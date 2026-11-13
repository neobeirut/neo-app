import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield, Users, Lock, Key, CheckCircle2, XCircle, Search, Filter, 
  RotateCcw, Save, AlertCircle, Eye, UserCheck, UserX, Building2,
  Sliders, ArrowRight, Clock, ChevronRight, Check, X, Store, 
  RefreshCw, Download, FileText, ChevronDown, Sparkles, Layers,
  Receipt, ShoppingCart, DollarSign
} from 'lucide-react';
import { posPermissionsApi } from '../api/posPermissionsApi';
import {
  POS_PERMISSION_CATEGORIES,
  POS_PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
  normalizePosRole,
  type PosRoleName,
  type PosPermissionKey,
  type PosPermissionDef,
  type EmployeePosConfig,
  type PosAuditLogEntry,
  type PermissionOverrideState
} from '../pos/posPermissions';

interface PosPermissionsScreenProps {
  user: any;
  permissions?: any;
}

export default function PosPermissionsScreen({ user }: PosPermissionsScreenProps) {
  const currentRestaurantId = user?.restaurant_id || user?.restaurants?.id || '79256f11-a9f8-4fec-901d-69baf929762d';
  const restaurantName = user?.restaurants?.name || 'Restaurant';

  // Active Tab: 'roles' | 'employees' | 'audit'
  const [activeTab, setActiveTab] = useState<'roles' | 'employees' | 'audit'>('roles');

  // Loading & notification states
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Tab 1: Role Permissions State ──
  const [rolePermissions, setRolePermissions] = useState<Record<PosRoleName, Record<PosPermissionKey, boolean>>>(DEFAULT_ROLE_PERMISSIONS);
  const [selectedRole, setSelectedRole] = useState<PosRoleName>('waiter');
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [roleCategoryFilter, setRoleCategoryFilter] = useState<string>('all');
  const [hasUnsavedRoleChanges, setHasUnsavedRoleChanges] = useState(false);

  // ── Tab 2: Employee Permissions State ──
  const [employees, setEmployees] = useState<EmployeePosConfig[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePosConfig | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeBranchFilter, setEmployeeBranchFilter] = useState<string>('all');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('all');
  const [employeePosStatusFilter, setEmployeePosStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [activeEmployeeOverrides, setActiveEmployeeOverrides] = useState<Partial<Record<PosPermissionKey, PermissionOverrideState>>>({});
  const [activeEmployeePosAccess, setActiveEmployeePosAccess] = useState(true);
  const [activeEmployeeRole, setActiveEmployeeRole] = useState<string>('waiter');
  const [employeeDrawerSearch, setEmployeeDrawerSearch] = useState('');

  // ── Tab 3: Authorization & Audit Log State ──
  const [auditLogs, setAuditLogs] = useState<PosAuditLogEntry[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditBranchFilter, setAuditBranchFilter] = useState('All');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditDateFilter, setAuditDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Show Toast helper
  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // ── Load All Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, empRes, logsRes] = await Promise.all([
        posPermissionsApi.getPosRolePermissions(currentRestaurantId),
        posPermissionsApi.getPosEmployees(currentRestaurantId),
        posPermissionsApi.getPosAuditLogs(currentRestaurantId)
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRolePermissions(rolesRes.data);
      }
      if (empRes.success && empRes.data) {
        setEmployees(empRes.data);
      }
      if (logsRes.success && logsRes.data) {
        setAuditLogs(logsRes.data);
      }
    } catch (err: any) {
      console.error('Error loading POS permissions data:', err);
      showToast('error', 'Failed to load POS permissions');
    } finally {
      setLoading(false);
    }
  }, [currentRestaurantId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Available branches computed from employees ──
  const availableBranches = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.branch && e.branch !== 'All') set.add(e.branch);
    });
    return Array.from(set);
  }, [employees]);

  // ── Tab 1 Handlers ──
  const handleToggleRolePermission = (permKey: PosPermissionKey) => {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [permKey]: !prev[selectedRole]?.[permKey]
      }
    }));
    setHasUnsavedRoleChanges(true);
  };

  const handleBulkCategoryToggle = (category: string, enableAll: boolean) => {
    const categoryKeys = POS_PERMISSION_DEFINITIONS
      .filter(d => d.category === category)
      .map(d => d.key);

    setRolePermissions(prev => {
      const updatedRole = { ...prev[selectedRole] };
      categoryKeys.forEach(k => {
        updatedRole[k] = enableAll;
      });
      return {
        ...prev,
        [selectedRole]: updatedRole
      };
    });
    setHasUnsavedRoleChanges(true);
  };

  const handleResetRoleToDefault = (roleToReset: PosRoleName) => {
    if (confirm(`Reset all permissions for ${ROLE_DISPLAY_NAMES[roleToReset]} to factory defaults?`)) {
      setRolePermissions(prev => ({
        ...prev,
        [roleToReset]: { ...DEFAULT_ROLE_PERMISSIONS[roleToReset] }
      }));
      setHasUnsavedRoleChanges(true);
      showToast('success', `Reset ${ROLE_DISPLAY_NAMES[roleToReset]} to default permissions`);
    }
  };

  const handleSaveRolePermissions = async () => {
    setSaveLoading(true);
    try {
      const res = await posPermissionsApi.savePosRolePermissions(rolePermissions, currentRestaurantId);
      if (res.success) {
        setHasUnsavedRoleChanges(false);
        showToast('success', 'Role permission templates saved successfully');
        // Refresh employees to recompute effective permissions
        const empRes = await posPermissionsApi.getPosEmployees(currentRestaurantId);
        if (empRes.success && empRes.data) {
          setEmployees(empRes.data);
        }
      } else {
        showToast('error', res.error || 'Failed to save role permissions');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving role permissions');
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Tab 2 Handlers: Employee Overrides & Role Assignment ──
  const handleOpenEmployeeDrawer = (emp: EmployeePosConfig) => {
    setSelectedEmployee(emp);
    setActiveEmployeeOverrides({ ...(emp.overrides || {}) });
    setActiveEmployeePosAccess(emp.can_access_pos);
    setActiveEmployeeRole(emp.role || 'Waiter');
    setEmployeeDrawerSearch('');
  };

  const handleCloseEmployeeDrawer = () => {
    setSelectedEmployee(null);
  };

  const handleSetEmployeeOverride = (permKey: PosPermissionKey, state: PermissionOverrideState) => {
    setActiveEmployeeOverrides(prev => {
      const next = { ...prev };
      if (state === 'inherit') {
        delete next[permKey];
      } else {
        next[permKey] = state;
      }
      return next;
    });
  };

  const handleResetAllEmployeeOverrides = () => {
    setActiveEmployeeOverrides({});
    showToast('success', 'Cleared all individual overrides. Employee now purely inherits from role.');
  };

  const handleQuickChangeRole = async (emp: EmployeePosConfig, newRole: string) => {
    try {
      const res = await posPermissionsApi.savePosEmployeeOverrides(
        emp.user_id,
        emp.overrides,
        emp.can_access_pos,
        emp.name,
        newRole
      );
      if (res.success) {
        showToast('success', `Assigned ${emp.name} to ${newRole}`);
        const empRes = await posPermissionsApi.getPosEmployees(currentRestaurantId);
        if (empRes.success && empRes.data) {
          setEmployees(empRes.data);
          if (selectedEmployee?.user_id === emp.user_id) {
            setActiveEmployeeRole(newRole);
          }
        }
      } else {
        showToast('error', res.error || 'Failed to update role');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error updating role');
    }
  };

  const handleSaveEmployeeConfig = async () => {
    if (!selectedEmployee) return;
    setSaveLoading(true);
    try {
      const res = await posPermissionsApi.savePosEmployeeOverrides(
        selectedEmployee.user_id,
        activeEmployeeOverrides,
        activeEmployeePosAccess,
        selectedEmployee.name,
        activeEmployeeRole
      );

      if (res.success) {
        showToast('success', `Saved permissions and assigned ${selectedEmployee.name} to ${activeEmployeeRole}`);
        // Refresh employee list
        const empRes = await posPermissionsApi.getPosEmployees(currentRestaurantId);
        if (empRes.success && empRes.data) {
          setEmployees(empRes.data);
          // update currently selected employee snapshot
          const updated = empRes.data.find(e => e.user_id === selectedEmployee.user_id);
          if (updated) setSelectedEmployee(updated);
        }
      } else {
        showToast('error', res.error || 'Failed to save employee permissions');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error saving employee permissions');
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Tab 3 Handlers: Audit Log Filtering & Export ──
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditSearchTerm) {
        const q = auditSearchTerm.toLowerCase();
        const match =
          log.employee_name.toLowerCase().includes(q) ||
          log.authorizer_name?.toLowerCase().includes(q) ||
          log.action_label.toLowerCase().includes(q) ||
          log.reason?.toLowerCase().includes(q) ||
          String(log.order_id || '').includes(q) ||
          String(log.table_number || '').includes(q);
        if (!match) return false;
      }

      if (auditBranchFilter !== 'All' && log.branch !== auditBranchFilter) {
        return false;
      }

      if (auditActionFilter !== 'all' && log.action_type !== auditActionFilter) {
        return false;
      }

      if (auditDateFilter !== 'all') {
        const logDate = new Date(log.created_at).getTime();
        const now = Date.now();
        if (auditDateFilter === 'today') {
          const oneDayAgo = now - 24 * 60 * 60 * 1000;
          if (logDate < oneDayAgo) return false;
        } else if (auditDateFilter === '7days') {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          if (logDate < sevenDaysAgo) return false;
        } else if (auditDateFilter === '30days') {
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [auditLogs, auditSearchTerm, auditBranchFilter, auditActionFilter, auditDateFilter]);

  const exportAuditLogsToCsv = () => {
    if (filteredAuditLogs.length === 0) {
      alert('No audit logs to export for the current filters.');
      return;
    }

    const headers = ['Timestamp', 'Action', 'Employee', 'Authorizer', 'Branch', 'Table', 'Order ID', 'Status', 'Reason', 'Details'];
    const rows = filteredAuditLogs.map(l => [
      new Date(l.created_at).toLocaleString(),
      `"${l.action_label}"`,
      `"${l.employee_name}"`,
      `"${l.authorizer_name || 'N/A'}"`,
      `"${l.branch || 'Main'}"`,
      `"${l.table_number || 'N/A'}"`,
      `"${l.order_id || 'N/A'}"`,
      `"${l.status}"`,
      `"${l.reason || ''}"`,
      `"${l.previous_value ? `Prev: ${JSON.stringify(l.previous_value)} New: ${JSON.stringify(l.new_value)}` : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pos_authorization_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Filtered Employees ──
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (employeeSearchTerm) {
        const q = employeeSearchTerm.toLowerCase();
        if (!emp.name.toLowerCase().includes(q) && !emp.role.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (employeeBranchFilter !== 'all' && emp.branch !== employeeBranchFilter) {
        return false;
      }
      if (employeeRoleFilter !== 'all' && emp.normalized_role !== employeeRoleFilter) {
        return false;
      }
      if (employeePosStatusFilter === 'enabled' && !emp.can_access_pos) return false;
      if (employeePosStatusFilter === 'disabled' && emp.can_access_pos) return false;
      return true;
    });
  }, [employees, employeeSearchTerm, employeeBranchFilter, employeeRoleFilter, employeePosStatusFilter]);

  // ── Filtered Permissions for Role Matrix Tab ──
  const filteredPermissions = useMemo(() => {
    return POS_PERMISSION_DEFINITIONS.filter(def => {
      if (roleCategoryFilter !== 'all' && def.category !== roleCategoryFilter) return false;
      if (roleSearchTerm) {
        const q = roleSearchTerm.toLowerCase();
        if (!def.label.toLowerCase().includes(q) && !def.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [roleCategoryFilter, roleSearchTerm]);

  return (
    <div className="pos-permissions-container" style={{ minHeight: '100vh', background: 'var(--bg-main, #0f172a)', color: 'var(--text-main, #f8fafc)', padding: '24px' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: '12px',
          background: toastMessage.type === 'success' ? '#064e3b' : '#7f1d1d',
          color: '#ffffff',
          border: `1px solid ${toastMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          fontSize: '13px',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header / Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
            <span>Flow Admin</span>
            <span>/</span>
            <span style={{ color: 'var(--primary, #3b82f6)', fontWeight: 600 }}>POS</span>
            <span>/</span>
            <span style={{ color: '#ffffff', fontWeight: 700 }}>Permissions &amp; Security</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Shield size={22} />
            </span>
            POS User Permissions Management
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
            Configure role templates, employee-specific overrides, and inspect sensitive operation authorization logs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3 Main Tabs Nav */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'roles' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'roles' ? '#3b82f6' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sliders size={16} />
          <span>Tab 1 — Role Permissions</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'employees' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'employees' ? '#3b82f6' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          <span>Tab 2 — Employee Permissions</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
            {employees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'audit' ? '#3b82f6' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          <span>Tab 3 — Authorization &amp; Audit Log</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: ROLE PERMISSIONS MATRIX                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Role Selector Header Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {(Object.keys(DEFAULT_ROLE_PERMISSIONS) as PosRoleName[]).map(roleKey => {
              const isSelected = selectedRole === roleKey;
              const roleAllowedCount = Object.values(rolePermissions[roleKey] || {}).filter(Boolean).length;
              const totalPerms = POS_PERMISSION_DEFINITIONS.length;

              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => setSelectedRole(roleKey)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                    border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: isSelected ? '#60a5fa' : '#f8fafc' }}>
                      {ROLE_DISPLAY_NAMES[roleKey]}
                    </span>
                    {isSelected && (
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3, marginBottom: '8px', minHeight: '28px' }}>
                    {ROLE_DESCRIPTIONS[roleKey]}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? '#93c5fd' : '#64748b' }}>
                    {roleAllowedCount} of {totalPerms} permitted
                  </div>
                </button>
              );
            })}
          </div>

          {/* Matrix Actions & Filter Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '14px',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRoleCategoryFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: roleCategoryFilter === 'all' ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  All ({POS_PERMISSION_DEFINITIONS.length})
                </button>
                {POS_PERMISSION_CATEGORIES.map(cat => {
                  const count = POS_PERMISSION_DEFINITIONS.filter(p => p.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRoleCategoryFilter(cat.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: roleCategoryFilter === cat.id ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                        color: roleCategoryFilter === cat.id ? '#ffffff' : '#cbd5e1',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {cat.title} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search permission by name..."
                  value={roleSearchTerm}
                  onChange={(e) => setRoleSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Save & Reset Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleResetRoleToDefault(selectedRole)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={13} />
                <span>Reset to Role Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={saveLoading || !hasUnsavedRoleChanges}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: hasUnsavedRoleChanges ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#334155',
                  color: '#ffffff',
                  border: hasUnsavedRoleChanges ? '1px solid #60a5fa' : '1px solid #475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: hasUnsavedRoleChanges ? 'pointer' : 'default',
                  opacity: hasUnsavedRoleChanges ? 1 : 0.6,
                  boxShadow: hasUnsavedRoleChanges ? '0 4px 14px rgba(37, 99, 235, 0.4)' : 'none'
                }}
              >
                <Save size={15} />
                <span>{saveLoading ? 'Saving...' : hasUnsavedRoleChanges ? 'Save Changes' : 'Saved'}</span>
              </button>
            </div>
          </div>

          {/* Role Permissions Categorized Cards Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {POS_PERMISSION_CATEGORIES.map(category => {
              if (roleCategoryFilter !== 'all' && roleCategoryFilter !== category.id) return null;

              const categoryPermissions = filteredPermissions.filter(p => p.category === category.id);
              if (categoryPermissions.length === 0) return null;

              const allEnabled = categoryPermissions.every(p => rolePermissions[selectedRole]?.[p.key]);

              return (
                <div
                  key={category.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '18px 20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{category.title}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>({categoryPermissions.length})</span>
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>{category.description}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleBulkCategoryToggle(category.id, true)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#34d399',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Enable All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkCategoryToggle(category.id, false)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Disable All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
                    {categoryPermissions.map(perm => {
                      const isGranted = !!rolePermissions[selectedRole]?.[perm.key];

                      return (
                        <div
                          key={perm.key}
                          onClick={() => handleToggleRolePermission(perm.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: isGranted ? 'rgba(30, 58, 138, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                            border: `1px solid ${isGranted ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <div style={{ paddingRight: '12px', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: isGranted ? '#ffffff' : '#94a3b8' }}>
                                {perm.label}
                              </span>
                              {perm.isSensitive && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  fontWeight: 600
                                }}>
                                  PIN Eligible
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.25 }}>
                              {perm.description}
                            </div>
                          </div>

                          {/* Toggle Switch */}
                          <div style={{
                            width: '40px',
                            height: '22px',
                            borderRadius: '12px',
                            background: isGranted ? '#2563eb' : '#334155',
                            position: 'relative',
                            transition: 'background 0.2s',
                            flexShrink: 0
                          }}>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              position: 'absolute',
                              top: '2px',
                              left: isGranted ? '20px' : '2px',
                              transition: 'left 0.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: EMPLOYEE PERMISSIONS & INDIVIDUAL OVERRIDES                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Filters Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '14px',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              {/* Search */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Filter employees..."
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Branch Filter */}
              <select
                value={employeeBranchFilter}
                onChange={(e) => setEmployeeBranchFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="all">All Branches</option>
                {availableBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                value={employeeRoleFilter}
                onChange={(e) => setEmployeeRoleFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="all">All Roles</option>
                {(Object.keys(DEFAULT_ROLE_PERMISSIONS) as PosRoleName[]).map(r => (
                  <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</option>
                ))}
              </select>

              {/* POS Access Status */}
              <select
                value={employeePosStatusFilter}
                onChange={(e) => setEmployeePosStatusFilter(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="all">All POS Statuses</option>
                <option value="enabled">POS Enabled Only</option>
                <option value="disabled">POS Disabled Only</option>
              </select>
            </div>

            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
              Showing {filteredEmployees.length} of {employees.length} employees
            </div>
          </div>

          {/* Employees Table */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>
                  <th style={{ padding: '14px 18px' }}>Employee</th>
                  <th style={{ padding: '14px 18px' }}>Assigned Role</th>
                  <th style={{ padding: '14px 18px' }}>Branch</th>
                  <th style={{ padding: '14px 18px' }}>POS Access</th>
                  <th style={{ padding: '14px 18px' }}>Overrides</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const overridesCount = Object.keys(emp.overrides || {}).length;
                  const isSelected = selectedEmployee?.user_id === emp.user_id;

                  return (
                    <tr
                      key={emp.user_id}
                      onClick={() => handleOpenEmployeeDrawer(emp)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px'
                          }}>
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{emp.name}</div>
                            {emp.display_name && emp.display_name !== emp.name && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Alias: {emp.display_name}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={emp.normalized_role}
                          onChange={(e) => {
                            const selectedDisplay = ROLE_DISPLAY_NAMES[e.target.value as PosRoleName] || e.target.value;
                            handleQuickChangeRole(emp, selectedDisplay);
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="waiter" style={{ background: '#1e293b', color: '#fff' }}>Waiter</option>
                          <option value="runner" style={{ background: '#1e293b', color: '#fff' }}>Runner</option>
                          <option value="cashier" style={{ background: '#1e293b', color: '#fff' }}>Cashier</option>
                          <option value="floor_supervisor" style={{ background: '#1e293b', color: '#fff' }}>Floor Supervisor</option>
                          <option value="manager" style={{ background: '#1e293b', color: '#fff' }}>Manager</option>
                          <option value="administrator" style={{ background: '#1e293b', color: '#fff' }}>Administrator</option>
                        </select>
                      </td>

                      <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Building2 size={13} style={{ color: '#64748b' }} />
                          {emp.branch || 'All'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {emp.can_access_pos ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            <Check size={12} /> Enabled
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            <X size={12} /> Disabled
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {overridesCount > 0 ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {overridesCount} override{overridesCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Pure Role Default
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEmployeeDrawer(emp);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Manage Permissions →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Employee Override Drawer Modal */}
          {selectedEmployee && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              justifyContent: 'flex-end',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '650px',
                height: '100%',
                background: '#0f172a',
                borderLeft: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
              }}>
                {/* Drawer Header */}
                <div style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1e293b'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Employee POS Permission Override
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0 0', color: '#f8fafc' }}>
                      {selectedEmployee.name}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                      <span style={{ fontWeight: 600 }}>Assigned Role:</span>
                      <select
                        value={normalizePosRole(activeEmployeeRole)}
                        onChange={(e) => {
                          const displayRole = ROLE_DISPLAY_NAMES[e.target.value as PosRoleName] || e.target.value;
                          setActiveEmployeeRole(displayRole);
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#334155',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.2)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="waiter">Waiter</option>
                        <option value="runner">Runner</option>
                        <option value="cashier">Cashier</option>
                        <option value="floor_supervisor">Floor Supervisor</option>
                        <option value="manager">Manager</option>
                        <option value="administrator">Administrator</option>
                      </select>
                      <span>•</span>
                      <span>Branch: <strong style={{ color: '#ffffff' }}>{selectedEmployee.branch}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseEmployeeDrawer}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Drawer Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Master POS Access Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '12px',
                    background: activeEmployeePosAccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${activeEmployeePosAccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: activeEmployeePosAccess ? '#34d399' : '#f87171' }}>
                        POS Access: {activeEmployeePosAccess ? 'ENABLED' : 'DISABLED'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {activeEmployeePosAccess ? 'Employee can log in and operate FLOW POS terminal' : 'Employee is immediately barred from accessing POS'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveEmployeePosAccess(!activeEmployeePosAccess)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: activeEmployeePosAccess ? '#dc2626' : '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {activeEmployeePosAccess ? 'Disable POS Access' : 'Enable POS Access'}
                    </button>
                  </div>

                  {/* Overrides Overview & Quick Clear */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                      Effective Permissions ({POS_PERMISSION_DEFINITIONS.length})
                    </div>
                    {Object.keys(activeEmployeeOverrides).length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAllEmployeeOverrides}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#fbbf24',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reset All to Role Defaults
                      </button>
                    )}
                  </div>

                  {/* Search within Drawer */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="Search permission in overrides..."
                      value={employeeDrawerSearch}
                      onChange={(e) => setEmployeeDrawerSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 32px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f8fafc',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Categorized Permissions Overrides List */}
                  {POS_PERMISSION_CATEGORIES.map(category => {
                    const catPerms = POS_PERMISSION_DEFINITIONS.filter(p => {
                      if (p.category !== category.id) return false;
                      if (employeeDrawerSearch) {
                        const q = employeeDrawerSearch.toLowerCase();
                        return p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
                      }
                      return true;
                    });

                    if (catPerms.length === 0) return null;

                    return (
                      <div key={category.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {category.title}
                        </div>

                        {catPerms.map(perm => {
                          const overrideState: PermissionOverrideState = activeEmployeeOverrides[perm.key] || 'inherit';
                          const normRole = normalizePosRole(activeEmployeeRole || selectedEmployee.role);
                          const roleDefault = !!rolePermissions[normRole]?.[perm.key];
                          const isEffective = overrideState === 'allow' ? true : overrideState === 'deny' ? false : roleDefault;

                          return (
                            <div
                              key={perm.key}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: '#1e293b',
                                border: `1px solid ${overrideState !== 'inherit' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px'
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>
                                    {perm.label}
                                  </span>

                                  {/* Effective Badge */}
                                  {overrideState === 'allow' ? (
                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#065f46', color: '#6ee7b7', fontWeight: 700 }}>
                                      ALLOW (OVERRIDE)
                                    </span>
                                  ) : overrideState === 'deny' ? (
                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#991b1b', color: '#fca5a5', fontWeight: 700 }}>
                                      DENY (OVERRIDE)
                                    </span>
                                  ) : roleDefault ? (
                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', fontWeight: 600 }}>
                                      INHERITED ALLOW ({ROLE_DISPLAY_NAMES[normRole]})
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontWeight: 600 }}>
                                      INHERITED DENY
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  {perm.description}
                                </div>
                              </div>

                              {/* 3-way Segmented Control: Inherit | Allow | Deny */}
                              <div style={{
                                display: 'flex',
                                background: '#0f172a',
                                borderRadius: '8px',
                                padding: '2px',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => handleSetEmployeeOverride(perm.key, 'inherit')}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    border: 'none',
                                    background: overrideState === 'inherit' ? '#334155' : 'transparent',
                                    color: overrideState === 'inherit' ? '#ffffff' : '#64748b',
                                    cursor: 'pointer'
                                  }}
                                  title="Inherit from assigned role template"
                                >
                                  Inherit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetEmployeeOverride(perm.key, 'allow')}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    border: 'none',
                                    background: overrideState === 'allow' ? '#059669' : 'transparent',
                                    color: overrideState === 'allow' ? '#ffffff' : '#64748b',
                                    cursor: 'pointer'
                                  }}
                                  title="Explicitly ALLOW for this employee"
                                >
                                  Allow
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetEmployeeOverride(perm.key, 'deny')}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    border: 'none',
                                    background: overrideState === 'deny' ? '#dc2626' : 'transparent',
                                    color: overrideState === 'deny' ? '#ffffff' : '#64748b',
                                    cursor: 'pointer'
                                  }}
                                  title="Explicitly DENY for this employee"
                                >
                                  Deny
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Drawer Footer Actions */}
                <div style={{
                  padding: '16px 24px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  background: '#1e293b',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button
                    type="button"
                    onClick={handleCloseEmployeeDrawer}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEmployeeConfig}
                    disabled={saveLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      border: '1px solid #60a5fa',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                    }}
                  >
                    <Save size={15} />
                    <span>{saveLoading ? 'Saving...' : 'Save Employee Overrides'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: AUTHORIZATION & AUDIT LOG                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Audit Filters Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '14px',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              {/* Search */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search by staff, authorizer, order #..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Branch Filter */}
              <select
                value={auditBranchFilter}
                onChange={(e) => setAuditBranchFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="All">All Branches</option>
                {availableBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Action Type Filter */}
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="all">All Actions</option>
                <option value="void_sent_items">Void Sent Items</option>
                <option value="apply_discount">Apply Discount</option>
                <option value="change_item_price">Price Override</option>
                <option value="transfer_table">Transfer Table</option>
                <option value="reopen_table">Reopen Table</option>
                <option value="refund_payment">Refund Payment</option>
                <option value="access_cash_drawer">Drawer Open</option>
                <option value="cancel_entire_order">Cancel Order</option>
              </select>

              {/* Date Filter */}
              <select
                value={auditDateFilter}
                onChange={(e) => setAuditDateFilter(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportAuditLogsToCsv}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Audit Log Table */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>
                  <th style={{ padding: '14px 16px' }}>Timestamp</th>
                  <th style={{ padding: '14px 16px' }}>Action</th>
                  <th style={{ padding: '14px 16px' }}>Employee</th>
                  <th style={{ padding: '14px 16px' }}>Authorizing Supervisor</th>
                  <th style={{ padding: '14px 16px' }}>Context</th>
                  <th style={{ padding: '14px 16px' }}>Reason</th>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
                      <FileText size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#94a3b8' }}>No Sensitive POS Events Logged</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        When staff perform sensitive actions or supervisors authorize voids, discounts, or overrides, they will appear here in real time.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map(log => {
                    const dateFormatted = new Date(log.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '14px 16px', color: '#94a3b8', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} style={{ color: '#64748b' }} />
                            <span>{dateFormatted}</span>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '12px',
                            fontWeight: 700
                          }}>
                            {log.action_label}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#f8fafc' }}>
                          {log.employee_name}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {log.authorizer_name ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 10px',
                              borderRadius: '8px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              <Shield size={12} />
                              {log.authorizer_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              Direct Execution
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', color: '#cbd5e1', fontSize: '12px' }}>
                          {log.table_number && <span>Table {log.table_number} </span>}
                          {log.order_id && <span style={{ color: '#94a3b8' }}>• #{log.order_id} </span>}
                          <span style={{ color: '#64748b' }}>({log.branch})</span>
                        </td>

                        <td style={{ padding: '14px 16px', color: '#e2e8f0', fontSize: '12px', maxWidth: '240px' }}>
                          {log.reason ? (
                            <span style={{ fontStyle: 'italic' }}>"{log.reason}"</span>
                          ) : (
                            <span style={{ color: '#64748b' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: log.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: log.status === 'approved' ? '#34d399' : '#60a5fa',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                          }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
