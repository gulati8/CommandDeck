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

# Function to update .gitignore with orchestrator exclusions
update_gitignore() {
    local target_dir="$1"
    local gitignore_file="$target_dir/.gitignore"

    # Entries to add (full ignore of orchestrator system)
    local entries=(
        ".claude/"
    )

    # Create .gitignore if it doesn't exist
    if [ ! -f "$gitignore_file" ]; then
        echo -e "   ${BLUE}Creating .gitignore...${NC}"
        touch "$gitignore_file"
    fi

    # Track if we need to add entries
    local needs_header=false
    local additions=""

    # Check each entry and add if missing
    for entry in "${entries[@]}"; do
        # Check if entry already exists (exact match or pattern match)
        if ! grep -Fxq "$entry" "$gitignore_file" 2>/dev/null; then
            if [ "$needs_header" = false ]; then
                # Add header comment before first entry
                # Only add newline if file is not empty
                if [ -s "$gitignore_file" ]; then
                    additions+=$'\n'
                fi
                additions+="# CommandDeck orchestrator system"$'\n'
                needs_header=true
            fi
            additions+="$entry"$'\n'
        fi
    done

    # Append new entries if any were found
    if [ "$needs_header" = true ]; then
        echo -n "$additions" >> "$gitignore_file"
        echo -e "   ${GREEN}✓${NC} Updated .gitignore (ignoring .claude/)"
    else
        echo -e "   ${GREEN}✓${NC} .gitignore already contains orchestrator exclusions"
    fi
}

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
            BACKUP_DIR="$TARGET_DIR/tmp"
            BACKUP_NAME="claude.backup.$(date +%Y%m%d_%H%M%S)"
            mkdir -p "$BACKUP_DIR"
            echo -e "${BLUE}Creating backup: $BACKUP_DIR/$BACKUP_NAME${NC}"
            mv "$TARGET_DIR/.claude" "$BACKUP_DIR/$BACKUP_NAME"
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

# Copy/refresh BridgeCrew structure (preserve state/logs)
echo -e "${BLUE}📁 Installing orchestrator system...${NC}"
mkdir -p "$TARGET_DIR/.claude"
rsync -a --delete \
  --exclude "state" \
  --exclude "logs" \
  "$BRIDGECREW_DIR/" "$TARGET_DIR/.claude/"
echo -e "   ${GREEN}✓${NC} Synced .claude directory (preserved state/logs)"

# Ensure CLAUDE.md references the orchestrator instructions
if [ -f "$TARGET_DIR/.claude/ORCHESTRATOR.md" ]; then
    CLAUDE_FILE="$TARGET_DIR/CLAUDE.md"
    ORCH_BLOCK_START="# CommandDeck Orchestrator"
    ORCH_BLOCK_END="# End CommandDeck Orchestrator"
    ORCH_BLOCK_CONTENT="$ORCH_BLOCK_START

Follow the orchestration instructions in:
- .claude/ORCHESTRATOR.md

$ORCH_BLOCK_END"

    if [ ! -f "$CLAUDE_FILE" ]; then
        echo "$ORCH_BLOCK_CONTENT" > "$CLAUDE_FILE"
        echo -e "   ${GREEN}✓${NC} Created CLAUDE.md (orchestrator reference)"
    else
        if ! grep -q "$ORCH_BLOCK_START" "$CLAUDE_FILE"; then
            printf "\n%s\n" "$ORCH_BLOCK_CONTENT" >> "$CLAUDE_FILE"
            echo -e "   ${GREEN}✓${NC} Appended orchestrator reference to CLAUDE.md"
        else
            echo -e "   ${GREEN}✓${NC} CLAUDE.md already references ORCHESTRATOR.md"
        fi
    fi
fi

# Create empty state and logs if they don't exist
mkdir -p "$TARGET_DIR/.claude/state"
mkdir -p "$TARGET_DIR/.claude/logs"
touch "$TARGET_DIR/.claude/logs/orchestration.jsonl"
echo -e "   ${GREEN}✓${NC} Initialized state and log directories"

# Update .gitignore to exclude orchestrator files
update_gitignore "$TARGET_DIR"

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo -e "${BLUE}📊 Installed:${NC}"
echo "   • Core agents + packs (installed by default)"
echo "   • Workflow commands (/project:feature, /project:bugfix, /project:refactor, /project:plan, /project:review, /project:quickfix, /project:lite-feature, /project:lite-bugfix, etc.)"
echo "   • State management utilities"
echo "   • Skills and templates"
echo ""
echo -e "${BLUE}🚀 Usage:${NC}"
echo "   cd $TARGET_DIR"
echo "   claude"
echo "   /project:feature <description>"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   • CLAUDE.md - Project instructions with orchestrator reference"
echo "   • .claude/agents/ - Agent definitions"
echo "   • .claude/commands/ - Workflow commands"
echo ""
echo -e "${BLUE}🔌 Optional MCP Setup:${NC}"
echo "   • Playwright MCP manifest: .claude/mcp.manifest.json"
echo "   • Install Playwright MCP plugin in Claude Code:"
echo "     /plugin install playwright@claude-plugins-official"
echo ""
