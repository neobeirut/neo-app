import { Home } from "lucide-react";

export function TabNavigation({ activeTab, onTabChange, tabs: tabsProp }) {
  const defaultTabs = [
    "dashboard",
    "categories",
    "products",
    "customization-items",
    "branches",
    "orders",
    "events",
    "notifications",
    "whatsapp-inbox",
    "product-status",
    "rewards",
    "promo-codes",
    "loyalty",
    "clients",
    "admin-users",
    "settings",
    "bulk-upload",
  ];

  const tabs =
    Array.isArray(tabsProp) && tabsProp.length > 0 ? tabsProp : defaultTabs;

  return (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-6 py-3 capitalize whitespace-nowrap flex items-center gap-2 ${
            activeTab === tab
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {tab === "dashboard" && <Home size={18} />}
          {tab.replace("-", " ")}
        </button>
      ))}
    </div>
  );
}
