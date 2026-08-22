import { Hono } from 'hono';

const app = new Hono();
app.get('/api/test', async (c) => {
  const rawUrl = c.req.raw.url;
  const parsed = new URL(rawUrl);
  return c.json({ rawUrl, q: parsed.searchParams.get('q') });
});

const req = new Request('http://localhost/api/test?q=03361515');
const res = await app.fetch(req);
console.log('Result:', await res.json());
