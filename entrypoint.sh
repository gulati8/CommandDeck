#!/bin/bash
set -e

# --- SSH setup ---
# Host SSH key is mounted read-only at /tmp/host-ssh-key. Copy to writable location
# and configure git to use it.
GIT_SSH_DIR="$HOME/.git-ssh"
HOST_KEY="/tmp/host-ssh-key"

if [ -f "$HOST_KEY" ]; then
  mkdir -p "$GIT_SSH_DIR"
  cp "$HOST_KEY" "$GIT_SSH_DIR/id_ed25519"
  chmod 700 "$GIT_SSH_DIR"
  chmod 600 "$GIT_SSH_DIR/id_ed25519"

  # Add GitHub SSH host keys
  ssh-keyscan -t ed25519,rsa github.com > "$GIT_SSH_DIR/known_hosts" 2>/dev/null || true

  # Configure git to use these
  git config --global core.sshCommand "ssh -i $GIT_SSH_DIR/id_ed25519 -o UserKnownHostsFile=$GIT_SSH_DIR/known_hosts -o StrictHostKeyChecking=yes"
  echo "[entrypoint] SSH configured (key: id_ed25519)"
fi

# --- GitHub CLI auth ---
if [ -n "$GH_TOKEN" ]; then
  echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null || true
  echo "[entrypoint] gh CLI authenticated via GH_TOKEN"
fi

# --- Git config ---
git config --global user.name "CommandDeck" 2>/dev/null || true
git config --global user.email "commanddeck@gulatilabs.me" 2>/dev/null || true

exec "$@"
