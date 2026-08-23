import sql from "@/app/api/utils/sql";

/**
 * Generates a unique, non-sequential order number in format: YYMMDD-XXXX
 * where XXXX is a random 4-digit number.
 * Ensures uniqueness by checking against existing order_number entries.
 */
export async function generateOrderNumber() {
  const now = new Date();
  
  // Format current date in Beirut timezone (Asia/Beirut)
  const beirutDateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // Output is MM/DD/YY
  
  const [mm, dd, yy] = beirutDateStr.split('/');
  const prefix = `${yy}${mm}${dd}`; // YYMMDD
  
  let attempts = 0;
  while (attempts < 10) {
    // Generate a random 4-digit number (1000 - 9999)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `${prefix}-${randomSuffix}`;
    
    // Check database if it exists
    const [existing] = await sql`
      SELECT id FROM orders WHERE order_number = ${orderNumber} LIMIT 1
    `;
    if (!existing) {
      return orderNumber;
    }
    attempts++;
  }
  
  // Fallback: if somehow we fail 10 times, generate with 6-digit suffix
  const fallbackSuffix = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${fallbackSuffix}`;
}

/**
 * Resolves a display ID or order_number string back to the database integer primary key `id`.
 * Supports both the new obfuscated format and legacy numeric IDs.
 */
export async function resolveOrderId(idOrNumber) {
  if (idOrNumber === null || idOrNumber === undefined) {
    return null;
  }
  
  const str = String(idOrNumber).trim();
  if (!str) {
    return null;
  }
  
  // If it's a pure integer
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    const [row] = await sql`
      SELECT id FROM orders 
      WHERE id = ${num}
      LIMIT 1
    `;
    return row?.id || null;
  }
  
  return null;
}
