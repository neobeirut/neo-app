import postgres from 'postgres';

const projectRef = 'nigtjaiwnmjdnmjtdlof';
const pass = 'FsDdHJhoYDv1GsxW';

// List of all Supabase regions
const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'sa-east-1',
  'ca-central-1',
  'me-central-1',
  'af-south-1'
];

async function scanAllPoolers() {
  console.log('Scanning all Supabase region poolers on port 6543...');

  for (const r of regions) {
    for (const prefix of ['aws-0', 'aws-1']) {
      const host = `${prefix}-${r}.pooler.supabase.com`;
      const url = `postgresql://postgres.${projectRef}:${pass}@${host}:6543/postgres`;

      const sql = postgres(url, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 3
      });

      try {
        const res = await sql`SELECT 1 as connected;`;
        if (res && res[0] && res[0].connected === 1) {
          console.log(`\n🎉 MATCH FOUND!`);
          console.log(`Region: ${r} (${prefix})`);
          console.log(`Connection URL:\n${url}`);
          await sql.end();
          return url;
        }
      } catch (err) {
        if (!err.message.includes('tenant/user') && !err.message.includes('ENOTFOUND')) {
          console.log(`\n[${host}] ->`, err.message);
        } else {
          process.stdout.write('.');
        }
      } finally {
        await sql.end().catch(() => {});
      }
    }
  }
  console.log('\nScan finished.');
}

scanAllPoolers();
