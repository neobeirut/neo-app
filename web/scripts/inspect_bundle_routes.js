import fs from 'fs';

const files = fs.readdirSync('build/server/assets');
const indexFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
const code = fs.readFileSync(`build/server/assets/${indexFile}`, 'utf8');

const regex = /"(\.\.\/src\/app\/api\/[^"]+)"/g;
let m;
const found = [];
while ((m = regex.exec(code)) !== null) {
  found.push(m[1]);
}
console.log(`Glob routes in bundle (${found.length} routes):`);
console.log(found.filter(r => r.includes('pos')));
