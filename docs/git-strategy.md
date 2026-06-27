# Git Strategy

This project uses a simple Git workflow for a solo developer working with Codex. The goal is to keep changes small, reviewable, and tied to one planned task at a time.

## Permanent Branch

- `main` is the only permanent branch.
- Do not create or use a `develop` branch.
- `main` should always represent the latest reviewed project state.
- Direct pushes to `main` should be avoided after the initial setup.
- All work after the initial commit should happen on task branches and be merged through pull requests.

## Task Branches

Every task should use its own branch.

Branch naming format:

```text
task/T000-git-strategy
task/T001-planning-docs
task/T002-repo-tooling
task/T003-auth-onboarding
```

Rules:

- Create one branch per task.
- Keep the branch scoped to the task ID and acceptance criteria.
- Do not mix unrelated implementation, refactoring, documentation, or tooling changes.
- If a task becomes too large, split it into a follow-up task instead of expanding the branch indefinitely.

Recommended flow:

```text
main
  -> task/T001-planning-docs
  -> pull request
  -> review
  -> squash merge into main
```

## Commit Strategy

Use Conventional Commits for all commit messages.

Examples:

```text
feat: add invoice creation form
fix: correct invoice status calculation
docs: add webhook processing plan
test: add payment reconciliation tests
chore: configure workspace scripts
refactor: simplify payment status mapper
style: format invoice table layout
ci: add pull request validation workflow
```

Commit rules:

- Commits must be focused and meaningful.
- Prefer small commits that explain one logical change.
- Avoid vague messages such as `update`, `changes`, `fix stuff`, or `misc`.
- Use `docs:` for project documentation changes.
- Use `chore:` for maintenance changes that do not alter product behavior.
- Use `refactor:` only when behavior is intentionally unchanged.

## Pull Request Strategy

Each task should be completed through a pull request into `main`.

PR title format:

```text
T001: Add product and technical planning docs
```

PR body should include:

- Summary
- Scope
- Screenshots, if UI changed
- Tests run
- Known issues
- Next task

PR rules:

- PRs should be small and task-scoped.
- PRs should not mix unrelated concerns.
- Prefer squash merge for clean history.
- The final squashed commit should use a Conventional Commit message.
- Before review, Codex must summarize files changed and commands run.
- If Codex made changes, the PR description should make clear what was generated, edited, or verified.

## Validation

Every PR should attempt to run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If these commands do not exist yet, the PR should state that they are not available yet and explain why. For example, early documentation-only tasks may not have a package manager, scripts, or application scaffold yet.

## Codex Execution Rules

Codex should work task-by-task from `docs/codex-task-board.md`.

Before making changes, Codex should identify:

- Current branch
- Task ID
- Files expected to change
- Whether application code is in scope

During implementation, Codex should:

- Keep changes aligned to the task scope.
- Avoid broad rewrites unless explicitly requested.
- Avoid creating files outside the requested task area.
- Avoid installing packages unless the task specifically requires tooling or dependencies.
- Preserve unrelated user changes.

Before PR review, Codex should summarize:

- Files changed
- Commands run
- Validation results
- Known gaps or unavailable checks
- Any assumptions made

This workflow is intentionally conservative to prevent large uncontrolled agent-generated changes.
