"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Tag, 
  Truck, 
  Calendar, 
  Download, 
  Clock, 
  AlertTriangle, 
  CreditCard,
  RefreshCw
} from "lucide-react";

export default function ReportsView() {
  const [range, setRange] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/admin/reports?range=${range}`;
      if (range === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setReportData(data);
      } else {
        setError(data.error || "Failed to load report analytics");
      }
    } catch (err) {
      setError("Error connecting to server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [range]);

  const handleExportCSV = () => {
    if (!reportData) return;

    const { summary, channels, paymentMethods, topProducts } = reportData;

    let csvContent = "data:text/csv;charset=utf-8,";

    // Summary Section
    csvContent += "SALES & POS SUMMARY REPORT\n";
    csvContent += `Filter Range,${range}\n`;
    csvContent += `Generated At,${new Date().toLocaleString()}\n\n`;
    csvContent += "Metric,Value\n";
    csvContent += `Total Completed Orders,${summary.total_orders || 0}\n`;
    csvContent += `Total Net Revenue,$${(summary.total_revenue || 0).toFixed(2)}\n`;
    csvContent += `Gross Subtotal,$${(summary.gross_subtotal || 0).toFixed(2)}\n`;
    csvContent += `Total Discounts,$${(summary.total_discounts || 0).toFixed(2)}\n`;
    csvContent += `Total Delivery Fees,$${(summary.total_delivery_fees || 0).toFixed(2)}\n`;
    csvContent += `Average Order Value,$${(summary.avg_order_value || 0).toFixed(2)}\n\n`;

    // Channels
    csvContent += "CHANNEL SALES BREAKDOWN\n";
    csvContent += "Channel,Orders,Revenue,Discounts\n";
    (channels || []).forEach((c) => {
      csvContent += `${c.channel},${c.order_count},$${(c.total_revenue || 0).toFixed(2)},$${(c.total_discount || 0).toFixed(2)}\n`;
    });
    csvContent += "\n";

    // Payment Methods
    csvContent += "PAYMENT METHOD RECONCILIATION\n";
    csvContent += "Payment Method,Orders,Total Amount\n";
    (paymentMethods || []).forEach((p) => {
      csvContent += `${p.method},${p.order_count},$${(p.total_revenue || 0).toFixed(2)}\n`;
    });
    csvContent += "\n";

    // Top Products
    csvContent += "TOP SELLING PRODUCTS\n";
    csvContent += "Product Name,Category,Quantity Sold,Total Revenue\n";
    (topProducts || []).forEach((item) => {
      csvContent += `"${item.product_name}",${item.category_name},${item.total_qty},$${(item.total_revenue || 0).toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ovrload_pos_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = reportData?.summary || {};
  const channels = reportData?.channels || [];
  const paymentMethods = reportData?.paymentMethods || [];
  const topProducts = reportData?.topProducts || [];
  const categories = reportData?.categories || [];
  const voidedSummary = reportData?.voidedSummary || {};
  const voidedOrders = reportData?.voidedOrders || [];
  const hourlySales = reportData?.hourlySales || [];

  const maxChannelRevenue = Math.max(...channels.map((c) => c.total_revenue || 0), 1);

  return (
    <div className="space-y-6 select-none pb-12">
      {/* HEADER & DATE RANGE FILTER BAR */}
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#eb660c]/20 text-[#eb660c] flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-white">POS Sales & Analytics Reports</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">Real-time revenue, order origins, payment reconciliation, and top sellers</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "7days", label: "Last 7 Days" },
            { id: "thismonth", label: "This Month" },
            { id: "all", label: "All Time" },
            { id: "custom", label: "Custom Range" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setRange(btn.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                range === btn.id
                  ? "bg-[#eb660c] text-white shadow-md"
                  : "bg-[#0F1115] text-gray-400 hover:text-white border border-[#262D3D]"
              }`}
            >
              {btn.label}
            </button>
          ))}

          <button
            onClick={fetchReport}
            className="p-2 bg-[#262D3D] hover:bg-[#323B4E] text-white rounded-xl text-xs font-bold transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!reportData || loading}
            className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-black rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Custom Date Inputs */}
      {range === "custom" && (
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">Start Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0F1115] border border-[#262D3D] text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#eb660c]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">End Date:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0F1115] border border-[#262D3D] text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#eb660c]"
            />
          </div>
          <button
            onClick={fetchReport}
            className="px-4 py-1.5 bg-[#eb660c] text-white rounded-xl text-xs font-extrabold hover:bg-[#d55909]"
          >
            Apply Range
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-400 rounded-2xl p-4 text-xs font-bold">
          {error}
        </div>
      )}

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Net Revenue */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 space-y-2 shadow-lg">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold">Net Revenue</span>
            <div className="p-2 rounded-xl bg-[#eb660c]/20 text-[#eb660c]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            ${(summary.total_revenue || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">Gross: ${(summary.gross_subtotal || 0).toFixed(2)}</div>
        </div>

        {/* Total Orders */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 space-y-2 shadow-lg">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold">Completed Orders</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {summary.total_orders || 0}
          </div>
          <div className="text-[11px] text-gray-500">Avg Value: ${(summary.avg_order_value || 0).toFixed(2)}</div>
        </div>

        {/* Average Order Value */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 space-y-2 shadow-lg">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold">Avg Order Value</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            ${(summary.avg_order_value || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">Per ticket average</div>
        </div>

        {/* Total Discounts */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 space-y-2 shadow-lg">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold">Total Discounts</span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#eb660c]">
            -${(summary.total_discounts || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">Campaigns & promos</div>
        </div>

        {/* Delivery Fees */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 space-y-2 shadow-lg col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-bold">Delivery Fees</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            ${(summary.total_delivery_fees || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">Collected for deliveries</div>
        </div>
      </div>

      {/* CHARTS SECTION: CHANNELS & PAYMENT METHODS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Channels Breakdown */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>🛵</span> Sales Channel Performance
            </h2>
            <span className="text-xs text-gray-400 font-bold">{channels.length} Active Channels</span>
          </div>

          <div className="space-y-3">
            {channels.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">No channel data available for this range</div>
            ) : (
              channels.map((ch) => {
                const percent = Math.min(100, Math.round(((ch.total_revenue || 0) / maxChannelRevenue) * 100));
                const badgeColor =
                  ch.channel === "Toters" ? "bg-[#00C49F] text-black" :
                  ch.channel === "WhatsApp" ? "bg-[#25D366] text-black" :
                  ch.channel === "NokNok" ? "bg-[#FF5A5F] text-white" :
                  ch.channel === "App" ? "bg-[#3B82F6] text-white" :
                  "bg-[#E5C07B] text-black";

                return (
                  <div key={ch.channel} className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg font-black text-[11px] ${badgeColor}`}>
                          {ch.channel}
                        </span>
                        <span className="text-gray-400 font-semibold">{ch.order_count} orders</span>
                      </div>
                      <span className="font-black text-white text-sm">${(ch.total_revenue || 0).toFixed(2)}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-[#181C24] h-2 rounded-full overflow-hidden">
                      <div className="bg-[#eb660c] h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Payment Method Reconciliation */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#eb660c]" /> Payment Method Reconciliation
            </h2>
            <span className="text-xs text-gray-400 font-bold">End-of-Day Shift Balances</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {paymentMethods.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-xs text-gray-500">No payment data available</div>
            ) : (
              paymentMethods.map((pm) => (
                <div key={pm.method} className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-gray-300 flex items-center gap-1.5">
                      {pm.method === "Cash" ? "💵 Cash" : pm.method === "Whish" ? "🟣 Whish" : pm.method === "Toters" ? "🟢 Toters" : "🔴 NokNok"}
                    </span>
                    <span className="text-[11px] text-gray-500 font-bold">{pm.order_count} orders</span>
                  </div>
                  <div className="text-xl font-black text-white">
                    ${(pm.total_revenue || 0).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* TOP SELLING PRODUCTS & CATEGORY RANKINGS */}
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>🍔</span> Best-Selling Products Ranking
          </h2>
          <span className="text-xs text-gray-400 font-bold">Top 15 Items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262D3D] text-gray-400 font-bold uppercase text-[10px]">
                <th className="pb-3 pl-2">#</th>
                <th className="pb-3">Product Name</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-center">Qty Sold</th>
                <th className="pb-3 text-right pr-2">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262D3D]/50 text-gray-300 font-semibold">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">No product sales found for this period</td>
                </tr>
              ) : (
                topProducts.map((item, idx) => (
                  <tr key={item.product_id || idx} className="hover:bg-[#0F1115]/50 transition-colors">
                    <td className="py-3 pl-2 font-black text-[#eb660c]">{idx + 1}</td>
                    <td className="py-3 font-extrabold text-white">{item.product_name}</td>
                    <td className="py-3 text-gray-400">{item.category_name}</td>
                    <td className="py-3 text-center font-bold text-white bg-[#0F1115] rounded-lg px-2 py-1">{item.total_qty}</td>
                    <td className="py-3 text-right pr-2 font-black text-[#eb660c]">${(item.total_revenue || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VOIDED & CANCELLED ORDERS AUDIT LOG */}
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
          <h2 className="text-base font-extrabold text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" /> Voided Orders Audit Log
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg font-bold">
              Total Voids: {voidedSummary.void_count || 0} (${(voidedSummary.total_voided_amount || 0).toFixed(2)})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262D3D] text-gray-400 font-bold uppercase text-[10px]">
                <th className="pb-3 pl-2">Order ID</th>
                <th className="pb-3">Origin</th>
                <th className="pb-3">Date / Time</th>
                <th className="pb-3">Void Reason</th>
                <th className="pb-3 text-right pr-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262D3D]/50 text-gray-300 font-semibold">
              {voidedOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">No voided orders recorded</td>
                </tr>
              ) : (
                voidedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#0F1115]/50 transition-colors">
                    <td className="py-3 pl-2 font-bold text-white">#{order.id}</td>
                    <td className="py-3 text-gray-400">{order.order_source}</td>
                    <td className="py-3 text-gray-400">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="py-3 text-red-300 italic">{order.void_reason || "No reason specified"}</td>
                    <td className="py-3 text-right pr-2 font-bold text-red-400">${(order.total_amount || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
