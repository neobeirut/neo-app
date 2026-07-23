import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';

import MenuManualScreen from './screens/MenuManualScreen';
import MenuRecipeFormScreen from './screens/MenuRecipeFormScreen';
import EmployeesScreen from './screens/EmployeesScreen';
import EmployeeFormScreen from './screens/EmployeeFormScreen';
import AttendanceDashboardScreen from './screens/AttendanceDashboardScreen';
import TipsScreen from './screens/TipsScreen';
import TipsCreateScreen from './screens/TipsCreateScreen';
import TipsDistributionScreen from './screens/TipsDistributionScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import SOPsScreen from './screens/SOPsScreen';
import SOPFormScreen from './screens/SOPFormScreen';
import { LayoutDashboard, ChefHat, Users, LogOut, DollarSign, Shield, BookOpen, TrendingUp, MessageSquare, Newspaper, AlertTriangle, Sparkles, Trash2, History, Coins, Truck, ShoppingBag, Calendar, ClipboardList, Package, CheckSquare, Receipt, Briefcase, Store, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from './api/client';
import FinanceDashboardScreen from './screens/FinanceDashboardScreen';
import PaymentDetailsScreen from './screens/PaymentDetailsScreen';
import ComplaintsDashboardScreen from './screens/ComplaintsDashboardScreen';
import ComplaintFormScreen from './screens/ComplaintFormScreen';
import ComplaintsAnalyticsScreen from './screens/ComplaintsAnalyticsScreen';
import NewsManagementScreen from './screens/NewsManagementScreen';
import NewsFormScreen from './screens/NewsFormScreen';
import Menu86ViewScreen from './screens/Menu86ViewScreen';
import DashboardScreen from './screens/DashboardScreen';
import ChefSpecialsScreen from './screens/ChefSpecialsScreen';
import WasteScreen from './screens/WasteScreen';
import { sessionLogger } from './utils/sessionLogger';
import SignInLogsScreen from './screens/SignInLogsScreen';
import PurchasingScreen from './screens/PurchasingScreen';
import OrdersScreen from './screens/OrdersScreen';
import ReservationsScreen from './screens/ReservationsScreen';
import ChecklistsScreen from './screens/ChecklistsScreen';
import ItemCatalogScreen from './screens/ItemCatalogScreen';
import TasksScreen from './screens/TasksScreen';
import VoidReceiptsScreen from './screens/VoidReceiptsScreen';
import ClientOrdersScreen from './screens/ClientOrdersScreen';
import ClientOrderFormScreen from './screens/ClientOrderFormScreen';
import ClientOrdersReportsScreen from './screens/ClientOrdersReportsScreen';
import SuppliersScreen from './screens/SuppliersScreen';
import WalletsScreen from './screens/WalletsScreen';
import SupplierPriceIntelligenceScreen from './screens/SupplierPriceIntelligenceScreen';
import BranchManagementScreen from './screens/BranchManagementScreen';
import ReelCreditScreen from './screens/ReelCreditScreen';
import SuperAdminScreen from './screens/SuperAdminScreen';

  function Sidebar({ onLogout, permissions, user }: { onLogout: () => void; permissions: any; user: any }) {
    const location = useLocation();
    const roleLower = (user?.role || '').toString().toLowerCase().trim();
    const isPrivileged = roleLower === 'admin' || roleLower === 'manager' || roleLower === 'superadmin';
    const isAdminOrSuper = roleLower === 'admin' || roleLower === 'superadmin';

    const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({
      Operations: false,
      Inventory: false,
      People: false,
      Customers: false,
      Analytics: false,
      Administration: false,
    });

    const toggleGroup = (name: string) => {
      setCollapsedGroups(prev => ({
        ...prev,
        [name]: !prev[name]
      }));
    };

    const isSectionEnabled = (key: string) => {
      const enabledSections = user?.restaurants?.settings?.enabled_sections;
      if (!enabledSections) return true; // Default to enabled if not configured
      return enabledSections.includes(key);
    };

    const menuGroups: any[] = [
      {
        name: 'Dashboard',
        items: [
          { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> }
        ]
      },
      {
        name: 'Operations',
        items: [
          { to: '/orders', label: 'Branch Orders', icon: <ShoppingBag size={18} />, key: 'orders' },
          { to: '/client-orders', label: 'Client Orders', icon: <Briefcase size={18} />, visible: !!permissions?.can_view_client_orders, key: 'client_orders' },
          { to: '/reservations', label: 'Table Reservations', icon: <Calendar size={18} />, key: 'reservations' },
          { to: '/checklists', label: 'Daily Checklists', icon: <ClipboardList size={18} />, key: 'checklists' },
          { to: '/tasks', label: 'Task Manager', icon: <CheckSquare size={18} />, visible: !!permissions?.can_manage_tasks, key: 'tasks' }
        ]
      },
      {
        name: 'Inventory',
        items: [
          {to: '/catalog', label: 'Item Catalog', icon: <Package size={18} />, visible: isAdminOrSuper || !!permissions?.can_view_catalog, key: 'catalog' },
          { to: '/purchasing', label: 'Purchasing & Procurement', icon: <Truck size={18} />, key: 'purchasing' },
          { to: '/suppliers', label: 'Supplier Management', icon: <Store size={18} />, visible: isAdminOrSuper || !!permissions?.can_view_suppliers, key: 'suppliers' },
          { to: '/price-intelligence', label: 'Supplier Price Intelligence', icon: <TrendingUp size={18} />, visible: isAdminOrSuper || !!permissions?.can_view_price_intelligence, key: 'price_intelligence' },
          { to: '/waste', label: 'Waste Management', icon: <Trash2 size={18} />, key: 'waste' },
          { to: '/86', label: '86 Missing Items', icon: <AlertTriangle size={18} />, key: 'missing_items' },
          { to: '/inventory-reporting', label: 'Inventory Reporting (to be added)', icon: <TrendingUp size={18} />, key: 'inventory_reporting' },
          { to: '/voids', label: 'Void Receipts', icon: <Receipt size={18} />, visible: !!permissions?.can_view_voids, key: 'voids' }
        ]
      },
      {
        name: 'People',
        items: [
          { to: '/employees', label: 'Employees', icon: <Users size={18} />, visible: isPrivileged || !!permissions?.can_manage_hr, key: 'employees' },
          { to: '/tips', label: 'Tips Config', icon: <DollarSign size={18} />, visible: isPrivileged || !!permissions?.can_manage_tips, key: 'tips' },
          { to: '/permissions', label: 'Security & Matrix', icon: <Shield size={18} />, visible: isPrivileged, key: 'permissions' },
          { to: '/signin-logs', label: 'Sign-In Logs', icon: <History size={18} />, visible: !!permissions?.can_view_signin_logs, key: 'signin_logs' }
        ]
      },
      {
        name: 'Customers',
        items: [
          { to: '/complaints', label: 'Client Complaints', icon: <MessageSquare size={18} />, visible: permissions?.can_view_complaints, key: 'complaints' },
          { to: '/specials', label: 'Specials & Upsell', icon: <Sparkles size={18} />, visible: permissions?.can_view_upsell, key: 'specials' }
        ]
      },
      {
        name: 'Analytics',
        items: [
          { to: '/finance', label: 'Financial Analytics', icon: <TrendingUp size={18} />, visible: permissions?.can_view_finance_dashboard, key: 'finance' },
          { to: '/finance/payments', label: 'Payment Details', icon: <Coins size={18} />, visible: permissions?.can_view_finance_dashboard, key: 'finance' },
          { to: '/reel-credit', label: 'Reel Credit', icon: <Receipt size={18} />, visible: permissions?.can_view_finance_dashboard, key: 'finance' }
        ]
      },
      {
        name: 'Administration',
        items: [
          { to: '/super-admin', label: 'Super Admin', icon: <Shield size={18} />, visible: user.role?.toLowerCase() === 'superadmin' },
          { to: '/branch-management', label: 'Branch Management', icon: <Store size={18} />, visible: isPrivileged, key: 'branch_management' },
          { to: '/wallets', label: 'Manage E-Wallets', icon: <Coins size={18} />, visible: isPrivileged, key: 'branch_management' },
          { to: '/news', label: 'News Management', icon: <Newspaper size={18} />, visible: isPrivileged, key: 'news' },
          { to: '/sops', label: 'SOPs & Training', icon: <BookOpen size={18} />, visible: isPrivileged, key: 'sops' },
          { to: '/menu', label: 'Menu Manual', icon: <ChefHat size={18} />, visible: isPrivileged, key: 'menu' }
        ]
      }
    ];

    const allVisibleItems = menuGroups.flatMap(group =>
      group.items.filter((item: any) => {
        if (item.visible === false) return false;
        if (item.key && !isSectionEnabled(item.key)) return false;
        return true;
      })
    );

    const isLinkActive = (itemTo: string) => {
      if (itemTo === '/') {
        return location.pathname === '/';
      }
      const isExactOrSub = location.pathname === itemTo || location.pathname.startsWith(itemTo + '/');
      if (!isExactOrSub) return false;

      // Avoid marking a link active if there is a more specific matching item visible in the sidebar
      const hasMoreSpecificMatch = allVisibleItems.some(otherItem => 
        otherItem.to !== itemTo && 
        otherItem.to.startsWith(itemTo) && 
        (location.pathname === otherItem.to || location.pathname.startsWith(otherItem.to + '/'))
      );

      return !hasMoreSpecificMatch;
    };

    return (
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user.restaurants?.logo_url ? (
            <img src={user.restaurants.logo_url} alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'contain' }} />
          ) : null}
          <span>{user.restaurants?.name || import.meta.env.VITE_APP_NAME || "NÉO Admin"}</span>
        </div>
        <div className="sidebar-nav-container">
          {menuGroups.map(group => {
            const visibleItems = group.items.filter((item: any) => {
              if (item.visible === false) return false;
              if (item.key && !isSectionEnabled(item.key)) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;

            if (group.name === 'Dashboard') {
              const item = visibleItems[0];
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  {item.icon} {item.label}
                </Link>
              );
            }

            const isCollapsed = collapsedGroups[group.name];

            return (
              <div key={group.name} className="sidebar-group">
                <div 
                  className="sidebar-group-header" 
                  onClick={() => toggleGroup(group.name)}
                >
                  <span className="sidebar-group-header-left">{group.name}</span>
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </div>
                {!isCollapsed && (
                  <div className="sidebar-group-items">
                    {visibleItems.map((item: any) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`nav-link nav-link-nested ${
                          isLinkActive(item.to) ? 'active' : ''
                        }`}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {item.icon} {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={onLogout} 
            title="Logout"
            style={{ 
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={18} />
          </button>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Flow Admin v1.0.5</div>
            <div style={{ fontSize: '10px' }}>Build: July 23, 2026</div>
          </div>
        </div>
      </div>
    );
  }


function MainLayout({ user, onLogout, onUpdateUser }: { user: any; onLogout: () => void; onUpdateUser: (user: any) => void }) {
  const isSectionEnabled = (key: string) => {
    const enabledSections = user?.restaurants?.settings?.enabled_sections;
    if (!enabledSections) return true; // Default to enabled if not configured
    return enabledSections.includes(key);
  };

  const roleLower = user.role?.toLowerCase();
  const isPrivileged = roleLower === 'admin' || roleLower === 'manager' || roleLower === 'superadmin';
  const isAdminOrSuper = roleLower === 'admin' || roleLower === 'superadmin';
  const [permissions, setPermissions] = useState<any>({
    can_view_finance_dashboard: isPrivileged,
    can_view_complaints: isPrivileged,
    can_manage_complaints: isPrivileged,
    can_view_upsell: isPrivileged,
    can_manage_upsell: isPrivileged,
    can_view_signin_logs: isPrivileged,
    can_view_voids: isPrivileged,
    can_manage_tasks: isPrivileged
  });
  const [branchesList, setBranchesList] = useState<string[]>([]);

  useEffect(() => {
    api.getBranchesList().then(res => {
      const dbNames = (res.success && res.data) ? res.data.map((b: any) => b.name) : [];
      const combined = Array.from(new Set(['Badaro', 'Naccache', ...dbNames])).filter(Boolean);
      setBranchesList(combined);
    });
  }, [user]);

  useEffect(() => {
    api.getAppPermissions(user.name, user.departments || '', user.role).then(res => {
      if (res.success && res.data) {
        setPermissions(res.data);
      }
    });
  }, [user]);

  return (
    <div className="app-layout">
      <Sidebar 
        onLogout={onLogout} 
        permissions={permissions} 
        user={user} 
      />
      <div className="main-content">
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Active Branch:</span>
              <select
                className="admin-branch-select"
                value={user.branch || 'All'}
                onChange={(e) => onUpdateUser({ ...user, branch: e.target.value })}
              >
                <option value="All">All Branches</option>
                {branchesList.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--text-muted)" />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</span>
              <span style={{ fontSize: '12px', background: '#eef2f5', color: 'var(--primary)', padding: '4px 8px', borderRadius: '12px' }}>{user.role}</span>
              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                v1.0.5 • Updated
              </span>
            </div>
          </div>
        </div>
        <div className="content-area">
          <Routes>
            <Route 
              path="/" 
              element={
                <DashboardScreen 
                  user={user} 
                  permissions={permissions} 
                />
              } 
            />
            {isSectionEnabled('orders') && <Route path="/orders" element={<OrdersScreen user={user} />} />}
            {isSectionEnabled('purchasing') && <Route path="/purchasing" element={<PurchasingScreen user={user} />} />}
            {isSectionEnabled('catalog') && (
              <Route 
                path="/catalog" 
                element={
                  isAdminOrSuper || permissions?.can_view_catalog !== false 
                    ? <ItemCatalogScreen user={user} permissions={permissions} />
                    : <Navigate to="/" replace />
                } 
              />
            )}
            {isSectionEnabled('waste') && <Route path="/waste" element={<WasteScreen user={user} />} />}
            {isSectionEnabled('reservations') && <Route path="/reservations" element={<ReservationsScreen user={user} />} />}
            {isSectionEnabled('voids') && (
              <Route 
                path="/voids" 
                element={
                  permissions?.can_view_voids !== false 
                    ? <VoidReceiptsScreen user={user} />
                    : <Navigate to="/" replace />
                } 
              />
            )}
            {isSectionEnabled('checklists') && <Route path="/checklists" element={<ChecklistsScreen user={user} />} />}
            {isSectionEnabled('menu') && (
              <>
                <Route path="/menu" element={<MenuManualScreen />} />
                <Route path="/menu/new" element={<MenuRecipeFormScreen />} />
                <Route path="/menu/edit/:id" element={<MenuRecipeFormScreen />} />
              </>
            )}
            {isSectionEnabled('missing_items') && <Route path="/86" element={<Menu86ViewScreen />} />}
            {isSectionEnabled('employees') && (
              <>
                <Route path="/employees" element={<EmployeesScreen user={user} />} />
                <Route path="/employees/new" element={<EmployeeFormScreen user={user} />} />
                <Route path="/employees/edit/:id" element={<EmployeeFormScreen user={user} />} />
              </>
            )}
            {isSectionEnabled('attendance') && (
              <Route path="/attendance" element={<AttendanceDashboardScreen user={user} permissions={permissions} />} />
            )}
            {isSectionEnabled('tips') && (
              <>
                <Route path="/tips" element={<TipsScreen />} />
                <Route path="/tips/new" element={<TipsCreateScreen />} />
                <Route path="/tips/distribution/:id" element={<TipsDistributionScreen />} />
              </>
            )}
            {isSectionEnabled('permissions') && <Route path="/permissions" element={<PermissionsScreen user={user} onUpdateUser={onUpdateUser} />} />}
            {isSectionEnabled('signin_logs') && (
              <Route 
                path="/signin-logs" 
                element={
                  permissions?.can_view_signin_logs !== false 
                    ? <SignInLogsScreen user={user} />
                    : <Navigate to="/" replace />
                } 
              />
            )}
            {isSectionEnabled('sops') && (
              <>
                <Route path="/sops" element={<SOPsScreen />} />
                <Route path="/sops/new" element={<SOPFormScreen />} />
                <Route path="/sops/edit/:id" element={<SOPFormScreen />} />
              </>
            )}
            {isSectionEnabled('complaints') && (
              <>
                <Route path="/complaints" element={<ComplaintsDashboardScreen permissions={permissions} user={user} />} />
                <Route path="/complaints/new" element={<ComplaintFormScreen permissions={permissions} user={user} />} />
                <Route path="/complaints/edit/:id" element={<ComplaintFormScreen permissions={permissions} user={user} />} />
                <Route path="/complaints/analytics" element={<ComplaintsAnalyticsScreen permissions={permissions} user={user} />} />
              </>
            )}
            {isSectionEnabled('news') && (
              <>
                <Route path="/news" element={<NewsManagementScreen />} />
                <Route path="/news/new" element={<NewsFormScreen />} />
                <Route path="/news/edit/:id" element={<NewsFormScreen />} />
              </>
            )}
            {isSectionEnabled('finance') && (
              <>
                <Route path="/finance" element={<FinanceDashboardScreen user={user} permissions={permissions} />} />
                <Route path="/finance/payments" element={<PaymentDetailsScreen user={user} />} />
                <Route path="/reel-credit" element={<ReelCreditScreen user={user} />} />
              </>
            )}
            {isSectionEnabled('specials') && <Route path="/specials" element={<ChefSpecialsScreen permissions={permissions} user={user} />} />}
            {isSectionEnabled('tasks') && (
              <Route 
                path="/tasks" 
                element={
                  permissions?.can_manage_tasks !== false 
                    ? <TasksScreen user={user} />
                    : <Navigate to="/" replace />
                } 
              />
            )}
            {isSectionEnabled('client_orders') && (
              <>
                <Route path="/client-orders" element={<ClientOrdersScreen user={user} permissions={permissions} onUpdateUser={onUpdateUser} />} />
                <Route path="/client-orders/new" element={<ClientOrderFormScreen user={user} permissions={permissions} onUpdateUser={onUpdateUser} />} />
                <Route path="/client-orders/edit/:id" element={<ClientOrderFormScreen user={user} permissions={permissions} onUpdateUser={onUpdateUser} />} />
                <Route path="/client-orders/reports" element={<ClientOrdersReportsScreen user={user} permissions={permissions} />} />
              </>
            )}
            {isSectionEnabled('suppliers') && (
              <Route 
                path="/suppliers" 
                element={
                  isAdminOrSuper || permissions?.can_view_suppliers !== false 
                    ? <SuppliersScreen user={user} permissions={permissions} />
                    : <Navigate to="/" replace />
                } 
              />
            )}
            {isSectionEnabled('branch_management') && <Route path="/wallets" element={<WalletsScreen user={user} />} />}
            {isSectionEnabled('price_intelligence') && (
              <Route 
                path="/price-intelligence" 
                element={
                  isAdminOrSuper || permissions?.can_view_price_intelligence !== false 
                    ? <SupplierPriceIntelligenceScreen user={user} permissions={permissions} />
                    : <Navigate to="/" replace />
                } 
              />
            )}
            {isSectionEnabled('inventory_reporting') && (
              <Route 
                path="/inventory-reporting" 
                element={
                  <div className="placeholder-screen" style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border)', margin: '20px' }}>
                    <TrendingUp size={48} color="var(--primary)" style={{ marginBottom: '20px' }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>Inventory Reporting</h2>
                    <p style={{ color: 'var(--text-muted)' }}>This module is currently under development. Stay tuned for advanced analytics!</p>
                  </div>
                } 
              />
            )}
            {user.role?.toLowerCase() === 'superadmin' && (
              <Route path="/super-admin" element={<SuperAdminScreen />} />
            )}
            {isSectionEnabled('branch_management') && <Route path="/branch-management" element={<BranchManagementScreen />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function darkenColor(hex: string, percent: number): string {
  try {
    let num = parseInt(hex.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) - amt,
        G = (num >> 8 & 0x00FF) - amt,
        B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 0 ? 0 : R > 255 ? 255 : R) * 0x10000 + (G < 0 ? 0 : G > 255 ? 255 : G) * 0x100 + (B < 0 ? 0 : B > 255 ? 255 : B)).toString(16).slice(1);
  } catch (e) {
    return hex;
  }
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Quick and simple persist
    const saved = localStorage.getItem('neo_admin_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      sessionLogger.startHeartbeat();

      // Background refresh of restaurant configuration settings
      if (parsed.restaurant_id) {
        api.getRestaurantById(parsed.restaurant_id).then(res => {
          if (res.success && res.data) {
            const updatedUser = { ...parsed, restaurants: res.data };
            setUser(updatedUser);
            localStorage.setItem('neo_admin_user', JSON.stringify(updatedUser));
          }
        });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && user.restaurants) {
      const color = user.restaurants.primary_color;
      if (color) {
        document.documentElement.style.setProperty('--primary', color);
        document.documentElement.style.setProperty('--primary-hover', darkenColor(color, 15));
      }
      document.title = `${user.restaurants.name} Admin` || "NÉO Admin";
    } else {
      // Revert to default
      document.documentElement.style.setProperty('--primary', '#2563eb');
      document.documentElement.style.setProperty('--primary-hover', '#1d4ed8');
      document.title = import.meta.env.VITE_APP_NAME || "FLOW Admin";
    }
  }, [user]);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('neo_admin_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    await sessionLogger.endSession();
    setUser(null);
    localStorage.removeItem('neo_admin_user');
  };

  if (loading) return null;

  return (
    <HashRouter>
      {user ? (
        <MainLayout user={user} onLogout={handleLogout} onUpdateUser={handleLogin} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </HashRouter>
  );
}

export default App;
