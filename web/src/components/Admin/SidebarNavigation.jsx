import React, { useState } from "react";
import {
  Home,
  ShoppingBag,
  Layers,
  Coffee,
  Sliders,
  CheckCircle,
  Calendar,
  Send,
  Tag,
  Award,
  Gift,
  MessageSquare,
  Inbox,
  MapPin,
  DollarSign,
  Users,
  Shield,
  Globe,
  Settings,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronRight
} from "lucide-react";

export function SidebarNavigation({
  activeTab,
  onTabChange,
  tabs,
  adminUser,
  onLogout,
  mobileOpen,
  setMobileOpen
}) {
  const getIcon = (tabId) => {
    const iconMap = {
      dashboard: Home,
      orders: ShoppingBag,
      categories: Layers,
      products: Coffee,
      "customization-items": Sliders,
      "product-status": CheckCircle,
      events: Calendar,
      notifications: Send,
      "promo-codes": Tag,
      loyalty: Award,
      rewards: Gift,
      "whatsapp-inbox": MessageSquare,
      "customer-messages": Inbox,
      branches: MapPin,
      "delivery-pricing": DollarSign,
      clients: Users,
      "admin-users": Shield,
      website: Globe,
      settings: Settings,
      "bulk-upload": Upload
    };
    return iconMap[tabId] || ChevronRight;
  };

  const navGroups = [
    {
      title: "Overview & Operations",
      items: ["dashboard", "orders"]
    },
    {
      title: "Catalog Management",
      items: ["categories", "products", "customization-items", "product-status"]
    },
    {
      title: "Marketing & Rewards",
      items: ["events", "notifications", "promo-codes", "loyalty", "rewards"]
    },
    {
      title: "Customer Engagement",
      items: ["whatsapp-inbox", "customer-messages"]
    },
    {
      title: "System Config",
      items: ["branches", "delivery-pricing", "clients", "admin-users", "website", "settings", "bulk-upload"]
    }
  ];

  const handleNavClick = (tabId) => {
    onTabChange(tabId);
    if (setMobileOpen) setMobileOpen(false);
  };

  const getUserInitials = (name) => {
    if (!name) return "A";
    const parts = name.split(" ");
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
            NB
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight tracking-wide text-white">Neo Beirut</h2>
            <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">Admin Panel</span>
          </div>
        </div>
        {setMobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {navGroups.map((group, groupIdx) => {
          // Filter group items based on allowed tabs
          const allowedGroupItems = group.items.filter((item) => tabs.includes(item));
          if (allowedGroupItems.length === 0) return null;

          return (
            <div key={groupIdx} className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {allowedGroupItems.map((tabId) => {
                  const Icon = getIcon(tabId);
                  const isActive = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      onClick={() => handleNavClick(tabId)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-semibold"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon size={18} className={isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"} />
                      <span className="capitalize">{tabId.replace("-", " ")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin Profile & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
            {getUserInitials(adminUser?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-slate-200 truncate">{adminUser?.name || "Admin"}</h4>
            <p className="text-xs text-slate-400 truncate">{adminUser?.email || ""}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-rose-900/30 hover:text-rose-400 hover:border-rose-900/30 border border-slate-800 text-slate-300 rounded-lg text-sm font-medium transition-all duration-150"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 h-screen sticky top-0 z-20 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30"
        />
      )}

      {/* Mobile Drawer Content */}
      <aside
        className={`md:hidden fixed top-0 bottom-0 left-0 w-64 bg-slate-900 z-40 transition-transform duration-300 transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}