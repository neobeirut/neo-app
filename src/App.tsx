import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';

import MenuManualScreen from './screens/MenuManualScreen';
import MenuRecipeFormScreen from './screens/MenuRecipeFormScreen';
import ProductionRecipesScreen, { ProductionRecipeEditor } from './screens/ProductionRecipesScreen';
import EmployeesScreen from './screens/EmployeesScreen';
import EmployeeFormScreen from './screens/EmployeeFormScreen';
import AttendanceDashboardScreen from './screens/AttendanceDashboardScreen';
import TipsScreen from './screens/TipsScreen';
import TipsCreateScreen from './screens/TipsCreateScreen';
import TipsDistributionScreen from './screens/TipsDistributionScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import PosPermissionsScreen from './screens/PosPermissionsScreen';
import StaffDepartmentsScreen from './screens/StaffDepartmentsScreen';
import SalaryPaymentsScreen from './screens/SalaryPaymentsScreen';
import SOPsScreen from './screens/SOPsScreen';
import SOPFormScreen from './screens/SOPFormScreen';
import PrinterManagementScreen from './screens/pos/PrinterManagementScreen';
import ItemRecipesReportScreen from './screens/ItemRecipesReportScreen';
import { LayoutDashboard, BarChart3, ChefHat, Users, LogOut, DollarSign, Shield, BookOpen, TrendingUp, MessageSquare, Newspaper, AlertTriangle, Sparkles, Trash2, History, Coins, Truck, ShoppingBag, ShoppingCart, Calendar, ClipboardList, Package, CheckSquare, Receipt, Briefcase, Store, ChevronDown, ChevronRight, Clock, Target, Layers, Download, Sliders, FileText, Gift, Lock, Flame, Settings, Building2, Printer, FileSpreadsheet, Database, Bot, Activity } from 'lucide-react';
import SalesAnalyticsScreen from './screens/SalesAnalyticsScreen';
import LiveDailyTransactionsScreen from './screens/LiveDailyTransactionsScreen';
import { api, hasAdminAccess } from './api/client';
import { supabase } from './api/supabase';
import { usePWA } from './hooks/usePWA';
import CrmHubScreen from './screens/CrmHubScreen';
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
import InventoryIntelligenceDashboardScreen from './screens/InventoryIntelligenceDashboardScreen';
import ReplenishmentPlanningScreen from './screens/ReplenishmentPlanningScreen';
import MenuProfitabilityScreen from './screens/MenuProfitabilityScreen';
import StoreOperatingProfitabilityScreen from './screens/StoreOperatingProfitabilityScreen';
import CostControlScreen from './screens/CostControlScreen';
import CashControlScreen from './screens/CashControlScreen';
import DailyProductionScreen from './screens/DailyProductionScreen';
import PosInvoiceGeneratorScreen from './screens/pos/PosInvoiceGeneratorScreen';
import CompanySettingsScreen from './screens/CompanySettingsScreen';
import MultiConceptFinancialScreen from './screens/MultiConceptFinancialScreen';
import MonthEndReconciliationScreen from './screens/MonthEndReconciliationScreen';
import ConceptManagementScreen from './screens/ConceptManagementScreen';
import UnifiedOrderHistoryScreen from './screens/UnifiedOrderHistoryScreen';
import OvrloadMigrationPlanScreen from './screens/OvrloadMigrationPlanScreen';
import { ConceptProvider, useActiveConcept } from './context/ConceptContext';
import ConceptSelector from './components/common/ConceptSelector';

  function Sidebar({ onLogout, permissions, user }: { onLogout: () => void; permissions: any; user: any }) {
    const location = useLocation();
    const { isInstallable, isInstalled, installApp } = usePWA();
    const { activeConcept, activeProfile } = useActiveConcept();

    const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({
      'Company Finance': false,
      'Concept Performance': false,
      'Cost Control': false,
      'POS & Sales': false,
      'Menu & Kitchen': false,
      'Inventory & Procurement': false,
      'Reports': false,
      'Team & Staff': false,
      'Customers & CRM': false,
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
      if (key === 'permissions' || key === 'pos_permissions' || key === 'company_settings' || key === 'live_daily_report' || key === 'pos_live_daily_report' || key.startsWith('crm') || key.startsWith('reports') || key === 'reports') return true;
      const enabledSections = user?.restaurants?.settings?.enabled_sections;
      if (!enabledSections) return true; // Default to enabled if not configured
      if (key === 'inventory_reporting' || key === 'cost_control' || key === 'daily_production') {
        return enabledSections.includes('inventory_reporting') || enabledSections.includes('inventory') || enabledSections.includes('cost_control') || enabledSections.includes('daily_production') || enabledSections.includes('menu');
      }
      if (key === 'payment_details' || key === 'reel_credit' || key === 'cash_control') {
        return enabledSections.includes(key) || enabledSections.includes('finance');
      }
      if (key === 'wallets') {
        return enabledSections.includes(key) || enabledSections.includes('branch_management') || enabledSections.includes('finance');
      }
      if (key === 'departments_sections' || key === 'salary_payments') {
        return enabledSections.includes(key) || enabledSections.includes('employees');
      }
      return enabledSections.includes(key);
    };

    const canAccess = (moduleKey: string, staffFallback: boolean = false) => {
      if (moduleKey.startsWith('crm')) return true;
      return hasAdminAccess(user, permissions, moduleKey, staffFallback);
    };

    const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.is_super_admin === true;

    const menuGroups: any[] = [
      {
        name: 'Dashboard',
        items: [
          { to: '/', label: 'Overview Dashboard', icon: <LayoutDashboard size={18} /> }
        ]
      },
      {
        name: 'Company Finance',
        items: [
          { to: '/live-daily-report', label: 'Live Daily Transactions', icon: <Activity size={18} />, key: 'live_daily_report' },
          { to: '/finance', label: 'Central Finance Dashboard', icon: <TrendingUp size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'finance' },
          { to: '/finance/multi-concept?tab=consolidated', label: 'Consolidated Financial Reports', icon: <DollarSign size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial' },
          { to: '/purchasing', label: 'Supplier Invoices & Payments', icon: <Truck size={18} />, visible: canAccess('purchasing', permissions?.can_create_purchasing !== false || permissions?.can_receive_purchasing !== false), key: 'purchasing' },
          { to: '/salary-payments', label: 'Payroll Payments', icon: <DollarSign size={18} />, visible: canAccess('salary_payments', false), key: 'salary_payments' },
          { to: '/operating-profitability', label: 'Company Expenses & Store P&L', icon: <DollarSign size={18} />, visible: canAccess('finance', !!permissions?.can_view_operating_profitability || !!permissions?.can_view_finance_dashboard), key: 'operating_profitability' },
          { to: '/cash-control', label: 'Cashflow & Banking', icon: <Coins size={18} />, visible: canAccess('cash_control', !!permissions?.can_view_cash_reconciliation || !!permissions?.can_view_settlements || !!permissions?.can_view_finance_dashboard), key: 'cash_control' },
          { to: '/finance/month-end-reconciliation', label: 'Month-End Reconciliation & Closing', icon: <Lock size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'month_end_reconciliation' },
          { to: '/finance/payments', label: 'Payment Details', icon: <Coins size={18} />, visible: canAccess('payment_details', !!permissions?.can_view_finance_dashboard), key: 'payment_details' },
          { to: '/wallets', label: 'Manage E-Wallets', icon: <Coins size={18} />, visible: canAccess('wallets', !!permissions?.can_manage_wallets), key: 'wallets' },
          { to: '/reel-credit', label: 'Reel Credit', icon: <Receipt size={18} />, visible: canAccess('reel_credit', !!permissions?.can_view_finance_dashboard), key: 'reel_credit' }
        ]
      },
      {
        name: 'Concept Performance',
        items: [
          { to: '/concept-performance/sales-analytics', label: 'Sales & Analytics', icon: <BarChart3 size={18} />, key: 'concept_sales_analytics' },
          { to: '/finance/multi-concept?tab=comparison', label: 'Three-Level Concept P&L', icon: <Layers size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial_pnl' },
          { to: '/finance/multi-concept?tab=dashboard', label: 'Concept Executive Dashboard', icon: <LayoutDashboard size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial_dash' },
          { to: '/pos/orders-history', label: 'Order History & Sales Channels', icon: <History size={18} />, key: 'orders_history' },
          { to: '/finance/multi-concept?tab=channels', label: 'Product & Channel Profitability', icon: <ShoppingBag size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial_channels' },
          { to: '/cash-control', label: 'Concept Cash Shifts & Handover', icon: <DollarSign size={18} />, visible: canAccess('cash_control', !!permissions?.can_view_cash_reconciliation || !!permissions?.can_view_settlements || !!permissions?.can_view_finance_dashboard), key: 'cash_control_shifts' },
          { to: '/finance/multi-concept?tab=settlements', label: 'Marketplace Settlements (Toters/NokNok)', icon: <TrendingUp size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial_settlements' },
          { to: '/finance/multi-concept?tab=inventory', label: 'Concept Working Capital & Stock', icon: <Package size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial_inventory' }
        ]
      },
      {
        name: 'Cost Control',
        items: [
          { to: '/menu', label: 'Recipe Costing (BOM)', icon: <ChefHat size={18} />, visible: canAccess('menu', permissions?.can_view_menu_manual !== false), key: 'menu' },
          { to: '/production-recipes', label: 'Production Costing', icon: <ChefHat size={18} />, visible: canAccess('menu', permissions?.can_view_menu_manual !== false), key: 'menu' },
          { to: '/daily-production', label: 'Daily Production Batches', icon: <Flame size={18} />, visible: canAccess('menu', permissions?.can_view_menu_manual !== false), key: 'daily_production' },
          { to: '/finance/multi-concept?tab=inventory', label: 'Inventory Working Capital Valuation', icon: <Package size={18} />, visible: canAccess('finance', !!permissions?.can_view_finance_dashboard), key: 'multi_concept_financial' },
          { to: '/cost-control', label: 'Theoretical vs Actual Consumption', icon: <Target size={18} />, visible: canAccess('cost_control', !!permissions?.can_view_cost_control || !!permissions?.can_view_variance_financials), key: 'cost_control' },
          { to: '/waste', label: 'Four-Tier Waste Allocation', icon: <Trash2 size={18} />, visible: canAccess('waste', permissions?.can_view_waste_report !== false || permissions?.can_log_waste !== false), key: 'waste' },
          { to: '/inventory-intelligence', label: 'Stock Variances & Intelligence', icon: <TrendingUp size={18} />, visible: canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory || !!permissions?.can_view_reports), key: 'inventory_reporting' }
        ]
      },
      {
        name: 'POS & Sales',
        items: [
          { to: '/pos', label: 'Point of Sale (POS)', icon: <Store size={18} />, key: 'pos_terminal', externalHref: '/new/pos' },
          { to: '/86', label: '86 Missing Items', icon: <AlertTriangle size={18} />, visible: canAccess('missing_items', permissions?.can_view_86 !== false || permissions?.can_manage_86 !== false), key: 'missing_items' },
          { to: '/crm/products', label: 'Menu Products', icon: <ShoppingBag size={18} />, key: 'crm_products' },
          { to: '/live-daily-report', label: 'Live Daily Transactions', icon: <Activity size={18} />, key: 'pos_live_daily_report' },
          { to: '/pos/orders-history', label: 'Order History & Channels', icon: <History size={18} />, key: 'orders_history' },
          { to: '/orders', label: 'Branch Orders', icon: <ShoppingBag size={18} />, visible: canAccess('orders', permissions?.can_create_orders !== false || permissions?.can_receive_orders !== false), key: 'orders' },
          { to: '/client-orders', label: 'Client Orders', icon: <Briefcase size={18} />, visible: canAccess('client_orders', !!permissions?.can_view_client_orders), key: 'client_orders' },
          { to: '/reservations', label: 'Table Reservations', icon: <Calendar size={18} />, visible: canAccess('reservations', !!permissions?.can_manage_reservations), key: 'reservations' },
          { to: '/voids', label: 'Void Receipts', icon: <Receipt size={18} />, visible: canAccess('voids', !!permissions?.can_view_voids), key: 'voids' },
          { to: '/pos/invoice-generator', label: 'Invoice Generator', icon: <Receipt size={18} />, key: 'pos_invoice_generator', visible: isSuperAdmin },
          { to: '/pos/printers', label: 'Printer Management', icon: <Printer size={18} />, key: 'pos_printers' },
          { to: '/pos/settings', label: 'POS Receipt & Hardware', icon: <Settings size={18} />, key: 'pos_settings', externalHref: '/new/pos#/pos-settings' },
          { to: '/pos/permissions', label: 'POS Permissions', icon: <Lock size={18} />, key: 'pos_permissions' }
        ]
      },
      {
        name: 'Inventory & Procurement',
        items: [
          { to: '/catalog', label: 'Item Catalog', icon: <Package size={18} />, visible: canAccess('catalog', permissions?.can_view_catalog !== false), key: 'catalog' },
          { to: '/86', label: '86 Missing Items', icon: <AlertTriangle size={18} />, visible: canAccess('missing_items', permissions?.can_view_86 !== false || permissions?.can_manage_86 !== false), key: 'missing_items' },
          { to: '/inventory-reporting', label: 'Inventory Management', icon: <ClipboardList size={18} />, visible: canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory), key: 'inventory_reporting' },
          { to: '/purchasing', label: 'Purchasing & Procurement', icon: <Truck size={18} />, visible: canAccess('purchasing', permissions?.can_create_purchasing !== false || permissions?.can_receive_purchasing !== false), key: 'purchasing' },
          { to: '/suppliers', label: 'Supplier Management', icon: <Store size={18} />, visible: canAccess('suppliers', permissions?.can_view_suppliers !== false), key: 'suppliers' },
          { to: '/price-intelligence', label: 'Supplier Price Intelligence', icon: <TrendingUp size={18} />, visible: canAccess('price_intelligence', permissions?.can_view_price_intelligence !== false), key: 'price_intelligence' },
          { to: '/replenishment-planning', label: 'Replenishment Planning', icon: <ShoppingCart size={18} />, visible: canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory || !!permissions?.can_view_reports || !!permissions?.can_view_replenishment), key: 'inventory_reporting' },
          { to: '/inventory-intelligence', label: 'Inventory Intelligence', icon: <TrendingUp size={18} />, visible: canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory || !!permissions?.can_view_reports), key: 'inventory_reporting' },
          { to: '/waste', label: 'Waste Management', icon: <Trash2 size={18} />, visible: canAccess('waste', permissions?.can_view_waste_report !== false || permissions?.can_log_waste !== false), key: 'waste' },
          { to: '/cost-control', label: 'Cost Control & Variance', icon: <Target size={18} />, visible: canAccess('cost_control', !!permissions?.can_view_cost_control || !!permissions?.can_view_variance_financials), key: 'cost_control' }
        ]
      },
      {
        name: 'Reports',
        items: [
          { to: '/live-daily-report', label: 'Live Daily Transactions', icon: <Activity size={18} />, key: 'reports_live_daily' },
          { to: '/reports/recipes', label: 'Item Recipes Report', icon: <FileSpreadsheet size={18} />, key: 'reports_recipes' },
          { to: '/client-orders/reports', label: 'Client Orders Reports', icon: <FileText size={18} />, visible: canAccess('client_orders', !!permissions?.can_view_client_orders), key: 'client_orders' }
        ]
      },
      {
        name: 'Team & Staff',
        items: [
          { to: '/employees', label: 'Employees', icon: <Users size={18} />, visible: canAccess('employees', !!permissions?.can_manage_hr), key: 'employees' },
          { to: '/attendance', label: 'Attendance & Timesheets', icon: <Clock size={18} />, visible: canAccess('attendance', !!permissions?.can_manage_attendance || permissions?.can_punch_clock !== false), key: 'attendance' },
          { to: '/checklists', label: 'Daily Checklists', icon: <ClipboardList size={18} />, visible: canAccess('checklists', permissions?.can_manage_checklists !== false || permissions?.can_fill_checklists !== false), key: 'checklists' },
          { to: '/tasks', label: 'Task Manager', icon: <CheckSquare size={18} />, visible: canAccess('tasks', !!permissions?.can_manage_tasks), key: 'tasks' },
          { to: '/departments-sections', label: 'Departments & Sections', icon: <Layers size={18} />, visible: canAccess('departments_sections', !!permissions?.can_manage_hr), key: 'departments_sections' },
          { to: '/salary-payments', label: 'Salary Payments', icon: <DollarSign size={18} />, visible: canAccess('salary_payments', false), key: 'salary_payments' },
          { to: '/tips', label: 'Tips Config', icon: <DollarSign size={18} />, visible: canAccess('tips', !!permissions?.can_manage_tips), key: 'tips' },
          { to: '/assessments', label: 'Employee Assessments', icon: <Target size={18} />, visible: canAccess('assessments', !!permissions?.can_manage_assessments || !!permissions?.can_evaluate_assessments), key: 'assessments' }
        ]
      },
      {
        name: 'Customers & CRM',
        items: [
          { to: '/crm', label: 'WhatsApp Live Inbox', icon: <MessageSquare size={18} />, key: 'crm_inbox' },
          { to: '/crm/ai-assistant', label: 'NÉO AI Assistant', icon: <Bot size={18} />, key: 'crm_ai_assistant' },
          { to: '/crm/contacts', label: 'Customer Contacts', icon: <Users size={18} />, key: 'crm_contacts' },
          { to: '/crm/templates', label: 'Message Templates', icon: <FileText size={18} />, key: 'crm_templates' },
          { to: '/crm/loyalty', label: 'Loyalty & Promos', icon: <Gift size={18} />, key: 'crm_loyalty' },
          { to: '/crm/delivery', label: 'Delivery Pricing', icon: <Truck size={18} />, key: 'crm_delivery' },
          { to: '/complaints', label: 'Client Complaints', icon: <MessageSquare size={18} />, visible: canAccess('complaints', !!permissions?.can_view_complaints), key: 'complaints' }
        ]
      },
      {
        name: 'Administration',
        items: [
          { to: '/super-admin', label: 'Super Admin', icon: <Shield size={18} />, visible: user?.role?.toLowerCase() === 'superadmin' },
          { to: '/company-settings', label: 'Company & Fiscal Settings', icon: <Building2 size={18} />, key: 'company_settings' },
          { to: '/settings/concepts', label: 'Commercial Concepts', icon: <Layers size={18} />, key: 'concept_settings' },
          { to: '/migration/ovrload', label: 'Historical Migration Plan', icon: <Database size={18} />, visible: false, key: 'ovrload_migration' },
          { to: '/branch-management', label: 'Branch Management', icon: <Store size={18} />, visible: canAccess('branch_management', !!permissions?.can_manage_branches), key: 'branch_management' },
          { to: '/permissions', label: 'Security & Matrix', icon: <Shield size={18} />, visible: canAccess('permissions', false), key: 'permissions' },
          { to: '/signin-logs', label: 'Sign-In Logs', icon: <History size={18} />, visible: canAccess('signin_logs', !!permissions?.can_view_signin_logs), key: 'signin_logs' },
          { to: '/news', label: 'News Management', icon: <Newspaper size={18} />, visible: canAccess('news', !!permissions?.can_manage_news), key: 'news' },
          { to: '/sops', label: 'SOPs & Training', icon: <BookOpen size={18} />, visible: canAccess('sops', !!permissions?.can_manage_training), key: 'sops' }
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
          {activeConcept !== 'ALL' ? (
            <div 
              style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '6px', 
                backgroundColor: activeProfile.primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '11px',
                flexShrink: 0
              }}
            >
              {activeProfile.prefix.substring(0, 3)}
            </div>
          ) : user.restaurants?.logo_url ? (
            <img src={user.restaurants.logo_url} alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontWeight: 800, fontSize: '11px', flexShrink: 0 }}>
              FLW
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {activeConcept === 'ALL' ? (user.restaurants?.name || "FLOW Operations") : activeProfile.name}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {activeConcept === 'ALL' ? 'Company Overview' : activeProfile.tagline}
            </span>
          </div>
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
                      item.externalHref ? (
                        <a
                          key={item.to}
                          href={item.externalHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="nav-link nav-link-nested"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {item.icon} {item.label}
                        </a>
                      ) : (
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
                      )
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

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FLOW ErrorBoundary Caught Error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', maxWidth: '600px', margin: '40px auto', background: '#fff', border: '1px solid #fecaca', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Something went wrong loading this view</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/'; }}
              style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              Back to Dashboard
            </button>
            <button 
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainLayout({ user, onLogout, onUpdateUser }: { user: any; onLogout: () => void; onUpdateUser: (user: any) => void }) {
  const isSectionEnabled = (key: string) => {
    if (user?.role?.toLowerCase() === 'superadmin') return true;
    if (key === 'permissions') return true;
    if (key.startsWith('crm') || key === 'crm' || key.startsWith('reports') || key === 'reports') return true;
    const enabledSections = user?.restaurants?.settings?.enabled_sections;
    if (!enabledSections) return true; // Default to enabled if not configured
    if (key === 'inventory_reporting' || key === 'cost_control' || key === 'daily_production') {
      return enabledSections.includes('inventory_reporting') || enabledSections.includes('inventory') || enabledSections.includes('cost_control') || enabledSections.includes('daily_production') || enabledSections.includes('menu');
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
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.includes('/crm')) {
        const crmPath = pathname.substring(pathname.indexOf('/crm'));
        window.location.replace('/#' + crmPath + window.location.search);
      }
    }
  }, []);

  useEffect(() => {
    api.getBranchesList().then(res => {
      const dbNames = (res.success && res.data) ? res.data.map((b: any) => b.name) : [];
      const combined = Array.from(new Set(['Badaro', 'Naccache', ...dbNames])).filter(Boolean);
      setBranchesList(combined);
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
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Concept:</span>
              <ConceptSelector />
            </div>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)' }} />
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
          <ErrorBoundary>
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
            <Route path="/live-daily-report" element={<LiveDailyTransactionsScreen user={user} permissions={permissions} />} />
            <Route path="/concept-performance/sales-analytics" element={<SalesAnalyticsScreen user={user} permissions={permissions} />} />
            <Route path="/pos/orders-history" element={<UnifiedOrderHistoryScreen user={user} permissions={permissions} />} />
            <Route path="/orders/history" element={<UnifiedOrderHistoryScreen user={user} permissions={permissions} />} />
            <Route path="/pos-orders" element={<UnifiedOrderHistoryScreen user={user} permissions={permissions} />} />
            <Route path="/migration/ovrload" element={<OvrloadMigrationPlanScreen user={user} />} />
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
                <Route path="/production-recipes" element={<ProductionRecipesScreen canEdit={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
                <Route path="/production-recipes/new" element={<ProductionRecipeEditor canEdit={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
                <Route path="/production-recipes/:id" element={<ProductionRecipeEditor canEdit={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
                <Route path="/daily-production" element={<DailyProductionScreen user={user} permissions={permissions} canEdit={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
                <Route path="/menu" element={<MenuManualScreen canEdit={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
                <Route path="/menu/new" element={<MenuRecipeFormScreen canDelete={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
                <Route path="/menu/edit/:id" element={<MenuRecipeFormScreen canDelete={canAccess('menu', !!permissions?.can_manage_menu_manual)} />} />
              </>
            )}
            {isSectionEnabled('missing_items') && canAccess('missing_items', permissions?.can_view_86 !== false || permissions?.can_manage_86 !== false) && (
              <>
              <Route path="/86" element={<Menu86ViewScreen />} />
              <Route path="/86-missing-items" element={<Menu86ViewScreen />} />
              <Route path="/missing-items" element={<Menu86ViewScreen />} />
              </>
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
            <Route path="/pos/permissions" element={<PosPermissionsScreen user={user} permissions={permissions} />} />
            <Route path="/pos-permissions" element={<PosPermissionsScreen user={user} permissions={permissions} />} />
            <Route path="/pos/printers" element={<PrinterManagementScreen user={user} permissions={permissions} />} />
            <Route path="/pos/settings/printers" element={<PrinterManagementScreen user={user} permissions={permissions} />} />
            <Route path="/pos-printers" element={<PrinterManagementScreen user={user} permissions={permissions} />} />
            <Route path="/admin/pos/printers" element={<PrinterManagementScreen user={user} permissions={permissions} />} />
            <Route path="/admin/pos-printers" element={<PrinterManagementScreen user={user} permissions={permissions} />} />
            <Route path="/admin/pos/settings/printers" element={<PrinterManagementScreen user={user} permissions={permissions} />} />
            <Route path="/pos/invoice-generator" element={<PosInvoiceGeneratorScreen user={user} />} />
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
              <>
                <Route path="/finance" element={<FinanceDashboardScreen user={user} permissions={permissions} />} />
                <Route path="/finance/multi-concept" element={<MultiConceptFinancialScreen user={user} permissions={permissions} />} />
                <Route path="/finance/month-end-reconciliation" element={<MonthEndReconciliationScreen user={user} permissions={permissions} />} />
              </>
            )}
            {isSectionEnabled('cash_control') && canAccess('cash_control', !!permissions?.can_view_cash_reconciliation || !!permissions?.can_view_settlements || !!permissions?.can_view_finance_dashboard) && (
              <Route path="/cash-control" element={<CashControlScreen user={user} permissions={permissions} />} />
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
            {isSectionEnabled('inventory_reporting') && canAccess('inventory_reporting', !!permissions?.can_view_inventory || !!permissions?.can_manage_inventory || !!permissions?.can_view_reports) && (
              <>
                <Route 
                  path="/inventory-intelligence" 
                  element={<InventoryIntelligenceDashboardScreen user={user} permissions={permissions} />} 
                />
                <Route 
                  path="/replenishment-planning" 
                  element={<ReplenishmentPlanningScreen user={user} permissions={permissions} />} 
                />
                <Route 
                  path="/menu-profitability" 
                  element={<MenuProfitabilityScreen user={user} permissions={permissions} />} 
                />
                <Route 
                  path="/operating-profitability" 
                  element={<StoreOperatingProfitabilityScreen user={user} permissions={permissions} />} 
                />
                <Route 
                  path="/cost-control" 
                  element={<CostControlScreen user={user} permissions={permissions} />} 
                />
                <Route 
                  path="/inventory-reporting" 
                  element={<InventoryScreen user={user} permissions={permissions} />} 
                />
              </>
            )}
            {user.role?.toLowerCase() === 'superadmin' && (
              <Route path="/super-admin" element={<SuperAdminScreen />} />
            )}
            <Route path="/company-settings" element={<CompanySettingsScreen user={user} onUpdateUser={onUpdateUser} />} />
            <Route path="/settings/concepts" element={<ConceptManagementScreen user={user} permissions={permissions} />} />
            {isSectionEnabled('branch_management') && canAccess('branch_management', !!permissions?.can_manage_branches) && (
              <Route path="/branch-management" element={<BranchManagementScreen />} />
            )}
            <Route path="/crm" element={<CrmHubScreen user={user} />} />
            <Route path="/crm/ai-assistant" element={<CrmHubScreen user={user} defaultTab="ai_assistant" />} />
            <Route path="/crm/ai_assistant" element={<CrmHubScreen user={user} defaultTab="ai_assistant" />} />
            <Route path="/crm/products" element={<CrmHubScreen user={user} defaultTab="products" />} />
            <Route path="/crm/modifiers" element={<CrmHubScreen user={user} defaultTab="modifiers" />} />
            <Route path="/crm/contacts" element={<CrmHubScreen user={user} defaultTab="contacts" />} />
            <Route path="/crm/inbox" element={<CrmHubScreen user={user} defaultTab="inbox" />} />
            <Route path="/crm/templates" element={<CrmHubScreen user={user} defaultTab="templates" />} />
            <Route path="/crm/campaigns" element={<CrmHubScreen user={user} defaultTab="campaigns" />} />
            <Route path="/crm/loyalty" element={<CrmHubScreen user={user} defaultTab="loyalty" />} />
            <Route path="/reports/recipes" element={<ItemRecipesReportScreen user={user} permissions={permissions} />} />
            <Route path="/reports" element={<Navigate to="/reports/recipes" replace />} />
            <Route path="/pos" element={<RedirectToPos />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function RedirectToPos() {
  useEffect(() => {
    window.location.href = '/new/pos';
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-300">
      <span className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
      <p className="text-sm font-bold">Opening FLOW POS Terminal...</p>
      <a href="/new/pos" className="text-xs text-amber-400 underline font-semibold">
        Click here to open POS directly
      </a>
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
      const resolvedRestaurantId = parsed.restaurant_id || parsed.restaurants?.id || '79256f11-a9f8-4fec-901d-69baf929762d';
      const normalizedUser = { ...parsed, restaurant_id: resolvedRestaurantId };
      setUser(normalizedUser);
      localStorage.setItem('neo_admin_user', JSON.stringify(normalizedUser));
      sessionLogger.startHeartbeat();

      // Background refresh of restaurant configuration settings
      if (resolvedRestaurantId) {
        api.getRestaurantById(resolvedRestaurantId).then(res => {
          if (res.success && res.data) {
            const updatedUser = { ...normalizedUser, restaurant_id: resolvedRestaurantId, restaurants: res.data };
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
    const normalized = {
      ...userData,
      restaurant_id: userData?.restaurant_id || userData?.restaurants?.id || '79256f11-a9f8-4fec-901d-69baf929762d'
    };
    setUser(normalized);
    localStorage.setItem('neo_admin_user', JSON.stringify(normalized));
  };

  const handleLogout = async () => {
    try {
      await sessionLogger.endSession();
    } catch (e) {
      console.warn('Session end error:', e);
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
    setUser(null);
    localStorage.removeItem('neo_admin_user');
  };

  if (loading) return null;

  return (
    <HashRouter>
      <Routes>
        <Route path="/pos" element={<RedirectToPos />} />
        <Route path="*" element={
          user ? (
            <ConceptProvider user={user}>
              <MainLayout user={user} onLogout={handleLogout} onUpdateUser={handleLogin} />
            </ConceptProvider>
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )
        } />
      </Routes>
    </HashRouter>
  );
}

export default App;
