const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.env.FLOW_POS_ROOT || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));

function loadTs(file, mocks = {}) {
  const exports = {};
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React
    }
  }).outputText;

  const sandbox = {
    exports,
    module: { exports },
    require: name => mocks[name] || {},
    console: { error() {}, warn() {}, log() {} },
    crypto: require('crypto').webcrypto,
    Date,
    Number,
    JSON,
    Map,
    Set,
    parseFloat,
    parseInt,
    Intl,
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(transpiled, sandbox);
  return sandbox.module.exports;
}

function createMockDb(initialTables = {}, rpcHandlers = {}) {
  const tables = {};
  for (const k in initialTables) {
    if (Array.isArray(initialTables[k])) {
      tables[k] = initialTables[k].map(item => ({ ...item }));
    } else {
      tables[k] = initialTables[k];
    }
  }

  return {
    tables,
    from(table) {
      return {
        select(cols) {
          const filter = {
            _eq: {},
            _gt: null,
            _order: null,
            eq(col, val) {
              filter._eq[col] = val;
              return filter;
            },
            gt(col, val) {
              filter._gt = { col, val };
              return filter;
            },
            order(col, opts) {
              filter._order = { col, opts };
              return filter;
            },
            ilike(col, val) {
              filter._ilike = { col, val };
              return filter;
            },
            maybeSingle: async () => {
              if (tables[table + ':selectError']) {
                return { data: null, error: tables[table + ':selectError'] };
              }
              const records = tables[table] || [];
              const row = records.find(r => {
                for (const k in filter._eq) {
                  if (String(r[k]) !== String(filter._eq[k])) return false;
                }
                return true;
              });
              return { data: row || null, error: null };
            },
            single: async () => {
              if (tables[table + ':selectError']) {
                return { data: null, error: tables[table + ':selectError'] };
              }
              const records = tables[table] || [];
              const row = records.find(r => {
                for (const k in filter._eq) {
                  if (String(r[k]) !== String(filter._eq[k])) return false;
                }
                return true;
              });
              return { data: row || null, error: row ? null : new Error('Row not found') };
            },
            then(resolve) {
              if (tables[table + ':selectError']) {
                return resolve({ data: null, error: tables[table + ':selectError'] });
              }
              let list = [...(tables[table] || [])];
              for (const k in filter._eq) {
                list = list.filter(r => String(r[k]) === String(filter._eq[k]));
              }
              if (filter._gt) {
                list = list.filter(r => Number(r[filter._gt.col] || 0) > Number(filter._gt.val));
              }
              if (filter._order) {
                const { col, opts } = filter._order;
                list.sort((a, b) => {
                  const valA = a[col];
                  const valB = b[col];
                  if (valA === valB) return 0;
                  if (opts && opts.ascending === false) {
                    return valA < valB ? 1 : -1;
                  }
                  return valA > valB ? 1 : -1;
                });
              }
              return resolve({ data: list, error: null });
            }
          };
          return filter;
        },
        insert(rows) {
          if (tables[table + ':insertError']) {
            return {
              select: () => Promise.resolve({ data: null, error: tables[table + ':insertError'] }),
              then: (res) => res({ data: null, error: tables[table + ':insertError'] })
            };
          }
          const inserted = (Array.isArray(rows) ? rows : [rows]).map((r, idx) => {
            const row = { id: r.id || (Date.now() + idx), ...r };
            if (!tables[table]) tables[table] = [];
            tables[table].push(row);
            return row;
          });
          return {
            select: () => Promise.resolve({ data: inserted, error: null }),
            then: (res) => res({ data: inserted, error: null })
          };
        },
        update(payload) {
          if (tables[table + ':updateError']) {
            return {
              eq: () => Promise.resolve({ data: null, error: tables[table + ':updateError'] }),
              then: (res) => res({ data: null, error: tables[table + ':updateError'] })
            };
          }
          return {
            eq: (col, val) => {
              if (tables[table]) {
                tables[table].forEach(r => {
                  if (String(r[col]) === String(val)) {
                    Object.assign(r, payload);
                  }
                });
              }
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
      };
    },
    rpc(fn, args) {
      if (rpcHandlers[fn]) {
        return rpcHandlers[fn](args);
      }
      return Promise.resolve({ data: 1, error: null });
    }
  };
}

test('1. getFinancialSummary calculates accurate financial summary from FLOW Supabase tenders and refunds', async () => {
  const db = createMockDb({
    pos_orders: [
      {
        id: 101,
        total_amount: 50.00,
        amount_paid: 50.00,
        amount_refunded: 10.00,
        payment_status: 'PARTIALLY_REFUNDED',
        status: 'completed',
        version: 2
      }
    ],
    order_tender_receivables: [
      {
        id: 1,
        pos_order_id: 101,
        source_tender_key: 'tender-1',
        tender_type: 'CASH',
        tender_currency: 'USD',
        tendered_amount: 50.00,
        net_receivable_amount: 50.00,
        completed_at: '2026-10-30T10:00:00Z'
      }
    ],
    void_receipts: [
      {
        id: 5,
        operation_id: 'ref-1',
        order_number: '101',
        status: 'completed',
        void_type: 'refund',
        canceled_items: [{ price: 10.00 }]
      }
    ]
  });

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': { api: {} },
    '../config': { COMMERCE_API_BASE: '' }
  });

  const res = await paymentService.getFinancialSummary(101);
  assert.equal(res.success, true);
  assert.equal(res.summary.orderId, 101);
  assert.equal(res.summary.totalAmount, 50.00);
  assert.equal(res.summary.amountPaid, 50.00);
  assert.equal(res.summary.amountRefunded, 10.00);
  assert.equal(res.summary.netPaid, 40.00);
  assert.equal(res.summary.amountRemaining, 0);
  assert.equal(res.summary.paymentStatus, 'PARTIALLY_REFUNDED');
  assert.equal(res.payments.length, 1);
  assert.equal(res.refunds.length, 1);
});

test('2. submitPayment records tender receivable with idempotency and updates pos_orders', async () => {
  const rpcCalls = [];
  const db = createMockDb(
    {
      pos_orders: [
        {
          id: 102,
          restaurant_id: 'tenant-1',
          branch_id: 'branch-1',
          total_amount: 30.00,
          status: 'preparing',
          payment_status: 'unpaid'
        }
      ],
      order_tender_receivables: [],
      void_receipts: []
    },
    {
      create_order_tender_receivable: async (args) => {
        rpcCalls.push(args);
        return { data: 999, error: null };
      }
    }
  );

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': { api: {} },
    '../config': { COMMERCE_API_BASE: '' }
  });

  const tender = {
    id: 't-1',
    method: 'Cash USD',
    category: 'direct',
    currency: 'USD',
    exchangeRate: null,
    tenderedAmount: 30.00,
    appliedUsd: 30.00,
    changeAmount: 0
  };

  const res = await paymentService.submitPayment({
    orderId: 102,
    payment: tender,
    operationId: 'pay-unique-1',
    cashierName: 'Freddy',
    terminalId: 'term-1'
  });

  assert.equal(res.success, true);
  assert.equal(res.isDuplicate, false);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].p_source_tender_key, 'pay-unique-1');
  assert.equal(rpcCalls[0].p_net_receivable_amount, 30.00);

  const updatedOrder = db.tables.pos_orders.find(o => o.id === 102);
  assert.equal(updatedOrder.payment_status, 'paid');
  assert.equal(updatedOrder.amount_paid, 30.00);
});

