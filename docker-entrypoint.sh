#!/bin/sh
# `server` (the default) starts the web app; `cli ...` runs the command-line
# generator with the same data volume (D29); anything else runs as given.
set -e
# The heap needs room for a Scryfall refresh, when two card databases briefly
# coexist (~1.2 GB). Low-memory mode (T-S13) never holds two, so it fits in a
# smaller heap on a 1 GB server. A NODE_OPTIONS of your own wins.
case "$LOW_MEMORY" in
  true | 1) heap=768 ;;
  *) heap=1536 ;;
esac
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=$heap}"
# Frontend-render mode (T-S14): batches render in the browser, which still
# gets everything from this server. A misspelt value stops here, before the
# card data starts loading.
case "${FRONTEND_RENDER:-false}" in
  true | 1 | false | 0) ;;
  *) echo "FRONTEND_RENDER must be true or false: $FRONTEND_RENDER" >&2; exit 1 ;;
esac
case "$1" in
  server) exec node src/server/index.js ;;
  cli) shift; exec node src/cli.js "$@" ;;
  *) exec "$@" ;;
esac
