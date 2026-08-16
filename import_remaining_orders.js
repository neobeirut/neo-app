import fs from 'fs';
import https from 'https';

const parsedOrders = JSON.parse(fs.readFileSync('./parsed_orders.json', 'utf8'));

// Fetch existing orders in DB
https.get('https://ovrload-backend-production.up.railway.app/api/pos/orders?type=all', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', async () => {
    try {
      const dbOrders = JSON.parse(data).orders || [];
      console.log('Orders currently in database:', dbOrders.length);

      const importedRefs = new Set(dbOrders.map(o => o.special_instructions).filter(Boolean));
      const remaining = parsedOrders.filter(o => !importedRefs.has(o.specialInstructions));
      
      console.log(`Total CSV orders: ${parsedOrders.length}`);
      console.log(`Already imported: ${dbOrders.length}`);
      console.log(`Remaining to import: ${remaining.length}`);

      if (remaining.length === 0) {
        console.log('ALL ORDERS ALREADY IMPORTED!');
        return;
      }

      let success = 0;
      let fail = 0;

      for (let i = 0; i < remaining.length; i++) {
        const order = remaining[i];
        await new Promise((resolve) => {
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

          const req = https.request({
            hostname: 'ovrload-backend-production.up.railway.app',
            port: 443,
            path: '/api/pos/orders',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) success++; else fail++;
            setTimeout(resolve, 30);
          });

          req.on('error', err => { fail++; setTimeout(resolve, 30); });
          req.write(postData);
          req.end();
        });

        if ((i + 1) % 25 === 0 || i === remaining.length - 1) {
          console.log(`Imported ${i + 1}/${remaining.length} remaining orders (Success: ${success}, Fail: ${fail})...`);
        }
      }

      console.log(`\nBULK IMPORT COMPLETE! Success: ${success}, Failed: ${fail}`);
    } catch (e) {
      console.error('Error during import process:', e.message);
    }
  });
}).on('error', err => console.error('Fetch error:', err.message));
