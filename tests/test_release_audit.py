import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "generate_release_audit.py"


def run_git(repo, *args):
    return subprocess.run(
        ["git", *args], cwd=repo, check=True, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    ).stdout.strip()


class ReleaseAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        run_git(self.repo, "init", "-q")
        run_git(self.repo, "config", "user.name", "Audit Test")
        run_git(self.repo, "config", "user.email", "audit@example.invalid")
        (self.repo / "tracked.txt").write_text("initial\n", encoding="utf-8")
        run_git(self.repo, "add", "tracked.txt")
        run_git(self.repo, "commit", "-qm", "initial release")
        run_git(self.repo, "tag", "v1.0.0")
        (self.repo / "tracked.txt").write_text("updated\n", encoding="utf-8")
        run_git(self.repo, "commit", "-qam", "update tracked file")
        run_git(self.repo, "tag", "v1.1.0")

        fake_bin = self.root / "bin"
        fake_bin.mkdir()
        gh = fake_bin / "gh"
        gh.write_text(
            "#!/bin/sh\n"
            "printf '%s\\n' '{\"url\":\"https://example.invalid/release\","
            "\"author\":{\"login\":\"release-author\"},"
            "\"publishedAt\":\"2026-01-02T03:04:05Z\"}'\n",
            encoding="utf-8",
        )
        gh.chmod(0o755)
        self.env = os.environ.copy()
        self.env["PATH"] = str(fake_bin) + os.pathsep + self.env.get("PATH", "")
        self.env["GITHUB_REPOSITORY"] = "example/project"
        self.env["GITHUB_SERVER_URL"] = "https://github.com"
        self.env["GITHUB_RUN_ID"] = "1234"
        self.env["GITHUB_SHA"] = run_git(self.repo, "rev-parse", "HEAD")

    def tearDown(self):
        self.temp.cleanup()

    def execute(self, tag):
        output = self.root / "audit-output"
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--tag", tag, "--output-dir", str(output)],
            cwd=self.repo, env=self.env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        return result, output

    def test_release_range_and_github_metadata(self):
        result, output = self.execute("v1.1.0")
        self.assertEqual(result.returncode, 0, result.stderr)
        record = json.loads((output / "v1.1.0.json").read_text(encoding="utf-8"))
        self.assertEqual(record["commit_count"], 1)
        self.assertEqual(record["previous_tag"], "v1.0.0")
        self.assertIn("M\ttracked.txt", record["changed_paths"])
        self.assertEqual(record["release_url"], "https://example.invalid/release")
        self.assertEqual(record["release_author"], "release-author")
        self.assertEqual(record["publisher"], "release-author")
        self.assertEqual(record["published_at"], "2026-01-02T03:04:05Z")
        self.assertTrue((output / "v1.1.0.md").is_file())

    def test_first_release_without_previous_tag(self):
        result, output = self.execute("v1.0.0")
        self.assertEqual(result.returncode, 0, result.stderr)
        record = json.loads((output / "v1.0.0.json").read_text(encoding="utf-8"))
        self.assertIsNone(record["previous_tag"])
        self.assertGreaterEqual(record["commit_count"], 1)
        self.assertTrue(record["changed_paths"])

    def test_invalid_tag_fails_cleanly(self):
        result, _ = self.execute("not a valid tag")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Invalid Git tag", result.stderr)

    def test_slash_in_tag_uses_safe_output_filename(self):
        run_git(self.repo, "tag", "release/v1.2.0", "HEAD")
        result, output = self.execute("release/v1.2.0")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((output / "release__v1.2.0.json").is_file())


if __name__ == "__main__":
    unittest.main()
