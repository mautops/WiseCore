# GitHub: upstream PR commits

## Fetch PR `N` from upstream

```bash
git fetch upstream pull/N/head:pr-upstream-N
```

This works for **open** PRs. **Merged** PRs are already on `upstream/<default-branch>`; prefer
`git log upstream/<default-branch>` and cherry-pick from there.

If the PR author **force-pushed**, fetch again; the ref `pull/N/head` always points to the
latest head of the PR.

## Compare PR to your branch

```bash
git diff your-branch...pr-upstream-N
git log --oneline your-branch..pr-upstream-N
```

## GitHub CLI

```bash
gh pr view N --repo agentscope-ai/CoPaw --json commits,files,title
gh pr checks N --repo agentscope-ai/CoPaw
```

Checkout PR branch into a new local branch (read-only mirror):

```bash
gh pr checkout N --repo agentscope-ai/CoPaw --branch pr-upstream-N
```

Then cherry-pick from `pr-upstream-N` as needed.

## Patches without adding a remote (rare)

If `fetch` is blocked but HTTPS is allowed:

```bash
curl -L https://github.com/agentscope-ai/CoPaw/pull/N.patch | git am
```

Use only when the user understands `git am` semantics (commit messages from the patch).

## Common failures

| Symptom                           | Likely cause                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `fatal: couldn't find remote ref` | Wrong PR number, or PR from a fork (still use `pull/N/head` on the **base** repo) |
| Cherry-pick conflicts             | Downstream already changed same lines; resolve manually                           |
| Empty diff                        | PR already merged; sync from `upstream/<default-branch>` instead                  |
