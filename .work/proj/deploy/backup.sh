#!/bin/sh
# ================================================================
#  Automatic database backup for MED School
#
#  Runs inside a tiny container. Every 24 hours it copies the live
#  SQLite database into  ./backups  on your machine, timestamped.
#  It keeps the most recent KEEP snapshots and deletes older ones.
#
#  Restore a backup: stop the stack, then copy a chosen file over
#  the live DB inside the medlab-data volume (see docs/راهنمای-استقرار.md).
# ================================================================

DB_FILE="/data/medlab.db"       # live database (mounted read-only)
BACKUP_DIR="/backups"
INTERVAL="${BACKUP_INTERVAL:-86400}"   # seconds between backups (default 24h)
KEEP="${BACKUP_KEEP:-14}"              # how many snapshots to keep

mkdir -p "$BACKUP_DIR"
echo "[backup] service started — interval=${INTERVAL}s, keep=${KEEP}"

while true; do
  if [ -f "$DB_FILE" ]; then
    STAMP=$(date +%Y-%m-%d_%H-%M-%S)
    OUT="$BACKUP_DIR/medlab_$STAMP.db"
    cp "$DB_FILE" "$OUT" 2>/dev/null && \
      echo "[backup] $(date) → saved $OUT" || \
      echo "[backup] $(date) → copy failed"

    # keep only the newest $KEEP files, delete the rest
    ls -1t "$BACKUP_DIR"/medlab_*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
      rm -f "$old" && echo "[backup] pruned old snapshot $old"
    done
  else
    echo "[backup] $(date) → database not found yet at $DB_FILE (skipping)"
  fi
  sleep "$INTERVAL"
done
