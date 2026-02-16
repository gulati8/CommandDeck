#!/usr/bin/env bash
set -euo pipefail

# CommandDeck local setup script
# Creates .env, authenticates Claude, and starts the bot

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

echo "🖖 CommandDeck Setup"
echo "===================="
echo ""

# Step 1: Check for .env
if [[ -f "$ENV_FILE" ]]; then
  echo "✅ .env file found"
  source "$ENV_FILE"
else
  echo "📝 Let's create your .env file."
  echo ""
  echo "   Paste each token and press Enter."
  echo ""

  read -rp "   SLACK_BOT_TOKEN (xoxb-...): " SLACK_BOT_TOKEN
  read -rp "   SLACK_APP_TOKEN (xapp-...): " SLACK_APP_TOKEN
  read -rp "   SLACK_SIGNING_SECRET: " SLACK_SIGNING_SECRET

  cat > "$ENV_FILE" <<EOF
SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN
SLACK_APP_TOKEN=$SLACK_APP_TOKEN
SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET
EOF

  echo ""
  echo "✅ .env file created"
fi

# Validate tokens are present
if [[ -z "${SLACK_BOT_TOKEN:-}" || -z "${SLACK_APP_TOKEN:-}" ]]; then
  echo "❌ Missing Slack tokens in .env. Please fill them in and re-run."
  exit 1
fi

echo ""
echo "🔐 Step 2: Claude Code authentication"
echo "   Starting a container to authenticate Claude..."
echo "   Run: claude \"say hello\" "
echo "   Complete the OAuth flow in your browser if prompted."
echo "   Then type 'exit' to continue."
echo ""

docker run --rm -it \
  --name commanddeck-setup \
  -v commanddeck-claude:/home/commanddeck/.claude \
  -v commanddeck-state:/home/commanddeck/.commanddeck \
  -v commanddeck-projects:/home/commanddeck/projects \
  commanddeck bash

echo ""
echo "🚀 Step 3: Starting CommandDeck"
echo ""

docker run -d \
  --name commanddeck \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -v commanddeck-claude:/home/commanddeck/.claude \
  -v commanddeck-state:/home/commanddeck/.commanddeck \
  -v commanddeck-projects:/home/commanddeck/projects \
  commanddeck

echo ""
echo "✅ CommandDeck is starting!"
echo ""
echo "   Check logs:  docker logs -f commanddeck"
echo "   Stop:        docker stop commanddeck"
echo "   Restart:     docker restart commanddeck"
echo ""
echo "   Go to Slack and send: @CommandDeck status"
echo ""
