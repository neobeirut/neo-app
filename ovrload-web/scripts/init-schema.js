import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import Papa from 'papaparse';

// Read .env if DATABASE_URL not set in env
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync('./.env')) {
  const envContent = fs.readFileSync('./.env', 'utf-8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (match) {
    databaseUrl = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

if (!databaseUrl || databaseUrl.includes('YOUR_PASSWORD')) {
  console.error('❌ Please set your real DATABASE_URL (including password) in ovrload-web/.env before running this script.');
  process.exit(1);
}

// Find reference database folder containing CSV templates
const referenceDir = fs.existsSync('./database')
  ? './database'
  : fs.existsSync('../database')
    ? '../database'
    : fs.existsSync('../neo-app/database')
      ? '../neo-app/database'
      : null;

if (!referenceDir) {
  console.error('❌ Could not find reference database CSV folder.');
  process.exit(1);
}

console.log(`Connecting to Supabase Database...`);
const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

function inferColumnType(colName, sampleValues) {
  const cleanColName = colName.trim().toLowerCase();
  
  if (cleanColName.includes('phone') || cleanColName.includes('mobile')) {
    return 'TEXT';
  }

  if (cleanColName === 'id') {
    const allInt = sampleValues.every(val => val === null || val === undefined || val === '' || /^\d+$/.test(String(val).trim()));
    if (allInt && sampleValues.length > 0) {
      const outOfBounds = sampleValues.some(val => {
        const num = Number(String(val).trim());
        return num > 2147483647;
      });
      if (outOfBounds) return 'BIGINT PRIMARY KEY';
      return 'SERIAL PRIMARY KEY';
    }
    return 'TEXT PRIMARY KEY';
  }
  
  if (cleanColName.endsWith('_at') || cleanColName === 'date') return 'TIMESTAMP';
  if (cleanColName.endsWith('_id')) {
    const allInt = sampleValues.every(val => val === null || val === undefined || val === '' || /^\d+$/.test(String(val).trim()));
    if (allInt) {
      const outOfBounds = sampleValues.some(val => {
        const num = Number(String(val).trim());
        return num > 2147483647;
      });
      if (outOfBounds) return 'BIGINT';
      return 'INTEGER';
    }
  }

  let hasBoolean = false;
  let hasNumeric = false;
  let hasInteger = false;
  let hasBigInt = false;
  let hasText = false;

  for (const val of sampleValues) {
    if (val === null || val === undefined || val === '') continue;
    const strVal = String(val).trim().toLowerCase();
    if (strVal === 'true' || strVal === 'false') {
      hasBoolean = true;
    } else if (strVal.match(/^-?\d+$/)) {
      const num = Number(strVal);
      if (num > 2147483647 || num < -2147483648) {
        hasBigInt = true;
      } else {
        hasInteger = true;
      }
    } else if (strVal.match(/^-?\d+\.\d+$/)) {
      hasNumeric = true;
    } else {
      hasText = true;
    }
  }

  if (hasText) return 'TEXT';
  if (hasNumeric) return 'NUMERIC';
  if (hasBigInt) return 'BIGINT';
  if (hasInteger) return 'INTEGER';
  if (hasBoolean) return 'BOOLEAN';
  return 'TEXT';
}

async function createSchema() {
  console.log(`Reading CSV schemas from: ${referenceDir}`);
  const files = fs.readdirSync(referenceDir).filter(f => f.endsWith('.csv'));
  console.log(`Found ${files.length} CSV files to construct schema for.\n`);

  let count = 0;
  for (const file of files) {
    const table = file.replace('.csv', '').toLowerCase();
    const filePath = path.join(referenceDir, file);
    
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const headers = parsed.meta.fields ? parsed.meta.fields.map(h => h.trim()) : [];
    if (headers.length === 0) {
      console.log(`⚠️ Skipping ${file} (no headers found)`);
      continue;
    }

    const rows = parsed.data;
    const sampleSize = Math.min(rows.length, 20);
    const columnDefinitions = [];

    for (const header of headers) {
      const cleanHeader = header.toLowerCase().replace(/[\s-]+/g, '_');
      const sampleValues = rows.slice(0, sampleSize).map(r => r[header]);
      const inferredType = inferColumnType(cleanHeader, sampleValues);
      columnDefinitions.push(`"${cleanHeader}" ${inferredType}`);
    }

    const ddl = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${columnDefinitions.join(',\n  ')}\n);`;
    
    try {
      await sql.unsafe(ddl);
      console.log(`✅ Table "${table}" created successfully (${headers.length} columns).`);
      count++;
    } catch (err) {
      console.error(`❌ Failed to create table "${table}":`, err.message);
    }
  }

  console.log(`\n🎉 Successfully created ${count}/${files.length} database tables!`);
}

async function main() {
  try {
    await createSchema();
  } catch (err) {
    console.error('❌ Schema initialization failed:', err);
  } finally {
    await sql.end();
    console.log('Database connection closed.');
  }
}

main();
