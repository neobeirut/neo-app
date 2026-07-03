import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Plus, Edit, Trash2, User, Phone, Calendar, Clock, X, Check, AlertTriangle, Copy, ExternalLink } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_OPTIONS = ['Same day', 'Next day', '48h', '72h', '1 Week'];

export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeToDeliver, setTimeToDeliver] = useState('Next day');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await api.getSuppliers();
    if (res.success && res.data) {
      setSuppliers(res.data);
    } else {
      setErrorMsg(res.error || 'Failed to fetch suppliers.');
    }
    setLoading(false);
  };

  const handleOpenModal = (supplier?: any) => {
    setErrorMsg(null);
    if (supplier) {
      setEditingId(supplier.id);
      setName(supplier.name || '');
      setContactName(supplier.contact_name || '');
      setPhone(supplier.phone || '');
      setSelectedDays(supplier.delivery_days ? supplier.delivery_days.split(', ').filter(Boolean) : []);
      setTimeToDeliver(supplier.time_to_deliver || 'Next day');
      setIsActive(supplier.is_active !== false);
    } else {
      setEditingId(null);
      setName('');
      setContactName('');
      setPhone('');
      setSelectedDays([]);
      setTimeToDeliver('Next day');
      setIsActive(true);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Supplier name is required');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      delivery_days: selectedDays.join(', ') || null,
      time_to_deliver: timeToDeliver,
      is_active: isActive
    } as any;

    if (editingId) {
      payload.id = editingId;
    }

    const res = await api.saveSupplier(payload);
    setSaving(false);

    if (res.success) {
      setShowModal(false);
      loadSuppliers();
    } else {
      alert(res.error || 'Failed to save supplier');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete supplier "${name}"?`)) {
      return;
    }

    const res = await api.deleteSupplier(id);
    if (res.success) {
      loadSuppliers();
    } else {
      alert(res.error || 'Failed to delete supplier');
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const selectAllDays = () => {
    if (selectedDays.length === DAYS.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...DAYS]);
    }
  };

  const handleCopySql = () => {
    const sqlText = `CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  delivery_days TEXT,
  time_to_deliver TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.suppliers
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all authenticated users" ON public.suppliers
  FOR ALL USING (true);`;

    navigator.clipboard.writeText(sqlText);
    alert('SQL Migration Query copied to clipboard!');
  };

  // Filter and sort suppliers list
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Active' && s.is_active !== false) || 
      (statusFilter === 'Inactive' && s.is_active === false);

    return matchesSearch && matchesStatus;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

  const isTableMissing = errorMsg?.includes('relation "public.suppliers" does not exist') || errorMsg?.toLowerCase().includes("public.suppliers");

  if (isTableMissing) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px' }} className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#be123c', marginBottom: '16px' }}>
          <AlertTriangle size={32} />
          <h2>Database Migration Required</h2>
        </div>
        <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '20px' }}>
          It looks like the <code>suppliers</code> table hasn't been created in your Supabase database yet. Because DDL operations require admin access, you must execute the SQL migration query manually:
        </p>

        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>20260606_create_suppliers.sql</span>
            <button 
              onClick={handleCopySql}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Copy size={14} /> Copy SQL
            </button>
          </div>
          <pre style={{ overflowX: 'auto', fontSize: '12px', color: '#1e293b', background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
{`CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  delivery_days TEXT,
  time_to_deliver TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.suppliers
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all authenticated users" ON public.suppliers
  FOR ALL USING (true);`}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a 
            href="https://supabase.com/dashboard" 
            target="_blank" 
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#1e5c4f', color: '#ffffff', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}
          >
            Go to Supabase Dashboard <ExternalLink size={14} />
          </a>
          <button 
            onClick={loadSuppliers}
            style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#1e293b', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Retry Fetching Suppliers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>Suppliers</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Manage supplier profiles, contact numbers, delivery days, and logistics lead times.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      {/* Filters Card */}
      <div className="filters-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 12px', flex: 1, minWidth: '240px' }}>
          <Search size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
          <input
            type="text"
            placeholder="Search by supplier name, contact person or phone..."
            style={{ border: 'none !important', background: 'transparent !important', height: '36px !important', padding: '0 !important', flex: 1, boxShadow: 'none !important' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
          <select 
            value={statusFilter} 
            onChange={(e: any) => setStatusFilter(e.target.value)}
            style={{ height: '36px !important', padding: '4px 12px !important' }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : errorMsg ? (
        <div style={{ color: 'var(--danger)', padding: '20px', background: '#fff0f0', borderRadius: '8px', border: '1px solid #ffcccc', textAlign: 'center' }}>
          {errorMsg}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div style={{ background: 'white', padding: '48px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', color: '#64748b' }}>
          No suppliers match your criteria. Add a new supplier to get started!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{supplier.name}</h3>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    backgroundColor: supplier.is_active !== false ? '#e6f4ea' : '#fce8e6',
                    color: supplier.is_active !== false ? '#137333' : '#c5221f'
                  }}>
                    {supplier.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569', fontSize: '13.5px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={15} style={{ color: '#94a3b8' }} />
                    <span>Contact: <strong>{supplier.contact_name || 'N/A'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={15} style={{ color: '#94a3b8' }} />
                    <span>Phone: {supplier.phone ? <a href={`tel:${supplier.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{supplier.phone}</a> : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={15} style={{ color: '#94a3b8' }} />
                    <span style={{ fontSize: '12px' }}>
                      Delivery Days: <span style={{ color: '#0f172a', fontWeight: 600 }}>{supplier.delivery_days || 'None set'}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={15} style={{ color: '#94a3b8' }} />
                    <span>Lead Time: <span style={{ color: '#1e5c4f', fontWeight: 700 }}>{supplier.time_to_deliver || 'Next day'}</span></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
                <button 
                  onClick={() => handleOpenModal(supplier)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Edit size={14} /> Edit
                </button>
                <button 
                  onClick={() => handleDelete(supplier.id, supplier.name)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #fecdd3', color: '#be123c', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="web-modal-overlay">
          <div className="web-modal" style={{ maxWidth: '560px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{editingId ? 'Edit' : 'Add'} Supplier</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Azar Trading"
                  style={{ width: '100%' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    style={{ width: '100%' }}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +961 70 123456"
                    style={{ width: '100%' }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Delivery Days</label>
                  <button 
                    type="button" 
                    onClick={selectAllDays} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    {selectedDays.length === DAYS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {DAYS.map((day) => {
                    const isChecked = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: isChecked ? 'var(--primary)' : '#ffffff',
                          color: isChecked ? '#ffffff' : '#334155',
                          border: '1px solid',
                          borderColor: isChecked ? 'var(--primary)' : '#cbd5e1',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transform: 'none !important' // prevent scaling shift
                        }}
                      >
                        {isChecked && <Check size={12} />} {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Time to Deliver</label>
                  <select
                    value={timeToDeliver}
                    onChange={(e) => setTimeToDeliver(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {TIME_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isActive" style={{ fontSize: '14px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Active Supplier</label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
