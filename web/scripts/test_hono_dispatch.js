import { Hono } from 'hono';

function getHonoPath(routeFile) {
  const relativePath = routeFile.replace('../src/app/api', '').replace('src/app/api', '').replace(/\\/g, '/');
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1);
  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  const transformedParts = routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

const api = new Hono();

// Test the path
const testFile = '../src/app/api/pos/whatsapp-latest-location/route.js';
const parts = getHonoPath(testFile);
const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
api.get(honoPath, (c) => c.text('OK'));

console.log('Registered honoPath on api:', honoPath);

// Simulate Hono routing with /api basename
const app = new Hono();
app.route('/api', api);

// Test fetch dispatch
const req = new Request('http://localhost/api/pos/whatsapp-latest-location?phone=03361515');
const res = await app.fetch(req);
console.log('App Fetch Status:', res.status);
console.log('App Fetch Body:', await res.text());
