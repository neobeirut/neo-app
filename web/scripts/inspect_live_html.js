async function check() {
  const res = await fetch('https://ovrload-backend-production.up.railway.app/pos');
  const html = await res.text();
  const regex = /\/assets\/[a-zA-Z0-9_-]+\.js/g;
  const matches = html.match(regex) || [];
  console.log('Script files in live HTML:');
  console.log([...new Set(matches)]);
}
check();
