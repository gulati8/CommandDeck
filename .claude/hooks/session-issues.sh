#!/bin/bash
# Fetch open GitHub issues at session start and present them

REPO=$(git config --get remote.origin.url 2>/dev/null | sed 's|.*github.com[:/]\(.*\)\.git$|\1|' | sed 's|.*github.com[:/]\(.*\)$|\1|')

if [ -z "$REPO" ]; then
  exit 0
fi

ISSUES=$(gh issue list --repo "$REPO" --state open --json number,title,labels --limit 20 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$ISSUES" ] || [ "$ISSUES" = "[]" ]; then
  exit 0
fi

echo "## Open Issues"
echo ""
echo "$ISSUES" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
if (!data.length) process.exit(0);
for (const i of data) {
  const labels = i.labels.map(l => l.name).join(', ');
  console.log('- #' + i.number + ' [' + labels + ']: ' + i.title);
}
"
echo ""
echo "Ask which issue to work on, or start a new task."
