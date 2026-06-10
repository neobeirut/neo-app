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
} from "lucide-react";

export function DashboardView({ onNavigate, adminUser }) {
  const tiles = [
    {
      id: "categories",
      title: "Categories",
      description: "Manage product categories",
      icon: Grid,
      color: "bg-blue-500",
      hoverColor: "hover:bg-blue-600",
    },
    {
      id: "products",
      title: "Products",
      description: "Add and edit menu items",
      icon: Package,
      color: "bg-green-500",
      hoverColor: "hover:bg-green-600",
    },
    {
      id: "customization-items",
      title: "Customizations",
      description: "Manage product customizations",
      icon: ListChecks,
      color: "bg-purple-500",
      hoverColor: "hover:bg-purple-600",
    },
    {
      id: "branches",
      title: "Branches",
      description: "Manage store locations",
      icon: MapPin,
      color: "bg-orange-500",
      hoverColor: "hover:bg-orange-600",
    },
    {
      id: "orders",
      title: "Orders",
      description: "View and manage orders",
      icon: ShoppingBag,
      color: "bg-red-500",
      hoverColor: "hover:bg-red-600",
    },
    {
      id: "product-status",
      title: "Product Status",
      description: "Manage product availability",
      icon: ListChecks,
      color: "bg-yellow-500",
      hoverColor: "hover:bg-yellow-600",
    },
    {
      id: "rewards",
      title: "Rewards",
      description: "Manage loyalty rewards",
      icon: Gift,
      color: "bg-pink-500",
      hoverColor: "hover:bg-pink-600",
    },
    {
      id: "loyalty",
      title: "Loyalty Program",
      description: "Manage points and transactions",
      icon: Star,
      color: "bg-indigo-500",
      hoverColor: "hover:bg-indigo-600",
    },
    {
      id: "clients",
      title: "Clients",
      description: "View customer information",
      icon: Users,
      color: "bg-teal-500",
      hoverColor: "hover:bg-teal-600",
    },
    {
      id: "admin-users",
      title: "Admin Users",
      description: "Manage admin accounts",
      icon: UserCog,
      color: "bg-gray-700",
      hoverColor: "hover:bg-gray-800",
    },
    {
      id: "settings",
      title: "Settings",
      description: "App configuration",
      icon: Settings,
      color: "bg-slate-600",
      hoverColor: "hover:bg-slate-700",
    },
    {
      id: "bulk-upload",
      title: "Bulk Upload",
      description: "Upload products in bulk",
      icon: Upload,
      color: "bg-cyan-500",
      hoverColor: "hover:bg-cyan-600",
    },
    {
      id: "events",
      title: "Events",
      description: "Manage upcoming and past event recaps",
      icon: CalendarDays,
      color: "bg-violet-500",
      hoverColor: "hover:bg-violet-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-md p-8 border-l-4 border-blue-500">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back{adminUser ? `, ${adminUser.name}` : ""}!
        </h2>
        <p className="text-gray-600">
          Select a section below to manage your bakery
        </p>
      </div>

      {/* Navigation Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              onClick={() => onNavigate(tile.id)}
              className={`${tile.color} ${tile.hoverColor} rounded-lg shadow-lg p-6 text-left text-white transition-all duration-200 transform hover:scale-105 hover:shadow-xl`}
            >
              <div className="flex items-start justify-between mb-4">
                <Icon size={32} className="opacity-90" />
              </div>
              <h3 className="text-xl font-bold mb-2">{tile.title}</h3>
              <p className="text-white text-opacity-90 text-sm">
                {tile.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Quick Stats Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-md p-8 text-white">
        <h3 className="text-xl font-bold mb-4">Quick Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate("orders")}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 transition-all"
          >
            <FileText size={24} className="mb-2" />
            <p className="font-semibold">View Orders</p>
            <p className="text-sm opacity-90">Manage customer orders</p>
          </button>
          <button
            onClick={() => onNavigate("products")}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 transition-all"
          >
            <Package size={24} className="mb-2" />
            <p className="font-semibold">Add Product</p>
            <p className="text-sm opacity-90">Add new menu items</p>
          </button>
          <button
            onClick={() => onNavigate("clients")}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 transition-all"
          >
            <Users size={24} className="mb-2" />
            <p className="font-semibold">View Clients</p>
            <p className="text-sm opacity-90">Customer information</p>
          </button>
        </div>
      </div>
    </div>
  );
}
