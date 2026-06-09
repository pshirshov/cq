# T337 SPIKE — Orphan-branch ledger storage without working-tree switches

**Goal:** assess whether the ledger (`docs/*.md`) can live on a SEPARATE git
branch rooted at the empty/zero commit (an *orphan* ref), under the hard
constraint that ledger writes must NOT switch the working tree to that branch.

**Verdict: FEASIBLE-WITH-CAVEATS.** The git-plumbing path is correct and proven;
the caveats are concurrency/locking and the integration with the existing cq
per-merge/per-archive `git add docs/` commit steps — both solvable, but they
define what a follow-up goal must implement.

PoC: `nix/pkg/cq-ledgers/debug/20260609-221530-orphan-ledger-poc.sh`
(run against a throwaway `/tmp` repo; never touches the cq repo).

---

## 1. The plumbing command sequence (proven, no checkout)

Per ledger write, using an ISOLATED scratch index (`GIT_INDEX_FILE` pointing at
a throwaway path) so the repo's real index — and thus `git status` / the working
tree — is never perturbed:

```sh
# 1. write the ledger file content as a blob into the object DB
blob=$(printf '%s' "$content" | git hash-object -w --stdin)

# 2. build a tree from an ISOLATED scratch index (real index untouched)
GIT_INDEX_FILE="$scratch" git update-index --add \
    --cacheinfo 100644 "$blob" "docs/tasks.md"
tree=$(GIT_INDEX_FILE="$scratch" git write-tree)

# 3. build a commit — ORPHAN on the first write (no -p), child thereafter
commit=$(git commit-tree "$tree" -m "ledger: <op>")          # orphan
commit=$(git commit-tree "$tree" -p "$parent" -m "ledger: <op>")  # advance

# 4. advance the orphan ref — NO checkout, NO working-tree mutation
git update-ref refs/heads/cq-ledger "$commit"
```

Notes on the chosen primitives:
- `git update-index --cacheinfo` into a scratch `GIT_INDEX_FILE` is preferred
  over `git mktree`/`git update-index --index-info` against the real index: it
  keeps the production index byte-identical and composes naturally for a
  multi-file tree (one `--cacheinfo` per `docs/*.md`). For nested paths
  (`docs/archive/<ledger>/<id>.md`) `update-index --cacheinfo` builds the
  subtrees automatically; raw `git mktree` would require manual recursive tree
  assembly.
- The orphan property is exactly "first `commit-tree` has no `-p`". No
  `git checkout --orphan` (which mutates the working tree/HEAD) is needed.

## 2. Captured before/after proof (byte-identical)

From the PoC run (real SHAs):

```
HEAD   before=9b6d6c0… after=9b6d6c0…          (unchanged)
ref    before=refs/heads/main after=refs/heads/main  (HEAD symref unchanged)
wtree  before=7c257c8f… after=7c257c8f…        (sha256 of all tracked files — identical)
index  before=010a3cf4… after=010a3cf4…        (git ls-files -s digest — identical)
status after porcelain=[]                       (clean working tree)
orphan branch head 70301c6 -> 33fb332           (advanced two commits)
round-1 commit has 1 rev-list field             (parentless — a true orphan)
```

The orphan ref advanced across two writes (`round 1` -> `round 2`) while the
main checkout's HEAD ref, working tree (byte digest), and index all stayed
identical and `git status` stayed clean. Read-back via
`git cat-file -p cq-ledger:docs/tasks.md` and `git show <sha>:docs/tasks.md`
returned the expected content WITHOUT any checkout.

## 3. Reads

Reads need NO checkout and NO working-tree file:
- current ledger: `git cat-file -p refs/heads/cq-ledger:docs/<ledger>.md`
  (or `git show cq-ledger:docs/<ledger>.md`).
- history / archive: walk the orphan ref's commit history
  (`git rev-list cq-ledger`, `git show <sha>:<path>`) — the ledger gains real
  git history "for free" (every write is a commit; `git log cq-ledger` is the
  audit trail, superseding the current single `chore(ledger)` squash commits).
- enumerate: `git ls-tree -r --name-only cq-ledger`.

This maps cleanly onto `FsLedgerStore.init()`'s "read every `<ledger>.md` and
parse" step — the source bytes would come from `git cat-file` instead of
`fs.readFile`. The `docs/.locks/`, `docs/.backup/`, and `docs/logs/` paths
(see §4) would NOT live on the orphan ref.

## 4. Concurrency / locking vs the FsLedgerStore lockfile model

Current model (`packages/ledger/src/store/{FsLedgerStore,lockfile}.ts`):
- Per-ledger `AsyncMutex` + advisory lockfile at `docs/.locks/<ledger>.lock`
  ({pid,hostname,startedAt}, O_CREAT|O_EXCL, stale-PID reclaim, bounded
  `LedgerBusyError` after 5 s). A global `__milestones__` lock serialises
  cross-ledger ops; multi-lock order is `__milestones__` then per-ledger
  alphabetic (deadlock-avoidance invariant).
- Writes are atomic-rename (`atomicWrite`) into `docs/<ledger>.md`.

Interaction with an orphan ref:
- **`update-ref` is NOT atomic against a concurrent read-modify-write.** The
  orphan model is read-modify-write (read current tree -> mutate one file ->
  `commit-tree` -> `update-ref`). Two writers that both read the same parent
  and both `update-ref` will lose one update (last-writer-wins). The existing
  AsyncMutex + lockfile critical section ALREADY serialises the cq in-process
  store against the long-lived cq-mcp child on one cwd (LOCK-D01), so within
  one host the existing lock discipline is sufficient IF the read-current-tree
  step happens INSIDE the held lock.
