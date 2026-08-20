import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { 
  Loader2, Shield, Search, User, Users, Check, AlertCircle, 
  ShoppingCart, ClipboardList, ChefHat, DollarSign, Trash2, 
  TrendingUp, Briefcase, GraduationCap, Calendar, Lock, Sliders, CheckCircle2,
  Sparkles, CheckSquare, Receipt, FolderOpen, Package, Clock
} from 'lucide-react';

const DEFAULT_PERMISSIONS = {
  can_create_orders: false,
  can_send_orders: false,
  can_receive_orders: false,
  can_edit_all_orders: false,
  can_add_items_to_orders: false,
  can_order_all_departments: false,
  can_create_purchasing: false,
  can_order_purchasing: false,
  can_receive_purchasing: false,
  can_view_menu_manual: false,
  can_manage_menu_manual: false,
  can_manage_tips: false,
  can_manage_checklists: false,
  can_fill_checklists: false,
  can_log_waste: false,
  can_view_waste_report: false,
  can_manage_hr: false,
  can_manage_training: false,
  can_manage_reservations: false,
  can_access_settings: false,
  can_view_schedule: true,
  can_manage_schedules: false,
  can_view_timesheet: true,
  can_view_salary: true,
  can_request_leave: true,
  can_approve_leave: false,
  can_request_shift_swap: true,
  can_approve_shift_swap: false,
  can_submit_missing_punch: true,
  can_approve_missing_punch: false,
  can_view_attendance_reports: false,
  can_manage_branches: false,
  can_manage_wallets: false,
  can_manage_news: false,
  can_manage_daily_cash: false,
  can_view_86: false,
  can_manage_86: false,
  can_view_complaints: false,
  can_manage_complaints: false,
  can_view_upsell: false,
  can_manage_upsell: false,
  can_manage_tasks: false,
  can_view_voids: false,
  can_manage_voids: false,
  can_punch_clock: false,
  can_view_finance_dashboard: false,
  can_view_signin_logs: false,
  can_view_client_orders: false,
  can_manage_client_orders: false,
  can_view_client_reports: false,
  can_manage_attendance: false,
  can_view_catalog: false,
  can_manage_catalog: false,
  can_view_suppliers: false,
  can_manage_suppliers: false,
  can_view_price_intelligence: false,
  can_manage_price_intelligence: false,
  can_view_inventory: false,
  can_manage_inventory: false,
  allowed_departments: ''
};

