# Contributing to agentic-squad-framework

Thanks for helping improve this project. This guide describes how to propose changes and what we expect in pull requests.

## Development setup

This repository is currently documentation-only scaffolding and does not yet define a build system (**TODO**).

Minimum requirements:

- Git
- A local editor
- (**TODO**) Runtime/tooling once the implementation language is selected (e.g., Node.js, Python, Go, Rust)

Steps:

1) Fork the repository
2) Clone your fork:
   - `git clone https://github.com/<you>/agentic-squad-framework.git`
3) Create a branch:
   - `git checkout -b <type>/<short-description>`

## Branching and PR workflow

- Keep PRs focused: one change, one purpose.
- Prefer small PRs that are easy to review.
- Use draft PRs if you want early feedback.

PR expectations:

- Describe the problem and the approach.
- Include screenshots for doc rendering changes when helpful.
- Update docs alongside behavior changes.
- Add or update tests when tests exist (**TODO**).

## Commit conventions

Use Conventional Commits:

- `feat: ...` new behavior
- `fix: ...` bug fix
- `docs: ...` documentation-only change
- `chore: ...` maintenance, tooling
- `refactor: ...` refactor without behavior change
- `test: ...` tests only

Examples:

- `docs: add architecture overview`
- `feat: add squad runner skeleton` (**TODO** once code exists)

## Running checks/tests

No automated checks are defined yet (**TODO**).

When an implementation is added, this section should document:

- How to run unit tests
- How to run lint/format
- How to run end-to-end or integration tests

## Proposing changes

Best ways to contribute:

- Clarify terminology and fill in **TODO** markers in docs
- Add minimal runnable examples once an API exists (**TODO**)
- Open issues for design proposals and trade-offs
- Follow Soft-Verify for terminology: if you introduce a new term in docs or agent specs, add it to `docs/reference/terminology-glossary.md` or reuse an existing term; glossary updates are encouraged but do not block reviews.

Before submitting a large change:

- Open an issue describing the problem and proposal
- Call out API/UX impacts and backwards compatibility concerns

## Code of Conduct

This project uses the Contributor Covenant. See `CODE_OF_CONDUCT.md`.
