#!/bin/bash
set -e

# CommandDeck - Orchestrator Installation Script
# Installs BridgeCrew orchestrator system into a target project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BRIDGECREW_DIR="$REPO_ROOT/BridgeCrew/.claude"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CommandDeck - Orchestrator Installation${NC}"
echo ""

# Determine target directory
if [ -z "$1" ]; then
    TARGET_DIR="$(pwd)"
    echo -e "${YELLOW}No target directory specified, using current directory${NC}"
else
    TARGET_DIR="$1"
    if [ ! -d "$TARGET_DIR" ]; then
        echo -e "${YELLOW}Target directory does not exist. Create it? (y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            mkdir -p "$TARGET_DIR"
        else
            echo "Installation cancelled."
            exit 1
        fi
    fi
fi

echo -e "Target: ${GREEN}$TARGET_DIR${NC}"
echo ""

# Check if .claude already exists
if [ -d "$TARGET_DIR/.claude" ]; then
    echo -e "${YELLOW}⚠️  .claude directory already exists in target.${NC}"
    echo "Do you want to:"
    echo "  1) Backup and replace"
    echo "  2) Merge (keep existing, add new)"
    echo "  3) Cancel"
    read -r choice

    case $choice in
        1)
            BACKUP_NAME=".claude.backup.$(date +%Y%m%d_%H%M%S)"
            echo -e "${BLUE}Creating backup: $BACKUP_NAME${NC}"
            mv "$TARGET_DIR/.claude" "$TARGET_DIR/$BACKUP_NAME"
            ;;
        2)
            echo -e "${BLUE}Merging with existing .claude directory...${NC}"
            ;;
        *)
            echo "Installation cancelled."
            exit 0
            ;;
    esac
fi

# Copy BridgeCrew structure
echo -e "${BLUE}📁 Installing orchestrator system...${NC}"
cp -r "$BRIDGECREW_DIR" "$TARGET_DIR/"
echo -e "   ${GREEN}✓${NC} Copied .claude directory structure"

# Rename PICARD.md to CLAUDE.md (the orchestrator instructions)
if [ -f "$TARGET_DIR/.claude/PICARD.md" ]; then
    mv "$TARGET_DIR/.claude/PICARD.md" "$TARGET_DIR/CLAUDE.md"
    echo -e "   ${GREEN}✓${NC} Created CLAUDE.md (orchestrator instructions)"
fi

# Create empty state and logs if they don't exist
mkdir -p "$TARGET_DIR/.claude/state"
mkdir -p "$TARGET_DIR/.claude/logs"
touch "$TARGET_DIR/.claude/logs/orchestration.jsonl"
echo -e "   ${GREEN}✓${NC} Initialized state and log directories"

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo -e "${BLUE}📊 Installed:${NC}"
echo "   • 10 specialized agents (researcher, planner, code-writer, etc.)"
echo "   • 7 workflow commands (/project:feature, /project:bugfix, etc.)"
echo "   • State management utilities"
echo "   • Skills and templates"
echo ""
echo -e "${BLUE}🚀 Usage:${NC}"
echo "   cd $TARGET_DIR"
echo "   claude"
echo "   /project:feature <description>"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   • CLAUDE.md - Orchestrator instructions (for Claude)"
echo "   • .claude/agents/ - Agent definitions"
echo "   • .claude/commands/ - Workflow commands"
echo ""
