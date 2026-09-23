import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Edit2, Trash2, CheckCircle, 
  XCircle, Navigation, DollarSign, RefreshCw, X
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { DeliveryPricingRule } from '../../api/crmService';

export default function CrmDeliveryPricingTab() {
  const [rules, setRules] = useState<DeliveryPricingRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DeliveryPricingRule | null>(null);
  const [formData, setFormData] = useState<Partial<DeliveryPricingRule>>({
    min_distance_km: 0,
    max_distance_km: 5,
    delivery_cost: 2.5,
    is_active: true,
    display_order: 1,
  });

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await crmService.getDeliveryPricingRules();
      setRules(data);
    } catch (err) {
      console.error('Failed to load delivery pricing rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggleActive = async (rule: DeliveryPricingRule) => {
    try {
      const updated = await crmService.updateDeliveryPricingRule(rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (err: any) {
      alert('Failed to update rule status: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this delivery distance rule?')) return;
    try {
      await crmService.deleteDeliveryPricingRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert('Failed to delete rule: ' + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await crmService.updateDeliveryPricingRule(editingRule.id, formData);
      } else {
        await crmService.createDeliveryPricingRule(formData);
      }
      setIsModalOpen(false);
      setEditingRule(null);
      loadRules();
    } catch (err: any) {
      alert('Failed to save delivery rule: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Distance-Based Delivery Pricing Rules</h3>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Calculates automatic delivery delivery fees at customer checkout based on GPS road distance.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingRule(null);
            setFormData({
              min_distance_km: rules.length > 0 ? Number(rules[rules.length - 1].max_distance_km) : 0,
              max_distance_km: rules.length > 0 ? Number(rules[rules.length - 1].max_distance_km) + 5 : 5,
              delivery_cost: 3.0,
              is_active: true,
              display_order: rules.length + 1,
            });
            setIsModalOpen(true);
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
          <Plus size={16} /> Add Distance Tier
        </button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
              <th style={{ padding: '12px 18px' }}>Order</th>
              <th style={{ padding: '12px 18px' }}>Distance Bracket</th>
              <th style={{ padding: '12px 18px' }}>Delivery Fee</th>
              <th style={{ padding: '12px 18px' }}>Status</th>
              <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
                  Loading delivery pricing rules...
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No delivery pricing rules configured. Add your first distance tier above!
                </td>
              </tr>
            ) : (
              rules.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', width: '60px' }}>
                    #{r.display_order || idx + 1}
                  </td>

                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
                      <Navigation size={14} color="var(--primary)" />
                      {Number(r.min_distance_km).toFixed(1)} km — {Number(r.max_distance_km).toFixed(1)} km
                    </div>
                  </td>

                  <td style={{ padding: '12px 18px', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-main)' }}>
                    ${Number(r.delivery_cost || 0).toFixed(2)}
                  </td>

                  <td style={{ padding: '12px 18px' }}>
                    <button
                      onClick={() => handleToggleActive(r)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: r.is_active ? '#15803d' : '#94a3b8'
                      }}
                    >
                      {r.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {r.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>

                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          setEditingRule(r);
                          setFormData({ ...r });
                          setIsModalOpen(true);
                        }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                      >
                        <Edit2 size={13} color="var(--text-muted)" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} color="#ef4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingRule ? 'Edit Distance Tier' : 'Add Distance Tier'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingRule(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Min Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={formData.min_distance_km ?? 0}
                    onChange={e => setFormData({ ...formData, min_distance_km: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Max Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formData.max_distance_km ?? 5}
                    onChange={e => setFormData({ ...formData, max_distance_km: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Delivery Fee ($)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={formData.delivery_cost ?? 2.5}
                  onChange={e => setFormData({ ...formData, delivery_cost: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Display Order</label>
                <input
                  type="number"
                  min="1"
                  value={formData.display_order ?? 1}
                  onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 1 })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="active_cb"
                  checked={formData.is_active !== false}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="active_cb" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  Tier is active and available for checkout
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingRule(null); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
