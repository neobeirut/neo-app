import dns from 'dns';
import postgres from 'postgres';

// Force Node.js to try IPv6 as well as IPv4
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('verbatim');
}

const dbUrl = 'postgresql://postgres:FsDdHJhoYDv1GsxW@db.nigtjaiwnmjdnmjtdlof.supabase.co:5432/postgres';

async function testDirectIpv6() {
  console.log('Testing direct Supabase connection with IPv6 enabled...');
  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    connect_timeout: 5
  });

  try {
    const result = await sql`SELECT 1 as connected;`;
    console.log('🎉 Direct connection successful!', result);
  } catch (err) {
    console.error('❌ Connection error:', err);
  } finally {
    await sql.end();
  }
}

testDirectIpv6();
