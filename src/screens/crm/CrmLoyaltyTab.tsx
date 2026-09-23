import React, { useState, useEffect } from 'react';
import { 
  Gift, Ticket, Plus, Edit2, Trash2, CheckCircle, 
  XCircle, Award, Calendar, DollarSign, Percent, RefreshCw, X
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { PromoCode, RewardsCatalogItem } from '../../api/crmService';

export default function CrmLoyaltyTab() {
  const [subTab, setSubTab] = useState<'promos' | 'rewards'>('promos');
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [rewards, setRewards] = useState<RewardsCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Promo Modal
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [promoForm, setPromoForm] = useState<Partial<PromoCode>>({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_subtotal: '0',
    max_discount: '50',
    is_active: true,
  });

  // Reward Modal
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardsCatalogItem | null>(null);
  const [rewardForm, setRewardForm] = useState<Partial<RewardsCatalogItem>>({
    code: '',
    title: '',
    description: '',
    tier_required: 'Bronze',
    frequency: 'once',
    expires_days: 30,
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [pList, rList] = await Promise.all([
        crmService.getPromoCodes(),
        crmService.getRewardsCatalog(),
      ]);
      setPromos(pList);
      setRewards(rList);
    } catch (err) {
      console.error('Failed to load loyalty data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePromoActive = async (p: PromoCode) => {
    try {
      const updated = await crmService.updatePromoCode(p.id, { is_active: !p.is_active });
      setPromos(prev => prev.map(item => item.id === p.id ? updated : item));
    } catch (err: any) {
      alert('Failed to update promo code: ' + err.message);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm('Delete this promo code?')) return;
    try {
      await crmService.deletePromoCode(id);
      setPromos(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Failed to delete promo: ' + err.message);
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPromo) {
        await crmService.updatePromoCode(editingPromo.id, promoForm);
      } else {
        await crmService.createPromoCode(promoForm);
      }
      setIsPromoModalOpen(false);
      setEditingPromo(null);
      loadData();
    } catch (err: any) {
      alert('Failed to save promo: ' + err.message);
    }
  };

  const handleToggleRewardActive = async (r: RewardsCatalogItem) => {
    try {
      const updated = await crmService.updateRewardItem(r.id, { is_active: !r.is_active });
      setRewards(prev => prev.map(item => item.id === r.id ? updated : item));
    } catch (err: any) {
      alert('Failed to update reward: ' + err.message);
    }
  };

  const handleDeleteReward = async (id: number) => {
    if (!window.confirm('Delete this reward?')) return;
    try {
      await crmService.deleteRewardItem(id);
      setRewards(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert('Failed to delete reward: ' + err.message);
    }
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReward) {
        await crmService.updateRewardItem(editingReward.id, rewardForm);
      } else {
        await crmService.createRewardItem(rewardForm);
      }
      setIsRewardModalOpen(false);
      setEditingReward(null);
      loadData();
    } catch (err: any) {
      alert('Failed to save reward: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Subtab bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            onClick={() => setSubTab('promos')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: subTab === 'promos' ? '#ffffff' : 'transparent',
              color: subTab === 'promos' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: subTab === 'promos' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Ticket size={15} /> Promo & Discount Codes ({promos.length})
          </button>
          <button
            onClick={() => setSubTab('rewards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: subTab === 'rewards' ? '#ffffff' : 'transparent',
              color: subTab === 'rewards' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: subTab === 'rewards' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Gift size={15} /> Loyalty Rewards Catalog ({rewards.length})
          </button>
        </div>

        {subTab === 'promos' ? (
          <button
            onClick={() => {
              setEditingPromo(null);
              setPromoForm({ code: '', description: '', discount_type: 'percentage', discount_value: 10, min_subtotal: '0', max_discount: '50', is_active: true });
              setIsPromoModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} /> New Promo Code
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingReward(null);
              setRewardForm({ code: '', title: '', description: '', tier_required: 'Bronze', frequency: 'once', expires_days: 30, is_active: true });
              setIsRewardModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} /> New Reward
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
          Loading loyalty & promos...
        </div>
      ) : subTab === 'promos' ? (
        /* Promo Codes Table */
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px 18px' }}>Promo Code</th>
                <th style={{ padding: '12px 18px' }}>Discount</th>
                <th style={{ padding: '12px 18px' }}>Min Subtotal</th>
                <th style={{ padding: '12px 18px' }}>Max Cap</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No promo codes created yet. Create a coupon code above!
                  </td>
                </tr>
              ) : (
                promos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', fontSize: '14px' }}>
                        {p.code}
                      </div>
                      {p.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.description}</div>
                      )}
                    </td>

                    <td style={{ padding: '12px 18px', fontWeight: 700 }}>
                      {p.discount_type === 'percentage' ? `${p.discount_value}% OFF` : `$${p.discount_value} OFF`}
                    </td>

                    <td style={{ padding: '12px 18px', fontFamily: 'monospace' }}>
                      ${p.min_subtotal || '0'}
                    </td>

                    <td style={{ padding: '12px 18px', fontFamily: 'monospace' }}>
                      ${p.max_discount || 'No cap'}
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      <button
                        onClick={() => handleTogglePromoActive(p)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: p.is_active ? '#15803d' : '#94a3b8'
                        }}
                      >
                        {p.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {p.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            setEditingPromo(p);
                            setPromoForm({ ...p });
                            setIsPromoModalOpen(true);
                          }}
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                        >
                          <Edit2 size={13} color="var(--text-muted)" />
                        </button>
                        <button
                          onClick={() => handleDeletePromo(p.id)}
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
      ) : (
        /* Rewards Catalog Table */
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px 18px' }}>Reward Code & Title</th>
                <th style={{ padding: '12px 18px' }}>Tier Required</th>
                <th style={{ padding: '12px 18px' }}>Frequency</th>
                <th style={{ padding: '12px 18px' }}>Expires In</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rewards.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No rewards created yet. Add reward perks for loyal customers!
                  </td>
                </tr>
              ) : (
                rewards.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.code} • {r.description}</div>
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Award size={12} /> {r.tier_required}
                      </span>
                    </td>

                    <td style={{ padding: '12px 18px', textTransform: 'capitalize' }}>
                      {r.frequency}
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      {r.expires_days} days
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      <button
                        onClick={() => handleToggleRewardActive(r)}
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
                            setEditingReward(r);
                            setRewardForm({ ...r });
                            setIsRewardModalOpen(true);
                          }}
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                        >
                          <Edit2 size={13} color="var(--text-muted)" />
                        </button>
                        <button
                          onClick={() => handleDeleteReward(r.id)}
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
      )}

      {/* Promo Code Modal */}
      {isPromoModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
              </h3>
              <button onClick={() => { setIsPromoModalOpen(false); setEditingPromo(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePromo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Promo Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WELCOME20"
                  value={promoForm.code || ''}
                  onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  placeholder="e.g. 20% discount on first online order"
                  value={promoForm.description || ''}
                  onChange={e => setPromoForm({ ...promoForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Discount Type</label>
                  <select
                    value={promoForm.discount_type || 'percentage'}
                    onChange={e => setPromoForm({ ...promoForm, discount_type: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Discount Value</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={promoForm.discount_value || 0}
                    onChange={e => setPromoForm({ ...promoForm, discount_value: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Min Subtotal ($)</label>
                  <input
                    type="text"
                    value={promoForm.min_subtotal || '0'}
                    onChange={e => setPromoForm({ ...promoForm, min_subtotal: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Max Discount Cap ($)</label>
                  <input
                    type="text"
                    value={promoForm.max_discount || ''}
                    placeholder="e.g. 50"
                    onChange={e => setPromoForm({ ...promoForm, max_discount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsPromoModalOpen(false); setEditingPromo(null); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reward Modal */}
      {isRewardModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingReward ? 'Edit Reward' : 'Create Reward Perk'}
              </h3>
              <button onClick={() => { setIsRewardModalOpen(false); setEditingReward(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReward} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Reward Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Free Hand-Cut Fries"
                  value={rewardForm.title || ''}
                  onChange={e => setRewardForm({ ...rewardForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Unique Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REWARD_FRIES"
                  value={rewardForm.code || ''}
                  onChange={e => setRewardForm({ ...rewardForm, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Tier Required</label>
                  <select
                    value={rewardForm.tier_required || 'Bronze'}
                    onChange={e => setRewardForm({ ...rewardForm, tier_required: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  >
                    <option value="Bronze">Bronze</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Expires in Days</label>
                  <input
                    type="number"
                    min="1"
                    value={rewardForm.expires_days || 30}
                    onChange={e => setRewardForm({ ...rewardForm, expires_days: parseInt(e.target.value, 10) || 30 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={2}
                  value={rewardForm.description || ''}
                  onChange={e => setRewardForm({ ...rewardForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsRewardModalOpen(false); setEditingReward(null); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Reward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
