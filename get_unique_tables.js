import fs from 'fs';

const content = fs.readFileSync('src/api/client.ts', 'utf8');
const regex = /\.from\('([^']+)'\)/g;
const tables = new Set();
let match;

while ((match = regex.exec(content)) !== null) {
  tables.add(match[1]);
}

console.log('Unique tables found in client.ts:', Array.from(tables).sort());
