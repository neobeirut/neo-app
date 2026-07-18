const { createHmac } = require('crypto');

const AUTH_SECRET = 'f7ea89d42bb27ad8949826a798150aee';

function base64UrlEncode(input) {
  const raw = Buffer.from(String(input), 'utf8').toString('base64');
  return raw.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signAdminTokenPayload(payloadB64, secret) {
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64');
  return sig.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createAdminToken(adminUserId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    admin_user_id: Number(adminUserId),
    iat: now,
    exp: now + 3600 * 24 * 30
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signAdminTokenPayload(payloadB64, AUTH_SECRET);
  return `${payloadB64}.${sig}`;
}

async function test() {
  const token = createAdminToken(2); // HQ admin
  const url = 'https://gregarious-curiosity-production-653f.up.railway.app/api/admin/whatsapp-inbox/conversations';
  try {
    const res = await fetch(url, {
      headers: {
        'x-admin-token': token
      }
    });
    const data = await res.json();
    const target = data.conversations.find(c => c.phone === '9613361515');
    console.log('Live Server Conversation:', target);
  } catch (err) {
    console.error(err);
  }
}
test();
