import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  ClipboardList,
  Truck,
  AlertTriangle,
  Trash2,
  MessageSquare,
  Calendar,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  Users
} from 'lucide-react';
import { supabase } from '../api/supabase';
import './DashboardScreen.css';

interface DashboardScreenProps {
  user: {
    id: string;
    name: string;
    role: string;
    branch?: string;
  };
  permissions?: any;
}

export default function DashboardScreen({ user, permissions }: DashboardScreenProps) {
  const navigate = useNavigate();
  const isAdmin = user.role === 'Admin';

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedDept, setSelectedDept] = useState<string>('All');

  // Options State
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Dashboard Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [kpis, setKpis] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState<boolean>(false);
  const [userActivity, setUserActivity] = useState<any>({
    loggedInToday: 0,
    activeNow: 0,
    lastLoginText: 'N/A'
  });
  const [overdueCrmTasks, setOverdueCrmTasks] = useState<any[]>([]);

  // Load Branches & Departments
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [branchRes, deptRes] = await Promise.all([
          api.getBranchesList(),
          api.getDepartmentsList()
        ]);

        if (branchRes.success && branchRes.data) {
          setBranches(branchRes.data);
          
          // Set default branch
          if (isAdmin) {
            // Admin defaults to the first branch in the list
            if (branchRes.data.length > 0) {
              setSelectedBranch(branchRes.data[0].name);
            }
          } else {
            // Non-admin defaults to their assigned branch
            setSelectedBranch(user.branch || '');
          }
        }

        if (deptRes.success && deptRes.data) {
          setDepartments(deptRes.data);
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadFilterOptions();
  }, [isAdmin, user.branch]);

  // Fetch Dashboard KPIs
  useEffect(() => {
    if (!selectedBranch) return;

    let isMounted = true;
    async function fetchKpis() {
      setLoading(true);
      setErrorMsg(null);
      setMigrationNeeded(false);

      try {
        const res = await api.getDashboardKpis({
          date: selectedDate,
          branch: selectedBranch,
          department: selectedDept
        });

        if (!isMounted) return;

        if (res.success && res.data) {
          setKpis(res.data);
        } else {
          const isMissingRpc = 
            res.error?.includes('Could not find the function') && 
            res.error?.includes('get_dashboard_kpis');

          if (isMissingRpc) {
            setMigrationNeeded(true);
            loadFallbackMockData();
          } else {
            setErrorMsg(res.error || 'Failed to load dashboard statistics.');
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMsg(err.message || 'An unexpected error occurred.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchKpis();

    return () => {
      isMounted = false;
    };
  }, [selectedBranch, selectedDate, selectedDept]);

  // Fetch User Activity Stats
  useEffect(() => {
    if (!selectedBranch) return;

    let isMounted = true;
    async function fetchUserActivity() {
      try {
        let query = supabase
          .from('login_logs')
          .select('UserID, Status, LoginTime, Date')
          .eq('Branch', selectedBranch);

        if (selectedDept !== 'All') {
          query = query.eq('Department', selectedDept);
        }

        const { data } = await query;
        if (data && isMounted) {
          const todayStr = selectedDate;
          const todayLogs = data.filter(log => log.Date && log.Date.startsWith(todayStr));
          const uniqueUsers = new Set(todayLogs.map(log => log.UserID)).size;
          const activeNow = data.filter(log => log.Status === 'Active').length;

          const loginTimes = data.map(log => new Date(log.LoginTime).getTime()).filter(t => !isNaN(t));
          let lastLoginText = 'N/A';
          if (loginTimes.length > 0) {
            const latestTime = Math.max(...loginTimes);
            const diffMs = Date.now() - latestTime;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) {
              lastLoginText = 'Just now';
            } else if (diffMins < 60) {
              lastLoginText = `${diffMins} min ago`;
            } else {
              const diffHrs = Math.floor(diffMins / 60);
              if (diffHrs < 24) {
                lastLoginText = `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
              } else {
                lastLoginText = `${Math.floor(diffHrs / 24)} day${Math.floor(diffHrs / 24) > 1 ? 's' : ''} ago`;
              }
            }
          }

          setUserActivity({
            loggedInToday: uniqueUsers,
            activeNow,
            lastLoginText
          });
        }
      } catch (err) {
        console.error('Failed to load user activity stats:', err);
      }
    }

    fetchUserActivity();

    return () => {
      isMounted = false;
    };
  }, [selectedBranch, selectedDate, selectedDept]);

  // Fetch Overdue CRM Tasks
  useEffect(() => {
    if (!selectedBranch) return;
    let isMounted = true;
    async function fetchOverdueCrmTasks() {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        let query = supabase
          .from('client_order_tasks')
          .select('*, client_orders!inner(*, clients(*))')
          .eq('status', 'Pending')
          .lt('due_date', todayStr)
          .eq('client_orders.branch', selectedBranch);
        
        const { data, error } = await query;
        if (error) {
          console.error('Error fetching overdue CRM tasks:', error);
          return;
        }
        if (isMounted && data) {
          setOverdueCrmTasks(data);
        }
      } catch (err) {
        console.error('Failed to load overdue CRM tasks:', err);
      }
    }
    fetchOverdueCrmTasks();
    return () => {
      isMounted = false;
    };
  }, [selectedBranch]);

  // Fallback Mock Data for Demo/Initial Setup
  const loadFallbackMockData = () => {
    setKpis({
      orders: {
        pendingCount: 4,
        status: 'warning'
      },
      purchasing: {
        pendingCount: 3,
        status: 'warning'
      },
      unavailableItems: {
        todayCount: 8,
        status: 'alert'
      },
      waste: {
        todayCount: 5,
        status: 'neutral'
      },
      complaints: {
        openCount: 2,
        status: 'alert'
      },
      reservations: {
        todayCount: 12,
        nextTime: '20:30',
        status: 'neutral'
      },
      dailyCash: {
        statusText: 'Afternoon pending',
        status: 'warning'
      },
      checklists: {
        completionPercent: 78,
        status: 'warning'
      },
      alerts: [
        '4 orders still not sent',
        '2 complaints waiting for follow-up',
        'Afternoon cash not submitted'
      ]
    });
  };

  // Helper to map backend status string to CSS class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'success':
        return 'kpi-status-success';
      case 'warning':
        return 'kpi-status-warning';
      case 'alert':
      case 'danger':
        return 'kpi-status-danger';
      case 'neutral':
      default:
        return 'kpi-status-neutral';
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard size={28} style={{ color: 'var(--primary)' }} /> Dashboard & KPI Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Real-time operations, checklists completion, and alerts at a glance.
          </p>
        </div>
      </div>

      {migrationNeeded && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeeba',
          color: '#856404',
          padding: '16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Database Migration Required</strong>
            The RPC function <code>get_dashboard_kpis</code> is missing in your Supabase database. Please apply the migration file:
            <div style={{ margin: '8px 0' }}>
              <code style={{ background: '#f8f9fa', padding: '4px 8px', borderRadius: '4px', border: '1px solid #dee2e6' }}>
                supabase/migrations/20260524_create_dashboard_kpis_rpc.sql
              </code>
            </div>
            in your Supabase SQL Editor. Displaying simulated fallback data for presentation.
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filters Row */}
      <div className="filters-card">
        <div className="filters-row">
          <div className="filter-group">
            <label>Branch</label>
            <select
              className="filter-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={!isAdmin}
            >
              {!selectedBranch && <option value="">Select Branch...</option>}
              {isAdmin ? (
                branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))
              ) : (
                <option value={user.branch}>{user.branch}</option>
              )}
            </select>
          </div>

          <div className="filter-group">
            <label>Date</label>
            <input
              type="date"
              className="filter-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Department</label>
            <select
              className="filter-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <Loader2 size={40} className="spin" />
          <span>Loading operational analytics...</span>
        </div>
      ) : kpis ? (
        <>
          {/* Today at a Glance Grid */}
          <div>
            <h2 className="section-header">
              Today at a Glance <span>Live</span>
            </h2>

            <div className="kpi-grid">
              {/* Card 1: Pending Orders */}
              <div
                className={`kpi-card ${getStatusClass(kpis.orders.status)}`}
                onClick={() => navigate('/orders')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Pending Orders</span>
                  <div className="kpi-card-icon-wrapper">
                    <ClipboardList size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.orders.pendingCount}</span>
                  <span className="kpi-card-label">Draft / Submitted / Sent</span>
                </div>
              </div>

              {/* Card 2: Purchasing Pending */}
              <div
                className={`kpi-card ${getStatusClass(kpis.purchasing.status)}`}
                onClick={() => navigate('/purchasing')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Purchasing Pending</span>
                  <div className="kpi-card-icon-wrapper">
                    <Truck size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.purchasing.pendingCount}</span>
                  <span className="kpi-card-label">Ordered / Partially Received</span>
                </div>
              </div>

              {/* Card 3: Unavailable Items */}
              <div
                className={`kpi-card ${getStatusClass(kpis.unavailableItems.status)}`}
                onClick={() => navigate('/86')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Unavailable Items Today</span>
                  <div className="kpi-card-icon-wrapper">
                    <AlertTriangle size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.unavailableItems.todayCount}</span>
                  <span className="kpi-card-label">Active 86 items today</span>
                </div>
              </div>

              {/* Card 4: Waste Today */}
              <div
                className={`kpi-card ${getStatusClass(kpis.waste.status)}`}
                onClick={() => navigate('/waste')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Waste Today</span>
                  <div className="kpi-card-icon-wrapper">
                    <Trash2 size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.waste.todayCount}</span>
                  <span className="kpi-card-label">Submitted waste logs</span>
                </div>
              </div>

              {/* Card 5: Open Complaints */}
              <div
                className={`kpi-card ${getStatusClass(kpis.complaints.status)}`}
                onClick={() => navigate('/complaints')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Open Client Complaints</span>
                  <div className="kpi-card-icon-wrapper">
                    <MessageSquare size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.complaints.openCount}</span>
                  <span className="kpi-card-label">New & In-progress complaints</span>
                </div>
              </div>

              {/* Card 6: Reservations Today */}
              <div
                className={`kpi-card ${getStatusClass(kpis.reservations.status)}`}
                onClick={() => navigate('/reservations')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Reservations Today</span>
                  <div className="kpi-card-icon-wrapper">
                    <Calendar size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.reservations.todayCount}</span>
                  <span className="kpi-card-label">
                    {kpis.reservations.nextTime
                      ? `Next booking: ${kpis.reservations.nextTime}`
                      : 'No upcoming reservations'}
                  </span>
                </div>
              </div>

              {/* Card 7: Daily Cash Status */}
              <div
                className={`kpi-card ${getStatusClass(kpis.dailyCash.status)}`}
                onClick={() => navigate('/cash')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Daily Cash Status</span>
                  <div className="kpi-card-icon-wrapper">
                    <Coins size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value" style={{ fontSize: '20px', paddingTop: '8px', paddingBottom: '4px' }}>
                    {kpis.dailyCash.statusText}
                  </span>
                  <span className="kpi-card-label">Morning / Afternoon shifts</span>
                </div>
              </div>

              {/* Card 8: Checklist Completion */}
              <div
                className={`kpi-card ${getStatusClass(kpis.checklists.status)}`}
                onClick={() => navigate('/checklists')}
              >
                <div className="kpi-card-header">
                  <span className="kpi-card-title">Checklist Completion</span>
                  <div className="kpi-card-icon-wrapper">
                    <CheckCircle2 size={22} />
                  </div>
                </div>
                <div className="kpi-card-body">
                  <span className="kpi-card-value">{kpis.checklists.completionPercent}%</span>
                  <span className="kpi-card-label">Tasks completed today</span>
                </div>
              </div>

              {/* Card 9: User Activity Today */}
              {permissions?.can_view_signin_logs && (
                <div
                  className="kpi-card kpi-status-success"
                  onClick={() => navigate('/signin-logs')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="kpi-card-header">
                    <span className="kpi-card-title">User Activity Today</span>
                    <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(30, 92, 79, 0.1)', color: 'var(--primary)' }}>
                      <Users size={22} />
                    </div>
                  </div>
                  <div className="kpi-card-body">
                    <span className="kpi-card-value">{userActivity.loggedInToday}</span>
                    <span className="kpi-card-label" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      <span>Active Now: <strong>{userActivity.activeNow}</strong></span>
                      <span>Last Login: <strong>{userActivity.lastLoginText}</strong></span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alerts & Follow-Ups */}
          <div>
            <h2 className="section-header">Alerts & Follow-Ups</h2>
            <div className="alerts-card">
              {(kpis.alerts && kpis.alerts.length > 0) || overdueCrmTasks.length > 0 ? (
                <div className="alerts-list">
                  {/* Overdue CRM tasks */}
                  {overdueCrmTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="alert-item alert-crm-overdue"
                      onClick={() => navigate(`/client-orders/edit/${task.order_id}`)}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderLeft: '4px solid var(--danger)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertCircle size={18} className="alert-item-icon" style={{ color: 'var(--danger)' }} />
                        <span>
                          <strong>CRM Overdue:</strong> {task.task_name} for client <strong>{task.client_orders?.clients?.name || 'Unknown'}</strong> (Due: {task.due_date})
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', textDecoration: 'underline', color: 'var(--primary)' }}>
                        Go to Order
                      </span>
                    </div>
                  ))}
                  {/* Normal alerts */}
                  {kpis.alerts?.map((alert: string, index: number) => {
                    const isCashMissing = alert.toLowerCase().includes('cash not submitted');
                    return (
                      <div
                        key={index}
                        className={`alert-item ${isCashMissing ? 'alert-cash-missing' : ''}`}
                      >
                        <AlertCircle size={18} className="alert-item-icon" />
                        <span>{alert}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <CheckCircle2 size={36} color="var(--success)" />
                  <span className="empty-state-title">All Quiet Today</span>
                  <span className="empty-state-desc">No outstanding operational alerts or follow-ups detected.</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <AlertCircle size={36} />
          <span className="empty-state-title">No Data Available</span>
          <span className="empty-state-desc">
            We couldn't retrieve KPI analytics for the selected filters.
          </span>
        </div>
      )}
    </div>
  );
}
