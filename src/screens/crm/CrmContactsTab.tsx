import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, Phone, Mail, User, Tag, 
  MessageSquare, Edit2, ShieldCheck, ShieldAlert, Download, RefreshCw, X
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { WhatsAppContact } from '../../api/crmService';

interface CrmContactsTabProps {
  onStartChat: (phone: string) => void;
}

export default function CrmContactsTab({ onStartChat }: CrmContactsTabProps) {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [optInFilter, setOptInFilter] = useState<'all' | 'opted_in' | 'opted_out'>('all');
  
  // Modal states
  const [editingContact, setEditingContact] = useState<WhatsAppContact | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<WhatsAppContact>>({
    name: '',
    phone_e164: '',
    email: '',
    category: 'Regular',
    notes: '',
    whatsapp_opt_in: true,
  });

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await crmService.getContacts(search, optInFilter);
      setContacts(data);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [optInFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadContacts();
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContact) {
        await crmService.updateContact(editingContact.id, formData);
      } else {
        await crmService.createContact(formData);
      }
      setEditingContact(null);
      setIsNewModalOpen(false);
      loadContacts();
    } catch (err: any) {
      alert('Failed to save contact: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name, phone (+961...), notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
            />
          </form>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'opted_in', 'opted_out'] as const).map(f => (
              <button
                key={f}
                onClick={() => setOptInFilter(f)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: optInFilter === f ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: optInFilter === f ? '#eff6ff' : '#ffffff',
                  color: optInFilter === f ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {f === 'all' ? 'All Contacts' : f === 'opted_in' ? 'Opted-In' : 'Opted-Out'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {contacts.length} Contacts
          </span>
          <button
            onClick={() => {
              setFormData({ name: '', phone_e164: '', email: '', category: 'Regular', notes: '', whatsapp_opt_in: true });
              setIsNewModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> New Contact
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
              <th style={{ padding: '12px 16px' }}>Customer</th>
              <th style={{ padding: '12px 16px' }}>Phone Number</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px' }}>Opt-In Status</th>
              <th style={{ padding: '12px 16px' }}>Tags</th>
              <th style={{ padding: '12px 16px' }}>Notes</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
                  Loading WhatsApp contacts...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No contacts found matching your criteria.
                </td>
              </tr>
            ) : (
              contacts.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                        {(c.name || c.phone_e164 || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name || 'Anonymous Guest'}</div>
                        {c.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div>}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px 16px', fontWeight: 500, fontFamily: 'monospace' }}>
                    {c.phone_e164}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                      {c.category || 'Regular'}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {c.whatsapp_opt_in !== false ? (
                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={12} /> Opted-In
                      </span>
                    ) : (
                      <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldAlert size={12} /> Opted-Out
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                      {(c.tags && c.tags.length > 0 ? c.tags : ['Customer']).map((t, idx) => (
                        <span key={idx} style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '12px 16px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {c.notes || '—'}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => onStartChat(c.phone_e164)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#eff6ff',
                          color: 'var(--primary)',
                          border: '1px solid #bfdbfe',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <MessageSquare size={13} /> Chat
                      </button>

                      <button
                        onClick={() => {
                          setEditingContact(c);
                          setFormData({
                            name: c.name,
                            phone_e164: c.phone_e164,
                            email: c.email || '',
                            category: c.category || 'Regular',
                            notes: c.notes || '',
                            whatsapp_opt_in: c.whatsapp_opt_in !== false,
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#f8fafc',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / New Modal */}
      {(editingContact || isNewModalOpen) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingContact ? 'Edit WhatsApp Contact' : 'Create New Contact'}
              </h3>
              <button onClick={() => { setEditingContact(null); setIsNewModalOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Phone Number (E.164)</label>
                <input
                  type="text"
                  required
                  placeholder="+961..."
                  value={formData.phone_e164 || ''}
                  onChange={e => setFormData({ ...formData, phone_e164: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Email (Optional)</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                <select
                  value={formData.category || 'Regular'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                >
                  <option value="Regular">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="Loyal">Loyal Customer</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Notes & Preferences</label>
                <textarea
                  rows={3}
                  placeholder="Delivery instructions, dietary restrictions..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="optin_cb"
                  checked={formData.whatsapp_opt_in}
                  onChange={e => setFormData({ ...formData, whatsapp_opt_in: e.target.checked })}
                />
                <label htmlFor="optin_cb" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  WhatsApp Opt-in Confirmed
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setEditingContact(null); setIsNewModalOpen(false); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
