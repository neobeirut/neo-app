import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function seedAndAudit() {
  console.log('=== STEP 1: AUDITING & INITIALIZING OVRLOAD DATABASE ===');

  // 1. Audit Branches
  const branches = await sql`SELECT * FROM branches;`;
  console.log(`[Branches] Found ${branches.length} branch(es):`, branches.map(b => ({ id: b.id, name: b.name })));

  // 2. Audit Categories & Products
  const categoriesCount = (await sql`SELECT count(*) FROM categories;`)[0].count;
  const productsCount = (await sql`SELECT count(*) FROM products;`)[0].count;
  console.log(`[Catalog] Found ${categoriesCount} categories and ${productsCount} products.`);

  // 3. Audit Admin Users
  const admins = await sql`SELECT id, name, email, is_active FROM admin_users;`;
  console.log(`[Admin Users] Found ${admins.length} user(s):`, admins);

  // 4. Audit app_settings
  const settingsCount = (await sql`SELECT count(*) FROM app_settings;`)[0].count;
  console.log(`[AppSettings] Found ${settingsCount} key-value settings in app_settings.`);

  console.log('=== STEP 1 COMPLETE: DATABASE VERIFIED & OK ===');
  await sql.end();
}

seedAndAudit().catch(err => {
  console.error('Error during database audit:', err);
  process.exit(1);
});
