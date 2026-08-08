import dns from 'dns/promises';

const ref = 'nigtjaiwnmjdnmjtdlof';

const candidates = [
  `db.${ref}.supabase.co`,
  `${ref}.supabase.co`,
  `pooler.supabase.com`,
  `aws-0-eu-central-1.pooler.supabase.com`,
  `aws-0-eu-west-1.pooler.supabase.com`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
  `aws-1-ap-northeast-2.pooler.supabase.com`,
  `db.${ref}.supabase.net`,
  `${ref}.supabase.net`
];

async function checkDns() {
  console.log('Resolving DNS candidates...');
  for (const host of candidates) {
    try {
      const addresses = await dns.resolve(host);
      console.log(`✅ [${host}] ->`, addresses);
    } catch (err) {
      console.log(`❌ [${host}] ->`, err.code);
    }
  }
}

checkDns();
