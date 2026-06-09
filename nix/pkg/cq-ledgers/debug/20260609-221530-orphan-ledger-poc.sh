#!/usr/bin/env bash
#
# T337 SPIKE PoC — store a ledger on an orphan git branch WITHOUT switching the
# working tree to it. Throwaway. Operates ENTIRELY in a fresh /tmp repo; never
# touches the cq repo. Prints PASS/FAIL proof that an orphan-ref commit advanced
# while the main checkout's HEAD ref AND working tree stayed byte-identical.
#
# Run:  bash nix/pkg/cq-ledgers/debug/20260609-221530-orphan-ledger-poc.sh
#
# Method (pure plumbing, NO `git checkout` / `git switch` / `git read-tree`
# against the working index):
#   1. git hash-object -w            -> write blob(s) to the object DB
#   2. git mktree (via printf'd ls-tree lines) -> build a tree object
#   3. git commit-tree               -> build a commit (orphan: no -p on first)
#   4. git update-ref refs/heads/<ledger-branch> <sha> -> advance the orphan ref
#   5. git cat-file -p <ref>:<path>  -> read back WITHOUT checkout
#
# All object-DB writes use a temporary, ISOLATED index file (GIT_INDEX_FILE
# pointing at a scratch path) so the repo's real index — and therefore the
# working tree status — is never perturbed.

set -euo pipefail

WORK="$(mktemp -d /tmp/orphan-ledger-poc.XXXXXX)"
LEDGER_BRANCH="cq-ledger"
LEDGER_PATH="docs/tasks.md"
trap 'rm -rf "$WORK"' EXIT

echo "== work repo: $WORK =="
git init -q "$WORK"
cd "$WORK"
git config user.email poc@example.com
git config user.name "poc"
git config commit.gpgsign false

# --- seed the main branch with a normal commit + working-tree file ----------
echo "real source file, must stay byte-identical" > src.txt
git add src.txt
git commit -q -m "main: initial"
MAIN_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# capture BEFORE state of the main checkout (HEAD ref + working tree + index)
HEAD_BEFORE="$(git rev-parse HEAD)"
HEADREF_BEFORE="$(git symbolic-ref HEAD)"
WT_BEFORE="$(find . -path ./.git -prune -o -type f -print | sort | xargs sha256sum | sha256sum)"
STATUS_BEFORE="$(git status --porcelain)"
INDEX_BEFORE="$(git ls-files -s | sha256sum)"

echo "-- BEFORE: HEAD=$HEAD_BEFORE ref=$HEADREF_BEFORE"

# ===========================================================================
# Round 1: create the orphan ledger branch (no parent) entirely via plumbing.
# ===========================================================================
SCRATCH_INDEX="$WORK/.git/poc-ledger-index"

write_ledger_commit () {
  # $1 = file content, $2 = commit message, $3 = parent sha (empty for orphan)
  local content="$1" msg="$2" parent="${3:-}"
  rm -f "$SCRATCH_INDEX"

  # 1. blob
  local blob
  blob="$(printf '%s' "$content" | git hash-object -w --stdin)"

  # 2. tree — build via an isolated index so the real index is untouched.
  #    update-index --add --cacheinfo <mode> <sha> <path> stages into the
  #    scratch index; write-tree serialises it to a tree object.
  GIT_INDEX_FILE="$SCRATCH_INDEX" git update-index --add \
    --cacheinfo 100644 "$blob" "$LEDGER_PATH"
  local tree
  tree="$(GIT_INDEX_FILE="$SCRATCH_INDEX" git write-tree)"

  # 3. commit-tree (orphan when $parent is empty)
  local commit
  if [ -z "$parent" ]; then
    commit="$(git commit-tree "$tree" -m "$msg")"
  else
    commit="$(git commit-tree "$tree" -p "$parent" -m "$msg")"
  fi

  # 4. advance the orphan ref — NO checkout, NO working-tree mutation.
  git update-ref "refs/heads/$LEDGER_BRANCH" "$commit"
  rm -f "$SCRATCH_INDEX"
  printf '%s' "$commit"
}

L1="$(write_ledger_commit $'# tasks\n\nT1 planned\n' "ledger: round 1" "")"
echo "-- orphan ref created: refs/heads/$LEDGER_BRANCH -> $L1"

# Round 2: advance the orphan ref with a child commit (still no checkout).
L2="$(write_ledger_commit $'# tasks\n\nT1 done\nT2 planned\n' "ledger: round 2" "$L1")"
echo "-- orphan ref advanced: refs/heads/$LEDGER_BRANCH -> $L2"

# --- read back the ledger WITHOUT checkout ---------------------------------
echo "-- read-back via 'git cat-file -p $LEDGER_BRANCH:$LEDGER_PATH':"
git cat-file -p "$LEDGER_BRANCH:$LEDGER_PATH" | sed 's/^/     | /'

echo "-- read-back via 'git show $LEDGER_BRANCH:$LEDGER_PATH' (round-1 parent):"
git show "$L1:$LEDGER_PATH" | sed 's/^/     | /'

# ledger history is real history (reflog + log) on the orphan ref:
echo "-- orphan ref log:"
git --no-pager log --oneline "$LEDGER_BRANCH" | sed 's/^/     | /'

# ===========================================================================
# capture AFTER state of the main checkout and compare
# ===========================================================================
HEAD_AFTER="$(git rev-parse HEAD)"
HEADREF_AFTER="$(git symbolic-ref HEAD)"
WT_AFTER="$(find . -path ./.git -prune -o -type f -print | sort | xargs sha256sum | sha256sum)"
STATUS_AFTER="$(git status --porcelain)"
INDEX_AFTER="$(git ls-files -s | sha256sum)"

echo
echo "== PROOF =="
echo "HEAD   before=$HEAD_BEFORE after=$HEAD_AFTER"
echo "ref    before=$HEADREF_BEFORE after=$HEADREF_AFTER"
echo "wtree  before=$WT_BEFORE"
echo "wtree  after =$WT_AFTER"
echo "index  before=$INDEX_BEFORE"
echo "index  after =$INDEX_AFTER"
echo "status after porcelain=[$STATUS_AFTER]"
echo "orphan branch head=$L2 (advanced from $L1; main untouched)"

fail=0
[ "$HEAD_BEFORE" = "$HEAD_AFTER" ]       || { echo "FAIL: HEAD moved";        fail=1; }
[ "$HEADREF_BEFORE" = "$HEADREF_AFTER" ] || { echo "FAIL: HEAD ref switched"; fail=1; }
[ "$WT_BEFORE" = "$WT_AFTER" ]           || { echo "FAIL: working tree changed"; fail=1; }
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ]     || { echo "FAIL: index changed";     fail=1; }
[ -z "$STATUS_AFTER" ]                   || { echo "FAIL: dirty working tree"; fail=1; }
[ "$L1" != "$L2" ]                       || { echo "FAIL: orphan ref did not advance"; fail=1; }
# confirm the orphan really is parentless (no shared history with main)
PARENTS_L1="$(git rev-list --parents -n1 "$L1" | wc -w)"
[ "$PARENTS_L1" -eq 1 ]                   || { echo "FAIL: round-1 commit is not an orphan"; fail=1; }

echo
if [ "$fail" -eq 0 ]; then
  echo "RESULT: PASS — orphan ref advanced $L1 -> $L2 while main HEAD + working tree + index stayed BYTE-IDENTICAL."
  exit 0
else
  echo "RESULT: FAIL — see messages above."
  exit 1
fi
