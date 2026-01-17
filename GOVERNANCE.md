# Governance

This document describes how the project is maintained and how decisions are made.

## Roles

### Maintainers

Maintainers are responsible for:

- Reviewing and merging pull requests
- Triaging issues and moderating discussions
- Publishing releases and security patches
- Maintaining documentation accuracy

Maintainer expectations:

- Be responsive (within reasonable time) and transparent about availability
- Prefer small, reviewable changes over large rewrites
- Keep the project usable for external contributors

### Contributors

Contributors help by:

- Reporting bugs and proposing features via issues
- Submitting PRs that follow `CONTRIBUTING.md`
- Improving docs, examples, and tests

## Decision making

We use a lightweight consensus process:

- Most changes: “lazy consensus” (silence implies consent after review time)
- Disputed changes or API decisions: explicit maintainer approval required

When in doubt:

1) Open an issue describing the problem and proposal
2) Discuss trade-offs and alternatives
3) Capture the decision and rationale in the issue and/or docs

## Releases

Release process overview (**TODO** when implementation exists):

- Define release criteria (tests passing, docs updated)
- Decide version number following `docs/versioning.md`
- Update `CHANGELOG.md`
- Tag the release in git
- Publish release artifacts (package registry, container, etc.) (**TODO**)

## Project scope

The intended scope is to provide a minimal, composable framework for agent squads, plus documentation and examples. The exact supported runtimes, providers, and integrations are to be defined (**TODO**).

