import postgres from 'postgres';
const sql = postgres('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres');
async function getCategories() {
  const cats = await sql`SELECT * FROM categories`;
  console.log(cats.map(c => c.name));
  await sql.end();
}
getCategories();
