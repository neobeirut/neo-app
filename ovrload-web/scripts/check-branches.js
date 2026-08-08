import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function checkAndAddBranch() {
  console.log('Checking branches table...');
  const branches = await sql`SELECT * FROM branches;`;
  console.log(`Current branches count: ${branches.length}`);

  if (branches.length === 0) {
    console.log('Adding default Ovrload Central Kitchen branch...');
    await sql`
      INSERT INTO branches (
        name, address, phone, is_active, display_order, 
        opening_time, closing_time, delivery_start_time, delivery_end_time, orders_active
      ) VALUES (
        'Ovrload Kitchen', 'Beirut, Lebanon', '+96170000000', true, 1,
        '09:00', '23:00', '09:00', '23:00', true
      );
    `;
    console.log('🎉 Default branch "Ovrload Kitchen" added to database!');
  }
  await sql.end();
}

checkAndAddBranch();
