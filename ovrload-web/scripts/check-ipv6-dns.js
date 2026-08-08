import dns from 'dns/promises';

async function checkIpv6() {
  try {
    const addrs = await dns.resolve6('db.nigtjaiwnmjdnmjtdlof.supabase.co');
    console.log('IPv6 address found:', addrs);
  } catch (err) {
    console.log('IPv6 resolve error:', err.code);
  }
}

checkIpv6();
