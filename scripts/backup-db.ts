import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

/** A consistent SQLite snapshot, including committed WAL data, before any import. */
export function backupDatabase(path = 'data/chartbook.db') {
  mkdirSync('data/backups', { recursive: true });
  const destination = `data/backups/chartbook-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const db = new DatabaseSync(path, { readOnly: true });
  try { db.exec(`VACUUM INTO '${destination}'`); } finally { db.close(); }
  const check = new DatabaseSync(destination, { readOnly: true });
  try {
    if (check.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Database backup failed its integrity check.');
  } finally { check.close(); }
  console.log(`Database backup: ${destination}`);
  return destination;
}
