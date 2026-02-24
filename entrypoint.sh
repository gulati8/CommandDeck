#!/bin/bash
set -e

# --- SSH setup ---
# SSH keys may be mounted read-only. Copy to a writable GIT_SSH dir and configure git to use it.
MOUNT_SSH="$HOME/.ssh"
GIT_SSH_DIR="$HOME/.git-ssh"

if [ -d "$MOUNT_SSH" ]; then
  mkdir -p "$GIT_SSH_DIR"

  # Copy key files
  for f in "$MOUNT_SSH"/id_*; do
    [ -f "$f" ] && cp "$f" "$GIT_SSH_DIR/"
  done

  # Copy existing known_hosts if available
  [ -f "$MOUNT_SSH/known_hosts" ] && cp "$MOUNT_SSH/known_hosts" "$GIT_SSH_DIR/known_hosts"

  # Add GitHub SSH host keys if not present
  if ! grep -q "github.com" "$GIT_SSH_DIR/known_hosts" 2>/dev/null; then
    ssh-keyscan -t ed25519,rsa github.com >> "$GIT_SSH_DIR/known_hosts" 2>/dev/null || true
  fi

  chmod 700 "$GIT_SSH_DIR"
  chmod 600 "$GIT_SSH_DIR"/* 2>/dev/null || true

  # Find the key to use (prefer ed25519)
  if [ -f "$GIT_SSH_DIR/id_ed25519" ]; then
    KEY_FILE="$GIT_SSH_DIR/id_ed25519"
  elif [ -f "$GIT_SSH_DIR/id_rsa" ]; then
    KEY_FILE="$GIT_SSH_DIR/id_rsa"
  fi

  if [ -n "$KEY_FILE" ]; then
    export GIT_SSH_COMMAND="ssh -i $KEY_FILE -o UserKnownHostsFile=$GIT_SSH_DIR/known_hosts -o StrictHostKeyChecking=yes"
    git config --global core.sshCommand "$GIT_SSH_COMMAND"
    echo "[entrypoint] SSH configured (key: $(basename $KEY_FILE))"
  fi
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
