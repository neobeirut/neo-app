import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, Plus, Edit2, Upload, Image as ImageIcon, Trash2, 
  Layers, CheckCircle, AlertCircle, Sparkles, Store, Smartphone,
  Info, ArrowRight, RefreshCw, DollarSign, Package
} from 'lucide-react';
import type { Product, Category } from '../../api/crmService';
import { crmService } from '../../api/crmService';
import { api } from '../../api/client';
import { 
  conceptProductService, 
  CORE_CONCEPTS, 
  SALES_CHANNELS, 
  type ProductConceptConfig, 
  type ConceptChannelOverride,
  type SalesChannel,
  resolveEffectiveSellingPrice,
  resolveEffectiveProductImage
} from '../../api/conceptProductService';

interface ConceptProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  onSaved: (product: Product) => void;
  onOpenNewCategory?: () => void;
  onOpenEditCategory?: (cat: Category) => void;
}

export default function ConceptProductModal({
  isOpen,
  onClose,
  product,
  categories,
  onSaved,
  onOpenNewCategory,
  onOpenEditCategory
}: ConceptProductModalProps) {
  const [activeTab, setActiveTab] = useState<'master' | '00000000-0000-0000-0000-000000000001' | '00000000-0000-0000-0000-000000000002' | '00000000-0000-0000-0000-000000000003'>('master');
  
  // Master Form Data
  const [masterData, setMasterData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    category_id: null,
    concept_id: '00000000-0000-0000-0000-000000000001',
    image_url: '',
    prep_time: '20',
    status: 'Available',
    is_featured: false,
    is_special: false,
    show_in_mobile: true,
  });

  // Concept Configurations
  const [conceptConfigs, setConceptConfigs] = useState<Record<string, ProductConceptConfig>>({});
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'master' | 'concept' | 'channel'; conceptId?: string; channel?: string } | null>(null);

  // Initialize data on modal open or product change
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setSuccessMsg('');
    setActiveTab('master');

    if (product) {
      setMasterData({
        ...product,
        price: Number(product.price || 0)
      });
      loadConfigurations(product.id, product);
    } else {
      const initialMaster: Partial<Product> = {
        name: '',
        description: '',
        price: 0,
        category_id: categories[0]?.id || null,
        concept_id: '00000000-0000-0000-0000-000000000001',
        image_url: '',
        prep_time: '20',
        status: 'Available',
        is_featured: false,
        is_special: false,
        show_in_mobile: true,
      };
      setMasterData(initialMaster);

      // Initialize default configs for new product
      const initialConfigs: Record<string, ProductConceptConfig> = {};
      CORE_CONCEPTS.forEach((c, idx) => {
        initialConfigs[c.id] = {
          product_id: 0,
          concept_id: c.id,
          display_name: '',
          description: '',
          selling_price: 0,
          main_image_url: '',
          gallery_image_urls: [],
          menu_category_id: categories[0]?.id || null,
          is_visible: idx === 0,
          is_available: true,
          display_order: 0,
          is_active: idx === 0,
          channel_overrides: {}
        };
      });
      setConceptConfigs(initialConfigs);
    }
  }, [isOpen, product]);

  const loadConfigurations = async (prodId: number, currentProd: Product) => {
    setLoadingConfigs(true);
    try {
      const configs = await conceptProductService.getProductConfigurations(prodId, {
        id: currentProd.id,
        name: currentProd.name,
        price: Number(currentProd.price || 0),
        description: currentProd.description || '',
        image_url: currentProd.image_url || '',
        category_id: currentProd.category_id,
        concept_id: currentProd.concept_id,
        status: currentProd.status,
        is_active: currentProd.is_active,
        show_in_mobile: currentProd.show_in_mobile
      });
      setConceptConfigs(configs);
    } catch (err) {
      console.error('Failed to load concept configurations:', err);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const handleUpdateConceptConfig = (conceptId: string, updates: Partial<ProductConceptConfig>) => {
    setConceptConfigs(prev => {
      const existing = prev[conceptId] || {
        product_id: product?.id || 0,
        concept_id: conceptId,
        display_name: masterData.name || '',
        description: masterData.description || '',
        selling_price: Number(masterData.price || 0),
        main_image_url: masterData.image_url || '',
        gallery_image_urls: [],
        menu_category_id: masterData.category_id,
        is_visible: true,
        is_available: true,
        display_order: 0,
        is_active: true,
        channel_overrides: {}
      };

      return {
        ...prev,
        [conceptId]: {
          ...existing,
          ...updates
        }
      };
    });
  };

  const handleUpdateChannelOverride = (
    conceptId: string,
    channel: string,
    updates: Partial<ConceptChannelOverride>
  ) => {
    setConceptConfigs(prev => {
      const existingConfig = prev[conceptId];
      if (!existingConfig) return prev;

      const currentOverrides = existingConfig.channel_overrides || {};
      const currentOverride = currentOverrides[channel] || {
        channel,
        selling_price: null,
        image_url: '',
        description: '',
        is_available: true
      };

      const updatedOverride = {
        ...currentOverride,
        ...updates
      };

      return {
        ...prev,
        [conceptId]: {
          ...existingConfig,
          channel_overrides: {
            ...currentOverrides,
            [channel]: updatedOverride
          }
        }
      };
    });
  };

  const triggerUpload = (target: { type: 'master' | 'concept' | 'channel'; conceptId?: string; channel?: string }) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    setUploadingImage(true);
    try {
      const url = await conceptProductService.uploadProductImage(file);
      if (uploadTarget.type === 'master') {
        setMasterData(prev => ({ ...prev, image_url: url }));
      } else if (uploadTarget.type === 'concept' && uploadTarget.conceptId) {
        handleUpdateConceptConfig(uploadTarget.conceptId, { main_image_url: url });
      } else if (uploadTarget.type === 'channel' && uploadTarget.conceptId && uploadTarget.channel) {
        handleUpdateChannelOverride(uploadTarget.conceptId, uploadTarget.channel, { image_url: url });
      }
    } catch (err: any) {
      alert('Failed to upload image: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadTarget(null);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterData.name?.trim()) {
      setErrorMsg('Product name is required.');
      setActiveTab('master');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Save canonical master product
      const isAvailable = (masterData.status || 'Available') === 'Available';
      const masterPrice = Number(masterData.price || 0);
      const enabledConceptIds = Object.keys(conceptConfigs).filter(cid => conceptConfigs[cid]?.is_active);
      const firstActiveConceptId = enabledConceptIds.length > 0 ? enabledConceptIds[0] : null;

      const masterPayload = {
        ...masterData,
        concept_id: firstActiveConceptId || masterData.concept_id || null,
        name: masterData.name.trim(),
        price: masterPrice,
        unit_price_usd: masterPrice,
        is_active: masterData.is_active !== undefined ? masterData.is_active : isAvailable,
        show_in_mobile: masterData.show_in_mobile !== undefined ? masterData.show_in_mobile : true
      };

      let savedProduct: Product;
      if (product) {
        savedProduct = await crmService.updateProduct(product.id, masterPayload);
      } else {
        savedProduct = await crmService.createProduct(masterPayload);
      }

      // If disabled in a concept, remove product from today's menu_86 for that concept
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res86 = await api.get86Logs(todayStr);
        if (res86?.success && Array.isArray(res86.data)) {
          for (const rec of res86.data) {
            const rCid = rec.concept_id || '00000000-0000-0000-0000-000000000001';
            const isConceptDisabled = conceptConfigs[rCid] && !conceptConfigs[rCid].is_active;
            if (isConceptDisabled && Array.isArray(rec.items)) {
              const pClean = masterPayload.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const filteredItems = rec.items.filter((it: any) => (it.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') !== pClean);
              if (filteredItems.length !== rec.items.length) {
                await api.save86(rec.branch || 'Badaro', filteredItems, todayStr, rCid);
              }
            }
          }
        }
      } catch (clean86Err) {
        console.warn('Could not auto-clean disabled concept from 86 log:', clean86Err);
      }

      // 2. Ensure each concept has proper product_id attached
      const updatedConfigs: Record<string, ProductConceptConfig> = {};
      Object.keys(conceptConfigs).forEach(cid => {
        const c = conceptConfigs[cid];
        updatedConfigs[cid] = {
          ...c,
          product_id: savedProduct.id,
          display_name: c.display_name?.trim() || masterPayload.name,
          selling_price: c.selling_price !== undefined && c.selling_price !== null ? Number(c.selling_price) : Number(masterPayload.price)
        };
      });

      // 3. Save concept configurations and channel overrides
      await conceptProductService.saveProductConfigurations(savedProduct.id, updatedConfigs);

      setSuccessMsg('Product and multi-concept configurations saved successfully!');
      setTimeout(() => {
        onSaved(savedProduct);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Error saving multi-concept product:', err);
      setErrorMsg('Failed to save product: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '920px',
        height: '88vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
                backgroundColor: '#e2e8f0',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                FLOW Unified Catalog
              </span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {product ? `Edit: ${product.name}` : 'Create Unified Master Product'}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              One master recipe shared across NÉO, OVRLOAD & WICKD with brand-specific pricing, imagery & channel overrides.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Concept Navigation Bar */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 24px 0',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('master')}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'master' ? '2px solid #0f172a' : '2px solid transparent',
              color: activeTab === 'master' ? '#0f172a' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={15} />
            <span>Master Identity</span>
          </button>

          {CORE_CONCEPTS.map(c => {
            const isTabActive = activeTab === c.id;
            const cfg = conceptConfigs[c.id];
            const isEnabled = cfg?.is_active;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveTab(c.id as any)}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: isTabActive ? `2px solid ${c.color}` : '2px solid transparent',
                  color: isTabActive ? c.color : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isEnabled ? c.color : '#cbd5e1'
                }} />
                <span>{c.code}</span>
                {isEnabled && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: isTabActive ? `${c.color}15` : '#f1f5f9',
                    color: c.color
                  }}>
                    ${cfg.selling_price.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #fecaca'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #bbf7d0'
            }}>
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 1: MASTER IDENTITY & SHARED RECIPE / BOM */}
          {/* ============================================================= */}
          {activeTab === 'master' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <Info size={18} color="#0284c7" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                  <strong>Master Product Architecture:</strong> This canonical record defines the internal operational identity, kitchen recipe, bill of materials (BOM), and base costing. Each concept will independently define its customer-facing display name, selling price, and photos.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Internal Master Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Chocolate Cookie • 120g Portion"
                    value={masterData.name || ''}
                    onChange={e => setMasterData({ ...masterData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Master Default Category
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={masterData.category_id || ''}
                      onChange={e => setMasterData({ ...masterData, category_id: Number(e.target.value) || null })}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        backgroundColor: '#fff'
                      }}
                    >
                      <option value="">-- Choose Category --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {onOpenNewCategory && (
                      <button
                        type="button"
                        onClick={onOpenNewCategory}
                        style={{
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        + New
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Master Pricing and Image */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Default Base Price ($ USD)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b', fontSize: '13px' }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={masterData.price ?? 0}
                      onChange={e => setMasterData({ ...masterData, price: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 24px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Used as fallback if concept has no custom price.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Default Master Product Image
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {masterData.image_url ? (
                      <img 
                        src={masterData.image_url} 
                        alt="Preview" 
                        style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                      />
                    ) : (
                      <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                        <ImageIcon size={18} color="#94a3b8" />
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="https://..."
                      value={masterData.image_url || ''}
                      onChange={e => setMasterData({ ...masterData, image_url: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px'
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => triggerUpload({ type: 'master' })}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Upload size={14} />
                      {uploadingImage ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Master Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  Default Master Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Master culinary description, portion specs, allergens..."
                  value={masterData.description || ''}
                  onChange={e => setMasterData({ ...masterData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Prep & Kitchen Routing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Prep Time (min)
                  </label>
                  <input
                    type="text"
                    value={masterData.prep_time || '20'}
                    onChange={e => setMasterData({ ...masterData, prep_time: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Kitchen Station
                  </label>
                  <select
                    value={masterData.preparation_section || ''}
                    onChange={e => setMasterData({ ...masterData, preparation_section: e.target.value || null })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="">Auto-detect from Category</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bar">Bar</option>
                    <option value="Pastry">Pastry</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Store">Store / Retail (No-Prep)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={masterData.status || 'Available'}
                    onChange={e => setMasterData({ ...masterData, status: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="Available">Available</option>
                    <option value="Unavailable Today">Unavailable Today</option>
                    <option value="Sold Out">Sold Out</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2, 3, 4: CONCEPT-SPECIFIC CONFIGURATION & CHANNEL OVERRIDES */}
          {/* ============================================================= */}
          {activeTab !== 'master' && (
            (() => {
              const concept = CORE_CONCEPTS.find(c => c.id === activeTab);
              if (!concept) return null;
              const config = conceptConfigs[concept.id] || {
                product_id: product?.id || 0,
                concept_id: concept.id,
                display_name: masterData.name || '',
                description: masterData.description || '',
                selling_price: Number(masterData.price || 0),
                main_image_url: masterData.image_url || '',
                gallery_image_urls: [],
                menu_category_id: masterData.category_id,
                is_visible: true,
                is_available: true,
                display_order: 0,
                is_active: true,
                channel_overrides: {}
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Concept Activation Header */}
                  <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: config.is_active ? `${concept.color}10` : '#f1f5f9',
                    border: `1px solid ${config.is_active ? `${concept.color}40` : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: config.is_active ? concept.color : '#94a3b8',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '13px'
                      }}>
                        {concept.code}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                          {concept.name}
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                          Configure display name, base selling price, photos, and channel overrides for {concept.code}.
                        </p>
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: config.is_active ? concept.color : '#64748b' }}>
                        {config.is_active ? 'Enabled for this Concept' : 'Disabled for this Concept'}
                      </span>
                      <input
                        type="checkbox"
                        checked={config.is_active}
                        onChange={e => handleUpdateConceptConfig(concept.id, { is_active: e.target.checked })}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: concept.color
                        }}
                      />
                    </label>
                  </div>

                  {config.is_active && (
                    <>
                      {/* Concept Identity & Base Pricing */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                              Concept Display Name *
                            </label>
                            <button
                              type="button"
                              onClick={() => handleUpdateConceptConfig(concept.id, { display_name: masterData.name || '' })}
                              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                            >
                              Copy from Master
                            </button>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder={`e.g. ${concept.code === 'OVRLOAD' ? 'Loaded Choco Cookie' : concept.code === 'WICKD' ? 'Wicked Cinnamon Cookie' : 'Chocolate Cookie'}`}
                            value={config.display_name}
                            onChange={e => handleUpdateConceptConfig(concept.id, { display_name: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                            Concept Base Price ($ USD) *
                          </label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b', fontSize: '13px' }}>$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={config.selling_price}
                              onChange={e => handleUpdateConceptConfig(concept.id, { selling_price: parseFloat(e.target.value) || 0 })}
                              style={{
                                width: '100%',
                                padding: '9px 12px 9px 24px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '13px',
                                fontWeight: 600
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Concept Image & Menu Category */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                              Concept Main Image
                            </label>
                            {masterData.image_url && (
                              <button
                                type="button"
                                onClick={() => handleUpdateConceptConfig(concept.id, { main_image_url: masterData.image_url || '' })}
                                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                              >
                                Inherit Master Image
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {config.main_image_url ? (
                              <img 
                                src={config.main_image_url} 
                                alt="Preview" 
                                style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                              />
                            ) : (
                              <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                                <ImageIcon size={18} color="#94a3b8" />
                              </div>
                            )}
                            <input
                              type="text"
                              placeholder="Image URL for this concept..."
                              value={config.main_image_url || ''}
                              onChange={e => handleUpdateConceptConfig(concept.id, { main_image_url: e.target.value })}
                              style={{
                                flex: 1,
                                padding: '9px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '13px'
                              }}
                            />
                            <button
                              type="button"
                              disabled={uploadingImage}
                              onClick={() => triggerUpload({ type: 'concept', conceptId: concept.id })}
                              style={{
                                padding: '9px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Upload size={14} /> Upload
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                            Concept Menu Category
                          </label>
                          <select
                            value={config.menu_category_id || ''}
                            onChange={e => handleUpdateConceptConfig(concept.id, { menu_category_id: Number(e.target.value) || null })}
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              backgroundColor: '#fff'
                            }}
                          >
                            <option value="">-- Choose Category --</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Concept Description & Packaging */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                              Concept Description
                            </label>
                            {masterData.description && (
                              <button
                                type="button"
                                onClick={() => handleUpdateConceptConfig(concept.id, { description: masterData.description || '' })}
                                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                              >
                                Copy from Master
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Branded concept description for menu and online channels..."
                            value={config.description || ''}
                            onChange={e => handleUpdateConceptConfig(concept.id, { description: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              resize: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                            Packaging Material (Section 7)
                          </label>
                          <input
                            type="text"
                            placeholder={concept.code === 'OVRLOAD' ? 'e.g. Delivery Sleeve' : concept.code === 'WICKD' ? 'e.g. Branded 4-Pack Box' : 'e.g. Dine-In Plate'}
                            value={config.packaging_item_id || ''}
                            onChange={e => handleUpdateConceptConfig(concept.id, { packaging_item_id: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px'
                            }}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                            Deducted per sale without duplicating recipe.
                          </span>
                        </div>
                      </div>

                      {/* ========================================================= */}
                      {/* SECTION C: SALES CHANNEL OVERRIDES TABLE */}
                      {/* ========================================================= */}
                      <div style={{
                        marginTop: '10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff'
                      }}>
                        <div style={{
                          padding: '12px 18px',
                          backgroundColor: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                              Sales Channel Pricing & Media Overrides
                            </h4>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                              Overrides apply strictly to that channel. Empty fields automatically inherit the concept base price (${config.selling_price.toFixed(2)}) and concept image.
                            </p>
                          </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569', width: '130px' }}>Channel</th>
                              <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569', width: '160px' }}>Selling Price ($)</th>
                              <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569' }}>Media Override (Image)</th>
                              <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569', width: '90px', textAlign: 'center' }}>Available</th>
                            </tr>
                          </thead>
                          <tbody>
                            {SALES_CHANNELS.map(ch => {
                              const ov = (config.channel_overrides && config.channel_overrides[ch]) || {
                                channel: ch,
                                selling_price: null,
                                image_url: '',
                                description: '',
                                is_available: true
                              };

                              const effectivePrice = resolveEffectiveSellingPrice(config, ch);
                              const effectiveImg = resolveEffectiveProductImage(config, ch, masterData.image_url);
                              const hasPriceOverride = ov.selling_price !== null && ov.selling_price !== undefined;
                              const hasImageOverride = Boolean(ov.image_url && ov.image_url.trim());

                              return (
                                <tr key={ch} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{ch}</span>
                                      {ch === 'Toters' && (
                                        <span style={{ fontSize: '10px', backgroundColor: '#ecfdf5', color: '#059669', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                          3rd Party
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ position: 'relative' }}>
                                      <span style={{ position: 'absolute', left: '8px', top: '7px', color: '#94a3b8', fontSize: '12px' }}>$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={`Inherited: $${config.selling_price.toFixed(2)}`}
                                        value={hasPriceOverride ? ov.selling_price! : ''}
                                        onChange={e => {
                                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                          handleUpdateChannelOverride(concept.id, ch, { selling_price: val });
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '6px 8px 6px 20px',
                                          borderRadius: '6px',
                                          border: hasPriceOverride ? `1px solid ${concept.color}` : '1px solid #e2e8f0',
                                          backgroundColor: hasPriceOverride ? '#fefce8' : '#fff',
                                          fontSize: '12px',
                                          fontWeight: hasPriceOverride ? 700 : 400
                                        }}
                                      />
                                    </div>
                                  </td>

                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <img
                                        src={effectiveImg}
                                        alt={ch}
                                        style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '6px',
                                          objectFit: 'cover',
                                          border: hasImageOverride ? `2px solid ${concept.color}` : '1px solid #e2e8f0'
                                        }}
                                        title={hasImageOverride ? 'Channel-specific image' : 'Inherited image'}
                                      />
                                      <input
                                        type="text"
                                        placeholder="Inherited from concept..."
                                        value={ov.image_url || ''}
                                        onChange={e => handleUpdateChannelOverride(concept.id, ch, { image_url: e.target.value })}
                                        style={{
                                          flex: 1,
                                          padding: '6px 8px',
                                          borderRadius: '6px',
                                          border: hasImageOverride ? `1px solid ${concept.color}` : '1px solid #e2e8f0',
                                          fontSize: '12px'
                                        }}
                                      />
                                      <button
                                        type="button"
                                        disabled={uploadingImage}
                                        onClick={() => triggerUpload({ type: 'channel', conceptId: concept.id, channel: ch })}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: '6px',
                                          border: '1px solid #e2e8f0',
                                          backgroundColor: '#fff',
                                          cursor: 'pointer',
                                          fontSize: '11px'
                                        }}
                                        title="Upload channel-specific photo"
                                      >
                                        <Upload size={12} />
                                      </button>
                                      {hasImageOverride && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateChannelOverride(concept.id, ch, { image_url: '' })}
                                          style={{
                                            padding: '4px',
                                            borderRadius: '4px',
                                            border: 'none',
                                            backgroundColor: '#fee2e2',
                                            color: '#ef4444',
                                            cursor: 'pointer'
                                          }}
                                          title="Revert to inherited image"
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={ov.is_available !== false}
                                      onChange={e => handleUpdateChannelOverride(concept.id, ch, { is_available: e.target.checked })}
                                      style={{ cursor: 'pointer', accentColor: concept.color }}
                                      title={ov.is_available !== false ? 'Available on this channel' : 'Blocked on this channel'}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {activeTab === 'master' ? (
              <span>Editing Master Recipe Identity</span>
            ) : (
              <span>Configuring Concept: <strong>{CORE_CONCEPTS.find(c => c.id === activeTab)?.name}</strong></span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAll}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Saving Concept Catalog...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save Multi-Concept Product</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
