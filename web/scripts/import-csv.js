import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import Papa from 'papaparse';

// Get database url from environment
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

// Resolve database directory path
const databaseDir = fs.existsSync('./database')
  ? './database'
  : fs.existsSync('../database')
    ? '../database'
    : null;

console.log('Connecting to database...');
const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

function inferColumnType(colName, sampleValues) {
  const cleanColName = colName.trim().toLowerCase();
  
  // Phone numbers should always be TEXT to preserve leading zeros, plus signs, and prevent out-of-range issues
  if (cleanColName.includes('phone') || cleanColName.includes('mobile')) {
    return 'TEXT';
  }

  if (cleanColName === 'id') {
    const allInt = sampleValues.every(val => val === null || val === undefined || val === '' || /^\d+$/.test(String(val).trim()));
    if (allInt && sampleValues.length > 0) {
      // Check if any ID is out of bounds for 32-bit int
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
  return 'TEXT'; // Default fallback
}

async function importAll() {
  if (!databaseDir) {
    console.error(`❌ Database directory not found in current path or parent path.`);
    return;
  }

  console.log(`Using database folder: ${databaseDir}`);
  const files = fs.readdirSync(databaseDir).filter(f => f.endsWith('.csv'));
  console.log(`Found ${files.length} CSV files to import.`);

  for (const file of files) {
    const table = file.replace('.csv', '').toLowerCase();
    const filePath = path.join(databaseDir, file);
    
    console.log(`\n--------------------------------------------`);
    console.log(`📂 Processing ${file} -> table "${table}"...`);

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    if (rows.length === 0) {
      console.log(`ℹ️ Empty file ${file}, creating table with basic text structure...`);
      await sql.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
      await sql.unsafe(`CREATE TABLE "${table}" (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
      continue;
    }

    // Infer column types from all headers and sample rows (up to 20 rows)
    const headers = Object.keys(rows[0]).map(h => h.trim());
    const columnDefinitions = [];
    const sampleSize = Math.min(rows.length, 20);
    
    for (const header of headers) {
      const cleanHeader = header.toLowerCase().replace(/[\s-]+/g, '_');
      const sampleValues = rows.slice(0, sampleSize).map(r => r[header]);
      const inferredType = inferColumnType(cleanHeader, sampleValues);
      columnDefinitions.push(`"${cleanHeader}" ${inferredType}`);
    }

    // Drop table first to avoid schema/column mismatch errors from previous runs
    console.log(`🗑️ Dropping existing table "${table}" (if any)...`);
    await sql.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`);

    const ddl = `CREATE TABLE "${table}" (\n  ${columnDefinitions.join(',\n  ')}\n);`;
    console.log(`🔨 Generating DDL:\n${ddl}`);
    
    // Create Table
    await sql.unsafe(ddl);

    // Batch Insert using postgres library native bulk insert (1 query per batch)
    const batchSize = 100;
    const cleanColumns = headers.map(h => h.toLowerCase().replace(/[\s-]+/g, '_'));

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const normalizedBatch = batch.map(row => {
        const normalizedRow = {};
        Object.entries(row).forEach(([colName, val]) => {
          const cleanColName = colName.trim().toLowerCase().replace(/[\s-]+/g, '_');
          
          let cleanVal = typeof val === 'string' ? val.trim() : val;
          if (cleanVal === '' || cleanVal === 'NULL' || cleanVal === undefined || cleanVal === null) {
            normalizedRow[cleanColName] = null;
          } else if (cleanVal.toLowerCase() === 'true') {
            normalizedRow[cleanColName] = true;
          } else if (cleanVal.toLowerCase() === 'false') {
            normalizedRow[cleanColName] = false;
          } else if (!isNaN(cleanVal) && cleanVal.match(/^-?\d+(\.\d+)?$/)) {
            normalizedRow[cleanColName] = Number(cleanVal);
          } else {
            normalizedRow[cleanColName] = cleanVal;
          }
        });
        return normalizedRow;
      });

      // Execute bulk insert in single DB round-trip
      await sql`
        INSERT INTO ${ sql(table) }
        ${ sql(normalizedBatch, cleanColumns) }
      `;
      
      console.log(`Inserted batch ${Math.min(i + batchSize, rows.length)}/${rows.length}...`);
    }

    // Reset SERIAL sequence if table has serial 'id'
    try {
      const seqCheck = await sql`SELECT pg_get_serial_sequence(${table}, 'id') as seq`;
      if (seqCheck[0] && seqCheck[0].seq) {
        const seq = seqCheck[0].seq;
        console.log(`🔄 Resetting sequence for "${table}" -> ${seq}...`);
        await sql.unsafe(`SELECT setval('${seq}', COALESCE(MAX(id), 1)) FROM "${table}";`);
      }
    } catch (seqError) {
      // Ignore sequence reset errors
    }

    console.log(`🎉 Imported "${table}" successfully!`);
  }

  console.log('\n🌟 All CSV tables imported successfully!');
}

async function main() {
  try {
    await importAll();
  } catch (err) {
    console.error('❌ Import run failed:', err);
  } finally {
    await sql.end();
    console.log('Database connection closed.');
  }
}

main();
