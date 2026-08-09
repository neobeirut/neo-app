import postgres from 'postgres';
const sql = postgres('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres');

async function insertTestUser() {
  try {
    const phone = '+9611234567';
    // Check if user exists
    let user = await sql`SELECT * FROM auth_users WHERE phone = ${phone}`;
    if (user.length === 0) {
      console.log('User does not exist, inserting...');
      user = await sql`
        INSERT INTO auth_users (phone, first_name, last_name, is_active, role)
        VALUES (${phone}, 'Test', 'User', true, 'customer')
        RETURNING *
      `;
    } else {
      console.log('User already exists, updating role and active status...');
      user = await sql`
        UPDATE auth_users SET is_active = true, role = 'customer'
        WHERE phone = ${phone}
        RETURNING *
      `;
    }
    console.log('User:', user[0]);
    
    // Check auth_codes table if there is a pin/code concept?
    // Wait, let's check how the code is verified in the backend.
  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await sql.end();
  }
}
insertTestUser();
