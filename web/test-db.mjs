import postgres from 'postgres';

const sql = postgres('postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres');

async function test() {
  try {
    const phone = '9611234567';
    console.log('Testing resolveUserId query...');
    const user = await sql`
      SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${phone} AND is_active = true ORDER BY id DESC LIMIT 1
    `;
    console.log('User:', user);
    
    const userId = "2";
    const branchId = "1";
    console.log('Testing cart query...');
    const cartItems = await sql`
      SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.unit_price,
        ci.notes as comment,
        p.name,
        p.inventory_applies,
        p.status,
        COALESCE(pbs.price, p.price) as price,
        pbs.quantity_on_hand,
        p.image_url,
        p.description,
        json_agg(
          DISTINCT jsonb_build_object(
            'addon_id', pa.id,
            'name', pa.name,
            'price', pa.price
          )
        ) FILTER (WHERE pa.id IS NOT NULL) as addons
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_branch_status pbs 
        ON p.id = pbs.product_id AND (${branchId ? Number(branchId) : null}::int IS NULL OR pbs.branch_id = ${branchId ? Number(branchId) : null}::int)
      LEFT JOIN cart_item_addons cia ON ci.id = cia.cart_item_id
      LEFT JOIN product_addons pa ON cia.addon_id = pa.id
      WHERE ci.user_id = ${String(userId)}
      GROUP BY ci.id, p.id, pbs.price, pbs.quantity_on_hand
      ORDER BY ci.id DESC
    `;
    console.log('Cart Items count:', cartItems.length);
  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await sql.end();
  }
}
test();
