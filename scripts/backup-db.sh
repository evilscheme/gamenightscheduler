#!/bin/bash
#
# Backup cloud Supabase database to a local file
#
# Usage:
#   ./scripts/backup-db.sh                    # Uses DATABASE_URL from .env.local
#   ./scripts/backup-db.sh <connection_url>   # Uses provided connection URL
#
# The connection URL can be found in Supabase Dashboard > Settings > Database > Connection string (URI)
#

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Get database URL from argument or .env.local
if [ -n "$1" ]; then
    DATABASE_URL="$1"
else
    # Try to read from .env.local
    if [ -f .env.local ]; then
        DATABASE_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: No database URL provided"
    echo ""
    echo "Usage:"
    echo "  $0 <postgresql://connection_url>"
    echo ""
    echo "Or add DATABASE_URL to your .env.local file"
    echo ""
    echo "Find your connection URL in Supabase Dashboard:"
    echo "  Settings > Database > Connection string > URI"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Backing up database..."
echo "Output: $BACKUP_FILE"

# Run pg_dump
# --no-owner: Don't output commands to set ownership
# --no-acl: Don't output commands to set access privileges
# --clean: Output commands to DROP objects before creating them
# --if-exists: Use IF EXISTS when dropping objects
pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Show result
SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo ""
echo "Backup complete!"
echo "  File: $BACKUP_FILE"
echo "  Size: $SIZE"
