import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import PosTerminalScreen from './screens/PosTerminalScreen';
import { KdsScreen } from './pos/kds';

import MenuManualScreen from './screens/MenuManualScreen';
import MenuRecipeFormScreen from './screens/MenuRecipeFormScreen';
import EmployeesScreen from './screens/EmployeesScreen';
import EmployeeFormScreen from './screens/EmployeeFormScreen';
import AttendanceDashboardScreen from './screens/AttendanceDashboardScreen';
import TipsScreen from './screens/TipsScreen';
import TipsCreateScreen from './screens/TipsCreateScreen';
import TipsDistributionScreen from './screens/TipsDistributionScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import StaffDepartmentsScreen from './screens/StaffDepartmentsScreen';
import SalaryPaymentsScreen from './screens/SalaryPaymentsScreen';
import SOPsScreen from './screens/SOPsScreen';
import SOPFormScreen from './screens/SOPFormScreen';
import { LayoutDashboard, ChefHat, Users, LogOut, DollarSign, Shield, BookOpen, TrendingUp, MessageSquare, Newspaper, AlertTriangle, Sparkles, Trash2, History, Coins, Truck, ShoppingBag, Calendar, ClipboardList, Package, CheckSquare, Receipt, Briefcase, Store, ChevronDown, ChevronRight, Clock, Target, Layers, Download } from 'lucide-react';
import { api, hasAdminAccess, getRestaurantId, setCachedRestaurantId } from './api/client';
import { usePWA } from './hooks/usePWA';
import AssessmentsScreen from './screens/AssessmentsScreen';
import AssessmentConductWebScreen from './screens/AssessmentConductWebScreen';
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
import InventoryScreen from './screens/InventoryScreen';

  function Sidebar({ onLogout, permissions, user }: { onLogout: () => void; permissions: any; user: any }) {
    const location = useLocation();
    const { isInstallable, isInstalled, installApp } = usePWA();

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
      if (user?.role?.toLowerCase() === 'superadmin') return true;
      if (key === 'permissions') return true;
      const enabledSections = user?.restaurants?.settings?.enabled_sections;
      if (!enabledSections) return true; // Default to enabled if not configured
      if (key === 'inventory_reporting') {
        return enabledSections.includes('inventory_reporting') || enabledSections.includes('inventory');
      }
      if (key === 'payment_details' || key === 'reel_credit') {
        return enabledSections.includes(key) || enabledSections.includes('finance');
      }
      if (key === 'wallets') {
        return enabledSections.includes(key) || enabledSections.includes('branch_management');
      }
      if (key === 'departments_sections' || key === 'salary_payments') {
        return enabledSections.includes(key) || enabledSections.includes('employees');
      }
      return enabledSections.includes(key);
    };

    const canAccess = (moduleKey: string, staffFallback: boolean = false) => {
      return hasAdminAccess(user, permissions, moduleKey, staffFallback);
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
          { to: '/pos', label: 'Point of Sale (POS)', icon: <Store size={18} />, visible: canAccess('pos', true), key: 'pos' },
          { to: '/kds', label: 'Kitchen Display (KDS)', icon: <ChefHat size={18} />, visible: canAccess('pos', true), key: 'kds' },
          { to: '/orders', label: 'Branch Orders', icon: <ShoppingBag size={18} />, visible: canAccess('orders', permissions?.can_create_orders !== false || permissions?.can_receive_orders !== false), key: 'orders' },
          { to: '/client-orders', label: 'Client Orders', icon: <Briefcase size={18} />, visible: canAccess('client_orders', !!permissions?.can_view_client_orders), key: 'client_orders' },
          { to: '/reservations', label: 'Table Reservations', icon: <Calendar size={18} />, visible: canAccess('reservations', !!permissions?.can_manage_reservations), key: 'reservations' },
          { to: '/checklists', label: 'Daily Checklists', icon: <ClipboardList size={18} />, visible: canAccess('checklists', permissions?.can_manage_checklists !== false || permissions?.can_fill_checklists !== false), key: 'checklists' },
          { to: '/tasks', label: 'Task Manager', icon: <CheckSquare size={18} />, visible: canAccess('tasks', !!permissions?.can_manage_tasks), key: 'tasks' }
        ]
      },
      {
        name: 'Inventory',
        items: [
          { to: '/catalog', label: 'Item Catalog', icon: <Package size={18} />, visible: canAccess('catalog', permissions?.can_view_catalog !== false), key: 'catalog' },
          { to: '/purchasing', label: 'Purchasing & Procurement', icon: <Truck size={18} />, visible: canAccess('purchasing', permissions?.can_create_purchasing !== false || permissions?.can_receive_purchasing !== false), key: 'purchasing' },
          { to: '/suppliers', label: 'Supplier Management', icon: <Store size={18} />, visible: canAccess('suppliers', permissions?.can_view_suppliers !== false), key: 'suppliers' },
          { to: '/price-intelligence', label: 'Supplier Price Intelligence', icon: <TrendingUp size={18} />, visible: canAccess('price_intelligence', permissions?.can_view_price_intelligence !== false), key: 'price_intelligence' },
          { to: '/waste', label: 'Waste Management', icon: <Trash2 size={18} />, visible: canAccess('waste', permissions?.can_view_waste_report !== false || permissions?.can_log_waste !== false), key: 'waste' },
          { to: '/86', label: '86 Missing Items', icon: <AlertTriangle size={18} />, visible: canAccess('missing_items', permissions?.can_view_86 !== false || permissions?.can_manage_86 !== false), key: 'missing_items' },
          { to: '/inventory-reporting', label: 'Inventory Management', icon: <ClipboardList size={18} />, visible: canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory), key: 'inventory_reporting' },
          { to: '/voids', label: 'Void Receipts', icon: <Receipt size={18} />, visible: canAccess('voids', !!permissions?.can_view_voids), key: 'voids' }
        ]
      },
      {
        name: 'People',
        items: [
          { to: '/employees', label: 'Employees', icon: <Users size={18} />, visible: canAccess('employees', !!permissions?.can_manage_hr), key: 'employees' },
          { to: '/departments-sections', label: 'Departments & Sections', icon: <Layers size={18} />, visible: canAccess('departments_sections', !!permissions?.can_manage_hr), key: 'departments_sections' },
          { to: '/salary-payments', label: 'Salary Payments', icon: <DollarSign size={18} />, visible: canAccess('salary_payments', false), key: 'salary_payments' },
          { to: '/assessments', label: 'Employee Assessments', icon: <Target size={18} />, visible: canAccess('assessments', !!permissions?.can_manage_assessments || !!permissions?.can_evaluate_assessments), key: 'assessments' },
          { to: '/attendance', label: 'Attendance & Timesheets', icon: <Clock size={18} />, visible: canAccess('attendance', !!permissions?.can_manage_attendance || permissions?.can_punch_clock !== false), key: 'attendance' },
          { to: '/tips', label: 'Tips Config', icon: <DollarSign size={18} />, visible: canAccess('tips', !!permissions?.can_manage_tips), key: 'tips' },
          { to: '/permissions', label: 'Security & Matrix', icon: <Shield size={18} />, visible: canAccess('permissions', false), key: 'permissions' },
          { to: '/signin-logs', label: 'Sign-In Logs', icon: <History size={18} />, visible: canAccess('signin_logs', !!permissions?.can_view_signin_logs), key: 'signin_logs' }
        ]
      },
      {
        name: 'Customers',
        items: [
          { to: '/complaints', label: 'Client Complaints', icon: <MessageSquare size={18} />, visible: canAccess('complaints', !!permissions?.can_view_complaints), key: 'complaints' },
          { to: '/specials', label: 'Specials & Upsell', icon: <Sparkles size={18} />, visible: canAccess('specials', !!permissions?.can_view_upsell), key: 'specials' }
        ]
      },
      {
        name: 'Analytics',
        items: [
          { to: '/finance', label: 'Financial Analytics', icon: <TrendingUp size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'finance' },
          { to: '/finance/payments', label: 'Payment Details', icon: <Coins size={18} />, visible: canAccess('payment_details', !!permissions?.can_view_finance_dashboard), key: 'payment_details' },
          { to: '/reel-credit', label: 'Reel Credit', icon: <Receipt size={18} />, visible: canAccess('reel_credit', !!permissions?.can_view_finance_dashboard), key: 'reel_credit' }
        ]
      },
      {
        name: 'Administration',
        items: [
          { to: '/super-admin', label: 'Super Admin', icon: <Shield size={18} />, visible: user?.role?.toLowerCase() === 'superadmin' },
          { to: '/branch-management', label: 'Branch Management', icon: <Store size={18} />, visible: canAccess('branch_management', !!permissions?.can_manage_branches), key: 'branch_management' },
          { to: '/wallets', label: 'Manage E-Wallets', icon: <Coins size={18} />, visible: canAccess('wallets', !!permissions?.can_manage_wallets), key: 'wallets' },
          { to: '/news', label: 'News Management', icon: <Newspaper size={18} />, visible: canAccess('news', !!permissions?.can_manage_news), key: 'news' },
          { to: '/sops', label: 'SOPs & Training', icon: <BookOpen size={18} />, visible: canAccess('sops', !!permissions?.can_manage_training), key: 'sops' },
          { to: '/menu', label: 'Menu Manual', icon: <ChefHat size={18} />, visible: canAccess('menu', permissions?.can_view_menu_manual !== false), key: 'menu' }
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
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isInstallable && (
            <button
              onClick={installApp}
              title="Install FLOW Web App"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Download size={15} />
              <span>Install FLOW App</span>
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                <span>FLOW Admin v1.1.0</span>
                {isInstalled && (
                  <span title="Running as Installed PWA" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                )}
              </div>
              <div style={{ fontSize: '10px' }}>Operations Portal</div>
            </div>
          </div>
        </div>
      </div>
    );
  }


function MainLayout({ user, onLogout, onUpdateUser }: { user: any; onLogout: () => void; onUpdateUser: (user: any) => void }) {
  const isSectionEnabled = (key: string) => {
    if (user?.role?.toLowerCase() === 'superadmin') return true;
    if (key === 'permissions') return true;
    const enabledSections = user?.restaurants?.settings?.enabled_sections;
    if (!enabledSections) return true; // Default to enabled if not configured
    if (key === 'inventory_reporting') {
      return enabledSections.includes('inventory_reporting') || enabledSections.includes('inventory');
    }
    if (key === 'payment_details' || key === 'reel_credit') {
      return enabledSections.includes(key) || enabledSections.includes('finance');
    }
    if (key === 'wallets') {
      return enabledSections.includes(key) || enabledSections.includes('branch_management');
    }
    if (key === 'departments_sections' || key === 'salary_payments') {
      return enabledSections.includes(key) || enabledSections.includes('employees');
    }
    return enabledSections.includes(key);
  };

  const roleLower = user.role?.toLowerCase();
  const isPrivileged = roleLower === 'admin' || roleLower === 'manager' || roleLower === 'superadmin';
  const [permissions, setPermissions] = useState<any>(user?.admin_permissions ? { admin_permissions: user.admin_permissions } : null);
  const [branchesList, setBranchesList] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const rid = user.restaurant_id || user.restaurants?.id || getRestaurantId();
    if (rid) {
      setCachedRestaurantId(rid);
    }
    api.getBranchesList(false, rid || undefined).then(res => {
      if (res.success && res.data) {
        const dbNames = res.data.map((b: any) => b.name).filter(Boolean);
        setBranchesList(dbNames);
      } else {
        setBranchesList([]);
      }
    });
  }, [user]);

  useEffect(() => {
    api.getAppPermissions(user.name, user.departments || '', user.role, user.id).then(res => {
      if (res.success && res.data) {
        setPermissions(res.data);
      }
    });
  }, [user]);

  const canAccess = (moduleKey: string, staffFallback: boolean = false) => {
    return hasAdminAccess(user, permissions, moduleKey, staffFallback);
  };

  const location = useLocation();
  const navigate = useNavigate();

  // Fullscreen POS Terminal Mode (Zero sidebar, zero top-bar)
  if (location.pathname === '/pos') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#0F1115' }}>
        <PosTerminalScreen user={user} onExit={() => navigate('/')} />
      </div>
    );
  }

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
                v1.0.7 • Multi-Storage & Department Sync
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
            <Route path="/pos" element={<PosTerminalScreen user={user} onExit={() => navigate('/')} />} />
            <Route path="/kds" element={<KdsScreen branchId={user?.branch_id || '9c214659-9cc7-4f33-b115-cbbb8a823a94'} />} />
            {isSectionEnabled('orders') && canAccess('orders', permissions?.can_create_orders !== false || permissions?.can_receive_orders !== false) && (
              <Route path="/orders" element={<OrdersScreen user={user} />} />
            )}
            {isSectionEnabled('purchasing') && canAccess('purchasing', permissions?.can_create_purchasing !== false || permissions?.can_receive_purchasing !== false) && (
              <Route path="/purchasing" element={<PurchasingScreen user={user} />} />
            )}
            {isSectionEnabled('catalog') && canAccess('catalog', permissions?.can_view_catalog !== false) && (
              <Route 
                path="/catalog" 
                element={<ItemCatalogScreen user={user} permissions={permissions} />} 
              />
            )}
            {isSectionEnabled('waste') && canAccess('waste', permissions?.can_view_waste_report !== false || permissions?.can_log_waste !== false) && (
              <Route path="/waste" element={<WasteScreen user={user} />} />
            )}
            {isSectionEnabled('reservations') && canAccess('reservations', !!permissions?.can_manage_reservations) && (
              <Route path="/reservations" element={<ReservationsScreen user={user} />} />
            )}
            {isSectionEnabled('voids') && canAccess('voids', !!permissions?.can_view_voids) && (
              <Route 
                path="/voids" 
                element={<VoidReceiptsScreen user={user} />} 
              />
            )}
            {isSectionEnabled('checklists') && canAccess('checklists', permissions?.can_manage_checklists !== false || permissions?.can_fill_checklists !== false) && (
              <Route path="/checklists" element={<ChecklistsScreen user={user} />} />
            )}
            {isSectionEnabled('menu') && canAccess('menu', permissions?.can_view_menu_manual !== false) && (
              <>
                <Route path="/menu" element={<MenuManualScreen />} />
                <Route path="/menu/new" element={<MenuRecipeFormScreen />} />
                <Route path="/menu/edit/:id" element={<MenuRecipeFormScreen />} />
              </>
            )}
            {isSectionEnabled('missing_items') && canAccess('missing_items', permissions?.can_view_86 !== false || permissions?.can_manage_86 !== false) && (
              <Route path="/86" element={<Menu86ViewScreen />} />
            )}
            {isSectionEnabled('employees') && canAccess('employees', !!permissions?.can_manage_hr) && (
              <>
                <Route path="/employees" element={<EmployeesScreen user={user} />} />
                <Route path="/employees/new" element={<EmployeeFormScreen user={user} />} />
                <Route path="/employees/edit/:id" element={<EmployeeFormScreen user={user} />} />
              </>
            )}
            {isSectionEnabled('departments_sections') && canAccess('departments_sections', !!permissions?.can_manage_hr) && (
              <Route path="/departments-sections" element={<StaffDepartmentsScreen user={user} permissions={permissions} />} />
            )}
            {isSectionEnabled('salary_payments') && canAccess('salary_payments', false) && (
              <Route path="/salary-payments" element={<SalaryPaymentsScreen user={user} permissions={permissions} />} />
            )}
            {isSectionEnabled('assessments') && canAccess('assessments', !!permissions?.can_manage_assessments || !!permissions?.can_evaluate_assessments) && (
              <>
                <Route path="/assessments" element={<AssessmentsScreen user={user} />} />
                <Route path="/assessments/conduct/:id" element={<AssessmentConductWebScreen user={user} />} />
              </>
            )}
            {isSectionEnabled('attendance') && canAccess('attendance', !!permissions?.can_manage_attendance || permissions?.can_punch_clock !== false) && (
              <Route path="/attendance" element={<AttendanceDashboardScreen user={user} permissions={permissions} />} />
            )}
            {isSectionEnabled('tips') && canAccess('tips', !!permissions?.can_manage_tips) && (
              <>
                <Route path="/tips" element={<TipsScreen />} />
                <Route path="/tips/new" element={<TipsCreateScreen />} />
                <Route path="/tips/distribution/:id" element={<TipsDistributionScreen />} />
              </>
            )}
            {isSectionEnabled('permissions') && canAccess('permissions', false) && (
              <Route path="/permissions" element={<PermissionsScreen user={user} onUpdateUser={onUpdateUser} />} />
            )}
            {isSectionEnabled('signin_logs') && canAccess('signin_logs', !!permissions?.can_view_signin_logs) && (
              <Route 
                path="/signin-logs" 
                element={<SignInLogsScreen user={user} />} 
              />
            )}
            {isSectionEnabled('sops') && canAccess('sops', !!permissions?.can_manage_training) && (
              <>
                <Route path="/sops" element={<SOPsScreen />} />
                <Route path="/sops/new" element={<SOPFormScreen />} />
                <Route path="/sops/edit/:id" element={<SOPFormScreen />} />
              </>
            )}
            {isSectionEnabled('complaints') && canAccess('complaints', !!permissions?.can_view_complaints) && (
              <>
                <Route path="/complaints" element={<ComplaintsDashboardScreen permissions={permissions} user={user} />} />
                <Route path="/complaints/new" element={<ComplaintFormScreen permissions={permissions} user={user} />} />
                <Route path="/complaints/edit/:id" element={<ComplaintFormScreen permissions={permissions} user={user} />} />
                <Route path="/complaints/analytics" element={<ComplaintsAnalyticsScreen permissions={permissions} user={user} />} />
              </>
            )}
            {isSectionEnabled('news') && canAccess('news', !!permissions?.can_manage_news) && (
              <>
                <Route path="/news" element={<NewsManagementScreen />} />
                <Route path="/news/new" element={<NewsFormScreen />} />
                <Route path="/news/edit/:id" element={<NewsFormScreen />} />
              </>
            )}
            {isSectionEnabled('finance') && canAccess('finance', !!permissions?.can_view_finance_dashboard) && (
              <Route path="/finance" element={<FinanceDashboardScreen user={user} permissions={permissions} />} />
            )}
            {isSectionEnabled('payment_details') && canAccess('payment_details', !!permissions?.can_view_finance_dashboard) && (
              <Route path="/finance/payments" element={<PaymentDetailsScreen user={user} />} />
            )}
            {isSectionEnabled('reel_credit') && canAccess('reel_credit', !!permissions?.can_view_finance_dashboard) && (
              <Route path="/reel-credit" element={<ReelCreditScreen user={user} />} />
            )}
            {isSectionEnabled('specials') && canAccess('specials', !!permissions?.can_view_upsell) && (
              <Route path="/specials" element={<ChefSpecialsScreen permissions={permissions} user={user} />} />
            )}
            {isSectionEnabled('tasks') && canAccess('tasks', !!permissions?.can_manage_tasks) && (
              <Route 
                path="/tasks" 
                element={<TasksScreen user={user} />} 
              />
            )}
            {isSectionEnabled('client_orders') && canAccess('client_orders', !!permissions?.can_view_client_orders) && (
              <>
                <Route path="/client-orders" element={<ClientOrdersScreen user={user} permissions={permissions} onUpdateUser={onUpdateUser} />} />
                <Route path="/client-orders/new" element={<ClientOrderFormScreen user={user} permissions={permissions} onUpdateUser={onUpdateUser} />} />
                <Route path="/client-orders/edit/:id" element={<ClientOrderFormScreen user={user} permissions={permissions} onUpdateUser={onUpdateUser} />} />
                <Route path="/client-orders/reports" element={<ClientOrdersReportsScreen user={user} permissions={permissions} />} />
              </>
            )}
            {isSectionEnabled('suppliers') && canAccess('suppliers', permissions?.can_view_suppliers !== false) && (
              <Route 
                path="/suppliers" 
                element={<SuppliersScreen user={user} permissions={permissions} />} 
              />
            )}
            {isSectionEnabled('wallets') && canAccess('wallets', !!permissions?.can_manage_wallets) && (
              <Route path="/wallets" element={<WalletsScreen user={user} />} />
            )}
            {isSectionEnabled('price_intelligence') && canAccess('price_intelligence', permissions?.can_view_price_intelligence !== false) && (
              <Route 
                path="/price-intelligence" 
                element={<SupplierPriceIntelligenceScreen user={user} permissions={permissions} />} 
              />
            )}
            {isSectionEnabled('inventory_reporting') && canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory) && (
              <Route 
                path="/inventory-reporting" 
                element={<InventoryScreen user={user} permissions={permissions} />} 
              />
            )}
            {user.role?.toLowerCase() === 'superadmin' && (
              <Route path="/super-admin" element={<SuperAdminScreen />} />
            )}
            {isSectionEnabled('branch_management') && canAccess('branch_management', !!permissions?.can_manage_branches) && (
              <Route path="/branch-management" element={<BranchManagementScreen user={user} />} />
            )}
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
      if (!parsed.restaurant_id) {
        if (parsed.email?.toLowerCase().includes('bistro') || parsed.branch?.toLowerCase().includes('bistro')) {
          parsed.restaurant_id = '4c0ed960-e459-42c4-962f-41229a2d3783';
        } else {
          parsed.restaurant_id = '79256f11-a9f8-4fec-901d-69baf929762d';
        }
        localStorage.setItem('neo_admin_user', JSON.stringify(parsed));
      }
      setCachedRestaurantId(parsed.restaurant_id);
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
      document.title = import.meta.env.VITE_APP_NAME || "Ovrload Admin";
    }
  }, [user]);

  const handleLogin = (userData: any) => {
    if (userData?.restaurant_id) {
      setCachedRestaurantId(userData.restaurant_id);
    }
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
