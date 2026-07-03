import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Plus, X, Shield, Calendar, Compass, AlertCircle } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  created_at: string;
}

export default function SuperAdminScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Fields
  const [rName, setRName] = useState('');
  const [rLogo, setRLogo] = useState('');
  const [rColor, setRColor] = useState('#1e5c4f'); // default green
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uPin, setUPin] = useState('');

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await api.getRestaurantsList();
    if (res.success && res.data) {
      setRestaurants(res.data);
    } else {
      setErrorMsg(res.error || 'Failed to fetch restaurants.');
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName.trim()) { setFormErr('Restaurant name is required.'); return; }
    if (!uName.trim()) { setFormErr('Admin name is required.'); return; }
    if (!uEmail.trim()) { setFormErr('Admin email is required.'); return; }
    if (uPassword.length < 6) { setFormErr('Password must be at least 6 characters.'); return; }
    if (!uPin.trim()) { setFormErr('Admin PIN is required for Mobile App login.'); return; }

    setSaving(true);
    setFormErr('');

    const res = await api.createTenantAdmin({
      r_name: rName.trim(),
      r_logo: rLogo.trim() || 'https://app.neobeirut.com/logo-512x512.png',
      r_color: rColor,
      u_name: uName.trim(),
      u_email: uEmail.trim().toLowerCase(),
      u_password: uPassword,
      u_pin: uPin.trim(),
    });

    setSaving(false);
    if (res.success) {
      // Clear form
      setRName('');
      setRLogo('');
      setRColor('#1e5c4f');
      setUName('');
      setUEmail('');
      setUPassword('');
      setUPin('');
      setShowModal(false);
      loadRestaurants();
    } else {
      setFormErr(res.error || 'Failed to create restaurant and admin.');
    }
  };

  const filtered = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={28} color="var(--primary)" /> Super Admin Panel
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Provision and manage client restaurants and credentials globally.
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormErr(''); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: 'var(--shadow)' }}
        >
          <Plus size={16} /> Create Restaurant
        </button>
      </div>

      {/* Search & Stats */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="gray" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search restaurants by name or database UUID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 40px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>
          Total Restaurants: {restaurants.length}
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {/* Restaurants List */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'gray' }}>
          <p>Loading active restaurants...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          <Compass size={40} style={{ marginBottom: '12px', color: 'var(--primary)' }} />
          <p style={{ fontWeight: 600 }}>No restaurants found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 20px' }}>Logo</th>
                <th style={{ padding: '16px 20px' }}>Restaurant Name</th>
                <th style={{ padding: '16px 20px' }}>Database UUID</th>
                <th style={{ padding: '16px 20px' }}>Primary Theme</th>
                <th style={{ padding: '16px 20px' }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <img 
                      src={r.logo_url || 'https://app.neobeirut.com/logo-512x512.png'} 
                      alt="Logo" 
                      style={{ width: '36px', height: '36px', borderRadius: '6px', border: '1px solid var(--border)', objectFit: 'contain', background: '#f8fafc' }} 
                    />
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: '16px 20px', color: 'gray', fontFamily: 'monospace', fontSize: '13px' }}>{r.id}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: r.primary_color || '#1e5c4f' }} />
                      {r.primary_color || '#1e5c4f'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <Calendar size={14} />
                      {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="var(--primary)" /> Provision New Restaurant
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'gray' }}><X size={20} /></button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formErr && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}

              {/* SECTION A: Restaurant Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>1. Restaurant Branding</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Restaurant Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rossi Pizzeria"
                      value={rName}
                      onChange={e => setRName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Theme Primary Color</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="color"
                        value={rColor}
                        onChange={e => setRColor(e.target.value)}
                        style={{ width: '42px', height: '42px', padding: 0, border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={rColor}
                        onChange={e => setRColor(e.target.value)}
                        placeholder="#1e5c4f"
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Logo Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={rLogo}
                    onChange={e => setRLogo(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* SECTION B: Admin User Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>2. Main Administrator Account</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Admin Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Rossi"
                      value={uName}
                      onChange={e => setUName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Email Address (Username)</label>
                    <input
                      type="email"
                      placeholder="e.g. john@rossipizzeria.com"
                      value={uEmail}
                      onChange={e => setUEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Portal Password</label>
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={uPassword}
                      onChange={e => setUPassword(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Mobile App PIN Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 5566 (Numeric)"
                      value={uPin}
                      onChange={e => setUPin(e.target.value)}
                      maxLength={8}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer / Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {saving ? 'Provisioning...' : 'Provision Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
