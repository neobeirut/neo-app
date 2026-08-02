async function testBranches() {
  try {
    const r = await fetch('https://ovrload-backend-production.up.railway.app/api/branches');
    console.log('Status:', r.status);
    const body = await r.json();
    console.log('Branches:', body.branches?.length ?? body);
  } catch(e) {
    console.error('Error:', e.message);
  }
}
testBranches();
