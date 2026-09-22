#!/usr/bin/env bash
# Runs INSIDE the container as the remote user, on every container start.
# Seeds the persisted ~/.claude volume with the session exported from the
# host by export-claude-auth.sh, so Claude Code (CLI and VS Code extension)
# comes up already signed in.
set -uo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CONFIG_DIR"

# Named volumes are owned by root on first creation; claim it for our user.
if [ "$(stat -c '%U' "$CONFIG_DIR")" != "$(whoami)" ]; then
  sudo chown -R "$(whoami)":"$(whoami)" "$CONFIG_DIR"
fi

if [ -f /tmp/host-claude-auth/.credentials.json ]; then
  cp /tmp/host-claude-auth/.credentials.json "$CONFIG_DIR/.credentials.json"
  chmod 600 "$CONFIG_DIR/.credentials.json"
fi

if [ -f /tmp/host-claude-auth/.claude.json ]; then
  cp /tmp/host-claude-auth/.claude.json "$CONFIG_DIR/.claude.json"
  chmod 600 "$CONFIG_DIR/.claude.json"
fi

exit 0
