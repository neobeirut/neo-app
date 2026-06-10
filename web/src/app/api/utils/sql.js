import postgres from 'postgres';

const NullishQueryFunction = () => {
  throw new Error(
    'No database connection string was provided. Please configure DATABASE_URL in your environment variables.'
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error(
    'No database connection string was provided. Please configure DATABASE_URL in your environment variables.'
  );
};

// LazyQuery wraps query execution so that queries are only run when awaited
// or executed together inside a transaction block.
class LazyQuery {
  constructor(db, stringsOrQuery, values) {
    this.db = db;
    this.stringsOrQuery = stringsOrQuery;
    this.values = values;
  }

  async then(onfulfilled, onrejected) {
    try {
      let result;
      if (typeof this.stringsOrQuery === 'string') {
        result = await this.db.unsafe(this.stringsOrQuery, this.values);
      } else {
        result = await this.db(this.stringsOrQuery, ...this.values);
      }
      return onfulfilled ? onfulfilled(result) : result;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }
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
