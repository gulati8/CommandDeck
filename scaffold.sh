#!/usr/bin/env bash
# scaffold.sh — Set up a project for CommandDeck
# Usage: commanddeck scaffold org/repo-name
#    or: bash scaffold.sh org/repo-name
set -euo pipefail

REPO_FULL="${1:-}"
if [[ -z "$REPO_FULL" ]]; then
  echo "Usage: commanddeck scaffold <org/repo-name>"
  echo "   or: bash scaffold.sh <org/repo-name>"
  exit 1
fi

REPO_SLUG="$(basename "$REPO_FULL")"
STATE_DIR="${COMMANDDECK_STATE_DIR:-$HOME/.commanddeck}"
PROJECT_DIR="${COMMANDDECK_PROJECT_DIR:-$HOME/projects}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "🖖 Scaffolding project: $REPO_FULL"
echo ""

# --- 1. Clone repo ---
REPO_PATH="$PROJECT_DIR/$REPO_SLUG"
if [[ -d "$REPO_PATH" ]]; then
  ok "Repo already cloned at $REPO_PATH"
  cd "$REPO_PATH" && git pull --ff-only 2>/dev/null || true
else
  echo "Cloning $REPO_FULL..."
  git clone "git@github.com:${REPO_FULL}.git" "$REPO_PATH"
  ok "Cloned to $REPO_PATH"
fi

# --- 2. Create state directories ---
PROJECT_STATE="$STATE_DIR/projects/$REPO_SLUG"
mkdir -p "$PROJECT_STATE/directives"
ok "Created state: $PROJECT_STATE/"

# --- 3. Project config ---
if [[ ! -f "$PROJECT_STATE/config.json" ]]; then
  # Auto-detect project type
  cd "$REPO_PATH"
  DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@refs/remotes/origin/@@' || echo "main")

  # Detect test/lint/build commands
  TEST_CMD="echo 'no test command configured'"
  LINT_CMD="echo 'no lint command configured'"
  BUILD_CMD="echo 'no build command configured'"

  if [[ -f "package.json" ]]; then
    TEST_CMD=$(jq -r '.scripts.test // "npx jest"' package.json)
    LINT_CMD=$(jq -r '.scripts.lint // "npx eslint ."' package.json)
    BUILD_CMD=$(jq -r '.scripts.build // "echo no build"' package.json)
  elif [[ -f "Gemfile" ]]; then
    TEST_CMD="bundle exec rspec"
    LINT_CMD="bundle exec rubocop"
    BUILD_CMD="echo 'no build needed'"
  elif [[ -f "go.mod" ]]; then
    TEST_CMD="go test ./..."
    LINT_CMD="golangci-lint run"
    BUILD_CMD="go build ./..."
  elif [[ -f "requirements.txt" ]] || [[ -f "pyproject.toml" ]]; then
    TEST_CMD="pytest"
    LINT_CMD="ruff check ."
    BUILD_CMD="echo 'no build needed'"
  fi

  cat > "$PROJECT_STATE/config.json" <<EOF
{
  "repo": "$REPO_FULL",
  "default_branch": "$DEFAULT_BRANCH",
  "model_overrides": {
    "captain-picard": "claude-opus-4-6",
    "scotty": "claude-opus-4-6",
    "borg": "claude-sonnet-4-5-20250929",
    "obrien": "claude-sonnet-4-5-20250929"
  },
  "max_workers": 3,
  "test_command": "$TEST_CMD",
  "lint_command": "$LINT_CMD",
  "build_command": "$BUILD_CMD",
  "high_risk_patterns": {
    "ci-workflow": [".github/workflows/**"],
    "infra": ["infra/**", "terraform/**", "Dockerfile"],
    "migration": ["db/migrate/**", "prisma/migrations/**", "migrations/**"],
    "auth": ["**/auth/**", "**/security/**"],
    "dependency": ["package.json", "pnpm-lock.yaml", "Gemfile", "go.mod", "requirements.txt"]
  },
  "protected_paths": [".env", "config/secrets.yml"]
}
EOF
  ok "Created project config"
else
  ok "Project config exists"
fi

# --- 4. Copy agent definitions to repo ---
cd "$REPO_PATH"
if [[ ! -d ".claude/agents" ]]; then
  mkdir -p .claude/agents
  if [[ -d "$SCRIPT_DIR/agents" ]]; then
    cp "$SCRIPT_DIR/agents/"*.md .claude/agents/
    ok "Copied agent definitions to .claude/agents/"
  fi
else
  ok "Agent definitions already present in .claude/agents/"
fi

# --- 5. Hook configuration ---
if [[ ! -f ".claude/settings.json" ]]; then
  cp "$SCRIPT_DIR/settings.json" .claude/settings.json
  ok "Copied hooks configuration to .claude/settings.json"
else
  ok "Hooks configuration exists"
fi

# --- 6. CLAUDE.md ---
if [[ ! -f "CLAUDE.md" ]]; then
  cat > "CLAUDE.md" <<CLAUDEMD
# Project: $REPO_SLUG

## Overview
<!-- Describe the project here -->

## Tech Stack
<!-- List frameworks, languages, key dependencies -->

## Development
- Test: \`$TEST_CMD\`
- Lint: \`$LINT_CMD\`
- Build: \`$BUILD_CMD\`

## Architecture
See \`docs/adr/\` for architectural decision records.
CLAUDEMD
  ok "Created starter CLAUDE.md"
else
  ok "CLAUDE.md exists"
fi

# --- 7. ADR directory ---
mkdir -p docs/adr
ok "docs/adr/ ready"

# --- 8. Install dependencies ---
if [[ -f "package.json" ]] && [[ ! -d "node_modules" ]]; then
  echo "Installing project dependencies..."
  if command -v pnpm &>/dev/null; then
    pnpm install
  elif command -v yarn &>/dev/null; then
    yarn install
  else
    npm install
  fi
  ok "Dependencies installed"
fi

# --- 9. Register in channel map ---
echo ""
warn "To map a Slack channel to this repo, edit:"
warn "  $SCRIPT_DIR/channel-map.json"
warn "  Add: \"CHANNEL_ID\": \"$REPO_SLUG\""

# --- Done ---
echo ""
echo "🖖 Project $REPO_SLUG is ready for CommandDeck missions!"
echo ""
echo "Start a mission:"
echo "  commanddeck run $REPO_SLUG \"describe what to build\""
echo "  @CommandDeck in $REPO_SLUG describe what to build"
echo ""