const CATEGORIES = [
  {
    id: 'orders',
    title: 'Orders & Fulfillment',
    icon: <ChefHat size={18} style={{ color: 'var(--primary)' }} />,
    permissions: [
      { key: 'can_create_orders', label: 'Create Orders' },
      { key: 'can_send_orders', label: 'Send Orders (Fulfill)' },
      { key: 'can_receive_orders', label: 'Receive Orders' },
      { key: 'can_edit_all_orders', label: 'Edit ALL Orders' },
      { key: 'can_add_items_to_orders', label: 'Add Items while Fulfilling' },
      { key: 'can_order_all_departments', label: 'Order for ALL Departments' },
    ]
  },
  {
    id: 'purchasing',
    title: 'Purchasing Module',
    icon: <ShoppingCart size={18} style={{ color: '#ffc107' }} />,
    permissions: [
      { key: 'can_create_purchasing', label: 'Create Purchasing' },
      { key: 'can_order_purchasing', label: 'Order Purchasing' },
      { key: 'can_receive_purchasing', label: 'Receive Purchasing' },
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory & Catalog',
    icon: <Package size={18} style={{ color: '#0d6efd' }} />,
    permissions: [
      { key: 'can_view_catalog', label: 'View Item Catalog' },
      { key: 'can_manage_catalog', label: 'Manage Item Catalog (Add/Edit/Delete)' },
      { key: 'can_view_inventory', label: 'View Inventory Management & Physical Counts' },
      { key: 'can_manage_inventory', label: 'Manage & Perform Physical Inventory Counts' },
      { key: 'can_view_suppliers', label: 'View Suppliers' },
      { key: 'can_manage_suppliers', label: 'Manage Suppliers (Add/Edit/Delete)' },
      { key: 'can_view_price_intelligence', label: 'View Supplier Price Intelligence' },
      { key: 'can_manage_price_intelligence', label: 'Manage Price Intelligence Settings' }
    ]
  },
  {
    id: 'checklists',
    title: 'Daily Checklists & Tasks',
    icon: <ClipboardList size={18} style={{ color: '#28a745' }} />,
    permissions: [
      { key: 'can_manage_checklists', label: 'Manage Checklists (SOPs)' },
      { key: 'can_fill_checklists', label: 'Fill Checklists (SOPs)' },
      { key: 'can_manage_tasks', label: 'Manage & Assign Tasks' },
    ]
  },
  {
    id: 'menu',
    title: 'Kitchen & Menu',
    icon: <ChefHat size={18} style={{ color: '#fd7e14' }} />,
    permissions: [
      { key: 'can_view_menu_manual', label: 'View Menu Manual' },
      { key: 'can_manage_menu_manual', label: 'Manage Menu Manual & Recipes (Add/Edit/Delete)' },
      { key: 'can_view_86', label: 'View 86 Items' },
      { key: 'can_manage_86', label: 'Manage 86 Items' },
    ]
  },
  {
    id: 'tips',
    title: 'Tips Management',
    icon: <DollarSign size={18} style={{ color: '#20c997' }} />,
    permissions: [
      { key: 'can_manage_tips', label: 'Manage Tips' },
    ]
  },
  {
    id: 'waste',
    title: 'Waste Module',
    icon: <Trash2 size={18} style={{ color: '#dc3545' }} />,
    permissions: [
      { key: 'can_log_waste', label: 'Log Waste' },
      { key: 'can_view_waste_report', label: 'View Waste Report' },
    ]
  },
  {
    id: 'daily_cash',
    title: 'Daily Cash & Finance',
    icon: <TrendingUp size={18} style={{ color: '#17a2b8' }} />,
    permissions: [
      { key: 'can_manage_daily_cash', label: 'Manage Daily Cash' },
      { key: 'can_view_finance_dashboard', label: 'View Finance Dashboard' },
    ]
  },
  {
    id: 'hr',
    title: 'Payroll & HR',
    icon: <Briefcase size={18} style={{ color: '#6f42c1' }} />,
    permissions: [
      { key: 'can_manage_hr', label: 'Manage Payroll & Salaries' },
    ]
  },
  {
    id: 'attendance',
    title: 'Attendance & Timesheets Matrix',
    icon: <Clock size={18} style={{ color: '#007bff' }} />,
    permissions: [
      { key: 'can_punch_clock', label: 'Punch Clock (In / Out / Break)' },
      { key: 'can_view_schedule', label: 'View Shift Schedule' },
      { key: 'can_manage_schedules', label: 'Manage Schedules (Builder & Publish)' },
      { key: 'can_view_timesheet', label: 'View Monthly Timesheets' },
      { key: 'can_view_salary', label: 'View Salary & Payslip Preview' },
      { key: 'can_request_leave', label: 'Submit Leave Requests' },
      { key: 'can_approve_leave', label: 'Approve Leave Requests' },
      { key: 'can_request_shift_swap', label: 'Submit Shift Swap Requests' },
      { key: 'can_approve_shift_swap', label: 'Approve Shift Swaps' },
      { key: 'can_submit_missing_punch', label: 'Submit Missing Punch Requests' },
      { key: 'can_approve_missing_punch', label: 'Approve Missing Punches' },
      { key: 'can_view_attendance_reports', label: 'View Live Attendance Hub & Reports' },
    ]
  },
  {
    id: 'training',
    title: 'Training & Procedures',
    icon: <GraduationCap size={18} style={{ color: '#e83e8c' }} />,
    permissions: [
      { key: 'can_manage_training', label: 'Manage SOPs & Training KB' },
    ]
  },
  {
    id: 'reservations',
    title: 'Table Reservations',
    icon: <Calendar size={18} style={{ color: '#6610f2' }} />,
    permissions: [
      { key: 'can_manage_reservations', label: 'Manage Reservations' },
    ]
  },
  {
    id: 'settings',
    title: 'Settings & Admin',
    icon: <Lock size={18} style={{ color: '#343a40' }} />,
    permissions: [
      { key: 'can_access_settings', label: 'Access App Settings' },
      { key: 'can_manage_branches', label: 'Manage Branches & Storage Locations' },
      { key: 'can_manage_wallets', label: 'Manage E-Wallets & Balances' },
      { key: 'can_manage_news', label: 'Manage Restaurant News & Announcements' },
    ]
  },
  {
    id: 'complaints',
    title: 'Client Complaints',
    icon: <AlertCircle size={18} style={{ color: '#dc3545' }} />,
    permissions: [
      { key: 'can_view_complaints', label: 'View Complaints' },
      { key: 'can_manage_complaints', label: 'Manage/Edit Complaints' },
    ]
  },
  {
    id: 'upsell',
    title: 'Chef Specials & Upsell',
    icon: <Sparkles size={18} style={{ color: '#e83e8c' }} />,
    permissions: [
      { key: 'can_view_upsell', label: 'View Upselling' },
      { key: 'can_manage_upsell', label: 'Manage/Edit Upselling' },
    ]
  },
  {
    id: 'voids',
    title: 'Void Receipts',
    icon: <Receipt size={18} style={{ color: '#1e5c4f' }} />,
    permissions: [
      { key: 'can_view_voids', label: 'View Void Receipts Logs' },
      { key: 'can_manage_voids', label: 'Submit Void Receipts' }
    ]
  },
  {
    id: 'client_orders',
    title: 'Client Orders',
    icon: <FolderOpen size={18} style={{ color: '#20c997' }} />,
    permissions: [
      { key: 'can_view_client_orders', label: 'View Client Orders' },
      { key: 'can_manage_client_orders', label: 'Create/Edit Client Orders' },
      { key: 'can_view_client_reports', label: 'View Client Orders Reports' }
    ]
  }
];

const GLOBAL_MODULES = [
  {
    key: 'news',
    title: 'Restaurant News',
    desc: 'Notifies all users globally when a new update/article is added.',
    bg: '#eff6ff',
    icon: <Sparkles size={20} style={{ color: '#3b82f6' }} />
  },
  {
    key: 'menu_86',
    title: 'Daily 86 (Missing Items)',
    desc: 'Notifies concern branch users and Admins when 86 items list is updated.',
    bg: '#fef3c7',
    icon: <AlertCircle size={20} style={{ color: '#f59e0b' }} />
  },
  {
    key: 'chef_specials',
    title: 'Chef Specials',
    desc: 'Notifies concern branch users and Admins when specials or upsells are added.',
    bg: '#fdf2f8',
    icon: <ChefHat size={20} style={{ color: '#ec4899' }} />
  },
  {
    key: 'orders',
    title: 'Branch-to-Branch Orders',
    desc: 'Notifies concern departments/branches on order placement, dispatch, and receipt.',
    bg: '#ecfdf5',
    icon: <ClipboardList size={20} style={{ color: '#10b981' }} />
  },
  {
    key: 'client_orders',
    title: 'Client Orders',
    desc: 'Notifies Admins and fulfillment managers when client orders are placed or updated.',
    bg: '#ecfdf5',
    icon: <Briefcase size={20} style={{ color: '#10b981' }} />
  },
  {
    key: 'purchasing',
    title: 'Purchasing Requests',
    desc: 'Notifies Admins and users in the Purchasing department when a request is updated.',
    bg: '#fff7ed',
    icon: <ShoppingCart size={20} style={{ color: '#ea580c' }} />
  },
  {
    key: 'tasks',
    title: 'Tasks',
    desc: 'Notifies employee, branch, or department users of task assignments and completions.',
    bg: '#eff6ff',
    icon: <CheckSquare size={20} style={{ color: '#3b82f6' }} />
  },
  {
    key: 'complaints',
    title: 'Client Complaints',
    desc: 'Notifies concern Branch Managers and Admins immediately on new complaint logs.',
    bg: '#fef2f2',
    icon: <AlertCircle size={20} style={{ color: '#ef4444' }} />
  },
  {
    key: 'inventory',
    title: 'Inventory Counts',
    desc: 'Notifies concern Branch Managers and Admins when inventory count sheets are submitted.',
    bg: '#eef2ff',
    icon: <ClipboardList size={20} style={{ color: '#4f46e5' }} />
  },
  {
    key: 'shift_cash',
    title: 'Daily Cash / Shift Cash',
    desc: 'Notifies concern Branch Managers and Admins when shift cash sheets are submitted.',
    bg: '#f0fdf4',
    icon: <DollarSign size={20} style={{ color: '#16a34a' }} />
  },
  {
    key: 'training',
    title: 'SOPs / Training Docs',
    desc: 'Notifies all users globally when new training content is added.',
    bg: '#faf5ff',
    icon: <GraduationCap size={20} style={{ color: '#9333ea' }} />
  },
  {
    key: 'reservations',
    title: 'Reservations',
    desc: 'Notifies concern Branch Managers and Admins when new reservations are placed.',
    bg: '#f5f3ff',
    icon: <Calendar size={20} style={{ color: '#7c3aed' }} />
  },
  {
    key: 'attendance_punch',
    title: 'Staff Punch In / Out',
    desc: 'Notifies Branch Managers and Admins immediately when employees clock in or clock out.',
    bg: '#ecfdf5',
    icon: <Clock size={20} style={{ color: '#10b981' }} />
  }
];

interface UserProfile {
  id: string;
  name?: string;
  role?: string;
  restaurant_id?: string;
  restaurants?: {
    id: string;
    name: string;
    settings?: {
      enabled_sections?: string[];
      is_vat_subscribed?: boolean;
    };
  };
}

export default function PermissionsScreen({ user, onUpdateUser }: { user?: UserProfile; onUpdateUser?: (u: UserProfile) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [permissions, setPermissions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'department' | 'user' | 'global_alerts'>('department');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [globalSettings, setGlobalSettings] = useState<Record<string, boolean> | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(90000);
  const [vatRate, setVatRate] = useState<number>(11);
  const [isVatSubscribed, setIsVatSubscribed] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [permRes, deptsRes, usersRes, globalRes, exRateRes, vatRateRes] = await Promise.all([
        api.getAllAppPermissions(),
        api.getDepartmentsList(),
        api.getAllUsers(),
        api.getGlobalNotificationSettings(),
        api.getExchangeRate(user?.restaurant_id),
        api.getVatRate(user?.restaurant_id)
      ]);
      
      if (permRes.success && permRes.data) {
        setPermissions(permRes.data);
      }
      
      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data.map((d: string | { name: string }) => typeof d === 'string' ? d : d.name));
      }
      
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data.map((u: { name: string }) => u.name));
      }

      if (globalRes.success && globalRes.data) {
        try {
          const val = typeof globalRes.data.setting_value === 'string'
            ? JSON.parse(globalRes.data.setting_value)
            : globalRes.data.setting_value;
          setGlobalSettings(val);
        } catch (e) {
          console.error('Failed to parse notifications settings:', e);
        }
      }

      if (exRateRes.success && exRateRes.rate !== undefined) {
        setExchangeRate(exRateRes.rate);
      }

      if (vatRateRes.success && vatRateRes.rate !== undefined) {
        setVatRate(vatRateRes.rate);
      }

      const restId = user?.restaurant_id;
      if (restId) {
        const restRes = await api.getRestaurantById(restId);
        if (restRes.success && restRes.data) {
          const settings = restRes.data.settings || {};
          setIsVatSubscribed(settings.is_vat_subscribed !== false);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSaveSystemSettings = async () => {
    setSavingState('saving');
    try {
      const promises: Promise<{ success: boolean; error?: string; rate?: number; data?: unknown }>[] = [];

      const restId = user?.restaurant_id;
      if (restId) {
        const restRes = await api.getRestaurantById(restId);
        const currentSettings = (restRes.success && restRes.data) ? (restRes.data.settings || {}) : (user.restaurants?.settings || {});
        const updatedSettings = {
          ...currentSettings,
          is_vat_subscribed: isVatSubscribed,
          exchange_rate: exchangeRate,
          vat_rate: vatRate
        };
        promises.push(api.updateRestaurantSettings(restId, updatedSettings));
      } else {
        promises.push(
          api.updateExchangeRate(exchangeRate),
          api.updateVatRate(vatRate)
        );
      }

      const results = await Promise.all(promises);
      const allSuccess = results.every(res => res.success);
      if (allSuccess) {
        setSavingState('saved');
        if (onUpdateUser && user && restId) {
          const restRes = await api.getRestaurantById(restId);
          if (restRes.success && restRes.data) {
            onUpdateUser({
              ...user,
              restaurants: restRes.data
            });
          }
        }
        setTimeout(() => setSavingState('idle'), 2000);
      } else {
        setSavingState('error');
        alert('Failed to save settings');
      }
    } catch (e: unknown) {
      console.error(e);
      setSavingState('error');
      alert('Error saving settings: ' + (e instanceof Error ? e.message || 'Unknown error' : String(e)));
    }
  };

  const sidebarItems = useMemo(() => {
    if (activeTab === 'global_alerts') {
      return [
        {
          id: 'global_settings',
          name: 'Notification Toggles',
          hasConfig: true
        }
      ];
    }
    const list = activeTab === 'department' ? departments : users;
    return list
      .filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(name => {
        const id = activeTab === 'department' ? `dept:${name}` : `user:${name}`;
        const hasConfig = permissions.some(p => p.id === id);
        return {
          id,
          name,
          hasConfig
        };
      });
  }, [activeTab, departments, users, permissions, searchQuery]);

  useEffect(() => {
    if (!selectedEntityId && sidebarItems.length > 0) {
      setSelectedEntityId(sidebarItems[0].id);
    }
  }, [sidebarItems, selectedEntityId]);

  const getSelectedPermission = () => {
    if (!selectedEntityId) return null;
    const found = permissions.find(p => p.id === selectedEntityId);
    if (found) return found;

    const [type, name] = selectedEntityId.split(':');
    const rid = user?.restaurant_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return {
      ...DEFAULT_PERMISSIONS,
      id: selectedEntityId,
      type: type as 'department' | 'user',
      name: name,
      ...(rid && uuidRegex.test(rid) ? { restaurant_id: rid } : {})
    };
  };

  const handleToggle = async (field: string, value: boolean) => {
    if (!selectedEntityId) return;
    
    setSavingState('saving');
    const current = getSelectedPermission();
    if (!current) return;
    
    const updated = {
      ...current,
      [field]: value
    };
    
    // Optimistic state update
    setPermissions(prev => {
      const exists = prev.some(p => p.id === selectedEntityId);
      if (exists) {
        return prev.map(p => p.id === selectedEntityId ? updated : p);
      } else {
        return [...prev, updated];
      }
    });
    
    const res = await api.saveAppPermission(updated);
    if (res.success) {
      setSavingState('saved');
      setTimeout(() => setSavingState('idle'), 2000);
    } else {
      setSavingState('error');
      fetchData(); // Reset from DB
      alert('Failed to save permissions: ' + (res.error || 'Unknown error'));
    }
  };

  const handleGlobalToggle = async (key: string, enabled: boolean) => {
    if (!globalSettings) return;
    
    setSavingState('saving');
    const updatedSettings = {
      ...globalSettings,
      [key]: enabled
    };
    
    setGlobalSettings(updatedSettings);
    
    const res = await api.saveGlobalNotificationSettings(updatedSettings);
    if (res.success) {
      setSavingState('saved');
      setTimeout(() => setSavingState('idle'), 2000);
    } else {
      setSavingState('error');
      const fetchAgain = await api.getGlobalNotificationSettings();
      if (fetchAgain.success && fetchAgain.data) {
        try {
          const val = typeof fetchAgain.data.setting_value === 'string'
            ? JSON.parse(fetchAgain.data.setting_value)
            : fetchAgain.data.setting_value;
          setGlobalSettings(val);
        } catch {
          // Ignore parser issues
        }
      }
      alert('Failed to save global notification settings: ' + (res.error || 'Unknown error'));
    }
  };

  const handleToggleDept = async (deptName: string) => {
    if (!selectedEntityId) return;
    
    setSavingState('saving');
    const current = getSelectedPermission();
    if (!current) return;
    
    const arr = (current.allowed_departments || '')
      .split(',')
      .map((d: string) => d.trim())
      .filter(Boolean);
      
    let newArr;
    if (arr.includes(deptName)) {
      newArr = arr.filter((d: string) => d !== deptName);
    } else {
      newArr = [...arr, deptName];
    }
    const newValue = newArr.join(', ');
    
    const updated = {
      ...current,
      allowed_departments: newValue
    };
    
    // Optimistic state update
    setPermissions(prev => {
      const exists = prev.some(p => p.id === selectedEntityId);
      if (exists) {
        return prev.map(p => p.id === selectedEntityId ? updated : p);
      } else {
        return [...prev, updated];
      }
    });
    
    const res = await api.saveAppPermission(updated);
    if (res.success) {
      setSavingState('saved');
      setTimeout(() => setSavingState('idle'), 2000);
    } else {
      setSavingState('error');
      fetchData(); // Reset from DB
      alert('Failed to save allowed departments: ' + (res.error || 'Unknown error'));
    }
  };

  const selectedPermission = getSelectedPermission();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .permissions-container {
          display: flex;
          gap: 24px;
          height: calc(100vh - 150px);
          min-height: 500px;
          margin-top: 16px;
        }
        
        .entity-sidebar {
          width: 300px;
          display: flex;
          flex-direction: column;
          background-color: var(--surface);
          border-radius: var(--radius);
          border: 1px solid var(--border);
          overflow: hidden;
        }
        
        .tabs-header {
          display: flex;
          border-bottom: 1px solid var(--border);
          background-color: #f8f9fa;
        }
        
        .tab-btn {
          flex: 1;
          padding: 12px;
          border: none;
          background: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        
        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background-color: #ffffff;
        }
        
        .search-box {
          padding: 10px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          background-color: #ffffff;
          position: relative;
        }
        
        .search-input {
          width: 100%;
          padding: 8px 12px 8px 32px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .search-input:focus {
          border-color: var(--primary);
        }
        
        .search-icon {
          position: absolute;
          left: 20px;
          color: var(--text-muted);
        }
        
        .entity-list {
          flex: 1;
          overflow-y: auto;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .entity-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid transparent;
        }
        
        .entity-item:hover {
          background-color: #f1f3f5;
        }
        
        .entity-item.active {
          background-color: #e8f2f0;
          border-color: rgba(30, 92, 79, 0.2);
        }
        
        .entity-name {
          font-weight: 600;
          font-size: 13px;
          color: var(--text-main);
        }
        
        .entity-badge {
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 10px;
          font-weight: 500;
        }
        
        .entity-badge.configured {
          background-color: #d4edda;
          color: #155724;
        }
        
        .entity-badge.default {
          background-color: #e2e3e5;
          color: #383d41;
        }
        
        .details-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--surface);
          border-radius: var(--radius);
          border: 1px solid var(--border);
          overflow: hidden;
        }
        
        .details-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background-color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .details-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .details-title {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
        }
        
        .saving-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 12px;
          transition: all 0.3s;
        }
        
        .saving-badge.idle {
          color: var(--text-muted);
          background-color: #f8f9fa;
        }
        
        .saving-badge.saving {
          color: #0c5460;
          background-color: #d1ecf1;
        }
        
        .saving-badge.saved {
          color: #155724;
          background-color: #d4edda;
        }
        
        .saving-badge.error {
          color: #721c24;
          background-color: #f8d7da;
        }
        
        .details-body {
          flex: 1;
          overflow-y: auto;
          background-color: #f8f9fa;
        }
        
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          padding: 20px;
        }
        
        .category-card {
          background-color: #ffffff;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #f1f3f5;
          padding-bottom: 8px;
        }
        
        .card-title {
          font-weight: 700;
          font-size: 14px;
          color: #333333;
        }
        
        .permission-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .permission-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        
        .permission-label {
          font-size: 13px;
          color: #495057;
          font-weight: 500;
        }
        
        .custom-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
          flex-shrink: 0;
        }
        
        .custom-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .switch-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ced4da;
          transition: .2s;
          border-radius: 20px;
        }
        
        .switch-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        
        input:checked + .switch-slider {
          background-color: var(--primary);
        }
        
        input:checked + .switch-slider:before {
          transform: translateX(20px);
        }
        
        .allowed-depts-card {
          grid-column: 1 / -1;
          background-color: #ffffff;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          padding: 16px;
        }
        
        .chips-container {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }
        
        .dept-chip {
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--border);
          background-color: #ffffff;
          color: var(--text-main);
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .dept-chip:hover {
          background-color: #f8f9fa;
          border-color: #adb5bd;
        }
        
        .dept-chip.active {
          background-color: var(--primary);
          border-color: var(--primary);
          color: #ffffff;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
        }
        
        .global-settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
          padding: 20px;
        }
        
        .global-module-card {
          background-color: #ffffff;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          padding: 20px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: all 0.2s ease-in-out;
          position: relative;
        }
        
        .global-module-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          border-color: rgba(30, 92, 79, 0.3);
        }
        
        .global-icon-wrapper {
          padding: 10px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .global-module-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .global-module-title {
          font-weight: 700;
          font-size: 14px;
          color: #1f2937;
        }
        
        .global-module-desc {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }
        
        .global-header-card {
          background: linear-gradient(135deg, #1e5c4f 0%, #11362e 100%);
          border-radius: var(--radius);
          padding: 20px;
          margin: 20px 20px 0 20px;
          color: #ffffff;
          box-shadow: 0 4px 15px rgba(30, 92, 79, 0.15);
        }
        
        .global-header-card h3 {
          margin: 0 0 6px 0;
          font-size: 16px;
          font-weight: 800;
        }
        
        .global-header-card p {
          margin: 0;
          font-size: 13px;
          opacity: 0.9;
          line-height: 1.4;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={28} style={{ color: 'var(--primary)' }} /> App Access Matrix
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage which departments and users can access specific app modules.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <div className="permissions-container">
          {/* Sidebar */}
          <div className="entity-sidebar">
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'department' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('department');
                  setSelectedEntityId(null);
                  setSearchQuery('');
                }}
              >
                <Users size={16} />
                Departments
              </button>
              <button 
                className={`tab-btn ${activeTab === 'user' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('user');
                  setSelectedEntityId(null);
                  setSearchQuery('');
                }}
              >
                <User size={16} />
                Users
              </button>
              <button 
                className={`tab-btn ${activeTab === 'global_alerts' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('global_alerts');
                  setSelectedEntityId('global_settings');
                  setSearchQuery('');
                }}
              >
                <Sliders size={16} />
                Settings
              </button>
            </div>

            {activeTab !== 'global_alerts' && (
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder={`Search ${activeTab}s...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}

            <div className="entity-list">
              {sidebarItems.map(item => (
                <div 
                  key={item.id}
                  className={`entity-item ${selectedEntityId === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedEntityId(item.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeTab === 'department' ? (
                      <Shield size={14} color="var(--primary)" />
                    ) : activeTab === 'user' ? (
                      <User size={14} color="var(--primary)" />
                    ) : (
                      <Sliders size={14} color="var(--primary)" />
                    )}
                    <span className="entity-name">{item.name}</span>
                  </div>
                  <span className={`entity-badge ${item.hasConfig ? 'configured' : 'default'}`}>
                    {activeTab === 'global_alerts' ? 'Active' : item.hasConfig ? 'Configured' : 'Default'}
                  </span>
                </div>
              ))}
              {sidebarItems.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No items found.
                </div>
              )}
            </div>
          </div>

          {/* Details Form */}
          <div className="details-panel">
            {activeTab === 'global_alerts' ? (
              <>
                <div className="details-header">
                  <div className="details-title-row">
                    <Sliders size={20} color="var(--primary)" />
                    <span className="details-title">System Settings</span>
                    <span className="entity-badge configured">
                      Admin Settings
                    </span>
                  </div>

                  <div className={`saving-badge ${savingState}`}>
                    {savingState === 'saving' && (
                      <>
                        <Loader2 size={12} className="spin" />
                        <span>Saving Settings...</span>
                      </>
                    )}
                    {savingState === 'saved' && (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Changes Saved</span>
                      </>
                    )}
                    {savingState === 'error' && (
                      <>
                        <AlertCircle size={12} />
                        <span>Error Saving</span>
                      </>
                    )}
                    {savingState === 'idle' && (
                      <>
                        <CheckCircle2 size={12} style={{ opacity: 0.5 }} />
                        <span>Settings Synced</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="details-body" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="global-header-card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginTop: '0', marginBottom: '20px' }}>
                    <h3>System Parameter Settings</h3>
                    <p>
                      Configure restaurant-specific business constants like LBP exchange rate and Lebanese VAT percentage.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '20px', marginTop: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9, display: 'block', marginBottom: '4px' }}>USD to LBP Exchange Rate</label>
                        <input 
                          type="number" 
                          value={exchangeRate} 
                          onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                        />
                      </div>
                      
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9, display: 'block', marginBottom: '4px' }}>VAT Percentage (%)</label>
                        <input 
                          type="number" 
                          value={vatRate} 
                          onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9, display: 'block', marginBottom: '8px' }}>VAT Subscribed (Yes/No)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: !isVatSubscribed ? '#fff' : 'rgba(255,255,255,0.6)' }}>NO</span>
                          <label className="custom-switch">
                            <input 
                              type="checkbox" 
                              checked={isVatSubscribed} 
                              onChange={(e) => setIsVatSubscribed(e.target.checked)}
                            />
                            <span className="switch-slider" style={{ border: '1px solid rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.2)' }}></span>
                          </label>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: isVatSubscribed ? '#fff' : 'rgba(255,255,255,0.6)' }}>YES</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex' }}>
                        <button 
                          onClick={handleSaveSystemSettings}
                          className="auth-btn"
                          style={{ backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontWeight: 'bold', padding: '10px 20px', height: '38px', lineHeight: '18px', width: 'auto', cursor: 'pointer' }}
                        >
                          Save Settings
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="global-header-card">
                    <h3>Global Alerts Settings</h3>
                    <p>
                      Enable or disable automated push notifications system-wide. When a toggle is turned OFF,
                      no push notifications will be sent globally for that module, overriding any specific user
                      roles or individual permissions. Concerned staff roles and branches are dynamically calculated.
                    </p>
                  </div>
                  
                  <div className="global-settings-grid">
                    {GLOBAL_MODULES.map(module => {
                      const isEnabled = globalSettings ? !!globalSettings[module.key] : true;
                      return (
                        <div key={module.key} className="global-module-card">
                          <div className="global-icon-wrapper" style={{ backgroundColor: module.bg }}>
                            {module.icon}
                          </div>
                          <div className="global-module-info">
                            <span className="global-module-title">{module.title}</span>
                            <span className="global-module-desc">{module.desc}</span>
                          </div>
                          <label className="custom-switch" style={{ marginTop: '4px' }}>
                            <input 
                              type="checkbox" 
                              checked={isEnabled} 
                              onChange={(e) => handleGlobalToggle(module.key, e.target.checked)}
                            />
                            <span className="switch-slider"></span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : selectedPermission ? (
              <>
                <div className="details-header">
                  <div className="details-title-row">
                    {activeTab === 'department' ? (
                      <Shield size={20} color="var(--primary)" />
                    ) : (
                      <User size={20} color="var(--primary)" />
                    )}
                    <span className="details-title">{selectedPermission.name}</span>
                    <span className="entity-badge configured" style={{ textTransform: 'capitalize' }}>
                      {activeTab} Settings
                    </span>
                  </div>

                  <div className={`saving-badge ${savingState}`}>
                    {savingState === 'saving' && (
                      <>
                        <Loader2 size={12} className="spin" />
                        <span>Saving...</span>
                      </>
                    )}
                    {savingState === 'saved' && (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Changes Saved</span>
                      </>
                    )}
                    {savingState === 'error' && (
                      <>
                        <AlertCircle size={12} />
                        <span>Error Saving</span>
                      </>
                    )}
                    {savingState === 'idle' && (
                      <>
                        <CheckCircle2 size={12} style={{ opacity: 0.5 }} />
                        <span>Autosaved</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="details-body">
                  <div className="cards-grid">
                    {CATEGORIES.map(cat => (
                      <div key={cat.id} className="category-card">
                        <div className="card-header">
                          {cat.icon}
                          <span className="card-title">{cat.title}</span>
                        </div>
                        <div className="permission-list">
                          {cat.permissions.map(perm => (
                            <div className="permission-row" key={perm.key}>
                              <span className="permission-label">{perm.label}</span>
                              <label className="custom-switch">
                                <input 
                                  type="checkbox" 
                                  checked={!!selectedPermission[perm.key]} 
                                  onChange={(e) => handleToggle(perm.key, e.target.checked)}
                                />
                                <span className="switch-slider"></span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Allowed Departments override list */}
                    {!selectedPermission.can_order_all_departments && (
                      <div className="allowed-depts-card">
                        <div className="card-header">
                          <Sliders size={18} style={{ color: 'var(--primary)' }} />
                          <span className="card-title">Allowed Departments (if not ALL)</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '12px' }}>
                          Select which departments this entity is allowed to place orders for:
                        </p>
                        <div className="chips-container">
                          {departments.map(dept => {
                            const isActive = (selectedPermission.allowed_departments || '')
                              .split(',')
                              .map((d: string) => d.trim())
                              .filter(Boolean)
                              .includes(dept);
                            return (
                              <button
                                key={dept}
                                className={`dept-chip ${isActive ? 'active' : ''}`}
                                onClick={() => handleToggleDept(dept)}
                              >
                                {isActive && <Check size={14} />}
                                {dept}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Shield size={48} style={{ color: '#ced4da', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Select an Entity
                </h3>
                <p style={{ fontSize: '14px', maxWidth: '300px' }}>
                  Choose a department or user override from the left sidebar to configure their app permissions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
