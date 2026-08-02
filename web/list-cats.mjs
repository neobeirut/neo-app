import postgres from 'postgres';
const sql = postgres('postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres');
async function getCategories() {
  const cats = await sql`SELECT * FROM categories`;
  console.log(cats.map(c => c.name));
  await sql.end();
}
getCategories();
