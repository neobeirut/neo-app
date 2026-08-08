import https from 'https';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node.js' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const host = 'www.neobeirut.com';
  console.log(`Fetching SSL Labs report with details for ${host}...`);
  try {
    const data = await getJSON(`https://api.ssllabs.com/api/v3/analyze?host=${host}&all=done&publish=off`);
    if (data.status !== 'READY') {
      console.log(`Status is ${data.status}. Please wait and try again.`);
      return;
    }
    const endpoint = data.endpoints[0];
    if (endpoint) {
      console.log(`Grade: ${endpoint.grade}`);
      console.log(`Has warnings: ${endpoint.hasWarnings}`);
      console.log(`Errors/Warnings detail:`, endpoint.statusDetails);
      console.log(`Details:`);
      if (endpoint.details && endpoint.details.chain) {
        console.log(`Chain issues code: ${endpoint.details.chain.issues}`);
        endpoint.details.chain.certs.forEach((cert, i) => {
          console.log(`Cert ${i}: ${cert.subject}`);
          console.log(`  Issuer: ${cert.issuer}`);
          console.log(`  Issues: ${cert.issues}`);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

main();