test('3. submitRefundWithFlowAudit fails clearly on NO_OPEN_TENDER and does not return fabricated success', async () => {
  const db = createMockDb({
    pos_orders: [
      {
        id: 201,
        branch_id: 'b-101',
        restaurant_id: 'tenant-1',
        total_amount: 50.00,
        amount_refunded: 0
      }
    ],
    void_receipts: []
  });

  const mockApi = {
    verifyCashierPin: async () => ({
      success: true,
      data: { name: 'Manager Bob', role: 'manager', admin_permissions: { refunds: true } }
    })
  };

  const mockOrderService = {
    recordOrderTenderRefund: async () => ({ success: false, error: 'NO_OPEN_TENDER' })
  };

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': { api: mockApi },
    '../services/posOrderService': mockOrderService,
    '../config': { COMMERCE_API_BASE: '' }
  });

  const res = await paymentService.submitRefundWithFlowAudit({
    orderId: 201,
    amount: 15.00,
    refundType: 'partial',
    reason: 'Customer complaint',
    managerPin: '1234',
    cashierName: 'Alice',
    branchName: 'Badaro',
    branchId: 'b-101'
  });

  assert.equal(res.success, false);
  assert.match(res.error, /No open tender receivable found/i);

  const voidRows = db.tables.void_receipts || [];
  assert.equal(voidRows.length, 1);
  assert.equal(voidRows[0].status, 'failed');
});

