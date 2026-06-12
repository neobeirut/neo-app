import { useState, useEffect, useMemo } from "react";
import {
  Package,
  ShoppingBag,
  MapPin,
  FileText,
  Gift,
  Star,
  Users,
  UserCog,
  Settings,
  Upload,
  Grid,
  ListChecks,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from "recharts";

// Helper for formatting currencies
const formatCurrency = (val) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val || 0);
};

// Colors for Recharts
const CHART_COLORS = {
  primary: "#6366f1", // Indigo
  secondary: "#06b6d4", // Cyan
  accent: "#f43f5e", // Rose
  success: "#10b981", // Emerald
  warning: "#f59e0b", // Amber
  purple: "#8b5cf6", // Purple
  gray: "#6b7280" // Gray
};

const PIE_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#6b7280"];

export function DashboardView({
  orders = [],
  users = [],
  products = [],
  branches = [],
  loading = false,
  onNavigate,
  adminUser
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter completed/delivered/ready orders for positive revenue mapping
  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === "completed");
  }, [orders]);

  // Compute KPI values
  const kpis = useMemo(() => {
    const totalSales = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const totalOrders = orders.length;
    const activeClients = users.length;
    const aov = completedOrders.length > 0 ? totalSales / completedOrders.length : 0;

    return {
      totalSales,
      totalOrders,
      activeClients,
      aov
    };
  }, [orders, users, completedOrders]);

  // 1. Sales Trend (Last 14 Days)
  const salesTrendData = useMemo(() => {
    const dataMap = {};
    // Seed last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dataMap[dateStr] = { date: label, sales: 0, orders: 0 };
    }

    // Populate data
    completedOrders.forEach(o => {
      // Use created_at or fallback to scheduled_date
      const dateVal = o.created_at || o.scheduled_date;
      if (!dateVal) return;
      
      const dateStr = new Date(dateVal).toISOString().split("T")[0];
      if (dataMap[dateStr]) {
        dataMap[dateStr].sales += parseFloat(o.total_amount || 0);
        dataMap[dateStr].orders += 1;
      }
    });

    return Object.values(dataMap);
  }, [completedOrders]);

  // 2. Popular Products (Top 5)
  const popularProductsData = useMemo(() => {
    const productQuantities = {};
    completedOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const name = item.product_name || "Unknown Product";
        productQuantities[name] = (productQuantities[name] || 0) + parseInt(item.quantity || 0);
      });
    });

    return Object.entries(productQuantities)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [completedOrders]);

  // 3. Sales by Branch
  const branchSalesData = useMemo(() => {
    const branchSales = {};
    completedOrders.forEach(o => {
      const branch = o.branch_name || "Unknown Branch";
      branchSales[branch] = (branchSales[branch] || 0) + parseFloat(o.total_amount || 0);
    });

    return Object.entries(branchSales)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales);
  }, [completedOrders]);

  // 4. Order Status Breakdown
  const orderStatusData = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      const status = o.status || "pending";
      counts[status] = (counts[status] || 0) + 1;
    });

    const statusLabels = {
      pending: "Pending",
      accepted: "Accepted",
      preparing: "Preparing",
      ready: "Ready",
      out_for_delivery: "Out for Delivery",
      completed: "Completed",
      cancelled: "Cancelled"
    };

    return Object.entries(counts).map(([status, value]) => ({
      name: statusLabels[status] || status.replace("_", " "),
      value
    }));
  }, [orders]);

  // Recent Orders Feed (Last 5 orders)
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const dateA = new Date(a.created_at || a.scheduled_date || 0);
        const dateB = new Date(b.created_at || b.scheduled_date || 0);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [orders]);

  // Original Navigation shortcuts mapping
  const navigationShortcuts = [
    { id: "categories", title: "Categories", icon: Grid, color: "from-blue-500 to-indigo-600" },
    { id: "products", title: "Products", icon: Package, color: "from-emerald-500 to-teal-600" },
    { id: "customization-items", title: "Customizations", icon: ListChecks, color: "from-purple-500 to-fuchsia-600" },
    { id: "branches", title: "Branches", icon: MapPin, color: "from-orange-500 to-amber-600" },
    { id: "orders", title: "Orders", icon: ShoppingBag, color: "from-red-500 to-rose-600" },
    { id: "product-status", title: "Product Availability", icon: ListChecks, color: "from-yellow-500 to-amber-500" },
    { id: "rewards", title: "Rewards Catalog", icon: Gift, color: "from-pink-500 to-rose-600" },
    { id: "loyalty", title: "Loyalty Program", icon: Star, color: "from-indigo-500 to-violet-600" },
    { id: "clients", title: "Clients View", icon: Users, color: "from-teal-500 to-emerald-600" },
    { id: "admin-users", title: "Admin Settings", icon: UserCog, color: "from-slate-600 to-slate-800" },
    { id: "settings", title: "App Configuration", icon: Settings, color: "from-slate-500 to-zinc-600" },
    { id: "bulk-upload", title: "Bulk Upload", icon: Upload, color: "from-cyan-500 to-sky-600" },
    { id: "events", title: "Bakery Events", icon: CalendarDays, color: "from-violet-500 to-purple-600" },
  ];

  const statusColors = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    accepted: "bg-blue-100 text-blue-800 border-blue-200",
    preparing: "bg-purple-100 text-purple-800 border-purple-200",
    ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
    out_for_delivery: "bg-indigo-100 text-indigo-800 border-indigo-200",
    completed: "bg-slate-100 text-slate-800 border-slate-200",
    cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  };

  // Render skeleton screens if data is loading
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* KPI Skels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="h-4 bg-gray-200 rounded-md w-2/3"></div>
              <div className="h-8 bg-gray-200 rounded-md w-1/2"></div>
            </div>
          ))}
        </div>

        {/* Charts Skels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[350px] bg-gray-100 border border-gray-200 rounded-2xl p-6"></div>
          <div className="h-[350px] bg-gray-100 border border-gray-200 rounded-2xl p-6"></div>
        </div>

        {/* List Skel */}
        <div className="h-[300px] bg-gray-100 border border-gray-200 rounded-2xl p-6"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Dashboard Summary Top Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl shadow-xl p-8 border border-indigo-900/40">
        <div className="relative z-10 md:flex justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
              Welcome Back{adminUser ? ", " + adminUser.name : ""}!
            </h2>
            <p className="text-indigo-200 max-w-xl text-sm font-medium">
              Here is your bakery's latest performance summary. Review sales trends, top products, and process active client orders.
            </p>
          </div>
          {adminUser?.branch_name && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <MapPin size={14} />
              {adminUser.branch_name} Branch
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Revenue */}
        <div className="group relative overflow-hidden bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {formatCurrency(kpis.totalSales)}
            </h3>
            <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium mt-1">
              <TrendingUp size={12} />
              Completed sales
            </p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Card 2: Orders Count */}
        <div className="group relative overflow-hidden bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Orders</p>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {kpis.totalOrders}
            </h3>
            <p className="text-xs text-indigo-500 flex items-center gap-1 font-medium mt-1">
              <Activity size={12} />
              Total in system
            </p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* Card 3: Active Clients */}
        <div className="group relative overflow-hidden bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Active Customers</p>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {kpis.activeClients}
            </h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 font-medium mt-1">
              Registered clients
            </p>
          </div>
          <div className="p-4 bg-cyan-50 rounded-2xl text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-all duration-300">
            <Users size={24} />
          </div>
        </div>

        {/* Card 4: AOV */}
        <div className="group relative overflow-hidden bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-300 border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Avg. Order Value</p>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {formatCurrency(kpis.aov)}
            </h3>
            <p className="text-xs text-indigo-500 flex items-center gap-1 font-medium mt-1">
              Average check size
            </p>
          </div>
          <div className="p-4 bg-rose-50 rounded-2xl text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all duration-300">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* Visual Charts Section */}
      {isMounted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Trend Area Chart */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-base font-bold text-slate-800">Sales Trend</h4>
                <p className="text-slate-500 text-xs">Revenue generated over the last 14 days</p>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                    formatter={(val) => [formatCurrency(val), "Revenue"]}
                  />
                  <Area type="monotone" dataKey="sales" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Order Status Pie Chart */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-800 mb-1">Order Status</h4>
              <p className="text-slate-500 text-xs mb-4">Breakdown of orders by current state</p>
            </div>
            {orderStatusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No orders registered</div>
            ) : (
              <div className="h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] font-semibold text-slate-600">
              {orderStatusData.slice(0, 6).map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-1.5 truncate">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                  <span className="truncate">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products Bar Chart */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
            <div>
              <h4 className="text-base font-bold text-slate-800">Popular Products</h4>
              <p className="text-slate-500 text-xs mb-4">Top 5 best-sellers by quantity sold</p>
            </div>
            {popularProductsData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No sales items calculated</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularProductsData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 10, fontWeight: 500 }} />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: "12px" }} />
                    <Bar dataKey="quantity" radius={[0, 8, 8, 0]}>
                      {popularProductsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Sales by Branch Bar Chart */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm lg:col-span-2">
            <div>
              <h4 className="text-base font-bold text-slate-800">Sales by Branch</h4>
              <p className="text-slate-500 text-xs mb-4">Revenue share distribution per branch</p>
            </div>
            {branchSalesData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No branch sales registered</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchSalesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: "12px" }}
                      formatter={(val) => [formatCurrency(val), "Revenue"]}
                    />
                    <Bar dataKey="sales" fill={CHART_COLORS.secondary} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Orders activity table */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="text-base font-bold text-slate-800">Recent Activity</h4>
            <p className="text-slate-500 text-xs">Overview of the latest orders received</p>
          </div>
          <button
            onClick={() => onNavigate("orders")}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all"
          >
            Manage All
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="pb-3 pr-4">Order ID</th>
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4">Branch</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4 text-right">Amount</th>
                <th className="pb-3 pr-4 text-center">Status</th>
                <th className="pb-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-slate-400 text-sm">No orders recorded</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pr-4 font-semibold text-slate-900">#{order.id}</td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-800">{order.customer_name || "Guest"}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{order.customer_email || "N/A"}</div>
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{order.branch_name || "N/A"}</td>
                    <td className="py-4 pr-4 text-slate-600 capitalize">{order.order_type}</td>
                    <td className="py-4 pr-4 text-slate-500 text-xs">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date(order.scheduled_date).toLocaleDateString()}
                    </td>
                    <td className="py-4 pr-4 text-right font-bold text-slate-800">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-4 pr-4 text-center">
                      <span className={`px-2.5 py-0.5 inline-flex text-[11px] leading-5 font-bold rounded-full border ${statusColors[order.status] || "bg-slate-50 text-slate-800 border-slate-200"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <button
                        onClick={() => onNavigate("orders")}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation Shortcut Grid inside collapsible container */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShortcutsExpanded(!shortcutsExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-50/50 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Grid className="text-indigo-600" size={20} />
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-800">Navigation Shortcuts</h4>
              <p className="text-slate-500 text-xs">Access all sections of the admin interface directly</p>
            </div>
          </div>
          <div className="text-slate-500 transition-transform duration-300" style={{ transform: shortcutsExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <ChevronDown size={20} />
          </div>
        </button>

        {shortcutsExpanded && (
          <div className="border-t border-slate-100 p-6 bg-slate-50/20">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {navigationShortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <button
                    key={shortcut.id}
                    onClick={() => onNavigate(shortcut.id)}
                    className="flex flex-col items-center justify-center p-4 bg-white hover:bg-indigo-50/20 border border-slate-100 hover:border-indigo-100 rounded-2xl shadow-sm text-center transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-md cursor-pointer group"
                  >
                    <div className="p-3 bg-slate-50 rounded-xl text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-3 transition-colors">
                      <Icon size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 tracking-tight transition-colors">
                      {shortcut.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
