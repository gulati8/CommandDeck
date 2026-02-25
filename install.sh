#!/usr/bin/env bash
# install.sh — CommandDeck EC2 one-time setup
# Run on a fresh Ubuntu 24.04 instance (t3.xlarge recommended)
set -euo pipefail

echo "🖖 CommandDeck Installer"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

COMMANDDECK_HOME="${COMMANDDECK_HOME:-$HOME}"
STATE_DIR="$COMMANDDECK_HOME/.commanddeck"
PROJECT_DIR="$COMMANDDECK_HOME/projects"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- 1. System dependencies ---
echo ""
echo "Step 1: System dependencies"
echo "----------------------------"

if command -v node &>/dev/null && [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -ge 20 ]]; then
  ok "Node.js $(node -v) found"
else
  warn "Installing Node.js 20..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v brew &>/dev/null; then
    brew install node@20
  else
    err "Cannot install Node.js. Please install Node.js 20+ manually."
    exit 1
  fi
  ok "Node.js $(node -v) installed"
fi

if command -v git &>/dev/null; then
  ok "Git $(git --version | awk '{print $3}') found"
else
  err "Git not found. Please install Git 2.40+."
  exit 1
fi

if command -v jq &>/dev/null; then
  ok "jq found"
else
  warn "Installing jq..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y jq
  elif command -v brew &>/dev/null; then
    brew install jq
  fi
  ok "jq installed"
fi

if command -v gh &>/dev/null; then
  ok "GitHub CLI found"
else
  warn "Installing GitHub CLI..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt-get update && sudo apt-get install -y gh
  elif command -v brew &>/dev/null; then
    brew install gh
  fi
  ok "GitHub CLI installed"
fi

# --- 2. Claude Code ---
echo ""
echo "Step 2: Claude Code"
echo "--------------------"

if command -v claude &>/dev/null; then
  ok "Claude Code found"
else
  warn "Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
  ok "Claude Code installed"
fi

# --- 3. Quality tools ---
echo ""
echo "Step 3: Quality tools"
echo "----------------------"

# npm global tools
for tool in prettier eslint typescript; do
  if npx --yes "$tool" --version &>/dev/null 2>&1; then
    ok "$tool available"
  else
    npm install -g "$tool" 2>/dev/null || warn "Could not install $tool globally"
  fi
done

# Python tools (optional)
if command -v python3 &>/dev/null; then
  for tool in black isort ruff mypy; do
    if command -v "$tool" &>/dev/null; then
      ok "$tool found"
    else
      pip3 install "$tool" 2>/dev/null || warn "$tool not installed (optional)"
    fi
  done
else
  warn "Python 3 not found — Python quality tools skipped"
fi

# --- 4. State directory structure ---
echo ""
echo "Step 4: State directory"
echo "------------------------"

mkdir -p "$STATE_DIR"/{standards,crew,playbooks,proposed/{standards,crew,playbooks},projects,scripts}
mkdir -p "$PROJECT_DIR"
ok "Created $STATE_DIR/"
ok "Created $PROJECT_DIR/"

