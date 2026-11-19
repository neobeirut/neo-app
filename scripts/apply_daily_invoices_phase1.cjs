const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('pos-app/src/pos/components/DailyPaymentsModal.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add state variables for Today's Invoices
const stateMarker = "  // TAB 1: SUPPLIER INVOICE STATE (PHASE 4)";
const stateAddition = `  // TAB 1: SUPPLIER INVOICE STATE (PHASE 4)
  // Today's Invoices in Daily Payments
  const [todaysInvoices, setTodaysInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [invoiceSubView, setInvoiceSubView] = useState<'form' | 'todays_list'>('form');
`;

if (!content.includes('todaysInvoices')) {
  content = content.replace(stateMarker, stateAddition);
  console.log('Added state for todaysInvoices');
} else {
  console.log('State already present');
}

// 2. Add loadTodaysInvoices implementation
const loadTodaysInvoicesFunc = `
  const loadTodaysInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const targetDate = date || (activeShiftDate ? String(activeShiftDate).split('T')[0] : '') || new Date().toISOString().split('T')[0];
      const localDate = new Date().toLocaleDateString('en-CA');
      const res = await api.getSupplierInvoices({ branch_id: branchId });
      if (res && res.success && Array.isArray(res.data)) {
        const filtered = res.data.filter((inv: any) => {
          const invDateStr = inv.invoice_date ? String(inv.invoice_date).split('T')[0] : '';
          const createdDateStr = inv.created_at ? String(inv.created_at).split('T')[0] : '';
          return (
            invDateStr === targetDate ||
            invDateStr === localDate ||
            createdDateStr === targetDate ||
            createdDateStr === localDate
          );
        });
        setTodaysInvoices(filtered);
      }
    } catch (err) {
      console.error('Failed to load today invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };
`;

if (!content.includes('const loadTodaysInvoices = async')) {
  content = content.replace('loadExpensesList();\n    }', 'loadExpensesList();\n      loadTodaysInvoices();\n    }');
  content = content.replace('const loadMasterData = async () => {', `${loadTodaysInvoicesFunc}\n  const loadMasterData = async () => {`);
  console.log('Added loadTodaysInvoices function');
}

// 3. In handleSubmitSupplierInvoice, call loadTodaysInvoices and setInvoiceSubView('todays_list')
if (!content.includes("loadTodaysInvoices();\n        setInvoiceSubView('todays_list');")) {
  content = content.replace(
    "loadExpensesList();\n        setTimeout(() => setSuccessMsg(null), 4000);",
    "loadExpensesList();\n        loadTodaysInvoices();\n        setInvoiceSubView('todays_list');\n        setTimeout(() => setSuccessMsg(null), 4000);"
  );
  console.log('Updated handleSubmitSupplierInvoice');
}

// 4. Update Tab 3 navigation button with badge
const tab3ButtonTarget = `<button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={\`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap \${
              activeTab === 'invoice'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }\`}
          >
            <FileText size={15} className="text-emerald-600" />
            <span>3. Supplier Invoice</span>
          </button>`;

const tab3ButtonReplacement = `<button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={\`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap \${
              activeTab === 'invoice'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }\`}
          >
            <FileText size={15} className="text-emerald-600" />
            <span>3. Supplier Invoice</span>
            {todaysInvoices.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {todaysInvoices.length}
              </span>
            )}
          </button>`;

if (content.includes(tab3ButtonTarget)) {
  content = content.replace(tab3ButtonTarget, tab3ButtonReplacement);
  console.log('Updated Tab 3 button with badge');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Phase 1 changes applied to DailyPaymentsModal.tsx');
