import fs from 'fs';

const parsed = JSON.parse(fs.readFileSync('./parsed_orders.json', 'utf8'));

let lines = [
  'Internal Order ID,Order Date,Customer,Payment Type,Item Name,Quantity,Unit Price LBP,Item Total LBP,Add-ons,Subtotal LBP,Delivery Charge LBP,Discount LBP,Final Total LBP'
];

const itemNamesMap = {
  1: 'Chicken Caesar Loaded Wrap Meal',
  2: 'Crispy Chicken Loaded Wrap Meal',
  3: 'Beef Loaded Quesa Meal',
  4: 'Chicken Caesar Loaded Wrap',
  5: 'Crispy Chicken Loaded Wrap',
  6: 'Beef Loaded Quesa',
  7: 'French Fries',
  8: 'Chocolate Load',
  10: 'Strawberry Load',
  11: 'Banoffee Ovrload',
  12: 'Oreo Ovrload',
  13: 'Redbull',
  14: 'Soft Drinks',
  18: 'Laban',
  20: 'Rim Sparkling Water',
  24: 'Caesar Dip',
  25: 'OVRLoad Dip',
  26: 'BBQ Dip',
  27: 'Honey Mustard Dip',
  28: 'Truffle Dip',
  29: 'Garlic Dip'
};

for (const order of parsed) {
  const refNum = (order.specialInstructions || '').replace('Toters Import Ref #', '');
  for (const item of (order.items || [])) {
    const name = itemNamesMap[item.product_id] || ('Item ' + item.product_id);
    const unitLbp = Math.round((item.unit_price || 0) * 89500);
    const totalLbp = Math.round((item.total_price || 0) * 89500);
    const subtotalLbp = Math.round((order.subtotal || 0) * 89500);
    const deliveryLbp = Math.round((order.deliveryFee || 0) * 89500);
    const discountLbp = Math.round((order.discountAmount || 0) * 89500);
    const finalLbp = Math.round((order.total || 0) * 89500);

    const row = [
      `"${refNum}"`,
      `"${order.created_at || ''}"`,
      `"${order.customerName || ''}"`,
      `"${(order.paymentMethod || 'cash').toLowerCase()}"`,
      `"${name}"`,
      item.quantity,
      unitLbp,
      totalLbp,
      `"${item.customizations || ''}"`,
      subtotalLbp,
      deliveryLbp,
      discountLbp,
      finalLbp
    ].join(',');

    lines.push(row);
  }
}

const artifactPath = 'C:/Users/fredd/.gemini/antigravity/brain/b74445f2-cfb0-4249-9f8b-4dd47ca133b5/editable_historical_orders.csv';
fs.writeFileSync(artifactPath, lines.join('\n'));
fs.writeFileSync('./editable_historical_orders.csv', lines.join('\n'));
console.log('Successfully created CSV template with', lines.length - 1, 'rows!');
