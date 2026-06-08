#!/usr/bin/env bash
# Runs INSIDE the bubblewrap sandbox as the command entrypoint, when secret
# session variables and/or sandbox pre-start hooks are configured (see yolo.sh).
# It, in order:
#   1. loads the composed secrets file ($YOLO_SECRETS_FILE) — one NAME=VALUE
#      line per secret — into the env by exporting each line verbatim (the value
#      is taken literally, never re-parsed, so no quoting/escaping is required);
#   2. sources the composed sandbox pre-start hook script
#      ($YOLO_SANDBOX_HOOKS_FILE), so hooks run in this shell and any env they
#      set is inherited by the command;
#   3. exec's the real command (its arguments).
# Both files are bound read-only; their paths arrive via the env vars above.
# Either may be absent. The store path of this script is reachable in the
# sandbox via the ro-bound /nix/store.
set -u

if [ -n "${YOLO_SECRETS_FILE:-}" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && export "$line"
  done < "$YOLO_SECRETS_FILE"
fi

if [ -n "${YOLO_SANDBOX_HOOKS_FILE:-}" ]; then
  # shellcheck disable=SC1090
  . "$YOLO_SANDBOX_HOOKS_FILE"
fi

exec "$@"
