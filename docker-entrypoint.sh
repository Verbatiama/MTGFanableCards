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
case "$1" in
  server) exec node src/server/index.js ;;
  cli) shift; exec node src/cli.js "$@" ;;
  *) exec "$@" ;;
esac
