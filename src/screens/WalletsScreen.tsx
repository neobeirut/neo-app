import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Plus, Edit, Trash2, X } from 'lucide-react';

export default function WalletsScreen({ user }: { user: any }) {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await api.getWallets();
    if (res.success && res.data) {
      setWallets(res.data);
    } else {
      setErrorMsg(res.error || 'Failed to fetch e-wallets.');
    }
    setLoading(false);
  };

  const handleOpenModal = (wallet?: any) => {
    setErrorMsg(null);
    if (wallet) {
      setEditingId(wallet.id);
      setName(wallet.name || '');
      setActive(wallet.active !== false);
    } else {
      setEditingId(null);
      setName('');
      setActive(true);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('E-Wallet name is required');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      active: active,
      restaurant_id: user?.restaurant_id
    } as any;

    if (editingId) {
      payload.id = editingId;
    }

    const res = await api.saveWallet(payload);
    setSaving(false);

    if (res.success) {
      setShowModal(false);
      loadWallets();
    } else {
      alert(res.error || 'Failed to save e-wallet');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete e-wallet "${name}"?`)) {
      return;
    }

    const res = await api.deleteWallet(id);
    if (res.success) {
      loadWallets();
    } else {
      alert(res.error || 'Failed to delete e-wallet');
    }
  };

  const filteredWallets = wallets.filter(w => {
    const matchesSearch = (w.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Active' && w.active !== false) || 
      (statusFilter === 'Inactive' && w.active === false);
    return matchesSearch && matchesStatus;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>E-Wallets</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Configure e-wallet payment providers like Whish, OMT.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={18} /> Add E-Wallet
        </button>
      </div>

      {/* Filters Card */}
      <div className="filters-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 12px', flex: 1, minWidth: '240px' }}>
          <Search size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
          <input
            type="text"
            placeholder="Search e-wallets..."
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
      ) : filteredWallets.length === 0 ? (
        <div style={{ background: 'white', padding: '48px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', color: '#64748b' }}>
          No e-wallets match your criteria. Add a new e-wallet to get started!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredWallets.map((wallet) => (
            <div key={wallet.id} className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{wallet.name}</h3>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    backgroundColor: wallet.active !== false ? '#e6f4ea' : '#fce8e6',
                    color: wallet.active !== false ? '#137333' : '#c5221f'
                  }}>
                    {wallet.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                <button 
                  onClick={() => handleOpenModal(wallet)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#0f172a', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Edit size={14} /> Edit
                </button>
                <button 
                  onClick={() => handleDelete(wallet.id, wallet.name)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{editingId ? 'Edit' : 'Add'} E-Wallet</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>E-Wallet Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Whish"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '15px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="active" style={{ fontSize: '14px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Active Status</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  style={{ padding: '10px 16px', border: '1px solid var(--border)', background: 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 16px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
