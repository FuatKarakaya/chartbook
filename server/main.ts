import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { openDb } from './db.ts';
import { api } from './routes.ts';
import { startUpdater } from './updater.ts';

const db = openDb();
const app = new Hono().route('/api', api(db)).use('/*', serveStatic({ root: './dist/web' }));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`chartbook running at http://localhost:${info.port} (close this window to stop)`);
  startUpdater(db);
});
