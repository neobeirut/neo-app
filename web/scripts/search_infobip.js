const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'node_modules' && f.name !== '.git' && f.name !== 'build') {
        search(full);
      }
    } else if (f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.json')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('INFOBIP') || content.includes('infobip')) {
        console.log('Found in:', full);
      }
    }
  }
}

search('./src/app/api');
