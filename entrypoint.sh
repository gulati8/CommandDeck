#!/bin/bash
set -e

# --- SSH setup ---
# If SSH keys are mounted (e.g., /home/commanddeck/.ssh), ensure known_hosts exists
SSH_DIR="$HOME/.ssh"
if [ -d "$SSH_DIR" ]; then
  if [ ! -f "$SSH_DIR/known_hosts" ] || ! grep -q "github.com" "$SSH_DIR/known_hosts" 2>/dev/null; then
    # Add GitHub's SSH host keys (safe — these are public)
    ssh-keyscan -t ed25519,rsa github.com >> "$SSH_DIR/known_hosts" 2>/dev/null || true
  fi
  chmod 700 "$SSH_DIR" 2>/dev/null || true
  chmod 600 "$SSH_DIR"/* 2>/dev/null || true
fi

# --- GitHub CLI auth ---
# If GH_TOKEN is set, authenticate gh CLI automatically
if [ -n "$GH_TOKEN" ]; then
  echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null || true
  echo "[entrypoint] gh CLI authenticated via GH_TOKEN"
fi

# --- Git config ---
# Set default git identity if not already configured
git config --global user.name "CommandDeck" 2>/dev/null || true
git config --global user.email "commanddeck@gulatilabs.me" 2>/dev/null || true

exec "$@"
