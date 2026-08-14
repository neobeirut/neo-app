import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';

// Automatic local .env loader fallback if DATABASE_URL is not yet in process.env
if (!process.env.DATABASE_URL) {
  try {
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'ovrload-web/.env'),
      path.resolve(process.cwd(), '../.env'),
    ];
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...val] = trimmed.split('=');
            const k = key.trim();
            let v = val.join('=').trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    }
  } catch (e) {}
}

let sql;

if (process.env.DATABASE_URL) {
  // Create connection pool to Supabase
  const db = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: false }, 
  });

  sql = (stringsOrQuery, ...values) => {
    let finalValues = values;
    if (typeof stringsOrQuery === 'string' && values.length === 1 && Array.isArray(values[0])) {
      finalValues = values[0];
    }
    return new LazyQuery(db, stringsOrQuery, finalValues);
  };

  sql.unsafe = (stringsOrQuery, ...values) => {
    return sql(stringsOrQuery, ...values);
  };

  sql.transaction = async (queriesOrFn) => {
    return await db.begin(async (txn) => {
      // Local transaction wrapper passing queries directly to txn connection
      const txnWrapper = (stringsOrQuery, ...values) => {
        let finalValues = values;
        if (typeof stringsOrQuery === 'string' && values.length === 1 && Array.isArray(values[0])) {
          finalValues = values[0];
        }
        return new LazyQuery(txn, stringsOrQuery, finalValues);
      };

      if (typeof queriesOrFn === 'function') {
        const result = await queriesOrFn(txnWrapper);
        if (Array.isArray(result)) {
          const outputs = [];
          for (const query of result) {
            if (query instanceof LazyQuery) {
              outputs.push(await new LazyQuery(txn, query.stringsOrQuery, query.values));
            } else {
              outputs.push(await query);
            }
          }
          return outputs;
        }
        return result;
      } else if (Array.isArray(queriesOrFn)) {
        const outputs = [];
        for (const query of queriesOrFn) {
          if (query instanceof LazyQuery) {
            outputs.push(await new LazyQuery(txn, query.stringsOrQuery, query.values));
          } else {
            outputs.push(await query);
          }
        }
        return outputs;
      }
    });
  };
} else {
  sql = NullishQueryFunction;
}

export default sql;
