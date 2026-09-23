import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Plus, Edit2, Trash2, CheckCircle, 
  XCircle, Clock, Tag, Sliders, RefreshCw, X, Image as ImageIcon,
  Grid, List
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { Product, Category } from '../../api/crmService';
import ProductModifierModal from './ProductModifierModal';

interface CrmProductsTabProps {
  onNavigateToModifiers?: () => void;
  onProductsCountChange?: (count: number) => void;
}

export default function CrmProductsTab({ onNavigateToModifiers, onProductsCountChange }: CrmProductsTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null); // product whose modifiers are being edited
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    category_id: null,
    image_url: '',
    prep_time: '20',
    status: 'Available',
    is_featured: false,
    is_special: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [pList, cList] = await Promise.all([
        crmService.getProducts(selectedCatId || undefined, search),
        crmService.getCategories()
      ]);
      setProducts(pList);
      setCategories(cList);
      if (!selectedCatId && !search) {
        onProductsCountChange?.(pList.length);
      }
    } catch (err) {
      console.error('Failed to load menu products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCatId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === 'Available' ? 'Unavailable Today' : 'Available';
    try {
      const updated = await crmService.updateProduct(product.id, { status: newStatus });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    } catch (err: any) {
      alert('Failed to toggle status: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this menu product?')) return;
    try {
      await crmService.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Failed to delete product: ' + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await crmService.updateProduct(editingProduct.id, formData);
      } else {
        await crmService.createProduct(formData);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      loadData();
    } catch (err: any) {
      alert('Failed to save product: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '320px' }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search product name or ingredient..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
            />
          </form>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
            <button
              onClick={() => setSelectedCatId(null)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: selectedCatId === null ? '1px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: selectedCatId === null ? '#eff6ff' : '#ffffff',
                color: selectedCatId === null ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              All Categories ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: selectedCatId === cat.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: selectedCatId === cat.id ? '#eff6ff' : '#ffffff',
                  color: selectedCatId === cat.id ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{ padding: '5px 8px', border: 'none', background: viewMode === 'grid' ? '#fff' : 'transparent', borderRadius: '4px', cursor: 'pointer' }}
              title="Grid View"
            >
              <Grid size={15} color={viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)'} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{ padding: '5px 8px', border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent', borderRadius: '4px', cursor: 'pointer' }}
              title="Table View"
            >
              <List size={15} color={viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)'} />
            </button>
          </div>

          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData({
                name: '',
                description: '',
                price: 15,
                category_id: categories[0]?.id || null,
                image_url: '',
                prep_time: '20',
                status: 'Available',
                is_featured: false,
                is_special: false
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
            <Plus size={16} /> New Menu Product
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
          Loading menu products...
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          No menu products found. Create your first product above!
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {products.map(p => (
            <div
              key={p.id}
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
            >
              <div>
                {/* Product Image */}
                <div style={{ height: '160px', width: '100%', backgroundColor: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e: any) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ImageIcon size={36} opacity={0.4} />
                    </div>
                  )}

                  {/* Badges on image */}
                  <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '5px' }}>
                    {p.category && (
                      <span style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                        {p.category.name}
                      </span>
                    )}
                  </div>

                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                    <button
                      onClick={() => handleToggleStatus(p)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: p.status === 'Available' ? 'rgba(22, 163, 74, 0.9)' : 'rgba(217, 119, 6, 0.9)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      {p.status === 'Available' ? '● Available' : '○ Unavailable'}
                    </button>
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.3' }}>
                      {p.name}
                    </h4>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', marginLeft: '8px' }}>
                      ${Number(p.price || 0).toFixed(2)}
                    </span>
                  </div>

                  {p.description && (
                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.description}
                    </p>
                  )}

                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {p.prep_time && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} /> {p.prep_time}m prep
                      </span>
                    )}
                    <span
                      onClick={() => setModifierProduct(p)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                      title="Click to manage modifiers for this product"
                    >
                      <Sliders size={12} />
                      {p.customization_count ? `${p.customization_count} modifiers` : 'Add modifiers'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', backgroundColor: '#fcfcfd', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  onClick={() => setModifierProduct(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--primary)', background: '#fff', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                  title="Manage which modifiers are available for this product"
                >
                  <Sliders size={12} /> Modifiers
                </button>
                <button
                  onClick={() => {
                    const rawStatus = (p.status || '').toLowerCase();
                    const normStatus =
                      rawStatus.includes('unavailable') ? 'Unavailable Today'
                      : rawStatus.includes('sold') ? 'Sold Out'
                      : 'Available';
                    setEditingProduct(p);
                    setFormData({ ...p, status: normStatus });
                    setIsModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff', cursor: 'pointer' }}
                >
                  <Trash2 size={12} color="#ef4444" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px 18px' }}>Product</th>
                <th style={{ padding: '12px 18px' }}>Category</th>
                <th style={{ padding: '12px 18px' }}>Price</th>
                <th style={{ padding: '12px 18px' }}>Prep Time</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px' }}>Customizations</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#f1f5f9', overflow: 'hidden', flexShrink: 0 }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <ImageIcon size={18} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      {p.category?.name || 'General'}
                    </span>
                  </td>

                  <td style={{ padding: '12px 18px', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px' }}>
                    ${Number(p.price || 0).toFixed(2)}
                  </td>

                  <td style={{ padding: '12px 18px', color: 'var(--text-muted)' }}>
                    {p.prep_time ? `${p.prep_time}m` : '—'}
                  </td>

                  <td style={{ padding: '12px 18px' }}>
                    <button
                      onClick={() => handleToggleStatus(p)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: p.status === 'Available' ? '#15803d' : '#d97706'
                      }}
                    >
                      {p.status === 'Available' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {p.status}
                    </button>
                  </td>

                  <td style={{ padding: '12px 18px' }}>
                    <button
                      onClick={() => setModifierProduct(p)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer',
                        background: 'none', border: 'none', padding: 0,
                      }}
                    >
                      <Sliders size={13} />
                      {p.customization_count ? `${p.customization_count} linked` : 'Add modifiers'}
                    </button>
                  </td>

                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setModifierProduct(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--primary)', background: '#fff', cursor: 'pointer', fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}
                        title="Manage modifiers"
                      >
                        <Sliders size={12} />
                      </button>
                      <button
                        onClick={() => {
                          const rawStatus = (p.status || '').toLowerCase();
                          const normStatus =
                            rawStatus.includes('unavailable') ? 'Unavailable Today'
                            : rawStatus.includes('sold') ? 'Sold Out'
                            : 'Available';
                          setEditingProduct(p);
                          setFormData({ ...p, status: normStatus });
                          setIsModalOpen(true);
                        }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                      >
                        <Edit2 size={13} color="var(--text-muted)" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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
      )}

      {/* Product Modifier Modal */}
      {modifierProduct && (
        <ProductModifierModal
          product={modifierProduct}
          onClose={() => setModifierProduct(null)}
          onSaved={loadData}
        />
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingProduct ? 'Edit Menu Product' : 'New Menu Product'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crispy Chicken Loaded Wrap • 800 G"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                  <select
                    value={formData.category_id || ''}
                    onChange={e => setFormData({ ...formData, category_id: Number(e.target.value) || null })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  >
                    <option value="">-- Choose category --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price ?? 0}
                    onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Image URL</label>
                <input
                  type="text"
                  placeholder="https://app.neobeirut.com/ovrload/images/..."
                  value={formData.image_url || ''}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Prep Time (minutes)</label>
                  <input
                    type="text"
                    placeholder="e.g. 20"
                    value={formData.prep_time || ''}
                    onChange={e => setFormData({ ...formData, prep_time: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Availability Status</label>
                  <select
                    value={formData.status || 'Available'}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  >
                    <option value="Available">Available</option>
                    <option value="Unavailable Today">Unavailable Today</option>
                    <option value="Sold Out">Sold Out</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed description, portion weight, ingredients..."
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingProduct(null); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