test('4. submitRefundWithFlowAudit resolves canonical branchId and executes successful refund', async () => {
  let passedRefundParams = null;

  const db = createMockDb({
    pos_orders: [
      {
        id: 301,
        branch_id: 'canonical-branch-guid',
        restaurant_id: 'canonical-tenant-guid',
        total_amount: 40.00,
        amount_refunded: 0
      }
    ],
    void_receipts: [],
    order_tender_receivables: []
  });

  const mockApi = {
    verifyCashierPin: async () => ({
      success: true,
      data: { name: 'Manager Jane', role: 'admin' }
    })
  };

  const mockOrderService = {
    recordOrderTenderRefund: async (params) => {
      passedRefundParams = params;
      return { success: true, refundId: 777, amountRefundedSoFar: params.refundAmount };
    }
  };

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'canonical-tenant-guid' },
    '../../api/client': { api: mockApi },
    '../services/posOrderService': mockOrderService,
    '../config': { COMMERCE_API_BASE: '' }
  });

  const res = await paymentService.submitRefundWithFlowAudit({
    orderId: 301,
    amount: 20.00,
    refundType: 'partial',
    reason: 'Wrong order item',
    managerPin: '9999',
    cashierName: 'Freddy',
    branchName: 'Badaro Branch'
  });

  assert.equal(res.success, true);
  assert.equal(passedRefundParams.branchId, 'canonical-branch-guid');
  assert.equal(passedRefundParams.restaurantId, 'canonical-tenant-guid');
  assert.equal(passedRefundParams.refundAmount, 20.00);

  const voidComp = db.tables.void_receipts[0];
  assert.equal(voidComp.status, 'completed');
  assert.equal(res.summary.orderId, 301);
});

test('5. recordOrderTenderRefund allocates refund across split tenders in LIFO order', async () => {
  const rpcRefundCalls = [];

  const openTenders = [
    { id: 20, pos_order_id: 501, restaurant_id: 'tenant-1', net_receivable_amount: 15.00, tender_type: 'CREDIT_CARD', tender_sequence: 2 }, // Card $15 (seq 2)
    { id: 10, pos_order_id: 501, restaurant_id: 'tenant-1', net_receivable_amount: 25.00, tender_type: 'CASH', tender_sequence: 1 }         // Cash $25 (seq 1)
  ];

  const db = createMockDb(
    {
      order_tender_receivables: openTenders
    },
    {
      record_order_tender_refund: async (args) => {
        rpcRefundCalls.push(args);
        return { data: 1234, error: null };
      }
    }
  );

  const orderService = loadTs('src/pos/services/posOrderService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    './posInventory': { readModifiers: () => [], serializeModifiers: () => [], modifierText: () => '', inventoryLines: () => [] }
  });

  // Request $25 refund: should take all $15 from Card tender, and remaining $10 from Cash tender
  const res = await orderService.recordOrderTenderRefund({
    orderId: 501,
    branchId: 'b-1',
    refundAmount: 25.00,
    reason: 'Split refund test'
  });

  assert.equal(res.success, true);
  assert.equal(rpcRefundCalls.length, 2);
  assert.equal(rpcRefundCalls[0].p_tender_id, 20);
  assert.equal(rpcRefundCalls[0].p_refund_amount, 15.00);
  assert.equal(rpcRefundCalls[0].p_refund_type, 'CARD_REFUND');

  assert.equal(rpcRefundCalls[1].p_tender_id, 10);
  assert.equal(rpcRefundCalls[1].p_refund_amount, 10.00);
  assert.equal(rpcRefundCalls[1].p_refund_type, 'CASH_REFUND');
});

