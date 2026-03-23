---
name: upstream-merge
description: >
  Merge updates from an upstream Git repository into a forked downstream project, cherry-pick
  specific commits, or pull commits from upstream pull requests that are not yet merged.
  Use this skill whenever the user mentions fork sync, upstream merge, pulling from
  agentscope-ai/CoPaw, cherry-picking upstream, importing a GitHub PR into their branch,
  git remote upstream, or staying current with upstream while maintaining a separate release.
---

# Upstream merge (fork maintenance)

Help the user bring selected changes from **upstream** into their **downstream** fork without
throwing away local work. Prefer small, reviewable steps; never rewrite published history unless
they explicitly ask.

## Prerequisites

- Git working tree clean enough to merge or cherry-pick (stash or commit WIP first).
- Optional: `gh` (GitHub CLI) for listing PR commits and inspecting diffs without leaving the terminal.

## Concepts

| Goal                                    | Typical approach                                                 |
| --------------------------------------- | ---------------------------------------------------------------- |
| Broad sync with upstream default branch | Merge or rebase `upstream/<default-branch>` into current branch  |
| One upstream feature (commit range)     | `cherry-pick` the commits onto a branch cut from downstream      |
| Upstream PR not merged yet              | Fetch PR head as a local ref, then cherry-pick or merge that ref |

Default branch name may be `main` or `master`. Resolve with:

```bash
git remote show upstream | sed -n '/HEAD branch/s/.*: //p'
```

## 1. Ensure `upstream` remote exists

```bash
git remote -v
```

If missing:

```bash
git remote add upstream git@github.com:agentscope-ai/CoPaw.git
```

HTTPS is fine if the user prefers:

```bash
git remote add upstream https://github.com/agentscope-ai/CoPaw.git
```

## 2. Fetch upstream

```bash
git fetch upstream --prune
```

## 3. Merge upstream default branch (full sync)

From the branch that tracks downstream development (example: `main` or `local`):

```bash
git checkout <branch>
git merge upstream/<default-branch>
```

If the project policy is rebase instead:

```bash
git rebase upstream/<default-branch>
```

Resolve conflicts file by file, `git add`, then `git merge --continue` or `git rebase --continue`.
After a successful merge, run tests; only then push to **downstream** `origin`.

## 4. Cherry-pick specific upstream commits

List recent upstream commits (optional):

```bash
git log --oneline upstream/<default-branch> -n 30
```

Create a safety branch from downstream:

```bash
git checkout -b sync/upstream-<topic> <branch>
git cherry-pick <sha1>^..<sha2>   # inclusive range
# or single commit:
git cherry-pick <sha1>
```

If a pick fails, fix conflicts, `git add`, `git cherry-pick --continue`, or abort with
`git cherry-pick --abort`.

## 5. Pull commits from an upstream PR (not merged)

GitHub exposes PR heads as refs. Fetch PR number `N` into a local branch:

```bash
git fetch upstream pull/N/head:pr-upstream-N
```

Inspect:

```bash
git log --oneline pr-upstream-N -n 20
git diff <branch>...pr-upstream-N
```

Then either:

- **Cherry-pick** selected SHAs onto downstream, or
- **Merge** the PR branch once: `git merge pr-upstream-N` (creates a merge commit if not fast-forward).

Delete the local ref when done:

```bash
git branch -d pr-upstream-N
```

With **GitHub CLI** (repo explicit):

```bash
gh pr view N --repo agentscope-ai/CoPaw
gh pr diff N --repo agentscope-ai/CoPaw
```

See `references/github-pr.md` for edge cases (force-push, closed PRs).

## 6. Safety and hygiene

- Work on a **topic branch** (`sync/upstream-...`) before touching shared mainline.
- Do **not** run `git push --force` to shared branches unless the user asks.
- If upstream and downstream diverged heavily, prefer **cherry-pick** or **merge** of a
  bounded topic branch over blind wholesale merge.
- After integrating, suggest running the project test suite and a quick smoke check of
  areas touched by the conflict resolution.

## 7. When the user is unsure what to take

1. Ask which **upstream branch** and **time range** or **PR number**.
2. Show `git log --oneline` for that range and propose a minimal cherry-pick set.
3. If conflicts appear, summarize **which files** conflicted and why (rename, delete, or logic).

## Bundled resources

- `references/github-pr.md` — PR ref fetch, `gh` usage, and troubleshooting
