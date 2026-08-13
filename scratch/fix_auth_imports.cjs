const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceInDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('from "@/auth"') || content.includes("from '@/auth'")) {
        console.log('Updating:', fullPath);
        content = content.replace(/from ["']@\/auth["']/g, 'from "@/auth.js"');
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

replaceInDir('C:\\Users\\fredd\\.gemini\\antigravity\\scratch\\neo-web-admin\\src');
replaceInDir('C:\\Users\\fredd\\.gemini\\antigravity\\scratch\\neo-web-admin\\web\\src');
console.log('Done replacing @/auth imports in both root src and web/src!');
