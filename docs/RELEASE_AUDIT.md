# Release audit trail

Version: 1.0.0

This repository generates a Markdown and JSON audit record whenever a GitHub
Release is published. A maintainer can also run the workflow manually for an
existing tag.

## What is recorded

- Repository, release tag, and exact Git commit SHA.
- Previous tag and compare URL, when a previous tag exists.
- Commit SHAs, subjects, authors, and authored timestamps in the release range.
- Changed paths from the previous tag to this tag.
- GitHub release author, publisher, publication timestamp, and workflow run URL
  when those fields are available.

## Where records are stored

The workflow attaches `<tag>.md` and `<tag>.json` to the corresponding GitHub
Release and also uploads them as a 90-day Actions artifact. Existing release
assets with the same names are preserved on reruns rather than overwritten.

## Run manually

1. Open **Actions → Release audit**.
2. Select **Run workflow**.
3. Enter an existing Git tag such as `v1.2.3`.
4. Review the workflow result and the attached assets on that GitHub Release.

The workflow needs the repository's GitHub Actions token to have release-content
write permission. It does not publish to npm, deploy software, modify tags, or
change branch protection.

## Evidence limits

The report is a factual change inventory, not a security certification,
approval record, SBOM, provenance attestation, or proof of successful
deployment. It records Git and GitHub event metadata available to the workflow.
A user with release-management permissions can still delete release assets.
