const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('pos-app/src/pos/components/DailyPaymentsModal.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const invoiceBlockTarget = `          {/* ================================================================ */}
          {/* TAB 3: SUPPLIER INVOICE (PHASE 4) */}
          {/* ================================================================ */}
          {activeTab === 'invoice' && (
            <form onSubmit={handleSubmitSupplierInvoice} className="space-y-4">
              {/* Centralized Engine Quick Launcher */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1e5c4f]/10 border border-[#1e5c4f]/20 flex items-center justify-center text-[#1e5c4f]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">FLOW Centralized Invoice Engine</span>
                    <span className="text-[11px] text-slate-600 font-medium">AI camera scan, PDF upload, catalog matching &amp; packaging conversion</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullInvoicesModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#1e5c4f]/90 text-white font-black text-xs transition shadow-xs cursor-pointer flex items-center gap-2 whitespace-nowrap self-stretch sm:self-auto justify-center"
                >
                  <Plus size={14} /> Open Scanner &amp; History
                </button>
              </div>`;

const invoiceBlockReplacement = `          {/* ================================================================ */}
          {/* TAB 3: SUPPLIER INVOICE (PHASE 4) */}
          {/* ================================================================ */}
          {activeTab === 'invoice' && (
            <div className="space-y-4">
              {/* Centralized Engine Quick Launcher */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1e5c4f]/10 border border-[#1e5c4f]/20 flex items-center justify-center text-[#1e5c4f]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">FLOW Centralized Invoice Engine</span>
                    <span className="text-[11px] text-slate-600 font-medium">AI camera scan, PDF upload, catalog matching &amp; packaging conversion</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullInvoicesModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#1e5c4f]/90 text-white font-black text-xs transition shadow-xs cursor-pointer flex items-center gap-2 whitespace-nowrap self-stretch sm:self-auto justify-center"
                >
                  <Plus size={14} /> Open Scanner &amp; History
                </button>
              </div>

              {/* Sub-view toggle: Enter / Scan Invoice vs Today's Invoices */}
              <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInvoiceSubView('form')}
                    className={\`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 \${
                      invoiceSubView === 'form'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }\`}
                  >
                    <Plus size={14} className={invoiceSubView === 'form' ? 'text-emerald-700' : ''} />
                    <span>Enter / Manual Invoice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInvoiceSubView('todays_list')}
                    className={\`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 \${
                      invoiceSubView === 'todays_list'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }\`}
                  >
                    <FileText size={14} className={invoiceSubView === 'todays_list' ? 'text-emerald-700' : ''} />
                    <span>Today's Invoices</span>
                    <span className={\`px-2 py-0.5 rounded-full text-[10px] font-black \${
                      invoiceSubView === 'todays_list'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }\`}>
                      {todaysInvoices.length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pr-1">
                  <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
                    {date || 'Today'}
                  </span>
                  <button
                    type="button"
                    onClick={loadTodaysInvoices}
                    disabled={loadingInvoices}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition cursor-pointer"
                    title="Refresh Today's Invoices"
                  >
                    <RefreshCw size={13} className={loadingInvoices ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {invoiceSubView === 'todays_list' ? (
                renderTodaysInvoicesList()
              ) : (
                <form onSubmit={handleSubmitSupplierInvoice} className="space-y-4">`;

if (content.includes(invoiceBlockTarget)) {
  content = content.replace(invoiceBlockTarget, invoiceBlockReplacement);
  console.log('Replaced invoice top block');

  // Now close the form and container div
  const endFormTarget = `                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{submitting ? 'Recording Invoice...' : 'Post Supplier Invoice'}</span>
                </button>
              </div>
            </form>
          )}`;

  const endFormReplacement = `                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{submitting ? 'Recording Invoice...' : 'Post Supplier Invoice'}</span>
                </button>
              </div>
            </form>
              )}
            </div>
          )}`;

  content = content.replace(endFormTarget, endFormReplacement);
  console.log('Replaced invoice bottom block');
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Phase 3 changes applied successfully to DailyPaymentsModal.tsx');
} else {
  console.error('Could not find invoiceBlockTarget');
}
