#!/bin/bash
#
# Set up a new git worktree workspace
#
# This script:
#   1. Copies .env files from the main project
#   2. Checks if the workspace is up to date with origin/main
#
# Usage:
#   ./scripts/workspace-setup.sh           # Skip existing files
#   ./scripts/workspace-setup.sh --force   # Overwrite existing files
#

set -e

# Parse arguments
FORCE=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE=true ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the main project directory from git worktree
GITDIR=$(cat .git 2>/dev/null | sed 's/gitdir: //')
if [ -z "$GITDIR" ]; then
    echo -e "${RED}Error: Not in a git worktree${NC}"
    echo "This script should be run from a Conductor workspace (git worktree)"
    exit 1
fi

# Extract main project path (remove .git/worktrees/<name> suffix)
MAIN_PROJECT=$(echo "$GITDIR" | sed 's|/.git/worktrees/.*||')

if [ ! -d "$MAIN_PROJECT" ]; then
    echo -e "${RED}Error: Could not find main project at $MAIN_PROJECT${NC}"
    exit 1
fi

echo "Main project: $MAIN_PROJECT"
echo "Workspace: $(pwd)"
echo ""

# Copy .env files
echo "Copying .env files..."
ENV_FILES=".env.local .env.local.supabase .env.test.local"
COPIED=0
SKIPPED=0

for file in $ENV_FILES; do
    if [ -f "$MAIN_PROJECT/$file" ]; then
        EXISTS=false
        [ -f "$file" ] && EXISTS=true

        if [ "$EXISTS" = true ] && [ "$FORCE" = false ]; then
            echo -e "  ${YELLOW}$file${NC} (already exists, skipping)"
            ((SKIPPED++))
        else
            cp "$MAIN_PROJECT/$file" "$file"
            if [ "$EXISTS" = true ]; then
                echo -e "  ${GREEN}$file${NC} (overwritten)"
            else
                echo -e "  ${GREEN}$file${NC} (copied)"
            fi
            ((COPIED++))
        fi
    else
        echo -e "  ${YELLOW}$file${NC} (not found in main project)"
    fi
done

echo ""
echo "Copied $COPIED file(s), skipped $SKIPPED existing file(s)"
echo ""

# Check if up to date with origin/main
echo "Checking sync status with origin/main..."
git fetch origin main --quiet 2>/dev/null || {
    echo -e "${YELLOW}Warning: Could not fetch from origin${NC}"
    exit 0
}

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MERGE_BASE=$(git merge-base HEAD origin/main 2>/dev/null)
ORIGIN_MAIN=$(git rev-parse origin/main 2>/dev/null)

if [ "$MERGE_BASE" != "$ORIGIN_MAIN" ]; then
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
    echo -e "${YELLOW}Warning: Branch '$CURRENT_BRANCH' is $BEHIND commit(s) behind origin/main${NC}"
    echo ""
    echo "To update, you can run:"
    echo "  git rebase origin/main"
    echo "  # or"
    echo "  git merge origin/main"
else
    echo -e "${GREEN}Branch '$CURRENT_BRANCH' is up to date with origin/main${NC}"
fi

echo ""
echo "Setup complete!"
