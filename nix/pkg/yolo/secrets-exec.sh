#!/usr/bin/env bash
# Runs INSIDE the bubblewrap sandbox as the command entrypoint, but only when
# secret session variables are configured (see yolo.sh / SECRET_FILE_ARGS).
#
# Loads the composed secrets file — one NAME=VALUE line per secret, bound
# read-only at the path in $YOLO_SECRETS_FILE — into the environment by
# exporting each line verbatim, then exec's the real command (its arguments).
# Exporting the line verbatim means the value is taken literally and never
# re-parsed by the shell, so no quoting/escaping is required. The store path of
# this script is reachable in the sandbox via the ro-bound /nix/store.
set -u

: "${YOLO_SECRETS_FILE:?must be set}"

while IFS= read -r line; do
  [[ -n "$line" ]] && export "$line"
done < "$YOLO_SECRETS_FILE"

exec "$@"
