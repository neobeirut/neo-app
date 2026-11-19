const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('pos-app/src/pos/components/DailyPaymentsModal.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Update Tab 3 navigation button with badge
const tab3Old = `          <button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={\`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap \${
              activeTab === 'invoice'
                ? 'border-[#1e5c4f] text-[#1e5c4f] bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }\`}
          >
            <Receipt size={15} />
            <span>3. Supplier Invoice</span>
          </button>`;

const tab3New = `          <button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={\`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap \${
              activeTab === 'invoice'
                ? 'border-[#1e5c4f] text-[#1e5c4f] bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }\`}
          >
            <Receipt size={15} />
            <span>3. Supplier Invoice</span>
            {todaysInvoices.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {todaysInvoices.length}
              </span>
            )}
          </button>`;

if (content.includes(tab3Old)) {
  content = content.replace(tab3Old, tab3New);
  console.log('Updated Tab 3 nav button with count badge');
}

// 2. Add renderTodaysInvoicesList helper function
const helperFunc = `
  const renderTodaysInvoicesList = () => {
    const totalUsd = todaysInvoices.reduce((acc, inv) => {
      const u = Number(inv.total_amount_usd);
      if (!isNaN(u) && u > 0) return acc + u;
      if (inv.invoice_currency === 'USD') return acc + (Number(inv.total_amount) || 0);
      return acc;
    }, 0);

    const totalLbp = todaysInvoices.reduce((acc, inv) => {
      const l = Number(inv.total_amount_lbp);
      if (!isNaN(l) && l > 0) return acc + l;
      if (inv.invoice_currency === 'LBP') return acc + (Number(inv.total_amount) || 0);
      return acc;
    }, 0);

    const paidCount = todaysInvoices.filter(i => i.payment_status === 'PAID').length;
    const unpaidCount = todaysInvoices.length - paidCount;

    return (
      <div className="space-y-4">
        {/* SUMMARY STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Today</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-slate-900">{todaysInvoices.length}</span>
              <span className="text-xs font-bold text-slate-500">invoices</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Volume ($)</span>
            <span className="text-lg font-black text-emerald-800 block mt-0.5">
              \${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Volume (LBP)</span>
            <span className="text-lg font-black text-teal-800 block mt-0.5">
              {Math.round(totalLbp).toLocaleString()} L.L.
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Status</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {paidCount} Paid
                </span>
                {unpaidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    {unpaidCount} Unpaid
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={loadTodaysInvoices}
              disabled={loadingInvoices}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Refresh Invoices"
            >
              <RefreshCw size={14} className={loadingInvoices ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* INVOICES LIST / EMPTY STATE */}
        {todaysInvoices.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Receipt size={24} />
            </div>
            <div>
              <span className="text-sm font-black text-slate-800 block">No Invoices Recorded Today</span>
              <span className="text-xs text-slate-500">There are no supplier invoices recorded for date: {date || 'today'}.</span>
            </div>
            <button
              type="button"
              onClick={() => setInvoiceSubView('form')}
              className="px-4 py-2 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-2"
            >
              <Plus size={14} />
              <span>Record First Invoice</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {todaysInvoices.map((inv: any) => {
              const isExpanded = expandedInvoiceId === inv.id;
              const isPaid = inv.payment_status === 'PAID';
              const isPartiallyPaid = inv.payment_status === 'PARTIALLY_PAID';
              const isReceived = inv.receipt_status === 'FULLY_RECEIVED';
              const currency = inv.invoice_currency || 'USD';
              const totalAmountNum = Number(inv.total_amount) || 0;
              const rate = Number(inv.exchange_rate) || invExchangeRate || 90000;

              return (
                <div
                  key={inv.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition space-y-3"
                >
                  {/* HEADER ROW */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-900 font-mono font-black text-xs border border-slate-200">
                        #{inv.invoice_number}
                      </span>
                      <span className="font-black text-sm text-slate-900">
                        {inv.supplier?.name || 'Supplier'}
                      </span>
                      {inv.supplier?.phone && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          ({inv.supplier.phone})
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400">
                        • {inv.created_at ? new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {inv.created_by && (
                        <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
                          By: {inv.created_by}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {/* Payment Status Badge */}
                      <span className={\`px-2.5 py-1 rounded-xl text-[11px] font-black border \${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isPartiallyPaid
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }\`}>
                        {inv.payment_status || 'UNPAID'}
                      </span>

                      {/* Stock Receiving Badge */}
                      <span className={\`px-2.5 py-1 rounded-xl text-[11px] font-black border \${
                        isReceived
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }\`}>
                        {isReceived ? '✓ Stock Received' : 'No Goods Recv'}
                      </span>
                    </div>
                  </div>

                  {/* DETAILS & AMOUNT ROW */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Date</span>
                        <span className="font-bold text-slate-800">{String(inv.invoice_date).split('T')[0]}</span>
                      </div>
                      <div className="border-l border-slate-200 pl-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Items</span>
                        <span className="font-bold text-slate-800">{inv.items?.length || 0} line items</span>
                      </div>
                      {inv.notes && (
                        <div className="border-l border-slate-200 pl-3 max-w-xs truncate">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Notes</span>
                          <span className="text-slate-600 truncate block">{inv.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right self-end sm:self-auto">
                      <span className="text-base font-black text-slate-900 block">
                        {currency === 'USD' ? \`$\${totalAmountNum.toFixed(2)}\` : \`\${Math.round(totalAmountNum).toLocaleString()} L.L.\`}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 block">
                        {currency === 'USD' 
                          ? \`≈ \${Math.round(totalAmountNum * rate).toLocaleString()} L.L.\`
                          : \`≈ $\${(totalAmountNum / rate).toFixed(2)}\`}
                      </span>
                    </div>
                  </div>

                  {/* ACTION BAR */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                    >
                      <ChevronDown size={14} className={\`transition-transform \${isExpanded ? 'rotate-180' : ''}\`} />
                      <span>{isExpanded ? 'Hide Items' : \`View \${inv.items?.length || 0} Items\`}</span>
                    </button>

                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('payment');
                          if (inv.supplier_id) handleSupplierChangeForPayment(inv.supplier_id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <CreditCard size={13} />
                        <span>Settle / Pay Now</span>
                      </button>
                    )}
                  </div>

                  {/* EXPANDABLE ITEMS TABLE */}
                  {isExpanded && (
                    <div className="mt-2 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                        Line Items Breakdown
                      </span>
                      {(!inv.items || inv.items.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No line item details available.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                                <th className="pb-1.5">Item</th>
                                <th className="pb-1.5 text-center">Invoiced Qty</th>
                                <th className="pb-1.5 text-right">Unit Price</th>
                                <th className="pb-1.5 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 font-medium">
                              {inv.items.map((it: any, itIdx: number) => (
                                <tr key={it.id || itIdx}>
                                  <td className="py-1.5 font-bold text-slate-800">
                                    {it.item_name || 'Item'}
                                    {Number(it.conversion_factor || 1) > 1 && (
                                      <span className="block text-[10px] text-slate-400 font-normal">
                                        Factor: {it.conversion_factor} {it.base_unit || 'base'} / {it.purchase_unit || it.unit}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-center text-slate-700">
                                    {it.invoiced_quantity || it.quantity} {it.purchase_unit || it.unit || 'pcs'}
                                  </td>
                                  <td className="py-1.5 text-right text-slate-700">
                                    {currency === 'USD' ? \`$\${Number(it.unit_price).toFixed(2)}\` : \`\${Math.round(Number(it.unit_price)).toLocaleString()} L.L.\`}
                                  </td>
                                  <td className="py-1.5 text-right font-black text-slate-900">
                                    {currency === 'USD' ? \`$\${Number(it.line_total).toFixed(2)}\` : \`\${Math.round(Number(it.line_total)).toLocaleString()} L.L.\`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };
`;

if (!content.includes('const renderTodaysInvoicesList = () => {')) {
  content = content.replace('const renderPaymentsList = () => {', `${helperFunc}\n  const renderPaymentsList = () => {`);
  console.log('Added renderTodaysInvoicesList');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Phase 2 changes applied to DailyPaymentsModal.tsx');
