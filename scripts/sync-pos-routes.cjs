const fs = require('fs');
const path = require('path');

const distPosDir = path.join(__dirname, '../dist/new/pos');
const distWaiterDir = path.join(__dirname, '../dist/new/waiter');
const distKdsDir = path.join(__dirname, '../dist/new/kds');
const publicIconsDir = path.join(__dirname, '../public/icons');

const standardIcons = [
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
  { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
];

if (fs.existsSync(path.join(distPosDir, 'index.html'))) {
  const posHtml = fs.readFileSync(path.join(distPosDir, 'index.html'), 'utf8');

  // 1. Sync Waiter POS Route
  fs.mkdirSync(distWaiterDir, { recursive: true });
  const waiterHtml = posHtml
    .replace('/new/pos/manifest.json', '/new/waiter/manifest.json')
    .replace(/<title>.*?<\/title>/i, '<title>FLOW Waiter POS</title>');
  fs.writeFileSync(path.join(distWaiterDir, 'index.html'), waiterHtml);

  const waiterManifest = {
    id: '/new/waiter',
    name: 'FLOW Waiter POS',
    short_name: 'Waiter POS',
    description: 'FLOW Waiter Order & Table Management Terminal',
    start_url: '/new/waiter',
    scope: '/new/waiter',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#F5F6F4',
    theme_color: '#eb660c',
    categories: ['business', 'food', 'productivity'],
    icons: standardIcons
  };
  fs.writeFileSync(path.join(distWaiterDir, 'manifest.json'), JSON.stringify(waiterManifest, null, 2));

  // 2. Sync KDS Route
  fs.mkdirSync(distKdsDir, { recursive: true });
  const kdsHtml = posHtml
    .replace('/new/pos/manifest.json', '/new/kds/manifest.json')
    .replace(/<title>.*?<\/title>/i, '<title>FLOW KDS</title>');
  fs.writeFileSync(path.join(distKdsDir, 'index.html'), kdsHtml);

  const kdsManifest = {
    id: '/new/kds',
    name: 'FLOW KDS Kitchen Screen',
    short_name: 'FLOW KDS',
    description: 'FLOW Kitchen Display System Terminal',
    start_url: '/new/kds',
    scope: '/new/kds',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#1a1f1d',
    theme_color: '#eb660c',
    categories: ['business', 'food', 'productivity'],
    icons: standardIcons
  };
  fs.writeFileSync(path.join(distKdsDir, 'manifest.json'), JSON.stringify(kdsManifest, null, 2));

  // 3. Ensure static icon copies in waiter & kds dirs
  const iconFiles = ['icon-192x192.png', 'icon-512x512.png', 'maskable-icon-512x512.png', 'apple-touch-icon.png'];
  for (const f of iconFiles) {
    const src = path.join(publicIconsDir, f);
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, path.join(distWaiterDir, f));
        fs.copyFileSync(src, path.join(distKdsDir, f));
      } catch (e) {}
    }
  }

  console.log('✅ Synchronized Waiter & KDS entry points with dedicated PWA manifests and icons');
} else {
  console.warn('⚠️ Warning: dist/new/pos/index.html not found to sync');
}
