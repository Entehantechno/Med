#!/bin/sh
# ================================================================
#  Automatic database backup for MED School (R71)
#
#  Runs inside a tiny container. It does NOT copy the live database file.
#  The app writes its own verified snapshots into backups/ inside the data
#  volume (SQLite VACUUM INTO: a consistent copy that includes committed pages
#  still held in the -wal file). This script copies the newest of those
#  snapshots to  ./backups  on your machine, keeps the most recent KEEP files,
#  and deletes older ones.
#
#  Why not copy medlab.db directly: the database runs in WAL mode, so a plain
#  file copy can miss committed data that is still in medlab.db-wal.
#
#  Restore a backup: stop the stack, then copy a chosen file over the live DB
#  inside the medlab-data volume and delete medlab.db-wal and medlab.db-shm
#  (see docs/راهنمای-استقرار.md).
# ================================================================

SRC_DIR="/data/backups"                 # the app's snapshots (volume: medlab-data)
BACKUP_DIR="/backups"                   # host folder ./backups
INTERVAL="${BACKUP_INTERVAL:-86400}"    # seconds between checks (default 24h)
KEEP="${BACKUP_KEEP:-14}"               # how many copies to keep

mkdir -p "$BACKUP_DIR"
echo "[backup] service started — interval=${INTERVAL}s, keep=${KEEP}, source=${SRC_DIR}"

while true; do
  LATEST=$(ls -1t "$SRC_DIR"/medlab-*.db 2>/dev/null | head -n 1)
  if [ -n "$LATEST" ]; then
    NAME=$(basename "$LATEST")
    OUT="$BACKUP_DIR/$NAME"
    if [ -s "$OUT" ]; then
      echo "[backup] $(date) → $NAME already saved"
    elif cp "$LATEST" "$OUT.tmp" && [ -s "$OUT.tmp" ] && mv "$OUT.tmp" "$OUT"; then
      echo "[backup] $(date) → saved $OUT"
    else
      rm -f "$OUT.tmp"
      echo "[backup] $(date) → copy failed"
    fi

    # keep only the newest $KEEP copies, delete the rest
    ls -1t "$BACKUP_DIR"/medlab-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
      rm -f "$old" && echo "[backup] pruned old snapshot $old"
    done
  else
    echo "[backup] $(date) → no app snapshot yet in ${SRC_DIR} (the app writes one at start-up and then about once a day)"
  fi
  sleep "$INTERVAL"
done
