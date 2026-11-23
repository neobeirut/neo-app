import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, Search, Plus, Edit2, Trash2, CheckCircle, 
  XCircle, Clock, Tag, Sliders, RefreshCw, X, Image as ImageIcon,
  Grid, List, Download, Upload, FileSpreadsheet, AlertTriangle, Layers,
  Smartphone, Store
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import { api } from '../../api/client';
import type { Product, Category } from '../../api/crmService';
import ProductModifierModal from './ProductModifierModal';
import ConceptProductModal from './ConceptProductModal';
import {
  CORE_CONCEPTS,
  conceptProductService,
  type ProductConceptConfig,
  type RecoveryPreviewResult,
  type RecoveryImportResult
} from '../../api/conceptProductService';
import { 
  downloadAlcoholTemplate, 
  downloadMenuProductsTemplate, 
  downloadProductRecipesTemplate, 
  parseAndImportAlcoholSpreadsheet, 
  type ImportResult 
} from '../../utils/alcoholRecipeImport';

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
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [channelFilter, setChannelFilter] = useState<'all' | 'mobile' | 'pos_only'>('all');

  // Commercial Concepts Filter
  const [selectedConcept, setSelectedConcept] = useState<string>('all');
  const [concepts, setConcepts] = useState<any[]>([
    { id: '00000000-0000-0000-0000-000000000001', code: 'NEO', name: 'NÉO (Restaurant & Bakery)', color: '#1e5c4f' },
    { id: '00000000-0000-0000-0000-000000000002', code: 'OVRLOAD', name: 'OVRLOAD (Loaded Wraps & Delivery)', color: '#ea580c' },
    { id: '00000000-0000-0000-0000-000000000003', code: 'WICKD', name: 'WICKD (Cinnamon Rolls Brand)', color: '#7c3aed' }
  ]);
  const [conceptConfigsMap, setConceptConfigsMap] = useState<Record<string, Record<string, ProductConceptConfig>>>({});
  const [recoveryPreview, setRecoveryPreview] = useState<RecoveryPreviewResult | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<RecoveryImportResult | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [active86Items, setActive86Items] = useState<any[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('flow_custom_concepts');
      if (stored) {
        const custom = JSON.parse(stored);
        if (Array.isArray(custom)) {
          setConcepts(prev => {
            const merged = [...prev];
            custom.forEach(cc => {
              if (!merged.some(m => m.id === cc.id || m.code === cc.code)) {
                merged.push({
                  id: cc.id,
                  code: cc.code,
                  name: cc.name,
                  color: cc.primary_color || '#0284c7'
                });
              }
            });
            return merged;
          });
        }
      }
    } catch (e) {}
  }, []);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    categories.forEach(c => {
      if (c.section) set.add(c.section);
    });
    return Array.from(set).sort();
  }, [categories]);

  const visibleCategories = useMemo(() => {
    if (!selectedSection) return categories;
    return categories.filter(c => c.section === selectedSection);
  }, [categories, selectedSection]);

  const displayedProducts = useMemo(() => {
    let list = products;
    if (selectedConcept !== 'all') {
      list = list.filter(p => {
        const isMaster = (p.concept_id || '00000000-0000-0000-0000-000000000001') === selectedConcept;
        const config = conceptConfigsMap[String(p.id)]?.[selectedConcept];
        const isConfigured = config ? config.is_active : isMaster;
        return isConfigured;
      });
    }
    if (selectedSection) {
      const secCatIds = new Set(categories.filter(c => c.section === selectedSection).map(c => c.id));
      list = list.filter(p => p.category_id && secCatIds.has(p.category_id));
    }
    if (channelFilter === 'mobile') {
      list = list.filter(p => p.show_in_mobile !== false);
    } else if (channelFilter === 'pos_only') {
      list = list.filter(p => p.show_in_mobile === false);
    }
    return list;
  }, [products, selectedConcept, selectedSection, categories, channelFilter, conceptConfigsMap]);

  // Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
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
  const [savingProduct, setSavingProduct] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Alcohol Import State
  const [importingAlcohol, setImportingAlcohol] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const alcoholFileInputRef = useRef<HTMLInputElement>(null);

  const handleAlcoholFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingAlcohol(true);
    try {
      const res = await parseAndImportAlcoholSpreadsheet(file);
      setImportResult(res);
      await loadData();
    } catch (err: any) {
      alert('Error importing alcohol spreadsheet: ' + err.message);
    } finally {
      setImportingAlcohol(false);
      if (alcoholFileInputRef.current) {
        alcoholFileInputRef.current.value = '';
      }
    }
  };

  // Category management
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySection, setNewCategorySection] = useState('Bistro');
  const [savingCategory, setSavingCategory] = useState(false);

  const openNewCategoryModal = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategorySection('Bistro');
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategorySection(cat.section || 'Bistro');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      if (editingCategory) {
        const updated = await crmService.updateCategory(editingCategory.id, {
          name: newCategoryName.trim(),
          section: newCategorySection
        });
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? updated : c));
        setFormData(prev => prev.category_id === editingCategory.id ? { ...prev, category_id: updated.id } : prev);
      } else {
        const created = await crmService.createCategory(newCategoryName.trim(), newCategorySection);
        setCategories(prev => [...prev, created]);
        setSelectedCatId(created.id);
        setFormData(prev => ({ ...prev, category_id: created.id }));
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setNewCategoryName('');
      loadData();
    } catch (err: any) {
      alert(`Failed to ${editingCategory ? 'update' : 'create'} category: ` + err.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    const catProds = products.filter(p => p.category_id === editingCategory.id);
    const msg = catProds.length > 0
      ? `This category contains ${catProds.length} product(s). Are you sure you want to delete category "${editingCategory.name}"?`
      : `Are you sure you want to delete category "${editingCategory.name}"?`;
    if (!window.confirm(msg)) return;
    setSavingCategory(true);
    try {
      await crmService.deleteCategory(editingCategory.id);
      setCategories(prev => prev.filter(c => c.id !== editingCategory.id));
      if (selectedCatId === editingCategory.id) setSelectedCatId(null);
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      loadData();
    } catch (err: any) {
      alert('Failed to delete category: ' + err.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
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

      // Load all concept configurations from Supabase (authoritative source)
      const [dbConfigs, preview] = await Promise.all([
        conceptProductService.getAllConfigurations(),
        conceptProductService.previewLocalStorageRecovery().catch(() => null)
      ]);
      setConceptConfigsMap(dbConfigs);
      setRecoveryPreview(preview);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res86 = await api.get86Logs(todayStr);
        const active86: any[] = [];
        if (res86?.success && Array.isArray(res86.data)) {
          for (const rec of res86.data) {
            if (Array.isArray(rec.items)) active86.push(...rec.items);
          }
        }
        setActive86Items(active86);
      } catch {
        // non-blocking
      }
    } catch (err) {
      console.error('Failed to load menu products:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCatId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleToggleMobile = async (product: Product) => {
    const currentVal = product.show_in_mobile !== undefined ? product.show_in_mobile : true;
    const nextVal = !currentVal;
    try {
      await crmService.updateProduct(product.id, { show_in_mobile: nextVal });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, show_in_mobile: nextVal } : p));
    } catch (err: any) {
      alert('Failed to toggle mobile visibility: ' + err.message);
    }
  };

  const cleanName = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isProduct86d = (p: Product) => {
    const rawStatus = (p.status || '').toLowerCase();
    if (['unavailable', 'unavailable today', '86', 'out_of_stock'].includes(rawStatus) || p.is_active === false) {
      return true;
    }
    const pClean = cleanName(p.name);
    return active86Items.some(it => {
      const itClean = cleanName(it.name);
      return itClean && (itClean === pClean || (itClean.length >= 3 && pClean.includes(itClean)));
    });
  };

  const handleToggleStatus = async (product: Product) => {
    const isCurrentlyUnavail = isProduct86d(product);
    const newStatus = isCurrentlyUnavail ? 'Available' : 'Unavailable Today';
    const newIsActive = newStatus === 'Available';
    try {
      await crmService.updateProduct(product.id, { status: newStatus, is_active: newIsActive });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus, is_active: newIsActive } : p));
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

  const handleSave = async (e?: React.FormEvent, isSaveAndNew = false) => {
    if (e) e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Please enter a product name');
      nameInputRef.current?.focus();
      return;
    }
    setSavingProduct(true);
    try {
      const isAvailable = (formData.status || 'Available') === 'Available';
      const priceNum = Number(formData.price) || 0;
      const payload = {
        ...formData,
        name: formData.name.trim(),
        price: priceNum,
        unit_price_usd: priceNum,
        is_active: formData.is_active !== undefined ? formData.is_active : isAvailable,
        show_in_mobile: formData.show_in_mobile !== undefined ? formData.show_in_mobile : true
      };
      if (isAvailable) {
        payload.is_active = true;
      }
      let savedProduct: Product;
      if (editingProduct) {
        savedProduct = await crmService.updateProduct(editingProduct.id, payload);
      } else {
        savedProduct = await crmService.createProduct(payload);
      }

      // Sync with POS workspace catalog
      try {
        const cObj = concepts.find(c => c.id === (payload.concept_id || '00000000-0000-0000-0000-000000000001')) || concepts[0];
        const code = cObj.code;
        const storedMenu = JSON.parse(localStorage.getItem('flow_concept_menu_' + code) || '{"categories":[],"products":[]}');
        const prodItem = {
          id: savedProduct?.id || (editingProduct ? editingProduct.id : ('p-' + Date.now())),
          name: payload.name,
          category: categories.find(c => c.id === payload.category_id)?.name || 'General',
          price: payload.price,
          description: payload.description || '',
          is_active: payload.is_active !== false
        };
        const pIdx = storedMenu.products.findIndex((p: any) => p.id === prodItem.id || p.name === prodItem.name);
        if (pIdx >= 0) storedMenu.products[pIdx] = prodItem;
        else storedMenu.products.unshift(prodItem);
        localStorage.setItem('flow_concept_menu_' + code, JSON.stringify(storedMenu));
      } catch (e) {}

      await loadData();

      if (isSaveAndNew) {
        // Keep all current settings (category, price, image, prep time, status, description)
        // but reset the product name for the next item
        setFormData(prev => ({
          ...prev,
          name: '',
        }));
        setEditingProduct(null);
        setSaveSuccessMsg(`Saved! Ready to add next item in ${categories.find(c => c.id === formData.category_id)?.name || 'category'}.`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      } else {
        setIsModalOpen(false);
        setEditingProduct(null);
        setSaveSuccessMsg('');
      }
    } catch (err: any) {
      alert('Failed to save product: ' + err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toolbar Row: Search, View Mode, and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
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

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{ padding: '5px 8px', border: 'none', background: viewMode === 'grid' ? '#fff' : 'transparent', borderRadius: '4px', cursor: 'pointer' }}
              title="Grid View"
            >
              <Grid size={15} color={viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)'} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{ padding: '5px 8px', border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent', borderRadius: '4px', cursor: 'pointer' }}
              title="Table View"
            >
              <List size={15} color={viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)'} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={downloadMenuProductsTemplate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid var(--border)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Download Excel template for Menu Products (Name, Category, Price, Prep time, Description)"
          >
            <Download size={14} /> Menu Template
          </button>

          <button
            type="button"
            onClick={downloadProductRecipesTemplate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid var(--border)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Download Excel template for Product Recipes (Glassware, Method, Ingredients, Dose/Qty, Units)"
          >
            <Download size={14} /> Recipe Template
          </button>

          <button
            type="button"
            disabled={importingAlcohol}
            onClick={() => alcoholFileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              fontSize: '13px',
              fontWeight: 600,
              cursor: importingAlcohol ? 'not-allowed' : 'pointer'
            }}
            title="Import alcohol menu products and recipes from Excel"
          >
            <Upload size={14} /> {importingAlcohol ? 'Importing...' : 'Import Alcohol'}
          </button>
          <input
            ref={alcoholFileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
            onChange={handleAlcoholFileSelect}
          />

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setSaveSuccessMsg('');
              setFormData({
                name: '',
                description: '',
                price: 15,
                category_id: selectedCatId || categories[0]?.id || null,
                concept_id: selectedConcept !== 'all' ? selectedConcept : '00000000-0000-0000-0000-000000000001',
                image_url: '',
                prep_time: '20',
                status: 'Available',
                is_featured: false,
                is_special: false,
                show_in_mobile: true
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

      {/* Commercial Concept Filter Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        padding: '10px 14px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '10px'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px', whiteSpace: 'nowrap' }}>
          <Store size={15} style={{ color: '#4f46e5' }} /> Commercial Brand:
        </span>
        <button
          type="button"
          onClick={() => setSelectedConcept('all')}
          style={{
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            border: selectedConcept === 'all' ? '1px solid #0f172a' : '1px solid #cbd5e1',
            backgroundColor: selectedConcept === 'all' ? '#0f172a' : '#ffffff',
            color: selectedConcept === 'all' ? '#ffffff' : '#334155',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          All Concepts ({products.length})
        </button>
        {concepts.map(c => {
          const isSelected = selectedConcept === c.id;
          const count = products.filter(p => {
            const cCfg = conceptConfigsMap[String(p.id)]?.[c.id];
            return cCfg ? cCfg.is_active : (p.concept_id || '00000000-0000-0000-0000-000000000001') === c.id;
          }).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedConcept(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                border: isSelected ? `2px solid ${c.color || '#1e5c4f'}` : '1px solid #cbd5e1',
                backgroundColor: isSelected ? (c.color || '#1e5c4f') : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isSelected ? '#ffffff' : (c.color || '#1e5c4f')
              }} />
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* LocalStorage -> Supabase Recovery Banner */}
      {recoveryPreview && recoveryPreview.candidates.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          marginBottom: '12px',
          borderRadius: '10px',
          backgroundColor: '#fff7ed',
          border: '1px solid #fdba74',
          color: '#9a3412'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <AlertTriangle size={18} color="#ea580c" style={{ flexShrink: 0 }} />
            <div>
              <strong>{recoveryPreview.candidates.length} saved local concept configuration{recoveryPreview.candidates.length === 1 ? '' : 's'}</strong> found in this browser (e.g. OVRLOAD drinks / pricing) not yet synced to the shared database.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRecoveryError(null);
              setRecoveryResult(null);
              setShowRecoveryModal(true);
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ea580c',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Preview &amp; Import to Database
          </button>
        </div>
      )}

      {/* Section Filter Pills */}
      {availableSections.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'thin'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Layers size={14} /> Section:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedSection(null);
              setSelectedCatId(null);
            }}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              borderRadius: '6px',
              border: selectedSection === null ? '1px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: selectedSection === null ? 'var(--primary)' : '#ffffff',
              color: selectedSection === null ? '#ffffff' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            All Sections
          </button>
          {availableSections.map(secName => {
            const isSelected = selectedSection === secName;
            const secCatIds = new Set(categories.filter(c => c.section === secName).map(c => c.id));
            const count = products.filter(p => p.category_id && secCatIds.has(p.category_id)).length;
            return (
              <button
                key={secName}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedSection(null);
                  } else {
                    setSelectedSection(secName);
                    setSelectedCatId(null);
                  }
                }}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                  color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{secName}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '999px',
                    background: isSelected ? 'var(--primary)' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 600
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category Filter Bar on a Dedicated Line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '6px',
        scrollbarWidth: 'thin'
      }}>
        <button
          type="button"
          onClick={() => setSelectedCatId(null)}
          style={{
            flexShrink: 0,
            padding: '7px 14px',
            borderRadius: '8px',
            border: selectedCatId === null ? '1px solid var(--primary)' : '1px solid var(--border)',
            backgroundColor: selectedCatId === null ? '#eff6ff' : '#ffffff',
            color: selectedCatId === null ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          All Categories ({displayedProducts.length})
        </button>
        {visibleCategories.map(cat => (
          <div
            key={cat.id}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '8px',
              border: selectedCatId === cat.id ? '1px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: selectedCatId === cat.id ? '#eff6ff' : '#ffffff',
              overflow: 'hidden'
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedCatId(selectedCatId === cat.id ? null : cat.id)}
              style={{
                padding: '7px 12px',
                border: 'none',
                background: 'transparent',
                color: selectedCatId === cat.id ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditCategoryModal(cat);
              }}
              title={`Edit "${cat.name}" category`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 8px',
                border: 'none',
                background: 'transparent',
                color: selectedCatId === cat.id ? 'var(--primary)' : '#94a3b8',
                cursor: 'pointer',
                borderLeft: selectedCatId === cat.id ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid #f1f5f9'
              }}
            >
              <Edit2 size={11} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={openNewCategoryModal}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px dashed var(--primary)',
            backgroundColor: '#f8fafc',
            color: 'var(--primary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          title="Add a new category"
        >
          <Plus size={13} /> Add Category
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
          Loading menu products...
        </div>
      ) : displayedProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          No menu products found. Create your first product above!
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {displayedProducts.map(p => {
            const cfg = selectedConcept !== 'all' ? conceptConfigsMap[String(p.id)]?.[selectedConcept] : undefined;
            const itemImg = (cfg?.main_image_url && cfg.main_image_url.trim()) || p.image_url;
            const itemName = cfg?.display_name || p.name;
            const itemPrice = cfg?.selling_price !== undefined ? cfg.selling_price : p.price;
            return (
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
                  {itemImg ? (
                    <img
                      src={itemImg}
                      alt={itemName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e: any) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ImageIcon size={36} opacity={0.4} />
                    </div>
                  )}

                  {/* Badges on image */}
                  <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {p.category && (
                      <span style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                        {p.category.name}
                      </span>
                    )}
                    {(() => {
                      const cObj = concepts.find(c => c.id === (p.concept_id || '00000000-0000-0000-0000-000000000001')) || concepts[0];
                      return (
                        <span style={{ backgroundColor: cObj.color || '#1e5c4f', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                          {cObj.code}
                        </span>
                      );
                    })()}
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
                        backgroundColor: !isProduct86d(p) ? 'rgba(22, 163, 74, 0.9)' : 'rgba(217, 119, 6, 0.95)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      {!isProduct86d(p) ? '● Available' : '🚫 86 (Unavailable)'}
                    </button>
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.3' }}>
                      {itemName}
                    </h4>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', marginLeft: '8px' }}>
                      ${Number(itemPrice || 0).toFixed(2)}
                    </span>
                  </div>

                  {selectedConcept === 'all' && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {CORE_CONCEPTS.map(c => {
                        const cCfg = conceptConfigsMap[String(p.id)]?.[c.id];
                        const isMaster = (p.concept_id || '00000000-0000-0000-0000-000000000001') === c.id;
                        const isEnabled = cCfg ? cCfg.is_active : isMaster;
                        const pr = cCfg ? cCfg.selling_price : p.price;
                        if (!isEnabled) return null;
                        return (
                          <span key={c.id} style={{ fontSize: '10px', backgroundColor: c.color + '14', color: c.color, border: '1px solid ' + c.color + '35', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            {c.code}: ${Number(pr).toFixed(2)}
                          </span>
                        );
                      })}
                    </div>
                  )}
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

              {/* Show in Mobile App Checkbox Toggle */}
              <div style={{ padding: '0 14px 10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={p.show_in_mobile !== false}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleMobile(p);
                    }}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: p.show_in_mobile !== false ? '#15803d' : '#c2410c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {p.show_in_mobile !== false ? (
                      <>
                        <Smartphone size={12} /> Show in Mobile App
                      </>
                    ) : (
                      <>
                        <Store size={12} /> POS Only
                      </>
                    )}
                  </span>
                </label>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: '1px solid var(--border)', backgroundColor: '#fafafa' }}>
                <button
                  type="button"
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
                    setFormData({ ...p, concept_id: p.concept_id || '00000000-0000-0000-0000-000000000001', status: normStatus, show_in_mobile: p.show_in_mobile !== undefined ? p.show_in_mobile : true });
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
          )})}
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
                <th style={{ padding: '12px 18px' }}>Show in Mobile App</th>
                <th style={{ padding: '12px 18px' }}>Prep Time</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px' }}>Customizations</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedProducts.map(p => {
                const cfg = selectedConcept !== 'all' ? conceptConfigsMap[String(p.id)]?.[selectedConcept] : undefined;
                const itemImg = (cfg?.main_image_url && cfg.main_image_url.trim()) || p.image_url;
                const itemName = cfg?.display_name || p.name;
                const itemPrice = cfg?.selling_price !== undefined ? cfg.selling_price : p.price;
                return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#f1f5f9', overflow: 'hidden', flexShrink: 0 }}>
                        {itemImg ? (
                          <img src={itemImg} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <ImageIcon size={18} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{itemName}</div>
                        {p.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {p.category?.name || 'General'}
                      </span>
                      {(() => {
                        const cObj = concepts.find(c => c.id === (p.concept_id || '00000000-0000-0000-0000-000000000001')) || concepts[0];
                        return (
                          <span style={{ backgroundColor: `${cObj.color}18`, color: cObj.color, border: `1px solid ${cObj.color}35`, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                            {cObj.code}
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                  <td style={{ padding: '12px 18px', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px' }}>
                    <div>
                      <span>${Number(itemPrice || 0).toFixed(2)}</span>
                      {selectedConcept === 'all' && (
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '3px' }}>
                          {CORE_CONCEPTS.map(c => {
                            const cCfg = conceptConfigsMap[String(p.id)]?.[c.id];
                            const isMaster = (p.concept_id || '00000000-0000-0000-0000-000000000001') === c.id;
                            const isEnabled = cCfg ? cCfg.is_active : isMaster;
                            const pr = cCfg ? cCfg.selling_price : p.price;
                            if (!isEnabled) return null;
                            return (
                              <span key={c.id} style={{ fontSize: '9px', backgroundColor: c.color + '15', color: c.color, padding: '0 4px', borderRadius: '3px', fontWeight: 600 }}>
                                {c.code}: ${Number(pr).toFixed(2)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        checked={p.show_in_mobile !== false}
                        onChange={() => handleToggleMobile(p)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: p.show_in_mobile !== false ? '#dcfce7' : '#ffedd5',
                          color: p.show_in_mobile !== false ? '#15803d' : '#c2410c'
                        }}
                      >
                        {p.show_in_mobile !== false ? (
                          <>
                            <Smartphone size={12} /> Show in Mobile App
                          </>
                        ) : (
                          <>
                            <Store size={12} /> POS Only
                          </>
                        )}
                      </span>
                    </label>
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
                        color: !isProduct86d(p) ? '#15803d' : '#d97706'
                      }}
                    >
                      {!isProduct86d(p) ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      {!isProduct86d(p) ? 'Available' : '86 (Unavailable)'}
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
                          setFormData({ ...p, concept_id: p.concept_id || '00000000-0000-0000-0000-000000000001', status: normStatus, show_in_mobile: p.show_in_mobile !== undefined ? p.show_in_mobile : true });
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
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Modifier Modal */}
      {modifierProduct && (
        <ProductModifierModal
          product={modifierProduct}
          onClose={() => {
            setModifierProduct(null);
            loadData(false);
          }}
          onSaved={() => {
            loadData(false);
          }}
        />
      )}

      {/* Concept-Specific Multi-Brand Product Modal */}
      <ConceptProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        categories={categories}
        onSaved={(_savedProduct) => {
          loadData(false);
        }}
        onOpenNewCategory={openNewCategoryModal}
        onOpenEditCategory={openEditCategoryModal}
      />

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Specialty Coffee, Bowls, Desserts..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Section / Station
                </label>
                <select
                  value={newCategorySection}
                  onChange={e => setNewCategorySection(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                >
                  <option value="Bistro">Bistro</option>
                  <option value="Bar">Bar</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Retail">Retail</option>
                  <option value="Bakery">Bakery</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Used to organize menus and station routing in POS and kitchen.
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: editingCategory ? 'space-between' : 'flex-end', 
                alignItems: 'center', 
                marginTop: '16px' 
              }}>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={handleDeleteCategory}
                    disabled={savingCategory}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fee2e2',
                      background: '#fff5f5',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: savingCategory ? 'not-allowed' : 'pointer'
                    }}
                    title="Delete this category"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setEditingCategory(null);
                    }}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCategory || !newCategoryName.trim()}
                    style={{ 
                      padding: '8px 18px', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--primary)', 
                      color: '#fff', 
                      border: 'none', 
                      fontSize: '13px', 
                      fontWeight: 600, 
                      cursor: savingCategory || !newCategoryName.trim() ? 'not-allowed' : 'pointer',
                      opacity: savingCategory || !newCategoryName.trim() ? 0.6 : 1
                    }}
                  >
                    {savingCategory ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alcohol Import Result Modal */}
      {importResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Alcohol Products & Recipes Import
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setImportResult(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {importResult.success ? (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <CheckCircle size={28} color="#16a34a" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '14px' }}>
                      Import Successful!
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                      Imported <strong>{importResult.totalProducts}</strong> alcohol menu products and linked <strong>{importResult.totalIngredients}</strong> recipe BOM ingredients with active recipe inventory depletion.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <AlertTriangle size={28} color="#dc2626" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px' }}>
                      Import Incomplete
                    </div>
                    <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
                      No products could be imported. Please review the errors below.
                    </div>
                  </div>
                </div>
              )}

              {/* Created Products List */}
              {importResult.createdProducts.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Imported Products ({importResult.createdProducts.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px', overflowY: 'auto', padding: '4px 0' }}>
                    {importResult.createdProducts.map((p, idx) => (
                      <span key={idx} style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#eff6ff',
                        color: 'var(--primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid #dbeafe'
                      }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#9f1239', fontSize: '12px', marginBottom: '6px' }}>
                    Errors:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#be123c', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: '12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} color="#b45309" />
                    Warnings ({importResult.warnings.length}):
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#b45309', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                    {importResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setImportResult(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LocalStorage Recovery Preview & Import Modal */}
      {showRecoveryModal && recoveryPreview && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Recover Local Concept Configurations to Database</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Imports missing concept assignments and channel overrides from this browser without overwriting existing database records.
                </p>
              </div>
              <button type='button' onClick={() => setShowRecoveryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {recoveryError && (
                <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', fontWeight: 600 }}>
                  {recoveryError}
                </div>
              )}
              {recoveryResult ? (
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Import completed successfully</div>
                  <div>Concept configurations persisted: <strong>{recoveryResult.importedConfigs}</strong></div>
                  <div>Channel overrides persisted: <strong>{recoveryResult.importedOverrides}</strong></div>
                  <div>Existing DB records preserved untouched: <strong>{recoveryResult.skippedExistingDbCount}</strong></div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                    Found <strong>{recoveryPreview.candidates.length}</strong> recoverable item(s) ({recoveryPreview.skippedExistingDbCount} existing DB record(s) will be preserved untouched).
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                          <th style={{ padding: '8px 12px' }}>Product</th>
                          <th style={{ padding: '8px 12px' }}>Concept</th>
                          <th style={{ padding: '8px 12px' }}>Price</th>
                          <th style={{ padding: '8px 12px' }}>Channel Overrides</th>
                          <th style={{ padding: '8px 12px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recoveryPreview.candidates.map(c => (
                          <tr key={c.productId + '-' + c.conceptId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{c.displayName} <span style={{ color: '#94a3b8', fontWeight: 400 }}>#{c.productId}</span></td>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>{c.conceptCode}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>${Number(c.sellingPrice || 0).toFixed(2)}</td>
                            <td style={{ padding: '8px 12px' }}>{c.channelOverridesCount}</td>
                            <td style={{ padding: '8px 12px', color: '#0369a1' }}>
                              {c.reason === 'missing_in_db' ? 'Insert concept config' : 'Add missing overrides'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#f8fafc' }}>
              <button type='button' onClick={() => setShowRecoveryModal(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
              {!recoveryResult && recoveryPreview.candidates.length > 0 && (
                <button
                  type='button'
                  disabled={recovering}
                  onClick={async () => {
                    setRecovering(true);
                    setRecoveryError(null);
                    try {
                      const res = await conceptProductService.recoverLocalStorageConfigs();
                      setRecoveryResult(res);
                      await loadData(false);
                    } catch (err: any) {
                      setRecoveryError(err?.message || 'Failed to import configurations to database.');
                    } finally {
                      setRecovering(false);
                    }
                  }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontSize: '12px', fontWeight: 700, cursor: recovering ? 'wait' : 'pointer', opacity: recovering ? 0.7 : 1 }}
                >
                  {recovering ? 'Importing to Database...' : 'Import ' + recoveryPreview.candidates.length + ' to Database'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