# --- 4b. Seed default content ---
if [[ -d "$SCRIPT_DIR/defaults" ]]; then
  for subdir in standards crew playbooks; do
    if [[ -d "$SCRIPT_DIR/defaults/$subdir" ]]; then
      for file in "$SCRIPT_DIR/defaults/$subdir"/*; do
        [[ -f "$file" ]] || continue
        dest="$STATE_DIR/$subdir/$(basename "$file")"
        if [[ ! -f "$dest" ]]; then
          cp "$file" "$dest"
        fi
      done
    fi
  done
  ok "Seeded default standards, crew preferences, and playbooks"
fi

# --- 5. Copy hook scripts ---
echo ""
echo "Step 5: Hook scripts"
echo "---------------------"

if [[ -d "$SCRIPT_DIR/hooks" ]]; then
  cp "$SCRIPT_DIR/hooks/"*.sh "$STATE_DIR/scripts/"
  chmod +x "$STATE_DIR/scripts/"*.sh
  ok "Copied hook scripts to $STATE_DIR/scripts/"
else
  err "hooks/ directory not found in $SCRIPT_DIR"
  exit 1
fi

# --- 6. Environment configuration ---
echo ""
echo "Step 6: Environment"
echo "--------------------"

ENV_FILE="$COMMANDDECK_HOME/.env"

if [[ -f "$ENV_FILE" ]]; then
  ok "Environment file exists at $ENV_FILE"
  warn "Review and update if needed"
else
  echo "Setting up environment variables..."
  echo ""

  # Anthropic API key
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    ok "ANTHROPIC_API_KEY already set in environment"
    ANTHRO_KEY="$ANTHROPIC_API_KEY"
  else
    read -rp "  Anthropic API key (sk-ant-...): " ANTHRO_KEY
  fi

  # Slack tokens
  echo ""
  echo "  Slack app setup:"
  echo "  1. Go to https://api.slack.com/apps"
  echo "  2. Create a new app from the manifest in the README"
  echo "  3. Install to your workspace"
  echo "  4. Copy the tokens below"
  echo ""

  if [[ -n "${SLACK_BOT_TOKEN:-}" ]]; then
    ok "SLACK_BOT_TOKEN already set"
    SLACK_BOT="$SLACK_BOT_TOKEN"
  else
    read -rp "  Slack Bot Token (xoxb-...): " SLACK_BOT
  fi

  if [[ -n "${SLACK_APP_TOKEN:-}" ]]; then
    ok "SLACK_APP_TOKEN already set"
    SLACK_APP="$SLACK_APP_TOKEN"
  else
    read -rp "  Slack App Token (xapp-...): " SLACK_APP
  fi

  if [[ -n "${SLACK_SIGNING_SECRET:-}" ]]; then
    ok "SLACK_SIGNING_SECRET already set"
    SLACK_SECRET="$SLACK_SIGNING_SECRET"
  else
    read -rp "  Slack Signing Secret: " SLACK_SECRET
  fi

  cat > "$ENV_FILE" <<EOF
# CommandDeck environment
ANTHROPIC_API_KEY=${ANTHRO_KEY}
SLACK_BOT_TOKEN=${SLACK_BOT}
SLACK_APP_TOKEN=${SLACK_APP}
SLACK_SIGNING_SECRET=${SLACK_SECRET}

# Optional overrides (defaults shown)
COMMANDDECK_MODEL=claude-opus-4-6
COMMANDDECK_MAX_WORKERS=3
COMMANDDECK_MAX_SESSIONS=50
COMMANDDECK_MAX_HOURS=6
COMMANDDECK_WORKER_TIMEOUT=2700000
COMMANDDECK_HEALTH_INTERVAL=120000
COMMANDDECK_PROJECT_DIR=${PROJECT_DIR}
COMMANDDECK_STATE_DIR=${STATE_DIR}
EOF

  chmod 600 "$ENV_FILE"
  ok "Environment file written to $ENV_FILE"
fi

# --- 7. Install CommandDeck npm dependencies ---
echo ""
echo "Step 7: npm dependencies"
echo "-------------------------"

cd "$SCRIPT_DIR"
npm install --production
ok "npm dependencies installed"

# --- 8. CLI symlink ---
echo ""
echo "Step 8: CLI setup"
echo "------------------"

chmod +x "$SCRIPT_DIR/cli.js"
if [[ -w /usr/local/bin ]]; then
  ln -sf "$SCRIPT_DIR/cli.js" /usr/local/bin/commanddeck
  ok "CLI linked: commanddeck → $SCRIPT_DIR/cli.js"
elif [[ -w "$HOME/.local/bin" ]] || mkdir -p "$HOME/.local/bin"; then
  ln -sf "$SCRIPT_DIR/cli.js" "$HOME/.local/bin/commanddeck"
  ok "CLI linked: ~/.local/bin/commanddeck → $SCRIPT_DIR/cli.js"
  warn "Make sure ~/.local/bin is in your PATH"
else
  warn "Could not create symlink. Run directly: node $SCRIPT_DIR/cli.js"
fi

# --- 9. systemd service (Linux only) ---
echo ""
echo "Step 9: systemd service"
echo "------------------------"

if command -v systemctl &>/dev/null; then
  CURRENT_USER=$(whoami)

  sudo tee /etc/systemd/system/commanddeck.service > /dev/null <<EOF
[Unit]
Description=CommandDeck Q
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${SCRIPT_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node q.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable commanddeck
  ok "systemd service created and enabled"

  read -rp "  Start CommandDeck now? [Y/n] " START_NOW
  if [[ "${START_NOW:-Y}" =~ ^[Yy]$ ]]; then
    sudo systemctl start commanddeck
    sleep 2
    if systemctl is-active --quiet commanddeck; then
      ok "CommandDeck Q is running!"
    else
      err "Service failed to start. Check: journalctl -u commanddeck -f"
    fi
  fi
else
  warn "systemd not found (macOS?). Start manually: node $SCRIPT_DIR/q.js"
  warn "Or use: source $ENV_FILE && node $SCRIPT_DIR/q.js"
fi

# --- Done ---
echo ""
echo "========================"
echo "🖖 CommandDeck installed!"
echo ""
echo "Next steps:"
echo "  1. Scaffold a project:  commanddeck scaffold org/repo-name"
echo "  2. Start a mission:     commanddeck run repo-name \"build a feature\""
echo "  3. Or from Slack:       @CommandDeck in repo-name build a feature"
echo ""
