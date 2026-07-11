import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { 
  MessageSquare, Plus, BarChart3, Search, X, Loader2, 
  MapPin, User, Phone, Tag, DollarSign, Clock, AlertCircle,
  Copy, AlertTriangle
} from 'lucide-react';


const SEVERITY_OPTIONS = ['All', 'Low', 'Medium', 'High', 'Critical'];
const STATUS_FILTER_TABS = ['All', 'New', 'Under Review', 'Waiting Customer Reply', 'Escalated', 'Resolved', 'Closed'];
const DEPARTMENTS = ['All', 'Kitchen', 'Service', 'Bar', 'Delivery', 'Valet', 'Administration', 'Other'];

interface ComplaintsDashboardScreenProps {
  permissions?: any;
  user?: any;
}

export default function ComplaintsDashboardScreen({ permissions, user: propUser }: ComplaintsDashboardScreenProps) {
  const navigate = useNavigate();
  const user = propUser || (localStorage.getItem('neo_admin_user') ? JSON.parse(localStorage.getItem('neo_admin_user')!) : null);
  const canView = permissions?.can_view_complaints || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin';
  const canManage = permissions?.can_manage_complaints || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin';

  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown options
  const [branches, setBranches] = useState<string[]>(['All']);

  // KPIs
  const [kpiOpen, setKpiOpen] = useState(0);
  const [kpiCritical, setKpiCritical] = useState(0);
  const [kpiResolvedToday, setKpiResolvedToday] = useState(0);
  const [kpiAvgHours, setKpiAvgHours] = useState(0);

  useEffect(() => {
    if (!canView) {
      alert('Access Denied. You do not have permission to view Client Complaints.');
      navigate('/');
      return;
    }
    loadData();
  }, [canView]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [branchRes, complaintsRes] = await Promise.all([
        api.getBranchesList(),
        api.getComplaints()
      ]);

      if (branchRes.success && branchRes.data) {
        setBranches(['All', ...branchRes.data.map((b: any) => b.name)]);
      }

      if (complaintsRes.success && complaintsRes.data) {
        setComplaints(complaintsRes.data);
        calculateKPIs(complaintsRes.data);
      } else {
        setErrorMsg(complaintsRes.error || 'Failed to load complaints.');
      }
    } catch (err: any) {
      console.error('Error loading complaints dashboard data:', err);
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = (data: any[]) => {
    let open = 0;
    let critical = 0;
    let resolvedToday = 0;
    const resolutionTimes: number[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    data.forEach((c) => {
      const isClosedState = c.Status === 'Resolved' || c.Status === 'Closed';
      
      if (!isClosedState) {
        open++;
        if (c.Severity === 'Critical') {
          critical++;
        }
      }

      // Resolved today check
      if (isClosedState && c.ResolutionDate) {
        const resDateStr = new Date(c.ResolutionDate).toISOString().split('T')[0];
        if (resDateStr === todayStr) {
          resolvedToday++;
        }
      }

      // Resolution duration calculation
      if (isClosedState && c.ResolutionDate && c.DateCreated) {
        const diffMs = new Date(c.ResolutionDate).getTime() - new Date(c.DateCreated).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        resolutionTimes.push(diffHours);
      }
    });

    setKpiOpen(open);
    setKpiCritical(critical);
    setKpiResolvedToday(resolvedToday);

    if (resolutionTimes.length > 0) {
      const sum = resolutionTimes.reduce((a, b) => a + b, 0);
      setKpiAvgHours(Math.round((sum / resolutionTimes.length) * 10) / 10);
    } else {
      setKpiAvgHours(0);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'New': return { bg: '#ffeebf', text: '#b7791f', border: '#fbd38d' };
      case 'Under Review': return { bg: '#ebf8ff', text: '#2b6cb0', border: '#bee3f8' };
      case 'Waiting Customer Reply': return { bg: '#faf5ff', text: '#6b46c1', border: '#e9d8fd' };
      case 'Escalated': return { bg: '#fff5f5', text: '#c53030', border: '#fed7d7' };
      case 'Resolved': return { bg: '#f0fff4', text: '#2f855a', border: '#c6f6d5' };
      case 'Closed': return { bg: '#f7fafc', text: '#4a5568', border: '#e2e8f0' };
      default: return { bg: '#edf2f7', text: '#2d3748', border: '#e2e8f0' };
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'Critical': return { bg: '#fff5f5', text: '#e53e3e', border: '#fed7d7', badge: '🚨 Critical' };
      case 'High': return { bg: '#fffaf0', text: '#dd6b20', border: '#fbd38d', badge: '⚠️ High' };
      case 'Medium': return { bg: '#f0fff4', text: '#38a169', border: '#c6f6d5', badge: 'Medium' };
      default: return { bg: '#f7fafc', text: '#4a5568', border: '#e2e8f0', badge: 'Low' };
    }
  };

  // Client side filtering for maximum responsiveness
  const filteredComplaints = complaints.filter((item) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchId = (item.ComplaintID || '').toLowerCase().includes(query);
      const matchName = (item.ClientName || '').toLowerCase().includes(query);
      const matchPhone = (item.ClientPhone || '').toLowerCase().includes(query);
      const matchDesc = (item.Description || '').toLowerCase().includes(query);
      const matchStaff = (item.StaffInvolved || '').toLowerCase().includes(query);
      const matchOrder = (item.OrderNumber || '').toLowerCase().includes(query);

      if (!matchId && !matchName && !matchPhone && !matchDesc && !matchStaff && !matchOrder) {
        return false;
      }
    }

    if (statusTab !== 'All' && item.Status !== statusTab) {
      return false;
    }

    if (branchFilter !== 'All' && item.Branch !== branchFilter) {
      return false;
    }

    if (severityFilter !== 'All' && item.Severity !== severityFilter) {
      return false;
    }

    if (deptFilter !== 'All' && item.Department !== deptFilter) {
      return false;
    }

    if (startDate) {
      const itemTime = new Date(item.DateCreated).getTime();
      const startDateTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
      if (itemTime < startDateTime) return false;
    }
    if (endDate) {
      const itemTime = new Date(item.DateCreated).getTime();
      const endDateTime = new Date(`${endDate}T23:59:59.999Z`).getTime();
      if (itemTime > endDateTime) return false;
    }

    return true;
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    setBranchFilter('All');
    setSeverityFilter('All');
    setDeptFilter('All');
    setStartDate('');
    setEndDate('');
    setStatusTab('All');
  };

  const handleCopySql = () => {
    const sqlText = `CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ComplaintID" TEXT NOT NULL UNIQUE,
  "Branch" TEXT NOT NULL,
  "LoggedBy" TEXT,
  "ClientName" TEXT NOT NULL,
  "ClientPhone" TEXT,
  "ClientEmail" TEXT,
  "OrderType" TEXT DEFAULT 'Dine-In',
  "TableNumber" TEXT,
  "OrderNumber" TEXT,
  "Category" TEXT NOT NULL,
  "SubCategory" TEXT,
  "Severity" TEXT DEFAULT 'Low',
  "Description" TEXT NOT NULL,
  "ItemInvolved" TEXT,
  "StaffInvolved" TEXT,
  "Department" TEXT,
  "ImmediateAction" TEXT,
  "CompensationAmount" NUMERIC DEFAULT 0,
  "Status" TEXT DEFAULT 'New',
  "AttachmentURLs" TEXT[] DEFAULT '{}',
  "RootCause" TEXT,
  "InternalNotes" TEXT,
  "TrainingRequired" BOOLEAN DEFAULT false,
  "SupplierIssue" BOOLEAN DEFAULT false,
  "RecurringProblem" BOOLEAN DEFAULT false,
  "Resolution" TEXT,
  "CustomerSatisfied" TEXT,
  "ResolvedBy" TEXT,
  "ResolutionDate" TIMESTAMPTZ,
  "DateCreated" TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.complaints
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all authenticated users" ON public.complaints
  FOR ALL USING (true);`;

    navigator.clipboard.writeText(sqlText);
    alert('SQL Migration Query copied to clipboard!');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
        <Loader2 className="spin" size={32} color="var(--primary)" />
        <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Loading client complaints database...</span>
      </div>
    );
  }

  const errorLower = (errorMsg || '').toLowerCase();
  const isTableMissing = errorLower.includes('relation "public.complaints" does not exist') ||
                         errorLower.includes('public.complaints') ||
                         errorLower.includes("could not find the table 'public.complaints'") ||
                         errorLower.includes('clientcomplaints');

  if (isTableMissing) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px' }} className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#be123c', marginBottom: '16px' }}>
          <AlertTriangle size={32} />
          <h2>Database Migration Required</h2>
        </div>
        <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '20px' }}>
          It looks like the <code>complaints</code> table hasn't been created in your Supabase database yet. Because DDL operations require admin access, you must execute the SQL migration query manually:
        </p>

        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>20260705_create_complaints.sql</span>
            <button 
              onClick={handleCopySql}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Copy size={14} /> Copy SQL
            </button>
          </div>
          <pre style={{ overflowX: 'auto', fontSize: '12px', color: '#1e293b', background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', maxHeight: '300px' }}>
{`CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ComplaintID" TEXT NOT NULL UNIQUE,
  "Branch" TEXT NOT NULL,
  "LoggedBy" TEXT,
  "ClientName" TEXT NOT NULL,
  "ClientPhone" TEXT,
  "ClientEmail" TEXT,
  "OrderType" TEXT DEFAULT 'Dine-In',
  "TableNumber" TEXT,
  "OrderNumber" TEXT,
  "Category" TEXT NOT NULL,
  "SubCategory" TEXT,
  "Severity" TEXT DEFAULT 'Low',
  "Description" TEXT NOT NULL,
  "ItemInvolved" TEXT,
  "StaffInvolved" TEXT,
  "Department" TEXT,
  "ImmediateAction" TEXT,
  "CompensationAmount" NUMERIC DEFAULT 0,
  "Status" TEXT DEFAULT 'New',
  "AttachmentURLs" TEXT[] DEFAULT '{}',
  "RootCause" TEXT,
  "InternalNotes" TEXT,
  "TrainingRequired" BOOLEAN DEFAULT false,
  "SupplierIssue" BOOLEAN DEFAULT false,
  "RecurringProblem" BOOLEAN DEFAULT false,
  "Resolution" TEXT,
  "CustomerSatisfied" TEXT,
  "ResolvedBy" TEXT,
  "ResolutionDate" TIMESTAMPTZ,
  "DateCreated" TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.complaints
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all authenticated users" ON public.complaints
  FOR ALL USING (true);`}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={loadData}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              borderRadius: 'var(--radius)', 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', textAlign: 'center' }} className="card">
        <AlertCircle size={48} color="#e53e3e" style={{ marginBottom: '16px' }} />
        <h2 style={{ color: '#e53e3e', marginBottom: '8px' }}>Failed to Load Complaints</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{errorMsg}</p>
        <button 
          onClick={loadData}
          style={{ padding: '10px 20px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={28} style={{ color: 'var(--primary)' }} /> Client Complaints
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitor, investigate, and resolve client feedback and restaurant service issues.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => navigate('/complaints/analytics')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', 
              backgroundColor: '#fff', border: '1px solid #c8e6c9', borderRadius: 'var(--radius)', 
              fontWeight: 600, cursor: 'pointer', color: '#2e7d32', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f8e9'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
          >
            <BarChart3 size={18} />
            Analytics Dashboard
          </button>
          {canManage && (
            <button 
              onClick={() => navigate('/complaints/new')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', 
                backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: 'var(--radius)', 
                fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(46,125,50,0.2)'
              }}
            >
              <Plus size={18} />
              Log Complaint
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ ...kpiCardStyle, borderLeft: '5px solid var(--primary)' }}>
          <span style={kpiLabelStyle}>Active Open Complaints</span>
          <span style={kpiValueStyle}>{kpiOpen}</span>
        </div>
        <div style={{ ...kpiCardStyle, borderLeft: '5px solid #e53e3e', backgroundColor: '#fff5f5' }}>
          <span style={{ ...kpiLabelStyle, color: '#e53e3e' }}>Active Critical Issues</span>
          <span style={{ ...kpiValueStyle, color: '#e53e3e' }}>{kpiCritical}</span>
        </div>
        <div style={{ ...kpiCardStyle, borderLeft: '5px solid #38a169', backgroundColor: '#f0fff4' }}>
          <span style={{ ...kpiLabelStyle, color: '#38a169' }}>Resolved Today</span>
          <span style={{ ...kpiValueStyle, color: '#38a169' }}>{kpiResolvedToday}</span>
        </div>
        <div style={{ ...kpiCardStyle, borderLeft: '5px solid #718096' }}>
          <span style={kpiLabelStyle}>Avg Resolution Time</span>
          <span style={kpiValueStyle}>{kpiAvgHours} hrs</span>
        </div>
      </div>

      {/* Filters Card Panel */}
      <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow)' }}>
        
        {/* Search Bar Row */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', backgroundColor: '#fafafa' }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search client complaints by customer name, phone, order #, staff involved, database ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '15px', outline: 'none' }}
          />
          {searchQuery && (
            <X size={18} color="var(--text-muted)" onClick={() => setSearchQuery('')} style={{ cursor: 'pointer' }} />
          )}
        </div>

        {/* Dropdown Filters Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label style={filterLabelStyle}>Branch</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={filterSelectStyle}>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Severity</label>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={filterSelectStyle}>
              {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Department Responsible</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={filterSelectStyle}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={filterSelectStyle} />
          </div>
          <div>
            <label style={filterLabelStyle}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={filterSelectStyle} />
          </div>
        </div>

        {/* Clear Filters Helper Link */}
        {(searchQuery || branchFilter !== 'All' || severityFilter !== 'All' || deptFilter !== 'All' || startDate || endDate) && (
          <button 
            onClick={handleClearFilters}
            style={{ 
              alignSelf: 'flex-end', border: 'none', background: 'transparent', 
              color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', display: 'flex', 
              alignItems: 'center', gap: '4px', fontSize: '13px' 
            }}
          >
            <X size={14} /> Clear all filters
          </button>
        )}
      </div>

      {/* Status Filtering Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', gap: '8px', paddingBottom: '1px' }}>
        {STATUS_FILTER_TABS.map((tab) => {
          const isActive = statusTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              style={{
                padding: '12px 18px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '3px solid #2e7d32' : '3px solid transparent',
                color: isActive ? '#2e7d32' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Complaints Cards Grid */}
      {filteredComplaints.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: '12px', backgroundColor: 'var(--surface)' }}>
          <AlertCircle size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>No matching complaints found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>Try broadening your search keywords or resetting active filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredComplaints.map((item) => {
            const statusColors = getStatusStyle(item.Status);
            const severityStyle = getSeverityStyle(item.Severity);
            const dateObj = new Date(item.DateCreated);
            const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div 
                key={item.id} 
                onClick={() => navigate(`/complaints/edit/${item.id}`)}
                style={complaintCardStyle}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
              >
                {/* ID & Status Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#2e7d32' }}>{item.ComplaintID}</span>
                  <span style={{ 
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', 
                    padding: '4px 8px', borderRadius: '12px', border: `1px solid ${statusColors.border}`,
                    backgroundColor: statusColors.bg, color: statusColors.text
                  }}>
                    {item.Status}
                  </span>
                </div>

                {/* Metadata Row */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                  <span style={cardTagStyle}><MapPin size={12} /> {item.Branch}</span>
                  <span style={{ 
                    fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                    backgroundColor: severityStyle.bg, color: severityStyle.text, border: `1px solid ${severityStyle.border}` 
                  }}>
                    {severityStyle.badge}
                  </span>
                  {item.Department && (
                    <span style={cardTagStyle}><Clock size={12} /> {item.Department}</span>
                  )}
                </div>

                {/* Client info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} color="var(--text-muted)" /> {item.ClientName}
                  </span>
                  {item.ClientPhone && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} /> {item.ClientPhone}
                    </span>
                  )}
                </div>

                {/* Category info */}
                <div style={{ fontSize: '13px', color: '#2e7d32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                  <Tag size={13} /> {item.Category} {item.SubCategory ? `› ${item.SubCategory}` : ''}
                </div>

                {/* Snippet Description */}
                <div style={{ 
                  fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.4', 
                  backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px', 
                  marginTop: '10px', display: '-webkit-box', WebkitLineClamp: 2, 
                  WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '40px' 
                }}>
                  {item.Description}
                </div>

                {/* Immediate Action (if any) */}
                {item.ImmediateAction && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '10px' }}>
                    ⚡ Action: {item.ImmediateAction}
                  </div>
                )}

                {/* Footer details */}
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  borderTop: '1px solid #f5f5f5', paddingTop: '10px', marginTop: '12px' 
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formattedDate}</span>
                  {item.CompensationAmount > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#e53e3e', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <DollarSign size={13} />{item.CompensationAmount} comp
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// Styling Constants
const kpiCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  boxShadow: 'var(--shadow)',
  borderLeft: '5px solid #ccc'
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 900,
  color: 'var(--text-main)'
};

const filterLabelStyle = { 
  display: 'block', 
  fontSize: '12px', 
  fontWeight: 700, 
  color: 'var(--text-muted)', 
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.3px'
};

const filterSelectStyle = { 
  width: '100%', 
  padding: '8px 10px', 
  borderRadius: '6px', 
  border: '1px solid var(--border)', 
  fontSize: '14px', 
  fontFamily: 'inherit',
  backgroundColor: '#fff',
  outline: 'none'
};

const complaintCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--shadow)',
  cursor: 'pointer',
  transition: 'transform 0.2s, box-shadow 0.2s'
};

const cardTagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  color: 'var(--text-muted)',
  fontWeight: 500
};
