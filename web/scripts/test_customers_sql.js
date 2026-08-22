import postgres from 'postgres';

const sql = postgres('postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: { rejectUnauthorized: false }
});

async function test(query) {
  const pattern = `%${query}%`;
  let rawDigits = query.replace(/\D/g, "");
  if (rawDigits.startsWith("00")) rawDigits = rawDigits.slice(2);
  if (rawDigits.startsWith("0")) rawDigits = rawDigits.slice(1);
  if (rawDigits.startsWith("961")) rawDigits = rawDigits.slice(3);
  const shortPattern = rawDigits.length >= 4 ? `%${rawDigits}%` : pattern;

  console.log({ query, pattern, rawDigits, shortPattern });

  const rows = await sql`
    WITH combined AS (
      SELECT 
        name as customer_name,
        phone as customer_phone,
        NULL as delivery_address,
        NULL::float as latest_location_lat,
        NULL::float as latest_location_lng,
        NULL as latest_location_address,
        NULL as latest_location_url,
        NULL::timestamp as latest_location_at
      FROM auth_users
      WHERE (name ILIKE ${pattern} OR phone ILIKE ${pattern} OR phone ILIKE ${shortPattern})

      UNION ALL

      SELECT 
        customer_name,
        customer_phone,
        delivery_address,
        NULL::float as latest_location_lat,
        NULL::float as latest_location_lng,
        NULL as latest_location_address,
        NULL as latest_location_url,
        NULL::timestamp as latest_location_at
      FROM orders
      WHERE (customer_name ILIKE ${pattern} OR customer_phone ILIKE ${pattern} OR customer_phone ILIKE ${shortPattern})
        AND (customer_name IS NOT NULL AND customer_name != '')

      UNION ALL

      SELECT 
        'WhatsApp Customer' as customer_name,
        phone as customer_phone,
        COALESCE(latest_location_address, latest_location_url) as delivery_address,
        latest_location_lat::float,
        latest_location_lng::float,
        latest_location_address,
        latest_location_url,
        latest_location_at
      FROM whatsapp_conversations
      WHERE (phone ILIKE ${pattern} OR phone ILIKE ${shortPattern})
        AND (latest_location_lat IS NOT NULL OR latest_location_url IS NOT NULL)
    )
    SELECT DISTINCT ON (LOWER(COALESCE(NULLIF(customer_phone, ''), customer_name)))
      customer_name,
      customer_phone,
      delivery_address,
      latest_location_lat,
      latest_location_lng,
      latest_location_address,
      latest_location_url,
      latest_location_at
    FROM combined
    ORDER BY LOWER(COALESCE(NULLIF(customer_phone, ''), customer_name)), latest_location_at DESC NULLS LAST, delivery_address DESC NULLS LAST
    LIMIT 10;
  `;

  console.log('Query result count:', rows.length);
  console.log(rows);
  await sql.end();
}

test('033361515');