test('6. CloseShiftModal reads card_usd contract directly without reading card.usd/lbp or inventing LBP', () => {
  const fileContent = fs.readFileSync(path.join(root, 'src/pos/components/CloseShiftModal.tsx'), 'utf8');
  assert(!fileContent.includes('tenders.card.usd'), 'CloseShiftModal must not reference tenders.card.usd');
  assert(!fileContent.includes('tenders.card.lbp'), 'CloseShiftModal must not reference tenders.card.lbp');
  assert(fileContent.includes('tenders?.card_usd'), 'CloseShiftModal must reference tenders?.card_usd');
});

test('7. OrdersHubScreen formats driver ETA using etaInfo.etaText instead of etaInfo.phrase', () => {
  const fileContent = fs.readFileSync(path.join(root, 'src/pos/orders/OrdersHubScreen.tsx'), 'utf8');
  assert(!fileContent.includes('etaInfo.phrase'), 'OrdersHubScreen must not reference etaInfo.phrase');
  assert(fileContent.includes('etaInfo.etaText'), 'OrdersHubScreen must reference etaInfo.etaText');
});

test('8. Payment false success recovery: submitPayment fails when pos_orders.update fails, and retry recovers without re-recording tender', async () => {
  let rpcCount = 0;
  const dbState = {
    pos_orders: [
      {
        id: 701,
        restaurant_id: 'tenant-1',
        branch_id: 'branch-1',
        total_amount: 50.00,
        amount_paid: 0,
        status: 'pending',
        payment_status: 'unpaid'
      }
    ],
    order_tender_receivables: [],
    void_receipts: []
  };

  const db = createMockDb(
    dbState,
    {
      create_order_tender_receivable: async (args) => {
        rpcCount++;
        db.tables.order_tender_receivables.push({
          id: 1001,
          source_tender_key: args.p_source_tender_key,
          pos_order_id: args.p_pos_order_id,
          tender_currency: args.p_tender_currency,
          tendered_amount: args.p_tendered_amount,
          net_receivable_amount: args.p_net_receivable_amount,
          tender_type: args.p_tender_type,
          completed_at: new Date().toISOString()
        });
        return { data: 1001, error: null };
      }
    }
  );

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': { api: {} },
    '../config': { COMMERCE_API_BASE: '' }
  });

  const tender = {
    id: 'tender-retry-1',
    method: 'Cash USD',
    category: 'direct',
    currency: 'USD',
    exchangeRate: null,
    tenderedAmount: 50.00,
    appliedUsd: 50.00,
    changeAmount: 0
  };

  // 1. First attempt: simulate pos_orders update DB failure
  db.tables['pos_orders:updateError'] = new Error('pos_orders lock contention timeout');

  const res1 = await paymentService.submitPayment({
    orderId: 701,
    payment: tender,
    operationId: 'op-stable-123',
    cashierName: 'Freddy',
    terminalId: 'term-main'
  });

  // Must not claim success when update failed!
  assert.equal(res1.success, false);
  assert.match(res1.error, /pos_orders lock contention timeout/i);
  assert.equal(rpcCount, 1);

  // 2. Second attempt (retry with the same operationId after transient failure is resolved)
  delete db.tables['pos_orders:updateError'];

  const res2 = await paymentService.submitPayment({
    orderId: 701,
    payment: tender,
    operationId: 'op-stable-123',
    cashierName: 'Freddy',
    terminalId: 'term-main'
  });

  // Successful retry: recognized existing tender, recovered pos_orders state, didn't re-create tender receivable
  assert.equal(res2.success, true);
  assert.equal(res2.isDuplicate, true);
  assert.equal(rpcCount, 1); // Not called again!

  const recoveredOrder = db.tables.pos_orders.find(o => o.id === 701);
  assert.equal(recoveredOrder.payment_status, 'paid');
  assert.equal(recoveredOrder.amount_paid, 50.00);
});

