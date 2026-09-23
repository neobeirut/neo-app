import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, CheckCircle, XCircle, 
  Layers, DollarSign, Search, Tag, RefreshCw, X, Sliders
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { CustomizationItem, ProductCustomization } from '../../api/crmService';

export default function CrmModifiersTab() {
  const [items, setItems] = useState<CustomizationItem[]>([]);
  const [productCustomizations, setProductCustomizations] = useState<ProductCustomization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState<'modifiers' | 'product_links'>('modifiers');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomizationItem | null>(null);
  const [formData, setFormData] = useState<Partial<CustomizationItem>>({
    name: '',
    customization_type: 'addon',
    default_price: 0,
    option_group_name: 'Add-ons',
    is_required: false,
    is_multi_select: false,
    is_active: true,
    display_order: 1
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemList, pList] = await Promise.all([
        crmService.getCustomizationItems(),
        crmService.getProductCustomizations()
      ]);
      setItems(itemList);
      setProductCustomizations(pList);
    } catch (err) {
      console.error('Failed to load customizations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (item: CustomizationItem) => {
    try {
      const updated = await crmService.updateCustomizationItem(item.id, {
        is_active: !item.is_active
      });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (err: any) {
      alert('Failed to toggle status: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this customization option?')) return;
    try {
      await crmService.deleteCustomizationItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await crmService.updateCustomizationItem(editingItem.id, formData);
      } else {
        await crmService.createCustomizationItem(formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      loadData();
    } catch (err: any) {
      alert('Failed to save customization: ' + err.message);
    }
  };

  // Group modifiers by option group name
  const filteredItems = items.filter(i => 
    !search.trim() || 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.option_group_name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filteredItems.reduce((acc, item) => {
    const group = item.option_group_name || 'General Modifiers';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, CustomizationItem[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-tab switcher and actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setSubTab('modifiers')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: subTab === 'modifiers' ? '#ffffff' : 'transparent',
                color: subTab === 'modifiers' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: subTab === 'modifiers' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              Modifier Items Pool ({items.length})
            </button>
            <button
              onClick={() => setSubTab('product_links')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: subTab === 'product_links' ? '#ffffff' : 'transparent',
                color: subTab === 'product_links' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: subTab === 'product_links' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              Product Customization Links ({productCustomizations.length})
            </button>
          </div>

          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search modifier or group..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', outline: 'none' }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({
              name: '',
              customization_type: 'addon',
              default_price: 0,
              option_group_name: 'Add-ons',
              is_required: false,
              is_multi_select: false,
              is_active: true,
              display_order: items.length + 1
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
          <Plus size={16} /> New Modifier Item
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
          Loading modifiers and customizations...
        </div>
      ) : subTab === 'modifiers' ? (
        /* Modifiers Pool grouped by option_group_name */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              No customization items found. Create your first modifier above!
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, groupItems]) => (
              <div key={groupName} style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{groupName}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({groupItems.length} options)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Required: <strong>{groupItems.some(i => i.is_required) ? 'Yes' : 'No'}</strong></span>
                    <span>•</span>
                    <span>Multi-Select: <strong>{groupItems.some(i => i.is_multi_select) ? 'Yes' : 'No'}</strong></span>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <th style={{ padding: '10px 18px' }}>Modifier Name</th>
                      <th style={{ padding: '10px 18px' }}>Type</th>
                      <th style={{ padding: '10px 18px' }}>Price</th>
                      <th style={{ padding: '10px 18px' }}>Status</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {item.name}
                          {item.is_default && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 5px', borderRadius: '4px' }}>
                              Default
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            backgroundColor: item.customization_type === 'addon' ? '#eff6ff' : item.customization_type === 'removal' ? '#fef2f2' : '#f0fdf4',
                            color: item.customization_type === 'addon' ? '#1d4ed8' : item.customization_type === 'removal' ? '#b91c1c' : '#15803d',
                          }}>
                            {item.customization_type}
                          </span>
                        </td>

                        <td style={{ padding: '12px 18px', fontWeight: 700, fontFamily: 'monospace' }}>
                          ${Number(item.default_price || 0).toFixed(2)}
                        </td>

                        <td style={{ padding: '12px 18px' }}>
                          <button
                            onClick={() => handleToggleActive(item)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: item.is_active ? '#15803d' : '#94a3b8'
                            }}
                          >
                            {item.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {item.is_active ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                // Normalize type: DB may have 'remove', 'add-on', etc.
                                const rawType = (item.customization_type || 'addon').toLowerCase();
                                const normalizedType =
                                  rawType === 'removal' || rawType === 'remove' ? 'removal'
                                  : rawType === 'addon' || rawType === 'add-on' || rawType === 'add_on' ? 'addon'
                                  : 'option';
                                setEditingItem(item);
                                setFormData({ ...item, customization_type: normalizedType as any });
                                setIsModalOpen(true);
                              }}
                              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                            >
                              <Edit2 size={13} color="var(--text-muted)" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', cursor: 'pointer' }}
                            >
                              <Trash2 size={13} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Product Customizations Table */
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px 18px' }}>Product ID</th>
                <th style={{ padding: '12px 18px' }}>Ingredient / Option</th>
                <th style={{ padding: '12px 18px' }}>Type</th>
                <th style={{ padding: '12px 18px' }}>Override Price</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {productCustomizations.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No product customization links yet.
                  </td>
                </tr>
              ) : (
                productCustomizations.map(pc => (
                  <tr key={pc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 18px', fontWeight: 600, fontFamily: 'monospace' }}>
                      Product #{pc.product_id}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {pc.ingredient}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569' }}>
                        {pc.customization_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 700, fontFamily: 'monospace' }}>
                      ${Number(pc.price || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ color: pc.is_active ? '#15803d' : '#94a3b8', fontSize: '12px', fontWeight: 600 }}>
                        {pc.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modifier Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingItem ? 'Edit Modifier Item' : 'New Modifier Item'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingItem(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Modifier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra Cheddar Cheese"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Option Group</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cheese, Cooking Temp, Add-ons"
                  value={formData.option_group_name || ''}
                  onChange={e => setFormData({ ...formData, option_group_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Type</label>
                  <select
                    value={formData.customization_type || 'addon'}
                    onChange={e => setFormData({ ...formData, customization_type: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  >
                    <option value="addon">Add-on</option>
                    <option value="option">Choice / Option</option>
                    <option value="removal">Removal (No Onion)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.default_price ?? 0}
                    onChange={e => setFormData({ ...formData, default_price: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_multi_select || false}
                    onChange={e => setFormData({ ...formData, is_multi_select: e.target.checked })}
                  />
                  Multi-Select Allowed
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active !== false}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active (Visible to customers &amp; cashier)
                </label>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', paddingLeft: '22px' }}>
                  ℹ️ <em>Required</em> and per-product multi-select rules are set in <strong>Products → Modifiers</strong>.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingItem(null); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
