import fs from 'fs';

const csvFilePath = 'C:/Users/fredd/.gemini/antigravity/brain/b74445f2-cfb0-4249-9f8b-4dd47ca133b5/.user_uploaded/media_1786813373430.csv';
const csvContent = fs.readFileSync(csvFilePath, 'utf8');

const PRODUCT_MAP = {
  "7Up": 16,
  "7up": 16,
  "Diet 7Up": 17,
  "Diet 7up": 17,
  "Almaza 330ml": 22,
  "Almaza light 330ml": 23,
  "Banoffee Load": 9,
  "Banoffee Ovrload": 11,
  "BBQ Dip": 26,
  "Beef Loaded Quesa": 6,
  "Beef Loaded Quesa • 550 G": 6,
  "Beef Loaded Quesa Meal": 3,
  "Beef Loaded Quesa Meal • 700 G": 3,
  "Caesar Dip": 24,
  "Caesar Loaded Wrap": 4,
  "Caesar Loaded Wrap • 800 G": 4,
  "Caesar Loaded Wrap Meal": 1,
  "Caesar Loaded Wrap Meal • 1 KG": 1,
  "Chicken Caesar Loaded Wrap": 4,
  "Chicken Caesar Loaded Wrap Meal": 1,
  "Chocolate Load": 8,
  "Chocolate Ovrload": 13,
  "Crispy Chicken Loaded Wrap": 5,
  "Crispy Chicken Loaded Wrap • 800 G": 5,
  "Crispy Chicken Loaded Wrap Meal": 2,
  "Crispy Chicken Loaded Wrap Meal • 1 KG": 2,
  "Diet Pepsi": 15,
  "French Fries": 7,
  "Fries": 7,
  "Honey Mustard Dip": 27,
  "Ice Tea Peach": 18,
  "Ice tea Peach": 18,
  "Ice tea Peach Zero": 19,
  "Ketchup": 28,
  "Mayo": 29,
  "Oreo Ovrload": 12,
  "OVRLoad Dip": 25,
  "Pepsi": 14,
  "Rim Sparkling Water": 20,
  "Rim Sparkling water": 20,
  "Soft Drinks": 14,
  "Vanilla Ovrload": 10,
  "Water": 21
};

const LBP_RATE = 89500;

function parseCSVLine(line) {
  const parts = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  return parts.map(p => p.replace(/^"|"$/g, '').trim());
}

const lines = csvContent.trim().split('\n');
const header = lines[0]; // Header line
const dataLines = lines.slice(1);

const orderMap = new Map();

for (const line of dataLines) {
  if (!line.trim()) continue;
  const cols = parseCSVLine(line);
  const internalId = cols[1];
  const createdAt = cols[2];
  const customerName = cols[3] || "";
  const paymentType = cols[5] === "card" || cols[5] === "Toters" ? "Toters" : "Cash";
  const itemName = cols[6];
  const qty = parseInt(cols[7], 10) || 1;
  const itemPriceLbp = parseFloat(cols[8]) || 0;
  const itemTotalLbp = parseFloat(cols[9]) || 0;
  const addons = cols[10] || "";
  const itemsTotalLbp = parseFloat(cols[12]) || 0;
  const deliveryChargeLbp = parseFloat(cols[13]) || 0;
  const discountLbp = parseFloat(cols[14]) || 0;
  const finalOrderTotalLbp = parseFloat(cols[15]) || 0;

  if (!orderMap.has(internalId)) {
    const subtotalUsd = parseFloat((itemsTotalLbp / LBP_RATE).toFixed(2));
    const deliveryUsd = parseFloat((deliveryChargeLbp / LBP_RATE).toFixed(2));
    const rawTotalUsd = subtotalUsd + deliveryUsd;

    // Apply 27.7% discount on the total invoice
    const discount277Amount = parseFloat((rawTotalUsd * 0.277).toFixed(2));
    const finalTotalWith277Discount = parseFloat((rawTotalUsd - discount277Amount).toFixed(2));

    orderMap.set(internalId, {
      branchId: 1,
      orderType: "delivery",
      orderSource: "Toters",
      paymentMethod: paymentType === "card" ? "Toters" : "Cash",
      customerName: customerName,
      customerPhone: "",
      deliveryAddress: "",
      specialInstructions: "Toters Import Ref #" + internalId,
      status: "completed",
      subtotal: subtotalUsd,
      deliveryFee: deliveryUsd,
      discountAmount: discount277Amount,
      total: finalTotalWith277Discount,
      created_at: createdAt,
      items: []
    });
  }

  const orderObj = orderMap.get(internalId);
  const productId = PRODUCT_MAP[itemName] || 1;
  const unitPriceUsd = parseFloat((itemPriceLbp / LBP_RATE).toFixed(2));

  orderObj.items.push({
    product_id: productId,
    quantity: qty,
    unit_price: unitPriceUsd,
    total_price: parseFloat((unitPriceUsd * qty).toFixed(2)),
    customizations: addons ? addons.split('|').map(s => s.trim()).join(', ') : null,
    comment: null
  });
}

const ordersList = Array.from(orderMap.values());
console.log(`Parsed ${ordersList.length} distinct orders with 27.7% Toters discount applied!`);
console.log('Sample parsed order:', JSON.stringify(ordersList[0], null, 2));

fs.writeFileSync('parsed_orders.json', JSON.stringify(ordersList, null, 2));
