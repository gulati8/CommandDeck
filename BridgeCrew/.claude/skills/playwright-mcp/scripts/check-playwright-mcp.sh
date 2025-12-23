#!/bin/bash
set -euo pipefail

PLUGIN_CONFIG="$HOME/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json"
INSTALLED_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"

if [ -f "$PLUGIN_CONFIG" ]; then
  echo "Playwright MCP plugin config found (marketplace cache)."
  echo "Config: $PLUGIN_CONFIG"
else
  echo "Playwright MCP plugin config not found in marketplace cache."
  echo "Use /plugin discover or /plugin install playwright@claude-plugins-official"
fi

if [ -f "$INSTALLED_PLUGINS" ] && grep -q '"playwright"' "$INSTALLED_PLUGINS"; then
  echo "Playwright plugin appears installed."
else
  echo "Playwright plugin not installed."
  echo "Run: /plugin install playwright@claude-plugins-official"
fi
