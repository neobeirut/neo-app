import fs from 'fs';
import https from 'https';

const parsedOrders = JSON.parse(fs.readFileSync('./parsed_orders.json', 'utf8'));

console.log(`Starting parallel bulk import of ${parsedOrders.length} orders...`);

function sendOrder(order) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      branchId: order.branchId || 1,
      orderType: order.orderType || 'delivery',
      orderSource: order.orderSource || 'Toters',
      paymentMethod: order.paymentMethod || 'Cash',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      deliveryAddress: order.deliveryAddress || '',
      specialInstructions: order.specialInstructions || '',
      status: order.status || 'completed',
      items: order.items,
      subtotal: order.subtotal || 0,
      deliveryFee: order.deliveryFee || 0,
      discountAmount: order.discountAmount || 0,
      total: order.total || 0,
      createdAt: order.created_at
    });

    const options = {
      hostname: 'ovrload-backend-production.up.railway.app',
      port: 443,
      path: '/api/pos/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

async function runImport() {
  const CONCURRENCY = 10;
  let index = 0;
  let successCount = 0;
  let failCount = 0;

  async function worker() {
    while (index < parsedOrders.length) {
      const i = index++;
      const order = parsedOrders[i];
      try {
        await sendOrder(order);
        successCount++;
      } catch (err) {
        failCount++;
      }
      if ((successCount + failCount) % 50 === 0 || (successCount + failCount) === parsedOrders.length) {
        console.log(`Processed ${successCount + failCount}/${parsedOrders.length} orders...`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\nImport Complete!`);
  console.log(`Successfully Imported: ${successCount} orders`);
  console.log(`Failed: ${failCount} orders`);
}

runImport();
