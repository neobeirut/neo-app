const fs = require('fs');
const path = require('path');

const distPosDir = path.join(__dirname, '../dist/new/pos');
const distWaiterDir = path.join(__dirname, '../dist/new/waiter');
const distKdsDir = path.join(__dirname, '../dist/new/kds');

if (fs.existsSync(path.join(distPosDir, 'index.html'))) {
  const posHtml = fs.readFileSync(path.join(distPosDir, 'index.html'), 'utf8');

  fs.mkdirSync(distWaiterDir, { recursive: true });
  fs.writeFileSync(path.join(distWaiterDir, 'index.html'), posHtml);

  fs.mkdirSync(distKdsDir, { recursive: true });
  fs.writeFileSync(path.join(distKdsDir, 'index.html'), posHtml);

  console.log('✅ Synchronized Waiter & KDS entry points to reuse single POS deployment bundle');
} else {
  console.warn('⚠️ Warning: dist/new/pos/index.html not found to sync');
}
