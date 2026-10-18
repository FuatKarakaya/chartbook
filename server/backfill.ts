// `npm run backfill`: re-download full history for every asset (the app does this by itself on first start).
import { openDb } from './db.ts';
import { updateAll } from './updater.ts';

await updateAll(openDb(), true);
