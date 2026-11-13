import * as XLSX from 'xlsx';
import type { ConceptPnlRow, ChannelProfitabilityRow, ConsolidatedStatementRow, ReconciliationAuditRow } from '../api/multiConceptFinancialApi';

export interface ComprehensiveExportData {
  periodCode: string;
  year: number;
  month: number;
  branchName: string;
  consolidated: ConsolidatedStatementRow | null;
  concepts: ConceptPnlRow[];
  channels: ChannelProfitabilityRow[];
  exceptions: ReconciliationAuditRow[];
  reconciliationSummary?: any;
  sha256Digest?: string;
  isDemoData?: boolean;
  dataProvenance?: string;
}

export const financialExportHelper = {
  /**
   * Generates a fully structured, multi-sheet .xlsx workbook
   * for B.R.I.M.E. S.A.L. executive management reporting.
   */
  exportComprehensiveExcel(data: ComprehensiveExportData, filenamePrefix = 'FLOW_Financial_Statement') {
    const wb = XLSX.utils.book_new();
    const isClosed = Boolean(data.sha256Digest && data.sha256Digest !== 'UNSEALED');
    const isDemo = Boolean(data.isDemoData || data.dataProvenance === 'SYNTHETIC_STAGING_FIXTURE');
    const statementStatus = isClosed ? 'Closed-Period Management Statement' : 'Preliminary Management Statement';

    // 1. Executive Consolidated P&L Sheet
    if (data.consolidated) {
      const c = data.consolidated;
      const consolidatedRows = [
        [`B.R.I.M.E. S.A.L. — ${statementStatus.toUpperCase()}`],
        ['Ministry of Finance Tax ID: 3870852 | CNSS Reg: 1489201'],
        [`Facility: ${data.branchName} | Period: ${data.periodCode}`],
        isDemo ? ['*** DATA PROVENANCE:', 'SYNTHETIC_STAGING_FIXTURE (DEMO DATA — NOT CERTIFIED FOR STATUTORY FILING) ***'] : ['Data Provenance:', isClosed ? 'CERTIFIED_PRODUCTION_ACTUALS (SEALED PERIOD)' : 'UNAUDITED_STAGING_ACTUALS (PRELIMINARY OPERATIONAL DATABASE)'],
        ['Cryptographic SHA-256 Digest:', data.sha256Digest || 'UNSEALED (Preliminary)'],
        ['Internal Status:', isClosed ? 'Internal Reconciliation Verified' : 'Preliminary / In-Progress'],
        [],
        ['Line Item', 'Amount (USD)', '% of Gross Sales', 'Notes / Basis'],
        ['Gross Sales (POS Subtotal)', c.gross_sales_usd, '100.00%', 'Raw gross sales across all concepts'],
        ['Promotions & Discounts', -c.total_discounts_usd, `${((c.total_discounts_usd / (c.gross_sales_usd || 1)) * 100).toFixed(2)}%`, 'Merchant & platform funded discounts'],
        ['Net Sales (POS Revenue)', c.net_sales_usd, `${((c.net_sales_usd / (c.gross_sales_usd || 1)) * 100).toFixed(2)}%`, 'Net billed sales to customers'],
        ['Marketplace Net Adjustments', c.marketplace_net_usd, '-', 'Net delivery platform accruals & settlements'],
        ['Total Net Operating Revenue', c.total_net_revenue_usd, '-', 'Recognized operating revenue'],
        [],
        ['Cost of Goods Sold (COGS)', '', '', ''],
        ['Direct Food COGS', -c.total_cogs_usd, `${((c.total_cogs_usd / (c.net_sales_usd || 1)) * 100).toFixed(2)}%`, 'Actual batch & recipe usage (MWAC/FEFO)'],
        ['Packaging Consumption', -c.total_packaging_cost_usd, `${((c.total_packaging_cost_usd / (c.net_sales_usd || 1)) * 100).toFixed(2)}%`, 'Takeaway & delivery containers'],
        ['Waste (Production & Sales)', -c.total_waste_cost_usd, `${((c.total_waste_cost_usd / (c.net_sales_usd || 1)) * 100).toFixed(2)}%`, 'Recorded operational scrap & spoil'],
        ['Gross Profit', c.gross_profit_usd, `${c.gross_profit_margin_pct}%`, 'Operating gross margin'],
        [],
        ['Operating Expenses (OPEX)', '', '', ''],
        ['Direct Concept Labor', -c.direct_labor_usd, '-', 'Allocated dedicated concept payroll'],
        ['Shared Kitchen Staff Labor', -c.shared_kitchen_labor_usd, '-', 'Shared preparation labor pool'],
        ['Total Labor Expense', -c.total_labor_usd, `${((c.total_labor_usd / (c.net_sales_usd || 1)) * 100).toFixed(2)}%`, 'Consolidated personnel cost'],
        ['Direct Concept Operating Expenses', -c.direct_opex_usd, '-', 'Direct marketing, licenses, equipment'],
        ['Shared Facility Kitchen Overhead', -c.shared_facility_overhead_usd, '-', 'Allocated facility rent, power, maintenance'],
        ['Corporate Headquarters Overhead', -c.corporate_overhead_usd, '-', 'Executive management & central admin'],
        ['Total Operating Expenses', -c.total_opex_usd, `${((c.total_opex_usd / (c.net_sales_usd || 1)) * 100).toFixed(2)}%`, 'Consolidated operational overhead'],
        [],
        ['NET OPERATING PROFIT (EBIT)', c.net_operating_profit_usd, `${c.net_profit_margin_pct}%`, 'Fully allocated operating income'],
        [],
        ['Lebanese Tax Sub-Ledger (Internal Management Basis)', '', '', ''],
        ['Output VAT (11% on Taxable Sales)', c.output_vat_usd, '-', 'Collected on taxable consumer sales'],
        ['Recoverable Input VAT (Verified Invoices)', c.recoverable_input_vat_usd, '-', 'Credited from verified MoF tax invoices and recoverable aggregator commissions'],
        ['Non-Creditable Input VAT (Expensed)', (c as any).non_creditable_input_vat_usd || 0, '-', 'Expensed as operating cost due to lack of tax evidence or non-creditable classification'],
        ['Estimated Net VAT Payable', (c.output_vat_usd - c.recoverable_input_vat_usd), '-', 'Quarterly net settlement estimate subject to final accountant review']
      ];
      const wsConsolidated = XLSX.utils.aoa_to_sheet(consolidatedRows);
      XLSX.utils.book_append_sheet(wb, wsConsolidated, 'Consolidated P&L');
    }

    // 2. Multi-Concept Comparison Sheet
    if (data.concepts && data.concepts.length > 0) {
      const conceptRows = [
        ['B.R.I.M.E. S.A.L. — MULTI-CONCEPT COMPARATIVE PROFITABILITY'],
        [`Period: ${data.periodCode} | Facility: ${data.branchName}`],
        [],
        [
          'Concept Name', 'Concept Code', 'Gross Sales (USD)', 'Discounts (USD)', 
          'Net Sales (USD)', 'Product COGS (USD)', 'Packaging (USD)', 'Waste (USD)', 
          'Direct COGS (USD)', 'Gross Margin %', 'Direct Labor (USD)', 'Direct OPEX (USD)', 
          'Shared Overhead (USD)', 'Corporate HQ (USD)', 'Net Profit (USD)', 'Net Margin %'
        ],
        ...data.concepts.map(cp => [
          cp.concept_name,
          cp.concept_code,
          cp.gross_sales_usd,
          cp.discount_amount_usd,
          cp.net_sales_usd,
          cp.product_cogs_usd,
          cp.packaging_cost_usd,
          cp.waste_cost_usd,
          cp.net_direct_cogs_usd,
          `${cp.gross_profit_margin_pct}%`,
          cp.direct_labor_usd,
          cp.direct_opex_usd,
          cp.shared_facility_overhead_usd,
          cp.corporate_overhead_usd,
          cp.fully_allocated_net_profit_usd,
          `${cp.net_profit_margin_pct}%`
        ])
      ];
      const wsConcepts = XLSX.utils.aoa_to_sheet(conceptRows);
      XLSX.utils.book_append_sheet(wb, wsConcepts, 'Concept Comparison');
    }

    // 3. Channel Economics Sheet
    if (data.channels && data.channels.length > 0) {
      const channelRows = [
        ['B.R.I.M.E. S.A.L. — SALES CHANNEL & MARKETPLACE ECONOMICS'],
        [`Period: ${data.periodCode} | Facility: ${data.branchName}`],
        [],
        [
          'Concept', 'Channel Code', 'Channel Name', 'Orders', 
          'Gross Sales (USD)', 'Discounts (USD)', 'Net Billed (USD)', 
          'Commissions (USD)', 'Platform Fees (USD)', 'Commission VAT (USD)', 
          'Net Received (USD)', 'Direct COGS (USD)', 'Gross Margin (USD)', 'Margin %'
        ],
        ...data.channels.map(ch => [
          ch.concept_name,
          ch.channel_code,
          ch.channel_name,
          ch.order_count,
          ch.gross_sales_usd,
          ch.merchant_discounts_usd,
          ch.net_sales_usd,
          ch.marketplace_commission_usd,
          ch.platform_fees_usd,
          (ch as any).commission_vat_amount_usd || 0,
          ch.net_cash_received_usd,
          ch.direct_cogs_usd,
          ch.channel_gross_profit_usd,
          `${ch.channel_margin_pct}%`
        ])
      ];
      const wsChannels = XLSX.utils.aoa_to_sheet(channelRows);
      XLSX.utils.book_append_sheet(wb, wsChannels, 'Channel Economics');
    }

    // 4. Reconciliation & Exceptions Sheet
    const exceptionRows = [
      ['B.R.I.M.E. S.A.L. — AUDIT & RECONCILIATION EXCEPTIONS SCHEDULE'],
      [`Period: ${data.periodCode} | Facility: ${data.branchName}`],
      [],
      [
        'Category', 'Reference Doc', 'Concept ID', 'Impact Amount (USD)', 
        'Status', 'Audit Reason', 'Timestamp'
      ],
      ...(data.exceptions && data.exceptions.length > 0
        ? data.exceptions.map(ex => [
            ex.exception_category,
            ex.reference_document,
            ex.concept_id || 'COMPANY_LEVEL',
            ex.impact_amount_usd,
            ex.resolution_status,
            ex.reason_description,
            ex.created_at
          ])
        : [['N/A', 'NONE', 'ALL', 0.00, 'CLEAN', 'All sub-ledgers balanced without active exceptions.', new Date().toISOString()]])
    ];
    const wsExceptions = XLSX.utils.aoa_to_sheet(exceptionRows);
    XLSX.utils.book_append_sheet(wb, wsExceptions, 'Reconciliation Exceptions');

    // Trigger Download
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const finalPrefix = isDemo ? `DEMO_${filenamePrefix}` : filenamePrefix;
    link.setAttribute('download', `${finalPrefix}_${data.periodCode}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Exports any table array to RFC-4180 standard CSV
   */
  exportToCsv(data: any[], filename: string, isDemoData?: boolean, dataProvenance?: string) {
    if (!data || data.length === 0) {
      alert('No data available to export.');
      return;
    }
    const headers = Object.keys(data[0]);
    const provenanceLabel = dataProvenance || (isDemoData 
      ? 'SYNTHETIC_STAGING_FIXTURE (DEMO DATA — NOT CERTIFIED FOR STATUTORY FILING)' 
      : 'UNAUDITED_STAGING_ACTUALS (PRELIMINARY OPERATIONAL DATABASE)');
    const lines = [`# DATA PROVENANCE: ${provenanceLabel}`];

    lines.push(headers.join(','));
    lines.push(
      ...data.map(row => 
        headers.map(field => {
          const val = row[field];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return val;
        }).join(',')
      )
    );

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const finalFilename = isDemoData ? `DEMO_${filename}` : filename;
    link.setAttribute('download', `${finalFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Generates a formal, printable PDF Management Financial Statement
   * opens a high-fidelity formatted print view in a new window.
   */
  exportManagementStatementPdf(data: ComprehensiveExportData) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to open the printable PDF management statement.');
      return;
    }

    const c = data.consolidated;
    const sha = data.sha256Digest || 'UNSEALED';
    const isSealed = Boolean(data.sha256Digest && data.sha256Digest !== 'UNSEALED');
    const isDemo = Boolean(data.isDemoData || data.dataProvenance === 'SYNTHETIC_STAGING_FIXTURE');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>B.R.I.M.E. S.A.L. — Financial Statement ${data.periodCode}${isDemo ? ' (DEMO)' : ''}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111827;
            margin: 40px;
            font-size: 11pt;
            line-height: 1.4;
          }
          .demo-banner {
            background-color: #fef2f2;
            border: 2px dashed #b91c1c;
            color: #991b1b;
            padding: 12px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
            font-size: 11pt;
            border-radius: 6px;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title { font-size: 18pt; font-weight: bold; color: #0f172a; }
          .subtitle { font-size: 10pt; color: #475569; margin-top: 4px; }
          .meta-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            font-size: 9pt;
          }
          .meta-item strong { display: block; color: #334155; font-size: 8pt; text-transform: uppercase; }
          .section-title {
            font-size: 12pt;
            font-weight: bold;
            color: #1e293b;
            margin-top: 24px;
            margin-bottom: 8px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10pt;
          }
          th, td {
            padding: 6px 10px;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 600;
            border-bottom: 1px solid #cbd5e1;
          }
          td.num, th.num { text-align: right; }
          tr.total-row {
            font-weight: bold;
            border-top: 1px solid #94a3b8;
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
          }
          tr.subtotal-row {
            font-weight: 600;
            border-top: 1px dashed #cbd5e1;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 600;
          }
          .badge-sealed { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
          .badge-draft { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .seal-box {
            margin-top: 30px;
            border: 1px dashed #94a3b8;
            padding: 12px;
            font-size: 8pt;
            background: #fafafa;
            border-radius: 4px;
          }
          .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 24px;
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #475569;
            margin-top: 40px;
            padding-top: 4px;
            font-size: 9pt;
            color: #475569;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${isDemo ? `
          <div class="demo-banner">
            ⚠️ DEMONSTRATION FIXTURE DATA — SYNTHETIC STAGING ESTIMATES — NOT CERTIFIED FOR STATUTORY OR TAX COMPLIANCE
          </div>
        ` : ''}
        <div class="header">
          <div>
            <div class="title">B.R.I.M.E. S.A.L.</div>
            <div class="subtitle">${isSealed ? 'Closed-Period Management Statement' : 'Preliminary Management Statement'}</div>
            <div class="subtitle">Lebanese MoF Tax Registration: <strong>3870852</strong> | CNSS Reg: <strong>1489201</strong></div>
          </div>
          <div style="text-align: right;">
            <span class="badge ${isSealed ? 'badge-sealed' : 'badge-draft'}">
              ${isSealed ? 'Closed-Period Management Statement (Internal Reconciliation Verified)' : 'Preliminary Management Statement'}
            </span>
            <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">
              Generated: ${new Date().toLocaleString()}
            </div>
          </div>
        </div>

        <div class="meta-box">
          <div class="meta-item">
            <strong>Accounting Period</strong>
            ${data.periodCode} (1-${data.month}-${data.year} to ${new Date(data.year, data.month, 0).getDate()}-${data.month}-${data.year})
          </div>
          <div class="meta-item">
            <strong>Operating Facility</strong>
            ${data.branchName}
          </div>
          <div class="meta-item">
            <strong>Accounting Currency</strong>
            USD (United States Dollar)
          </div>
        </div>

        ${c ? `
        <div class="section-title">Consolidated Income Statement (P&L)</div>
        <table>
          <thead>
            <tr>
              <th>Financial Component</th>
              <th class="num">Amount (USD)</th>
              <th class="num">% Net Sales</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gross Sales Revenue (POS)</td>
              <td class="num">$${Number(c.gross_sales_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="num">-</td>
            </tr>
            <tr>
              <td>Promotional Discounts & Allowances</td>
              <td class="num">($${Number(c.total_discounts_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">-</td>
            </tr>
            <tr class="subtotal-row">
              <td>Net Billed Sales Revenue</td>
              <td class="num">$${Number(c.net_sales_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="num">100.0%</td>
            </tr>
            <tr>
              <td>Cost of Goods Sold (Raw Recipe Batch Consumption)</td>
              <td class="num">($${Number(c.total_cogs_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.total_cogs_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Packaging Materials Consumption</td>
              <td class="num">($${Number(c.total_packaging_cost_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.total_packaging_cost_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Production & Sales Waste</td>
              <td class="num">($${Number(c.total_waste_cost_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.total_waste_cost_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr class="subtotal-row">
              <td><strong>Operating Gross Profit</strong></td>
              <td class="num"><strong>$${Number(c.gross_profit_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
              <td class="num"><strong>${c.gross_profit_margin_pct}%</strong></td>
            </tr>
            <tr>
              <td>Direct Concept Labor</td>
              <td class="num">($${Number(c.direct_labor_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.direct_labor_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Shared Kitchen Staff Labor (Preparation Pool)</td>
              <td class="num">($${Number(c.shared_kitchen_labor_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.shared_kitchen_labor_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Direct Concept Operating Expenses</td>
              <td class="num">($${Number(c.direct_opex_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.direct_opex_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Shared Facility Overhead (Rent, Generator, Utilities)</td>
              <td class="num">($${Number(c.shared_facility_overhead_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.shared_facility_overhead_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Corporate Headquarters Overhead (Central Management)</td>
              <td class="num">($${Number(c.corporate_overhead_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              <td class="num">${((c.corporate_overhead_usd / (c.net_sales_usd || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr class="total-row">
              <td><strong>NET OPERATING PROFIT (EBIT)</strong></td>
              <td class="num"><strong>$${Number(c.net_operating_profit_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
              <td class="num"><strong>${c.net_profit_margin_pct}%</strong></td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        <div class="section-title">Concept Contribution Summary</div>
        <table>
          <thead>
            <tr>
              <th>Concept</th>
              <th class="num">Net Sales</th>
              <th class="num">Direct COGS</th>
              <th class="num">Gross Margin</th>
              <th class="num">Overhead</th>
              <th class="num">Net Profit</th>
              <th class="num">Margin %</th>
            </tr>
          </thead>
          <tbody>
            ${data.concepts.map(cp => `
              <tr>
                <td><strong>${cp.concept_name}</strong> (${cp.concept_code})</td>
                <td class="num">$${Number(cp.net_sales_usd).toFixed(2)}</td>
                <td class="num">$${Number(cp.net_direct_cogs_usd).toFixed(2)}</td>
                <td class="num">$${(Number(cp.net_sales_usd) - Number(cp.net_direct_cogs_usd)).toFixed(2)}</td>
                <td class="num">$${(Number(cp.shared_facility_overhead_usd) + Number(cp.corporate_overhead_usd)).toFixed(2)}</td>
                <td class="num" style="color: ${cp.fully_allocated_net_profit_usd >= 0 ? '#15803d' : '#b91c1c'}"><strong>$${Number(cp.fully_allocated_net_profit_usd).toFixed(2)}</strong></td>
                <td class="num">${cp.net_profit_margin_pct}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="seal-box">
          <strong>INTERNAL MANAGEMENT STATEMENT & SNAPSHOT VERIFICATION</strong><br/>
          SHA-256 Snapshot Digest: <code>${sha}</code><br/>
          Internal Status: <strong>${isSealed ? 'Closed-Period Management Statement — Internal Reconciliation Verified' : 'Preliminary Management Statement — Unclosed Period'}</strong><br/>
          <em>Note: This internal management statement reflects reconciled multi-concept sub-ledgers. It is prepared for internal operational governance and external accountant review, and does not constitute a statutory external audit opinion.</em>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">Prepared By<br/><strong>Finance & Accounting Controller</strong></div>
          </div>
          <div>
            <div class="sig-line">Reconciled & Reviewed By<br/><strong>Internal Audit Department</strong></div>
          </div>
          <div>
            <div class="sig-line">Approved By<br/><strong>Executive Director / Board of Directors</strong></div>
          </div>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 24px; background: #0f172a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            Print / Save as PDF
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