test('9. Financial reads fail open protection: getFinancialSummary propagates DB errors and closeTableSession refuses closure', async () => {
  const db = createMockDb({
    pos_orders: [
      {
        id: 801,
        total_amount: 100.00,
        amount_paid: 100.00,
        amount_refunded: 0,
        payment_status: 'paid',
        status: 'completed'
      }
    ],
    pos_table_sessions: [
      {
        id: 'session-table-9',
        status: 'occupied',
        version: 1
      }
    ],
    // Force error when fetching order_tender_receivables
    'order_tender_receivables:selectError': new Error('Database connection reset during financial read')
  });

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': { api: {} },
    '../config': { COMMERCE_API_BASE: '' }
  });

  const fin = await paymentService.getFinancialSummary(801);
  assert.equal(fin.success, false);
  assert.match(fin.error, /Database connection reset during financial read/);

  const tableService = loadTs('src/pos/tables/tableService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../payments/paymentService': paymentService,
    '../config': { COMMERCE_API_BASE: '' }
  });

  const closeRes = await tableService.closeTableSession('session-table-9', 801, 1);
  assert.equal(closeRes.success, false);
  assert.match(closeRes.error, /Failed to verify payment balance/i);

  // Table session must remain open
  const session = db.tables.pos_table_sessions.find(s => s.id === 'session-table-9');
  assert.equal(session.status, 'occupied');
});

test('10. Split refund partial completion: commits portion 1 ($15), fails portion 2 ($10), persists partial, resumes remainder on retry', async () => {
  let attempt = 0;
  const db = createMockDb({
    pos_orders: [
      {
        id: 901,
        restaurant_id: 'tenant-1',
        branch_id: 'branch-1',
        total_amount: 50.00,
        amount_paid: 50.00,
        amount_refunded: 0,
        payment_status: 'paid'
      }
    ],
    order_tender_receivables: [
      { id: 101, pos_order_id: 901, tender_type: 'CREDIT_CARD', net_receivable_amount: 15.00 },
      { id: 102, pos_order_id: 901, tender_type: 'CASH', net_receivable_amount: 35.00 }
    ],
    void_receipts: []
  });

  const mockApi = {
    verifyCashierPin: async () => ({
      success: true,
      data: { name: 'Manager Sarah', role: 'manager', admin_permissions: { refunds: true } }
    })
  };

  const mockOrderService = {
    recordOrderTenderRefund: async (params) => {
      attempt++;
      if (attempt === 1) {
        // First run: $25 requested. Refunded card $15 successfully, but cash tender failed ($10)
        return {
          success: false,
          error: 'Cash drawer peripheral communication timeout',
          amountRefundedSoFar: 15.00,
          completedPortions: [
            { tenderId: 101, amount: 15.00, refundId: 5001, gatewayReference: `${params.operationId}:part_1:101` }
          ]
        };
      } else {
        // Second run: resumes remainder ($10) successfully
        assert.equal(params.refundAmount, 10.00, 'Retry must only request remainder of $10.00');
        return {
          success: true,
          amountRefundedSoFar: 10.00,
          completedPortions: [
            { tenderId: 102, amount: 10.00, refundId: 5002, gatewayReference: `${params.operationId}:part_2:102` }
          ]
        };
      }
    }
  };

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': { api: mockApi },
    '../services/posOrderService': mockOrderService,
    '../config': { COMMERCE_API_BASE: '' }
  });

  // 1. Initial attempt: requests $25 refund
  const res1 = await paymentService.submitRefundWithFlowAudit({
    orderId: 901,
    amount: 25.00,
    refundType: 'partial',
    reason: 'Partial order return',
    managerPin: '1234',
    cashierName: 'Freddy',
    branchName: 'Branch 1',
    branchId: 'branch-1',
    operationId: 'split-ref-op-999'
  });

  assert.equal(res1.success, false);
  assert.match(res1.error, /Cash drawer peripheral communication timeout/);

  // Check persisted partial state in pos_orders and void_receipts
  const orderAfterFail = db.tables.pos_orders.find(o => o.id === 901);
  assert.equal(orderAfterFail.amount_refunded, 15.00);
  assert.equal(orderAfterFail.payment_status, 'PARTIALLY_REFUNDED');

  const auditAfterFail = db.tables.void_receipts.find(v => v.operation_id === 'split-ref-op-999');
  assert.equal(auditAfterFail.status, 'partial');
  assert.equal(auditAfterFail.canceled_items[0].amount_completed, 15.00);

  // 2. Retry with same operation ID
  const res2 = await paymentService.submitRefundWithFlowAudit({
    orderId: 901,
    amount: 25.00,
    refundType: 'partial',
    reason: 'Partial order return',
    managerPin: '1234',
    cashierName: 'Freddy',
    branchName: 'Branch 1',
    branchId: 'branch-1',
    operationId: 'split-ref-op-999'
  });

  assert.equal(res2.success, true);

  const orderAfterRetry = db.tables.pos_orders.find(o => o.id === 901);
  assert.equal(orderAfterRetry.amount_refunded, 25.00);

  const auditAfterRetry = db.tables.void_receipts.find(v => v.operation_id === 'split-ref-op-999');
  assert.equal(auditAfterRetry.status, 'completed');
  assert.equal(auditAfterRetry.canceled_items[0].amount_completed, 25.00);
});

