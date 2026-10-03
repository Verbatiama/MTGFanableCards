#!/bin/sh
# `server` (the default) starts the web app; `cli ...` runs the command-line
# generator with the same data volume (D29); anything else runs as given.
set -e
case "$1" in
  server) exec node src/server/index.js ;;
  cli) shift; exec node src/cli.js "$@" ;;
  *) exec "$@" ;;
esac
