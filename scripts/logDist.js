// logDist.js – run this before uploading the dist folder to verify its contents
const fs = require('fs');
const path = require('path');
const distPath = path.join(__dirname, '..', 'dist');

function listFiles(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listFiles(fullPath, `${prefix}${entry.name}/`));
    } else {
      files.push(`${prefix}${entry.name}`);
    }
  }
  return files;
}

if (!fs.existsSync(distPath)) {
  console.error('Dist folder not found at', distPath);
  process.exit(1);
}

const fileList = listFiles(distPath);
const log = `=== Dist folder snapshot (${new Date().toISOString()}) ===\n` + fileList.join('\n');
console.log(log);

// also write to a file inside dist for verification after upload
fs.writeFileSync(path.join(distPath, 'upload_log.txt'), log);
console.log('Wrote upload_log.txt in dist folder');
