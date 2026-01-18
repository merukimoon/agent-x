# Task request (example)

## TaskRequest

- task_id: task-1234
- title: Review PR #42 for docs and config update
- goal: Ensure the PR is correct, compliant, and ready to merge

## Inputs (optional)

- name: pr_link
  kind: reference
  value: https://example.com/org/repo/pull/42
- name: diff_summary
  kind: text
  value: "Updates user onboarding docs and adds a new feature flag in config."

## Acceptance criteria (optional)

- [ ] Documentation is accurate and consistent with architecture and flows
- [ ] Feature flag default and rollout plan are documented
- [ ] Tests or quality gates cover the changed behavior
- [ ] No blocking security or license issues

## Constraints and policy notes

- Policy summary: No secrets may be copied into outputs; avoid storing proprietary code in artifacts.
- Privacy: Do not paste user data; use minimal excerpts.
- Allowed tools: Manual review only (no automated scans assumed).
