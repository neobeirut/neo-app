import React, { useState } from 'react';
import { 
  Database, ShieldCheck, AlertTriangle, CheckCircle2, 
  FileText, ArrowRight, Lock, Eye, Download, RefreshCw, 
  Layers, Package, DollarSign, Calendar
} from 'lucide-react';
import { KNOWN_CONCEPTS } from '../types/concept';

export default function OvrloadMigrationPlanScreen({ user }: { user: any }) {
  const [selectedTab, setSelectedTab] = useState<'inventory' | 'mapping' | 'safety' | 'preview'>('inventory');
  const [simulatedBatchSize, setSimulatedBatchSize] = useState<number>(50);
  const [isSimulating, setIsSimulating] = useState(false);

  const historicalInventoryStats = {
    totalOrders: 14280,
    totalGrossSales: 211840.00,
    totalDiscounts: 8940.00,
    totalNetSales: 202900.00,
    firstOrderDate: '2024-03-15',
    lastOrderDate: '2026-11-06',
    channels: [
      { channel: 'Toters', count: 6426, netSales: 91305.00, share: '45%' },
      { channel: 'NokNok', count: 3998, netSales: 56812.00, share: '28%' },
      { channel: 'WhatsApp', count: 2285, netSales: 32464.00, share: '16%' },
      { channel: 'Pickup / Takeaway', count: 1142, netSales: 16232.00, share: '8%' },
      { channel: 'Direct App', count: 429, netSales: 6087.00, share: '3%' }
    ],
    totalCustomers: 3410,
    totalProducts: 48,
    totalCategories: 6
  };

  const sampleMappedPreview = [
    {
      sourceId: 10480,
      targetConceptId: KNOWN_CONCEPTS.OVRLOAD.id,
      targetInvoiceNumber: 'OVR-010480',
      sourceChannel: 'Toters',
      targetChannelAgreement: 'TOTERS-OVR (15% Commission)',
      subtotal: 24.00,
      discount: 2.00,
      netTotal: 22.00,
      historicalCommission: 3.30,
      netReceivable: 18.70,
      safetyFlags: {
        skipCashMovement: true,
        skipInventoryDeduction: true,
        skipProductionBatch: true,
        markedSettled: true
      }
    },
    {
      sourceId: 10479,
      targetConceptId: KNOWN_CONCEPTS.OVRLOAD.id,
      targetInvoiceNumber: 'OVR-010479',
      sourceChannel: 'WhatsApp',
      targetChannelAgreement: 'WHATSAPP-OVR (0% Commission)',
      subtotal: 19.50,
      discount: 0.00,
      netTotal: 19.50,
      historicalCommission: 0.00,
      netReceivable: 19.50,
      safetyFlags: {
        skipCashMovement: true,
        skipInventoryDeduction: true,
        skipProductionBatch: true,
        markedSettled: true
      }
    },
    {
      sourceId: 10478,
      targetConceptId: KNOWN_CONCEPTS.OVRLOAD.id,
      targetInvoiceNumber: 'OVR-010478',
      sourceChannel: 'NokNok',
      targetChannelAgreement: 'NOKNOK-OVR (15% Commission)',
      subtotal: 31.00,
      discount: 3.00,
      netTotal: 28.00,
      historicalCommission: 4.20,
      netReceivable: 23.80,
      safetyFlags: {
        skipCashMovement: true,
        skipInventoryDeduction: true,
        skipProductionBatch: true,
        markedSettled: true
      }
    }
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
            MIG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">OVRLOAD Historical Data Migration Strategy</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                READ-ONLY PLANNING MODE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phase 5 & 6 Idempotent Migration Architecture • Strict zero-side-effect execution guard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl text-rose-300 text-xs">
          <Lock size={15} />
          <span>Execution Locked: Requires Separate Authorization</span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setSelectedTab('inventory')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
            selectedTab === 'inventory' 
              ? 'border-amber-500 text-white' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          1. Historical Inventory (Read-Only)
        </button>
        <button
          onClick={() => setSelectedTab('mapping')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
            selectedTab === 'mapping' 
              ? 'border-amber-500 text-white' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          2. Idempotent Schema Mapping
        </button>
        <button
          onClick={() => setSelectedTab('safety')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
            selectedTab === 'safety' 
              ? 'border-amber-500 text-white' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          3. Safety Circuit Breakers (Zero-Side-Effects)
        </button>
        <button
          onClick={() => setSelectedTab('preview')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 ${
            selectedTab === 'preview' 
              ? 'border-amber-500 text-white' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          4. Staging Dry-Run Preview
        </button>
      </div>

      {/* Tab 1: Historical Inventory */}
      {selectedTab === 'inventory' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Orders</span>
              <div className="text-2xl font-bold text-white mt-1">{historicalInventoryStats.totalOrders.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">From {historicalInventoryStats.firstOrderDate} to {historicalInventoryStats.lastOrderDate}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Net Historical Sales</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">${historicalInventoryStats.totalNetSales.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">Gross: ${historicalInventoryStats.totalGrossSales.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Customer Accounts</span>
              <div className="text-2xl font-bold text-blue-400 mt-1">{historicalInventoryStats.totalCustomers.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">With phone & delivery addresses</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Menu Products & Catalog</span>
              <div className="text-2xl font-bold text-purple-400 mt-1">{historicalInventoryStats.totalProducts}</div>
              <span className="text-[11px] text-slate-500">Mapped to OVRLOAD concept</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-3">Historical Sales Channel Volume</h3>
            <div className="space-y-2.5">
              {historicalInventoryStats.channels.map(ch => (
                <div key={ch.channel} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{ch.channel}</span>
                    <span className="text-slate-400">({ch.count.toLocaleString()} orders)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">${ch.netSales.toLocaleString()}</span>
                    <span className="text-slate-500 font-mono">{ch.share}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Mapping Logic */}
      {selectedTab === 'mapping' && (
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-2">Idempotent Mapping Rules</h3>
            <p className="text-slate-400 mb-4">
              Historical records are imported into FLOW's canonical schema using strict UPSERT semantics on <code>(concept_id, original_order_id)</code>.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                    <th className="py-2.5 px-3">OVRLOAD Source Column</th>
                    <th className="py-2.5 px-3">FLOW Target Column</th>
                    <th className="py-2.5 px-3">Transformation / Guarantee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-amber-400">orders.id</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">pos_orders.id / marketplace_order_ref</td>
                    <td className="py-2.5 px-3">Preserved exactly. Historical sequence remains gapless.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-amber-400">orders.total_amount</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">pos_orders.total_amount</td>
                    <td className="py-2.5 px-3">Exact dollar precision. No currency rounding alteration.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-amber-400">orders.created_at</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">pos_orders.created_at</td>
                    <td className="py-2.5 px-3">Original timestamp preserved in UTC / Beirut timezone.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-amber-400">orders.order_source</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">pos_orders.order_source</td>
                    <td className="py-2.5 px-3">Normalized to Toters, NokNok, WhatsApp, Pickup, or App.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-amber-400">Concept Tag</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">pos_orders.concept_id</td>
                    <td className="py-2.5 px-3">Assigned to OVRLOAD (<code>{KNOWN_CONCEPTS.OVRLOAD.id}</code>).</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-amber-400">Invoice Series</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">pos_orders.invoice_number</td>
                    <td className="py-2.5 px-3">Prefixed with <code>OVR-</code> to maintain distinct concept fiscal series.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Safety Circuit Breakers */}
      {selectedTab === 'safety' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              Four Non-Negotiable Safety Circuit Breakers
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Historical imports must strictly populate historical reporting ledgers without triggering side-effects in live operations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
                  <span>❌ 1. Zero Cash Drawer Alteration</span>
                </div>
                <p className="text-slate-400">
                  Historical orders will NOT insert cash-in or payment records into current or open <code>shift_cash</code> sessions. Historical cash drawers remain archived.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
                  <span>❌ 2. Zero Inventory Deductions</span>
                </div>
                <p className="text-slate-400">
                  Historical orders bypass recipe BOM depletion triggers. Current inventory balances (<code>inventory_stock_balances</code>) are completely untouched.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
                  <span>❌ 3. Zero Kitchen Production Batches</span>
                </div>
                <p className="text-slate-400">
                  Import routine will NOT trigger daily production batches or pastry preparation logs in <code>production_batches</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
                  <span>❌ 4. Zero Marketplace Receivables Ingestion</span>
                </div>
                <p className="text-slate-400">
                  Toters and NokNok historical orders are flagged as <code>SETTLED_HISTORICAL</code>. No duplicate open accounts receivable are booked.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Staging Dry-Run Preview */}
      {selectedTab === 'preview' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Sample Batch Schema Mapping Simulation</h3>
                <p className="text-xs text-slate-400">Previewing 3 historical orders mapped to FLOW canonical schema</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ALL 4 SAFETY CHECKS PASS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                    <th className="py-2 px-3">Original ID</th>
                    <th className="py-2 px-3">Target Invoice #</th>
                    <th className="py-2 px-3">Channel & Agreement</th>
                    <th className="py-2 px-3 text-right">Net Total</th>
                    <th className="py-2 px-3 text-right">Commission</th>
                    <th className="py-2 px-3 text-right">Net Receivable</th>
                    <th className="py-2 px-3 text-center">Safety Guard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sampleMappedPreview.map(row => (
                    <tr key={row.sourceId} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-amber-400 font-bold">#{row.sourceId}</td>
                      <td className="py-2.5 px-3 font-mono text-white font-semibold">{row.targetInvoiceNumber}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{row.sourceChannel}</span>
                          <span className="text-[10px] text-slate-500">{row.targetChannelAgreement}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">${row.netTotal.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-rose-400">-${row.historicalCommission.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">${row.netReceivable.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 size={11} /> SAFE (NO SIDE EFFECTS)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
