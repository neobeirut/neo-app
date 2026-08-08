import postgres from 'postgres';

const projectRef = 'nigtjaiwnmjdnmjtdlof';
const pass = 'FsDdHJhoYDv1GsxW';

const hosts = [
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-ap-southeast-2.pooler.supabase.com',
  'aws-0-me-central-1.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com',
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com'
];

async function testPoolers() {
  for (const host of hosts) {
    for (const port of [6543, 5432]) {
      const url = `postgresql://postgres.${projectRef}:${pass}@${host}:${port}/postgres`;
      console.log(`Connecting to ${host}:${port}...`);
      const sql = postgres(url, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 5
      });

      try {
        const res = await sql`SELECT 1 as connected;`;
        console.log(`\n🎉 SUCCESS! Connected to Supabase via ${host}:${port}`);
        console.log(`Database URL:\n${url}`);
        await sql.end();
        return url;
      } catch (err) {
        console.log(`❌ [${host}:${port}] -> ${err.message}`);
      } finally {
        await sql.end().catch(() => {});
      }
    }
  }
}

testPoolers();