- **Compare-and-swap is available and should be used as defence in depth:**
  `git update-ref refs/heads/cq-ledger <new> <expected-old>` fails if the ref
  moved since the read. This gives an optimistic-concurrency check that the
  pure-filesystem `atomicWrite` cannot. A follow-up should wrap the
  read->commit->update-ref sequence in the existing per-ledger lock AND pass
  the expected-old SHA to `update-ref` so a lost update surfaces as an error
  rather than silent data loss.
- The advisory `docs/.locks/*.lock` files must NOT be committed to the orphan
  ref (they are pid-scoped, ephemeral). They stay on the real filesystem
  (gitignored), exactly as today. So the lockfile model is unchanged; only the
  *payload write* changes from `atomicWrite(file)` to
  `commit-tree`+`update-ref` under the same lock.
- The `.backup` reinit and divergence-detection logic operate on file bytes;
  they would need a git-object analogue (snapshot = tag/branch the current
  orphan head) but that is strictly simpler than file copying.

## 5. Interaction with the existing per-merge/per-archive cq git-commit steps

Today the cq commands commit the ledger ON THE WORKING BRANCH:
`nix/pkg/cq-assets/commands/cq/implement/advance.md` (lines ~409, ~510) and the
sibling plan/investigate commands run, after each merge/archive:

```sh
git add docs/   # ledgers.yaml + .locks + .backup are gitignored
git diff --cached --quiet -- docs/ || git commit -q -m "chore(ledger): …"
```

i.e. the ledger markdown is versioned as ordinary files on `main`/the feature
branch. An orphan-ref ledger would REPLACE these steps:
- `docs/*.md` would no longer be tracked on the working branch (add to
  `.gitignore`, or stop staging them). The `git add docs/` lines become
  `git update-ref` advances of the orphan branch — which the FsLedgerStore
  write path already performed at mutation time, so the COMMAND-LEVEL commit
  step could be dropped entirely (the ledger is committed continuously, per
  write, on the orphan ref).
- This is the principal upside: the ledger stops interleaving `chore(ledger):`
  commits into the code history of every feature branch and merge, eliminating
  ledger/working-branch merge conflicts on `docs/*.md`.
- The orphan ref must be PUSHED/FETCHED explicitly: `git push origin
  cq-ledger`, and it is NOT included in a default `git push` of the feature
  branch. CI/automation and the `/cq:*` commands would need an explicit
  push/fetch of `refs/heads/cq-ledger` (or a refspec). This is the main new
  operational surface.

## 6. Reflog / push-fetch / failure-mode edge cases

- **reflog:** `update-ref` writes a reflog entry for `refs/heads/cq-ledger`, so
  `git reflog cq-ledger` gives crash-recovery / undo. Good. But the loose
  orphan objects created by `hash-object -w` / `commit-tree` are unreferenced
  until `update-ref` lands; if the process dies between, those objects are
  orphaned (collected by `git gc`) — no corruption, just garbage. Acceptable.
- **push/fetch:** the orphan branch is a normal branch ref; `git push origin
  cq-ledger` and `git fetch origin cq-ledger:refs/heads/cq-ledger` work. A
  force-push hazard exists because last-writer-wins history rewrites are
  possible; recommend a non-fast-forward-protected ref and CAS update-ref.
- **clone:** a fresh clone gets the orphan branch only if it is a remote branch
  the clone fetches; a shallow/single-branch clone of the code branch will NOT
  have the ledger. Tooling must fetch it explicitly.
- **gc / worktree alternative:** a dedicated *linked* `git worktree add
  ../ledger-wt cq-ledger` is the other option — it CAN checkout the orphan
  branch in a separate directory without touching the main checkout, letting the
  store use ordinary `fs.readFile`/`atomicWrite` against that directory. It is
  simpler to integrate (no plumbing) but adds a second on-disk working tree to
  manage, a second lock domain, and a `git -C ../ledger-wt commit` per write.
  The pure-plumbing path keeps everything in one repo with no extra checkout and
  is the recommended primary approach; the linked-worktree path is the fallback
  if a future need to run arbitrary git tooling against the ledger tree arises.

## 7. Go / No-go recommendation

**GO, with caveats** — the core constraint (advance an orphan ref without a
working-tree switch) is proven. A follow-up goal, if pursued, must implement:

1. A `GitObjectLedgerBackend` behind the same `LedgerStore` write/read surface:
   read = `git cat-file -p <ref>:<path>`; write = blob -> scratch-index tree ->
   `commit-tree` -> CAS `update-ref refs/heads/<ledger-branch> <new> <old>`,
   all inside the EXISTING per-ledger AsyncMutex + lockfile critical section
   (lockfiles stay on the real FS, gitignored, unchanged).
2. Remove `docs/*.md` from working-branch tracking (`.gitignore`) and DELETE
   the per-merge/per-archive `git add docs/ … git commit "chore(ledger)"` steps
   from the `/cq:*` commands — the orphan ref is committed continuously per
   write.
3. Explicit push/fetch of `refs/heads/cq-ledger` wired into the cq commands /
   CI (refspec), with non-fast-forward protection.
4. A git-object analogue for `.backup`/divergence (tag the orphan head before a
   reinit) — strictly simpler than the current file-copy backup.
5. Keep the *linked-worktree* approach documented as the fallback.

**No-go triggers** (none observed in the spike, listed for completeness): if the
target environment forbids `commit-tree`/`update-ref` (e.g. a managed git host
that only exposes porcelain), or if continuous per-write commits prove too
chatty for the object DB (mitigate by `git gc`/squash-on-archive).