test('11. Retry protection & dropped network response handling: commit succeeded before response dropped', async () => {
  // Scenario: Database commit succeeded for refund, but network dropped before client received response.
  // When client retries with the same operationId, it recovers successfully without executing duplicate refund.
  const db = createMockDb({
    pos_orders: [
      {
        id: 950,
        restaurant_id: 'tenant-1',
        branch_id: 'branch-1',
        total_amount: 30.00,
        amount_paid: 30.00,
        amount_refunded: 30.00,
        payment_status: 'REFUNDED'
      }
    ],
    order_tender_receivables: [
      { id: 201, pos_order_id: 950, tender_type: 'CASH', net_receivable_amount: 0 }
    ],
    void_receipts: [
      {
        id: 'void-drop-1',
        operation_id: 'drop-op-456',
        status: 'completed',
        canceled_items: [{ price: 30.00, amount_completed: 30.00 }]
      }
    ]
  });

  let rpcCalled = false;
  const mockOrderService = {
    recordOrderTenderRefund: async () => {
      rpcCalled = true;
      return { success: false, error: 'NO_OPEN_TENDER' };
    }
  };

  const paymentService = loadTs('src/pos/payments/paymentService.ts', {
    '../../api/supabase': { supabase: db, getGlobalRestaurantId: () => 'tenant-1' },
    '../../api/client': {
      api: {
        verifyCashierPin: async () => ({
          success: true,
          data: { name: 'Manager Bob', role: 'manager', admin_permissions: { refunds: true } }
        })
      }
    },
    '../services/posOrderService': mockOrderService,
    '../config': { COMMERCE_API_BASE: '' }
  });

  const res = await paymentService.submitRefundWithFlowAudit({
    orderId: 950,
    amount: 30.00,
    refundType: 'full',
    reason: 'Full return',
    managerPin: '1234',
    operationId: 'drop-op-456'
  });

  assert.equal(res.success, true);
  assert.equal(rpcCalled, false, 'Should not re-execute refund RPC when audit record already shows completion');
  assert.equal(res.refund.operation_id, 'drop-op-456');
});
