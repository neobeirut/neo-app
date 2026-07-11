import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { 
  Search, Plus, Edit, Trash2, Truck, Coins, Filter, X, 
  ArrowUpRight, ArrowDownRight, FileText, CheckCircle, RefreshCw, 
  BarChart2, Info, AlertCircle, FileSpreadsheet
} from 'lucide-react';


export default function PaymentDetailsScreen({ user }: { user: any }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filters State
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Add/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formBranch, setFormBranch] = useState('');
  const [formShift, setFormShift] = useState('AM');
  const [formSupplier, setFormSupplier] = useState('');
  const [formAmountUsd, setFormAmountUsd] = useState('');
  const [formAmountLbp, setFormAmountLbp] = useState('');
  const [formType, setFormType] = useState('Supplier');
  const [formStatus, setFormStatus] = useState('Paid');
  const [formHasInvoice, setFormHasInvoice] = useState(false);
  const [saving, setSaving] = useState(false);

  // Conversion rate for consolidated analytics
  const CONVERSION_RATE = 90000;

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadPayments();
    setCurrentPage(1);
  }, [startDate, endDate, branchFilter, typeFilter, statusFilter, supplierFilter]);

  const loadBranches = async () => {
    const res = await api.getBranchesList();
    const dbNames = (res.success && res.data) ? res.data.map((b: any) => b.name) : [];
    const combined = Array.from(new Set(['Badaro', 'Naccache', ...dbNames])).filter(Boolean);
    setBranches(combined);
  };

  const loadPayments = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await api.getAllDailyPayments({
      startDate,
      endDate,
      branch: branchFilter
    });
    if (res.success && res.data) {
      setPayments(res.data);
    } else {
      setErrorMsg(res.error || 'Failed to fetch payments.');
    }
    setLoading(false);
  };

  // -------------------------------------------------------------
  // MUTATION HANDLERS
  // -------------------------------------------------------------
  const handleOpenModal = (payment?: any) => {
    setErrorMsg(null);
    if (payment) {
      setIsEditMode(true);
      setEditingId(payment.id);
      setFormDate(payment.date);
      setFormBranch(payment.branch);
      setFormShift(payment.shift || 'AM');
      setFormSupplier(payment.supplier || '');
      setFormAmountUsd(String(payment.amount_usd || 0));
      setFormAmountLbp(String(payment.amount_lbp || 0));
      setFormType(payment.type || 'Supplier');
      setFormStatus(payment.status || 'Paid');
      setFormHasInvoice(!!payment.has_invoice);
    } else {
      setIsEditMode(false);
      setEditingId(null);
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormBranch(user.branch !== 'All' ? user.branch : (branches[0] || ''));
      setFormShift('AM');
      setFormSupplier('');
      setFormAmountUsd('');
      setFormAmountLbp('');
      setFormType('Supplier');
      setFormStatus('Paid');
      setFormHasInvoice(false);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBranch) {
      alert('Branch is required');
      return;
    }
    if (!formSupplier.trim()) {
      alert('Recipient/Supplier name is required');
      return;
    }
    const usdVal = parseFloat(formAmountUsd) || 0;
    const lbpVal = parseFloat(formAmountLbp) || 0;
    if (usdVal <= 0 && lbpVal <= 0) {
      alert('Please enter an amount in USD, LBP, or both.');
      return;
    }

    setSaving(true);
    const payload = {
      date: formDate,
      branch: formBranch,
      shift: formShift,
      supplier: formSupplier.trim(),
      amount_usd: usdVal,
      amount_lbp: lbpVal,
      type: formType,
      status: formStatus,
      has_invoice: formHasInvoice,
      user_name: user.name || 'Admin'
    };

    let res;
    if (isEditMode && editingId) {
      res = await api.updateDailyPayment(editingId, payload);
    } else {
      res = await api.createDailyPayment(payload);
    }
    setSaving(false);

    if (res.success) {
      setShowModal(false);
      loadPayments();
    } else {
      alert(res.error || 'Failed to save payment entry.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete payment record "${name}"?`)) {
      return;
    }
    setLoading(true);
    const res = await api.deleteDailyPayment(id);
    if (res.success) {
      loadPayments();
    } else {
      alert(res.error || 'Failed to delete payment.');
      setLoading(false);
    }
  };

  const handleToggleStatus = async (payment: any) => {
    const nextStatus = payment.status === 'Paid' ? 'Unpaid' : 'Paid';
    const res = await api.updateDailyPayment(payment.id, { status: nextStatus });
    if (res.success) {
      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: nextStatus } : p));
    } else {
      alert(res.error || 'Failed to update status.');
    }
  };

  const handleExportExcel = () => {
    try {
      if (filteredPayments.length === 0) {
        alert('No data to export.');
        return;
      }

      const exportData = filteredPayments.map((p) => {
        let displayType = p.type;
        if (p.type === 'CashIn') displayType = 'Cash In';
        else if (p.type === 'CashOut') displayType = 'Cash Out';
        else if (p.type === 'Supplier') displayType = 'Supplier Expense';
        else if (p.type === 'Delivery') displayType = 'Delivery Expense';

        return {
          'Date': p.date || '',
          'Branch': p.branch || '',
          'Shift': p.shift || '',
          'Type': displayType || '',
          'Recipient / Supplier': p.supplier || 'N/A',
          'Amount (USD)': p.amount_usd || 0,
          'Amount (LBP)': p.amount_lbp || 0,
          'Invoice Received': p.has_invoice ? 'Yes' : 'No',
          'Status': p.status || '',
          'Recorded By': p.user_name || 'System'
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const wscols = [
        { wch: 12 }, // Date
        { wch: 15 }, // Branch
        { wch: 8 },  // Shift
        { wch: 18 }, // Type
        { wch: 25 }, // Recipient / Supplier
        { wch: 15 }, // Amount (USD)
        { wch: 15 }, // Amount (LBP)
        { wch: 18 }, // Invoice Received
        { wch: 10 }, // Status
        { wch: 18 }  // Recorded By
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payment Details');

      const filename = `payment_details_${startDate}_to_${endDate}.xlsx`;
      
      // Generate ArrayBuffer representation of the workbook
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      // Create a Blob from the ArrayBuffer using the correct MIME type for Excel files
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Create a Blob URL and trigger the browser download natively
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting excel:', err);
      alert('Failed to export data to Excel: ' + (err.message || err));
    }
  };

  // -------------------------------------------------------------
  // FILTERED DATA & ANALYTICS COMPUTATIONS
  // -------------------------------------------------------------
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Type Filter
      if (typeFilter !== 'All' && p.type !== typeFilter) return false;
      // Status Filter
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      // Supplier / Recipient Filter
      if (supplierFilter !== 'All' && (p.supplier || '') !== supplierFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const supMatch = (p.supplier || '').toLowerCase().includes(query);
        const userMatch = (p.user_name || '').toLowerCase().includes(query);
        if (!supMatch && !userMatch) return false;
      }
      return true;
    });
  }, [payments, typeFilter, statusFilter, supplierFilter, searchQuery]);

  // Unique supplier/recipient names derived from loaded payments
  const uniqueSuppliers = useMemo(() => {
    const names = new Set<string>();
    payments.forEach(p => {
      if (p.supplier) names.add(p.supplier);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const stats = useMemo(() => {
    let cashInUsd = 0; let cashInLbp = 0;
    let cashOutUsd = 0; let cashOutLbp = 0;
    let supplierPaidUsd = 0; let supplierPaidLbp = 0;
    let supplierUnpaidUsd = 0; let supplierUnpaidLbp = 0;
    let deliveryPaidUsd = 0; let deliveryPaidLbp = 0;
    let deliveryUnpaidUsd = 0; let deliveryUnpaidLbp = 0;

    filteredPayments.forEach(p => {
      const u = Number(p.amount_usd) || 0;
      const l = Number(p.amount_lbp) || 0;

      if (p.type === 'CashIn') {
        cashInUsd += u;
        cashInLbp += l;
      } else if (p.type === 'CashOut') {
        cashOutUsd += u;
        cashOutLbp += l;
      } else if (p.type === 'Supplier') {
        if (p.status === 'Paid') {
          supplierPaidUsd += u;
          supplierPaidLbp += l;
        } else {
          supplierUnpaidUsd += u;
          supplierUnpaidLbp += l;
        }
      } else if (p.type === 'Delivery') {
        if (p.status === 'Paid') {
          deliveryPaidUsd += u;
          deliveryPaidLbp += l;
        } else {
          deliveryUnpaidUsd += u;
          deliveryUnpaidLbp += l;
        }
      }
    });

    const cashInConsolidated = cashInUsd + (cashInLbp / CONVERSION_RATE);
    const cashOutConsolidated = cashOutUsd + (cashOutLbp / CONVERSION_RATE);
    const supplierPaidConsolidated = supplierPaidUsd + (supplierPaidLbp / CONVERSION_RATE);
    const supplierUnpaidConsolidated = supplierUnpaidUsd + (supplierUnpaidLbp / CONVERSION_RATE);
    const deliveryPaidConsolidated = deliveryPaidUsd + (deliveryPaidLbp / CONVERSION_RATE);
    const deliveryUnpaidConsolidated = deliveryUnpaidUsd + (deliveryUnpaidLbp / CONVERSION_RATE);

    const netCashFlow = cashInConsolidated - cashOutConsolidated - supplierPaidConsolidated - deliveryPaidConsolidated;

    return {
      cashInUsd, cashInLbp, cashInConsolidated,
      cashOutUsd, cashOutLbp, cashOutConsolidated,
      supplierPaidUsd, supplierPaidLbp, supplierPaidConsolidated,
      supplierUnpaidUsd, supplierUnpaidLbp, supplierUnpaidConsolidated,
      deliveryPaidUsd, deliveryPaidLbp, deliveryPaidConsolidated,
      deliveryUnpaidUsd, deliveryUnpaidLbp, deliveryUnpaidConsolidated,
      netCashFlow
    };
  }, [filteredPayments]);

  // Paginated data
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  const formatLbp = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num)) + ' LBP';
  };

  const formatUsd = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100%' }}>
      {/* Upper header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Coins size={28} color="var(--primary)" /> Payment Details
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Inspect shifted cash flows, supplier logs, and delivery payouts across date ranges.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={handleExportExcel} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 18px', 
              borderRadius: '10px', 
              fontWeight: 700, 
              fontSize: '14px', 
              cursor: 'pointer', 
              background: '#f0fdf4', 
              color: '#16a34a', 
              border: '1px solid #86efac',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#d1fae5';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f0fdf4';
            }}
          >
            <FileSpreadsheet size={18} /> Export Excel
          </button>
          <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', background: 'var(--primary)', color: '#fff', border: 'none' }}>
            <Plus size={18} /> Record Payment Entry
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)', fontSize: '15px' }}>
          <Filter size={18} color="var(--primary)" /> Search & Filter Payments
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
          {/* Start Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Start Date</label>
            <input type="date" className="admin-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', outline: 'none' }} />
          </div>
          {/* End Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>End Date</label>
            <input type="date" className="admin-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', outline: 'none' }} />
          </div>
          {/* Branch Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Branch</label>
            <select className="admin-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', outline: 'none', background: '#fff', cursor: 'pointer' }}>
              <option value="All">All Branches</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {/* Type Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Payment Type</label>
            <select className="admin-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', outline: 'none' }}>
              <option value="All">All Types</option>
              <option value="Supplier">Supplier Expense</option>
              <option value="Delivery">Delivery Expense</option>
              <option value="CashOut">Cash Out</option>
              <option value="CashIn">Cash In</option>
            </select>
          </div>
          {/* Status Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</label>
            <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', outline: 'none' }}>
              <option value="All">All Statuses</option>
              <option value="Paid">Paid Only</option>
              <option value="Unpaid">Unpaid Only</option>
            </select>
          </div>
          {/* Recipient / Supplier Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Recipient / Supplier</label>
            <select className="admin-select" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', outline: 'none' }}>
              <option value="All">All Recipients</option>
              {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {/* Search Input */}
        <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
          <input type="text" placeholder="Search by recipient, supplier, or creator user..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 16px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }} />
          {searchQuery && (
            <X size={16} color="var(--text-muted)" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', cursor: 'pointer' }} />
          )}
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {/* Card 1: Cash In */}
        <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cash In</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981' }}><ArrowUpRight size={18} /></div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>{formatUsd(stats.cashInConsolidated)}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column' }}>
              <span>Raw USD: {formatUsd(stats.cashInUsd)}</span>
              <span>Raw LBP: {formatLbp(stats.cashInLbp)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Cash Out */}
        <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #f97316' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cash Out</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#fff7ed', color: '#f97316' }}><ArrowDownRight size={18} /></div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>{formatUsd(stats.cashOutConsolidated)}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column' }}>
              <span>Raw USD: {formatUsd(stats.cashOutUsd)}</span>
              <span>Raw LBP: {formatLbp(stats.cashOutLbp)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Supplier Expense */}
        <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supplier Expenses</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#f5f3ff', color: '#8b5cf6' }}><FileText size={18} /></div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
              {formatUsd(stats.supplierPaidConsolidated + stats.supplierUnpaidConsolidated)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: '#10b981', fontWeight: 500 }}>Paid: {formatUsd(stats.supplierPaidConsolidated)}</span>
              <span style={{ color: '#ef4444', fontWeight: 500 }}>Unpaid: {formatUsd(stats.supplierUnpaidConsolidated)}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Delivery Expense */}
        <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Expenses</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6' }}><Truck size={18} /></div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
              {formatUsd(stats.deliveryPaidConsolidated + stats.deliveryUnpaidConsolidated)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: '#10b981', fontWeight: 500 }}>Paid: {formatUsd(stats.deliveryPaidConsolidated)}</span>
              <span style={{ color: '#ef4444', fontWeight: 500 }}>Unpaid: {formatUsd(stats.deliveryUnpaidConsolidated)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {/* Chart 1: Expense breakdown bar chart */}
        <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)', fontSize: '15px' }}>
            <BarChart2 size={18} color="var(--primary)" /> Cash Flow Volumes by Payment Type (USD)
          </div>
          <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '10px 0 24px 0', position: 'relative', borderBottom: '1px solid var(--border)' }}>
            {/* Find max for scaling */}
            {(() => {
              const items = [
                { label: 'Cash In', value: stats.cashInConsolidated, color: '#10b981' },
                { label: 'Cash Out', value: stats.cashOutConsolidated, color: '#f97316' },
                { label: 'Supplier', value: stats.supplierPaidConsolidated + stats.supplierUnpaidConsolidated, color: '#8b5cf6' },
                { label: 'Delivery', value: stats.deliveryPaidConsolidated + stats.deliveryUnpaidConsolidated, color: '#3b82f6' }
              ];
              const maxVal = Math.max(...items.map(i => i.value), 100);

              return items.map(item => {
                const percent = (item.value / maxVal) * 100;
                return (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>{Math.round(item.value)}</div>
                    <div style={{
                      width: '32px',
                      height: `${Math.max(percent, 4)}%`,
                      backgroundColor: item.color,
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease'
                    }} />
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', position: 'absolute', bottom: '4px' }}>{item.label}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Chart 2: Paid vs Unpaid Donut chart */}
        <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)', fontSize: '15px' }}>
            <BarChart2 size={18} color="var(--primary)" /> Invoice Status Breakdown (Expenses Only)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', height: '220px' }}>
            {/* SVG Ring Donut */}
            {(() => {
              const paid = stats.supplierPaidConsolidated + stats.deliveryPaidConsolidated;
              const unpaid = stats.supplierUnpaidConsolidated + stats.deliveryUnpaidConsolidated;
              const total = paid + unpaid;
              
              const paidPercent = total > 0 ? (paid / total) * 100 : 100;
              const unpaidPercent = total > 0 ? (unpaid / total) * 100 : 0;
              
              // Circumference is 2 * pi * r = 2 * 3.14 * 25 = 157
              const r = 25;
              const c = 157;
              const paidStroke = (paidPercent / 100) * c;
              const unpaidStroke = (unpaidPercent / 100) * c;
              
              return (
                <>
                  <div style={{ width: '120px', height: '120px' }}>
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      <circle cx="50" cy="50" r={r} fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
                      {total > 0 ? (
                        <>
                          {/* Paid segment */}
                          <circle cx="50" cy="50" r={r} fill="transparent" stroke="#10b981" strokeWidth="12"
                                  strokeDasharray={`${paidStroke} ${c}`}
                                  strokeDashoffset="0"
                                  transform="rotate(-90 50 50)" />
                          {/* Unpaid segment */}
                          {unpaid > 0 && (
                            <circle cx="50" cy="50" r={r} fill="transparent" stroke="#ef4444" strokeWidth="12"
                                    strokeDasharray={`${unpaidStroke} ${c}`}
                                    strokeDashoffset={-paidStroke}
                                    transform="rotate(-90 50 50)" />
                          )}
                        </>
                      ) : (
                        <circle cx="50" cy="50" r={r} fill="transparent" stroke="#94a3b8" strokeWidth="12"
                                strokeDasharray={`157 157`}
                                strokeDashoffset="0" />
                      )}
                      <text x="50" y="55" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-main)">
                        {total > 0 ? `${Math.round(paidPercent)}%` : 'No Data'}
                      </text>
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981' }} />
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Paid Invoices</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatUsd(paid)} ({Math.round(paidPercent)}%)</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444' }} />
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Unpaid Expenses</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatUsd(unpaid)} ({Math.round(unpaidPercent)}%)</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card-glass" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
            Payment Transaction Logs ({filteredPayments.length} records found)
          </div>
          <button onClick={loadPayments} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px' }}>
            <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading payments from Supabase...</div>
          </div>
        ) : errorMsg ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#b91c1c' }}>
            <AlertCircle size={20} /> {errorMsg}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            <Info size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>No payment entries found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try relaxing your filters or record a new entry to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 8px' }}>Date</th>
                  <th style={{ padding: '12px 8px' }}>Branch</th>
                  <th style={{ padding: '12px 8px' }}>Shift</th>
                  <th style={{ padding: '12px 8px' }}>Type</th>
                  <th style={{ padding: '12px 8px' }}>Recipient / Supplier</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount (USD)</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount (LBP)</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Invoice</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 8px' }}>Recorded By</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((p) => {
                  let typeColor = '#f3f4f6'; let typeTextColor = '#374151';
                  if (p.type === 'CashIn') { typeColor = '#d1fae5'; typeTextColor = '#065f46'; }
                  else if (p.type === 'CashOut') { typeColor = '#ffedd5'; typeTextColor = '#9a3412'; }
                  else if (p.type === 'Supplier') { typeColor = '#f3e8ff'; typeTextColor = '#6b21a8'; }
                  else if (p.type === 'Delivery') { typeColor = '#dbeafe'; typeTextColor = '#1e40af'; }

                  return (
                    <tr key={p.id} className="hover-row" style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)' }}>
                      <td style={{ padding: '14px 8px', whiteSpace: 'nowrap' }}>{p.date}</td>
                      <td style={{ padding: '14px 8px', fontWeight: 600 }}>{p.branch}</td>
                      <td style={{ padding: '14px 8px' }}>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>{p.shift}</span>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <span style={{ backgroundColor: typeColor, color: typeTextColor, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {p.type === 'CashIn' ? 'Cash In' : p.type === 'CashOut' ? 'Cash Out' : p.type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 8px', fontWeight: 600 }}>{p.supplier || 'N/A'}</td>
                      <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: p.amount_usd > 0 ? 700 : 400 }}>
                        {p.amount_usd > 0 ? formatUsd(p.amount_usd) : '-'}
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: p.amount_lbp > 0 ? 700 : 400 }}>
                        {p.amount_lbp > 0 ? formatLbp(p.amount_lbp) : '-'}
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                        {p.has_invoice ? (
                          <span style={{ color: 'var(--primary)', background: '#eef6f4', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Yes</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                        <span 
                          onClick={() => handleToggleStatus(p)}
                          style={{
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: p.status === 'Paid' ? '#d1fae5' : '#fee2e2',
                            color: p.status === 'Paid' ? '#065f46' : '#991b1b',
                            userSelect: 'none'
                          }}
                          title="Click to toggle status"
                        >
                          {p.status === 'Paid' ? <CheckCircle size={12} /> : null}
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>{p.user_name || 'System'}</td>
                      <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => handleOpenModal(p)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Edit">
                            <Edit size={16} />
                          </button>
                          {(user.role === 'Admin' || user.role === 'Manager') && (
                            <button onClick={() => handleDelete(p.id, p.supplier)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredPayments.length} total entries)
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', fontSize: '13px', fontWeight: 600, color: currentPage === 1 ? '#cbd5e1' : 'var(--text-main)', cursor: currentPage === 1 ? 'default' : 'pointer' }}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentPage(i + 1)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: currentPage === i + 1 ? 'var(--primary)' : '#fff',
                    color: currentPage === i + 1 ? '#fff' : 'var(--text-main)'
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', fontSize: '13px', fontWeight: 600, color: currentPage === totalPages ? '#cbd5e1' : 'var(--text-main)', cursor: currentPage === totalPages ? 'default' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record/Edit Entry Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                {isEditMode ? 'Edit Payment Entry' : 'Record New Payment Entry'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Date</label>
                  <input type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }} />
                </div>
                {/* Shift */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Shift</label>
                  <select value={formShift} onChange={e => setFormShift(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', background: '#fff' }}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Branch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Branch</label>
                  <select value={formBranch} onChange={e => setFormBranch(e.target.value)} disabled={user.branch !== 'All'} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', background: user.branch !== 'All' ? '#eef2f5' : '#fff' }}>
                    {user.branch !== 'All' ? (
                      <option value={user.branch}>{user.branch}</option>
                    ) : (
                      branches.map(b => <option key={b} value={b}>{b}</option>)
                    )}
                  </select>
                </div>
                {/* Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Payment Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', background: '#fff' }}>
                    <option value="Supplier">Supplier Expense</option>
                    <option value="Delivery">Delivery Expense</option>
                    <option value="CashOut">Cash Out</option>
                    <option value="CashIn">Cash In</option>
                  </select>
                </div>
              </div>

              {/* Recipient / Supplier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Recipient / Supplier Name</label>
                <input type="text" required placeholder="e.g. Supplier name, Employee name, or Shift reason" value={formSupplier} onChange={e => setFormSupplier(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Amount USD */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Amount (USD)</label>
                  <input type="number" step="any" placeholder="0" value={formAmountUsd} onChange={e => setFormAmountUsd(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }} />
                </div>
                {/* Amount LBP */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Amount (LBP)</label>
                  <input type="number" step="any" placeholder="0" value={formAmountLbp} onChange={e => setFormAmountLbp(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                {/* Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', background: '#fff' }}>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>
                {/* Has Invoice Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', paddingTop: '16px' }}>
                  <input type="checkbox" id="formHasInvoice" checked={formHasInvoice} onChange={e => setFormHasInvoice(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="formHasInvoice" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Invoice Received</label>
                </div>
              </div>

              {/* Form buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: 'var(--primary)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
