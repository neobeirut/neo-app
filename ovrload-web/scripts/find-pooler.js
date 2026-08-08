import postgres from 'postgres';

const projectRef = 'nigtjaiwnmjdnmjtdlof';
const pass = 'FsDdHJhoYDv1GsxW';

const poolerHosts = [
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com',
  'aws-0-eu-west-2.pooler.supabase.com',
  'aws-0-eu-west-3.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-us-east-2.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
  'aws-0-us-west-2.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-ap-southeast-2.pooler.supabase.com',
  'aws-0-ap-northeast-1.pooler.supabase.com',
  'aws-1-ap-northeast-2.pooler.supabase.com',
  'aws-0-ap-south-1.pooler.supabase.com',
  'aws-0-sa-east-1.pooler.supabase.com',
  'aws-0-ca-central-1.pooler.supabase.com',
  'aws-0-me-central-1.pooler.supabase.com',
  'aws-0-af-south-1.pooler.supabase.com'
];

async function findWorkingPooler() {
  console.log(`Scanning ports 6543 and 5432 across pooler hosts for project ${projectRef}...`);

  for (const host of poolerHosts) {
    for (const port of [6543, 5432]) {
      const dbUrl = `postgresql://postgres.${projectRef}:${pass}@${host}:${port}/postgres`;
      const sql = postgres(dbUrl, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 4
      });

      try {
        const result = await sql`SELECT 1 as connected;`;
        if (result && result[0] && result[0].connected === 1) {
          console.log(`\n🎉 MATCHING POOLER FOUND!`);
          console.log(`Host: ${host}:${port}`);
          console.log(`URL: ${dbUrl}`);
          await sql.end();
          return dbUrl;
        }
      } catch (err) {
        if (!err.message.includes('tenant/user')) {
          console.log(`\n[${host}:${port}] -> ${err.message}`);
        }
      } finally {
        await sql.end().catch(() => {});
      }
    }
  }
}

findWorkingPooler();
