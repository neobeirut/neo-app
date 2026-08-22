import fs from 'fs';
import path from 'path';

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

const file = 'src/app/api/pos/whatsapp-latest-location/route.js';
const parts = getHonoPath(file);
const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
console.log('File:', file);
console.log('Hono Path:', honoPath);
console.log('Full API Route:', '/api' + honoPath);
