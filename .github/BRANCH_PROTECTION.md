# Branch protection and merge policy

## Observed repository state

Checked on 2026-11-22:
- The public branch metadata reports `main.protected=false`.
- The repository rulesets endpoint returned no rulesets.
- The branch-protection details endpoint returned HTTP 403 for the connected integration, so exact hidden settings could not be independently inspected.

This means the available evidence does **not** show an active protection rule for `main`. Repository administrators must verify and configure the settings in GitHub repository Settings.

## Recommended protection for `main`

Enable a branch ruleset or classic branch protection with:
1. Require a pull request before merging.
2. Require at least one approving review from someone other than the author.
3. Dismiss stale approvals when new commits are pushed.
4. Require approval of the most recent reviewable push.
5. Require conversation resolution.
6. Require these status checks: `Build, typecheck, security regression` and `Browser integration`.
7. Require branches to be up to date before merging.
8. Block force pushes and branch deletion.
9. Restrict direct pushes to maintainers / automation explicitly authorized by repository policy.

Set the allowed merge method to **Squash** (or keep other methods disabled if squash-only history is required).

## Squash merge runbook

Do not merge while the PR is Draft, while checks are pending/failing, or before the required approval is recorded.

After reviewer approval:
1. Re-fetch PR metadata and verify the head SHA has not changed since approval.
2. Verify both required checks are successful for that exact head SHA.
3. Verify all review conversations are resolved and the PR is mergeable.
4. Use **Squash and Merge** with a concise commit title and the PR summary as the body.
5. Verify the resulting merge commit is on `main`, then delete the feature branch if repository policy permits.

The repository integration used for this change cannot read branch-protection details (HTTP 403) or administer rulesets. Do not interpret this document as proof that the GitHub settings have been enabled.
