import https from 'https';

const url = 'https://www.neobeirut.com/delete-account';

const req = https.get(url, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Body length: ${data.length} bytes`);
    console.log(`First 200 chars of body:`);
    console.log(data.slice(0, 200));
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err);
});
