import postgres from 'postgres';

const sql = postgres('postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: { rejectUnauthorized: false }
});

async function runQuery(query) {
  let cleanDigits = query.replace(/\D/g, "");
  if (cleanDigits.startsWith("00")) cleanDigits = cleanDigits.slice(2);
  if (cleanDigits.startsWith("0")) cleanDigits = cleanDigits.slice(1);
  if (cleanDigits.startsWith("961")) cleanDigits = cleanDigits.slice(3);
  const pattern = `%${query}%`;
  const digitPattern = cleanDigits ? `%${cleanDigits}%` : pattern;
  const last7 = cleanDigits.length >= 4 ? cleanDigits.slice(-7) : "";
  const last7Pattern = last7 ? `%${last7}%` : pattern;

  const rows = await sql`
    WITH raw_customers AS (
      SELECT 
        name as customer_name,
        phone as customer_phone,
        NULL as delivery_address
      FROM auth_users
      WHERE name ILIKE ${pattern} 
         OR phone ILIKE ${pattern} 
         OR phone ILIKE ${digitPattern}
         OR phone ILIKE ${last7Pattern}

      UNION ALL

      SELECT 
        customer_name,
        customer_phone,
        delivery_address
      FROM orders
      WHERE (customer_name ILIKE ${pattern} 
         OR customer_phone ILIKE ${pattern}
         OR customer_phone ILIKE ${digitPattern}
         OR customer_phone ILIKE ${last7Pattern})
        AND (customer_name IS NOT NULL AND customer_name != '')

      UNION ALL

      SELECT 
        'WhatsApp Customer' as customer_name,
        phone as customer_phone,
        COALESCE(latest_location_address, latest_location_url) as delivery_address
      FROM whatsapp_conversations
      WHERE (phone ILIKE ${pattern} 
         OR phone ILIKE ${digitPattern}
         OR phone ILIKE ${last7Pattern})
        AND (latest_location_lat IS NOT NULL OR latest_location_url IS NOT NULL)
    ),
    deduped AS (
      SELECT DISTINCT ON (RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(customer_phone, ''), customer_name), '[^0-9]', '', 'g'), 7))
        customer_name,
        customer_phone,
        delivery_address
      FROM raw_customers
      ORDER BY RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(customer_phone, ''), customer_name), '[^0-9]', '', 'g'), 7), 
               CASE WHEN customer_name != 'WhatsApp Customer' THEN 0 ELSE 1 END,
               delivery_address DESC NULLS LAST
    )
    SELECT 
      d.customer_name,
      d.customer_phone,
      d.delivery_address,
      wc.latest_location_lat::float as lat,
      wc.latest_location_lng::float as lng,
      wc.latest_location_address as address,
      wc.latest_location_url as url,
      wc.latest_location_at,
      EXTRACT(EPOCH FROM (NOW() - wc.latest_location_at)) / 60 as minutes_ago
    FROM deduped d
    LEFT JOIN whatsapp_conversations wc 
      ON (RIGHT(REGEXP_REPLACE(wc.phone, '[^0-9]', '', 'g'), 7) = RIGHT(REGEXP_REPLACE(d.customer_phone, '[^0-9]', '', 'g'), 7))
      AND (wc.latest_location_lat IS NOT NULL OR wc.latest_location_url IS NOT NULL)
    ORDER BY wc.latest_location_at DESC NULLS LAST
    LIMIT 10;
  `;

  console.log(`Results for "${query}":`, rows.length);
  console.table(rows);
  await sql.end();
}

runQuery('03361515');
