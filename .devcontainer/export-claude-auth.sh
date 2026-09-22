#!/usr/bin/env bash
# Runs on the HOST machine (not in the container), before the dev container
# starts. It copies your current Claude Code session into a file outside
# this repo so the container can reuse it without a fresh browser login.
#
# On macOS, Claude Code normally stores credentials in the Keychain
# ("Claude Code-credentials"), which a Linux container cannot read directly,
# so we export that entry to a file. Nothing here is committed to git.
set -uo pipefail

AUTH_DIR="$HOME/.claude-devcontainer-auth"
mkdir -p "$AUTH_DIR"
chmod 700 "$AUTH_DIR"

if command -v security >/dev/null 2>&1 && \
   security find-generic-password -s "Claude Code-credentials" -w >/dev/null 2>&1; then
  security find-generic-password -s "Claude Code-credentials" -w > "$AUTH_DIR/.credentials.json"
  chmod 600 "$AUTH_DIR/.credentials.json"
elif [ -f "$HOME/.claude/.credentials.json" ]; then
  cp "$HOME/.claude/.credentials.json" "$AUTH_DIR/.credentials.json"
  chmod 600 "$AUTH_DIR/.credentials.json"
fi

if [ -f "$HOME/.claude.json" ]; then
  cp "$HOME/.claude.json" "$AUTH_DIR/.claude.json"
  chmod 600 "$AUTH_DIR/.claude.json"
fi

exit 0
