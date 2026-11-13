import React, { useState, useEffect } from 'react';
import { 
  Layers, Plus, Edit2, Shield, Store, Printer, 
  Check, X, AlertCircle, RefreshCw, Palette, 
  FileText, ArrowRight, Eye, EyeOff, Utensils, Tag, DollarSign, Trash2, Search,
  MessageSquare, Phone, Send, CheckCircle2, AlertTriangle, ShieldCheck, Building2
} from 'lucide-react';
import { supabase, supabasePublic } from '../api/supabase';
import { api } from '../api/client';
import { KNOWN_CONCEPTS, type BusinessConcept } from '../types/concept';
import { conceptMessagingService, type ConceptMessagingConfig } from '../services/conceptMessagingService';

export default function ConceptManagementScreen({ user, permissions }: { user: any; permissions: any }) {
  const [concepts, setConcepts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchAssignments, setBranchAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSchemaMigrated, setIsSchemaMigrated] = useState<boolean>(true);

  // Sub-Navigation Tabs
  const [activeTab, setActiveTab] = useState<'concepts' | 'communications'>('concepts');

  // Independent Invoice Series & Channel Mapping state
  const [invoiceSequences, setInvoiceSequences] = useState<Record<string, { standard: number; aSeries: number }>>({});
  const [channelSeriesMapping, setChannelSeriesMapping] = useState<Record<string, string>>({
    WHATSAPP: 'A',
    DIRECT_APP: 'A',
    PHONE: 'A',
    DINE_IN: 'STANDARD',
    POS: 'STANDARD',
    POS_PICKUP: 'STANDARD',
    TOTERS: 'STANDARD',
    NOKNOK: 'STANDARD'
  });

  // Communications state
  const [messagingConfigs, setMessagingConfigs] = useState<ConceptMessagingConfig[]>([]);
  const [editingCommConfig, setEditingCommConfig] = useState<ConceptMessagingConfig | null>(null);
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [commSaving, setCommSaving] = useState(false);
  const [verificationLog, setVerificationLog] = useState<{ conceptCode: string; status: string; details: string } | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Menu Products Management Modal
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [menuConcept, setMenuConcept] = useState<any | null>(null);
  const [menuCategories, setMenuCategories] = useState<string[]>([]);
  const [rawCategories, setRawCategories] = useState<any[]>([]);
  const [menuProducts, setMenuProducts] = useState<any[]>([]);
  const [activeMenuCategory, setActiveMenuCategory] = useState<string>('All');
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdCat, setNewProdCat] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    tagline: '',
    concept_type: 'RESTAURANT',
    status: 'INACTIVE', // New concepts are inactive by default
    primary_color: '#1e5c4f',
    secondary_color: '#ffffff',
    receipt_prefix: '',
    fiscal_series: 'MAIN',
    selected_branches: [] as string[],
    pos_workspace_enabled: true,
    menu_visible: true,
    printer_kitchen: true,
    printer_bar: false,
    printer_pastry: false,
    toters_commission_pct: 15,
    noknok_commission_pct: 15,
    whatsapp_promo_pct: 0,
    pickup_discount_pct: 0
  });

  const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Load branches
      const bRes = await api.getBranches();
      const bList = Array.isArray(bRes) ? bRes : (bRes?.data || []);
      setBranches(bList);

      // 2. Load concepts from business_concepts table
      const { data: dbConcepts, error: cErr } = await supabasePublic
        .from('business_concepts')
        .select('*')
        .order('code', { ascending: true });

      if (cErr) {
        setIsSchemaMigrated(false);
        // Fallback to hardcoded canonical concepts if table is not yet migrated in production
        const fallbacks = Object.values(KNOWN_CONCEPTS).map(c => ({
          id: c.id,
          code: c.prefix,
          name: c.name,
          primary_color: c.primaryColor,
          secondary_color: '#ffffff',
          receipt_prefix: c.prefix,
          status: 'ACTIVE',
          concept_type: c.prefix === 'NEO' ? 'RESTAURANT' : (c.prefix === 'OVRLOAD' ? 'CLOUD_KITCHEN' : 'RETAIL'),
          metadata: {
            description: c.description,
            tagline: c.tagline
          }
        }));

        let customConcepts: any[] = [];
        try {
          const stored = localStorage.getItem('flow_custom_concepts');
          if (stored) customConcepts = JSON.parse(stored);
        } catch (e) {}

        const merged = [...fallbacks];
        customConcepts.forEach(cc => {
          const idx = merged.findIndex(m => m.id === cc.id || m.code === cc.code);
          if (idx >= 0) merged[idx] = cc;
          else merged.push(cc);
        });

        setConcepts(merged);

        let localAssignments: Record<string, string[]> = {
          '00000000-0000-0000-0000-000000000001': bList.map(b => b.id),
          '00000000-0000-0000-0000-000000000002': ['9c214659-9cc7-4f33-b115-cbbb8a823a94'],
          '00000000-0000-0000-0000-000000000003': ['9c214659-9cc7-4f33-b115-cbbb8a823a94']
        };
        try {
          const storedAssign = localStorage.getItem('flow_concept_branch_assignments');
          if (storedAssign) {
            localAssignments = { ...localAssignments, ...JSON.parse(storedAssign) };
          }
        } catch (e) {}
        setBranchAssignments(localAssignments);
      } else {
        setIsSchemaMigrated(true);
        setConcepts(dbConcepts || []);

        // Load branch assignments
        const { data: assignments } = await supabasePublic
          .from('concept_branch_assignments')
          .select('concept_id, branch_id')
          .eq('enabled', true);

        const map: Record<string, string[]> = {};
        (assignments || []).forEach((a: any) => {
          if (!map[a.concept_id]) map[a.concept_id] = [];
          map[a.concept_id].push(a.branch_id);
        });
        setBranchAssignments(map);
      }

      // 3. Load concept communications configurations
      const comms = await conceptMessagingService.getAllConfigs();
      setMessagingConfigs(comms);

      // 4. Load independent invoice sequences for all concepts
      try {
        const seqRes = await (api as any).getConceptInvoiceSequences();
        if (seqRes.success && Array.isArray(seqRes.data)) {
          const map: Record<string, { standard: number; aSeries: number }> = {};
          seqRes.data.forEach((s: any) => {
            if (!map[s.concept_id]) map[s.concept_id] = { standard: 0, aSeries: 0 };
            const ser = (s.invoice_series || s.fiscal_series || '').toUpperCase();
            if (ser === 'A') {
              map[s.concept_id].aSeries = Number(s.current_val || 0);
            } else {
              map[s.concept_id].standard = Number(s.current_val || 0);
            }
          });
          setInvoiceSequences(map);
        }
      } catch (seqErr) {
        console.warn('Could not load invoice sequences:', seqErr);
      }

      // 5. Load channel-to-series mapping from app_settings
      try {
        const chanRes = await (api as any).getChannelInvoiceSeriesMapping();
        if (chanRes.success && chanRes.data) {
          setChannelSeriesMapping(chanRes.data);
        }
      } catch (chanErr) {
        console.warn('Could not load channel mapping:', chanErr);
      }
    } catch (err: any) {
      console.error('Error loading concepts:', err);
      setErrorMsg('Could not load concepts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditComm = (config: ConceptMessagingConfig) => {
    setEditingCommConfig({ ...config });
    setIsCommModalOpen(true);
  };

  const handleSaveCommConfig = async () => {
    if (!editingCommConfig) return;
    setCommSaving(true);
    setErrorMsg(null);
    try {
      await conceptMessagingService.saveConceptConfig(editingCommConfig);
      const refreshed = await conceptMessagingService.getAllConfigs();
      setMessagingConfigs(refreshed);
      setIsCommModalOpen(false);
      setSuccessMsg(`Communications for ${editingCommConfig.display_name} saved successfully.`);
    } catch (err: any) {
      setErrorMsg('Failed to save communications config: ' + err.message);
    } finally {
      setCommSaving(false);
    }
  };

  const handleVerifySenderIsolation = async (conceptId: string, conceptCode: string) => {
    setVerificationLog(null);
    const result = await conceptMessagingService.resolveSenderForConcept(conceptId);
    if (result.success) {
      setVerificationLog({
        conceptCode,
        status: 'VERIFIED_ACTIVE',
        details: `Authoritative sender resolved: +${result.senderNumber} (${result.displayName}). Provider: Infobip. Brand isolation strictly enforced.`
      });
    } else {
      setVerificationLog({
        conceptCode,
        status: 'BLOCKED_SAFE',
        details: `Automated sending safely blocked: ${result.error}. Cross-concept fallback prevented.`
      });
    }
  };

  const handleOpenCreateModal = () => {
    setEditingConcept(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      tagline: '',
      concept_type: 'RESTAURANT',
      status: 'INACTIVE', // Required: New concepts start INACTIVE
      primary_color: '#0284c7',
      secondary_color: '#ffffff',
      receipt_prefix: '',
      fiscal_series: 'MAIN',
      selected_branches: [],
      pos_workspace_enabled: true,
      menu_visible: true,
      printer_kitchen: true,
      printer_bar: false,
      printer_pastry: false
    });
    setIsModalOpen(true);
  };

  const handleOpenMenuModal = async (concept: any) => {
    setMenuConcept(concept);
    const code = String(concept.code || '').toUpperCase();
    setIsMenuModalOpen(true);
    setMenuLoading(true);
    setMenuSearchQuery('');
    setActiveMenuCategory('All');
    setShowAddProductForm(false);
    setShowAddCategoryForm(false);

    try {
      // 1. Read all rows from categories and products from live Supabase database
      const readAllRows = async (table: string, configure: (query: any) => any) => {
        const rows: any[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await configure(supabase.from(table).select('*')).range(offset, offset + 999);
          if (error) throw new Error(table + ': ' + error.message);
          rows.push(...(data || []));
          if (!data || data.length < 1000) return rows;
        }
      };

      const restId = user?.restaurant_id || '79256f11-a9f8-4fec-901d-69baf929762d';
      const [catData, prodData, restResp] = await Promise.all([
        readAllRows('categories', q => q.order('display_order', { ascending: true })),
        readAllRows('products', q => q.order('name', { ascending: true })),
        supabase.from('restaurants').select('settings').eq('id', restId).maybeSingle()
      ]);

      const remoteConceptMap: Record<string, string> = restResp?.data?.settings?.concept_products || {};
      const resolveProdConcept = (p: any) => {
        const mapped = remoteConceptMap[String(p.id)];
        const isDefault = !p.concept_id || p.concept_id === '00000000-0000-0000-0000-000000000001';
        return (isDefault && mapped) ? mapped : (p.concept_id || '00000000-0000-0000-0000-000000000001');
      };

      setRawCategories(catData);
      const catMap = new Map<number | string, string>();
      catData.forEach((c: any) => catMap.set(c.id, c.name));

      let cats: string[] = [];
      let prods: any[] = [];

      if (code === 'NEO') {
        // NÉO products: includes all products in the database with no concept_id or concept_id = NEO (excluding items mapped to other concepts)
        cats = catData.filter((c: any) => c.is_active !== false).map((c: any) => c.name);
        prods = prodData
          .filter((p: any) => resolveProdConcept(p) === '00000000-0000-0000-0000-000000000001' || String(p.concept_id).toUpperCase() === 'NEO')
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            category: (p.category_id ? catMap.get(p.category_id) : null) || 'General',
            category_id: p.category_id,
            price: Number(p.price ?? p.unit_price_usd ?? 0),
            description: p.description || '',
            is_active: p.is_active !== false
          }));
      } else if (code === 'OVRLOAD') {
        const dbOvr = prodData.filter((p: any) => resolveProdConcept(p) === '00000000-0000-0000-0000-000000000002' || String(p.concept_id).toUpperCase() === 'OVRLOAD');
        if (dbOvr.length > 0) {
          cats = Array.from(new Set(dbOvr.map((p: any) => catMap.get(p.category_id) || 'Loaded Wraps')));
          prods = dbOvr.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: (p.category_id ? catMap.get(p.category_id) : null) || 'Loaded Wraps',
            category_id: p.category_id,
            price: Number(p.price ?? p.unit_price_usd ?? 0),
            description: p.description || '',
            is_active: p.is_active !== false
          }));
        } else {
          // Check local storage or defaults
          let savedMenu: any = null;
          try {
            const item = localStorage.getItem('flow_concept_menu_' + code);
            if (item) savedMenu = JSON.parse(item);
          } catch (e) {}

          if (savedMenu && savedMenu.categories && savedMenu.products) {
            cats = savedMenu.categories;
            prods = savedMenu.products;
          } else {
            cats = ['Loaded Wraps', 'Loaded Fries & Sides', 'Overload Combos', 'Dips & Sauces', 'Beverages'];
            prods = [
              { id: 'ovr-01', name: 'Crispy Chicken Overload Wrap', category: 'Loaded Wraps', price: 7.50, description: 'Double fried crispy chicken breast, melted cheddar, pickles, overload garlic mayo.' },
              { id: 'ovr-02', name: 'Smash Beef & Melted Cheddar Wrap', category: 'Loaded Wraps', price: 8.50, description: '100% Angus smash beef patty, caramelized grilled onions, double American cheese.' },
              { id: 'ovr-03', name: 'Spicy Shawarma Crunch Wrap', category: 'Loaded Wraps', price: 8.00, description: 'Tender marinated chicken shawarma, garlic toum, pickles, crunchy shoestring fries.' },
              { id: 'ovr-04', name: 'Truffle Ribeye Steak Wrap', category: 'Loaded Wraps', price: 9.50, description: 'Thinly sliced tender ribeye steak, sautéed cremini mushrooms, truffle aioli.' },
              { id: 'ovr-05', name: 'Overload Cheesy Bacon Fries', category: 'Loaded Fries & Sides', price: 4.50, description: 'Crispy skin-on french fries drenched in hot melted cheddar sauce, bacon bits.' },
              { id: 'ovr-06', name: 'Overload Solo Combo', category: 'Overload Combos', price: 12.00, description: 'Any Signature Wrap + Cheesy Fries + Soft Drink.' }
            ];
          }
        }
      } else if (code === 'WICKD') {
        const dbWck = prodData.filter((p: any) => resolveProdConcept(p) === '00000000-0000-0000-0000-000000000003' || String(p.concept_id).toUpperCase() === 'WICKD');
        if (dbWck.length > 0) {
          cats = Array.from(new Set(dbWck.map((p: any) => catMap.get(p.category_id) || 'Signature Cinnamon Rolls')));
          prods = dbWck.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: (p.category_id ? catMap.get(p.category_id) : null) || 'Signature Cinnamon Rolls',
            category_id: p.category_id,
            price: Number(p.price ?? p.unit_price_usd ?? 0),
            description: p.description || '',
            is_active: p.is_active !== false
          }));
        } else {
          // Check local storage or defaults
          let savedMenu: any = null;
          try {
            const item = localStorage.getItem('flow_concept_menu_' + code);
            if (item) savedMenu = JSON.parse(item);
          } catch (e) {}

          if (savedMenu && savedMenu.categories && savedMenu.products) {
            cats = savedMenu.categories;
            prods = savedMenu.products;
          } else {
            cats = ['Signature Cinnamon Rolls', 'Wicked Boxes & Bundles', 'Toppings & Extra Dips', 'Specialty Drinks'];
            prods = [
              { id: 'wck-01', name: 'The OG Classic Cinnamon Roll', category: 'Signature Cinnamon Rolls', price: 4.50, description: 'Buttery brioche dough swirled with rich Korintje cinnamon, signature cream cheese icing.' },
              { id: 'wck-02', name: 'Sticky Pecan & Salted Caramel Roll', category: 'Signature Cinnamon Rolls', price: 5.50, description: 'Warm cinnamon roll topped with buttery sea-salt caramel sauce and roasted pecans.' },
              { id: 'wck-03', name: 'Belgian Triple Chocolate Roll', category: 'Signature Cinnamon Rolls', price: 5.50, description: 'Smothered in dark chocolate fudge, milk chocolate shavings, white chocolate ganache.' },
              { id: 'wck-04', name: 'Lotus Biscoff Cream Roll', category: 'Signature Cinnamon Rolls', price: 5.50, description: 'Topped with melted Lotus Biscoff spread, crushed speculoos biscuits, white drizzle.' },
              { id: 'wck-05', name: 'Wicked Box of 4 Assorted Rolls', category: 'Wicked Boxes & Bundles', price: 18.00, description: '1 Classic OG, 1 Pecan Caramel, 1 Triple Chocolate, 1 Lotus Biscoff.' },
              { id: 'wck-06', name: 'Vanilla Sweet Cream Cold Brew', category: 'Specialty Drinks', price: 4.50, description: '16-hour slow steeped dark roast cold brew topped with sweet cream.' }
            ];
          }
        }
      } else {
        // Custom concept
        const dbCustom = prodData.filter((p: any) => resolveProdConcept(p) === concept.id || String(p.concept_id).toUpperCase() === code);
        if (dbCustom.length > 0) {
          cats = Array.from(new Set(dbCustom.map((p: any) => catMap.get(p.category_id) || 'General')));
          prods = dbCustom.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: (p.category_id ? catMap.get(p.category_id) : null) || 'General',
            category_id: p.category_id,
            price: Number(p.price ?? p.unit_price_usd ?? 0),
            description: p.description || '',
            is_active: p.is_active !== false
          }));
        } else {
          let savedMenu: any = null;
          try {
            const item = localStorage.getItem('flow_concept_menu_' + code);
            if (item) savedMenu = JSON.parse(item);
          } catch (e) {}
          cats = savedMenu?.categories || ['General'];
          prods = savedMenu?.products || [];
        }
      }

      setMenuCategories(cats.length > 0 ? cats : ['General']);
      setMenuProducts(prods);
      setNewProdCat(cats[0] || 'General');
    } catch (err: any) {
      console.warn('Could not load live products from database, falling back to local defaults:', err);
      // Fallback
      let cats: string[] = [];
      let prods: any[] = [];
      if (code === 'OVRLOAD') {
        cats = ['Loaded Wraps', 'Loaded Fries & Sides', 'Overload Combos', 'Dips & Sauces', 'Beverages'];
        prods = [
          { id: 'ovr-01', name: 'Crispy Chicken Overload Wrap', category: 'Loaded Wraps', price: 7.50, description: 'Double fried crispy chicken breast, melted cheddar, pickles, overload garlic mayo.' },
          { id: 'ovr-02', name: 'Smash Beef & Melted Cheddar Wrap', category: 'Loaded Wraps', price: 8.50, description: '100% Angus smash beef patty, caramelized grilled onions, double American cheese.' }
        ];
      } else if (code === 'WICKD') {
        cats = ['Signature Cinnamon Rolls', 'Wicked Boxes & Bundles', 'Toppings & Extra Dips', 'Specialty Drinks'];
        prods = [
          { id: 'wck-01', name: 'The OG Classic Cinnamon Roll', category: 'Signature Cinnamon Rolls', price: 4.50, description: 'Buttery brioche dough swirled with rich Korintje cinnamon, signature cream cheese icing.' }
        ];
      } else {
        cats = ['General', 'Beverages', 'Desserts'];
        prods = [];
      }
      setMenuCategories(cats);
      setMenuProducts(prods);
      setNewProdCat(cats[0] || 'General');
    } finally {
      setMenuLoading(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const trimmed = newCatName.trim();
    if (!menuCategories.includes(trimmed)) {
      const updatedCats = [...menuCategories, trimmed];
      setMenuCategories(updatedCats);
      setNewProdCat(trimmed);
      saveMenuData(updatedCats, menuProducts);
    }
    setNewCatName('');
    setShowAddCategoryForm(false);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) return;
    const catName = newProdCat || menuCategories[0] || 'General';
    const numPrice = parseFloat(newProdPrice) || 0;
    const desc = newProdDesc.trim();

    let createdId: any = 'p-' + Date.now();

    // If it's NEO, insert into Supabase products table directly
    if (menuConcept?.code === 'NEO') {
      try {
        const catObj = rawCategories.find(c => c.name === catName);
        const { data: inserted } = await supabase.from('products').insert([{
          name: newProdName.trim(),
          category_id: catObj ? catObj.id : null,
          price: numPrice,
          unit_price_usd: numPrice,
          description: desc,
          is_active: true
        }]).select().single();
        if (inserted?.id) createdId = inserted.id;
      } catch (err) {
        console.warn('Could not insert product into Supabase:', err);
      }
    }

    const newProd = {
      id: createdId,
      name: newProdName.trim(),
      category: catName,
      price: numPrice,
      description: desc,
      is_active: true
    };
    const updatedProds = [newProd, ...menuProducts];
    setMenuProducts(updatedProds);
    saveMenuData(menuCategories, updatedProds);
    setNewProdName('');
    setNewProdPrice('');
    setNewProdDesc('');
    setShowAddProductForm(false);
    setSuccessMsg(`Added "${newProd.name}" to ${menuConcept?.name || 'concept'} menu!`);
  };

  const handleDeleteProduct = async (productId: string | number) => {
    if (menuConcept?.code === 'NEO' && typeof productId === 'number') {
      try {
        await supabase.from('products').update({ is_active: false }).eq('id', productId);
      } catch (e) {}
    }
    const updated = menuProducts.filter(p => p.id !== productId);
    setMenuProducts(updated);
    saveMenuData(menuCategories, updated);
  };

  const saveMenuData = (cats: string[], prods: any[]) => {
    if (!menuConcept) return;
    const code = String(menuConcept.code || '').toUpperCase();
    try {
      localStorage.setItem('flow_concept_menu_' + code, JSON.stringify({
        categories: cats,
        products: prods,
        updated_at: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Could not save concept menu to localStorage:', e);
    }
  };

  const handleOpenEditModal = (concept: any) => {
    setEditingConcept(concept);
    const assigned = branchAssignments[concept.id] || [];
    setFormData({
      code: concept.code,
      name: concept.name,
      description: concept.metadata?.description || '',
      tagline: concept.metadata?.tagline || '',
      concept_type: concept.concept_type || 'RESTAURANT',
      status: concept.status || 'ACTIVE',
      primary_color: concept.primary_color || '#1e5c4f',
      secondary_color: concept.secondary_color || '#ffffff',
      receipt_prefix: concept.receipt_prefix || concept.code,
      fiscal_series: concept.metadata?.fiscal_series || 'MAIN',
      selected_branches: assigned,
      pos_workspace_enabled: concept.metadata?.pos_workspace_enabled !== false,
      menu_visible: concept.metadata?.menu_visible !== false,
      printer_kitchen: concept.metadata?.printer_kitchen !== false,
      printer_bar: Boolean(concept.metadata?.printer_bar),
      printer_pastry: Boolean(concept.metadata?.printer_pastry),
      toters_commission_pct: concept.metadata?.channel_agreements?.toters_commission_pct ?? (concept.code === 'OVRLOAD' ? 15 : 0),
      noknok_commission_pct: concept.metadata?.channel_agreements?.noknok_commission_pct ?? (concept.code === 'OVRLOAD' ? 15 : 0),
      whatsapp_promo_pct: concept.metadata?.channel_agreements?.whatsapp_promo_pct ?? 0,
      pickup_discount_pct: concept.metadata?.channel_agreements?.pickup_discount_pct ?? 0
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (concept: any) => {
    const nextStatus = concept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!isSchemaMigrated) {
      const updated = concepts.map(c => c.id === concept.id ? { ...c, status: nextStatus } : c);
      setConcepts(updated);
      try {
        const stored = JSON.parse(localStorage.getItem('flow_custom_concepts') || '[]');
        const idx = stored.findIndex((s: any) => s.id === concept.id || s.code === concept.code);
        if (idx >= 0) stored[idx].status = nextStatus;
        else stored.push({ ...concept, status: nextStatus });
        localStorage.setItem('flow_custom_concepts', JSON.stringify(stored));
      } catch (e) {}
      setSuccessMsg(`Concept ${concept.name} is now ${nextStatus} (Local Sandbox Preview).`);
      return;
    }

    try {
      const { error } = await supabase
        .from('business_concepts')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', concept.id);

      if (error) {
        if (error.message.includes('schema cache') || (error as any).code === 'PGRST205') {
          setIsSchemaMigrated(false);
          const updated = concepts.map(c => c.id === concept.id ? { ...c, status: nextStatus } : c);
          setConcepts(updated);
          setSuccessMsg(`Concept ${concept.name} is now ${nextStatus} (Local Sandbox Preview).`);
          return;
        }
        throw error;
      }
      setSuccessMsg(`Concept ${concept.name} is now ${nextStatus}.`);
      loadData();
    } catch (err: any) {
      setErrorMsg('Failed to update status: ' + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const cleanCode = formData.code.trim().toUpperCase();
    const cleanPrefix = formData.receipt_prefix.trim().toUpperCase() || cleanCode.slice(0, 4);

    if (!cleanCode || !formData.name.trim()) {
      setErrorMsg('Brand Code and Brand Name are required.');
      setSaving(false);
      return;
    }

    const metadata = {
      description: formData.description,
      tagline: formData.tagline,
      fiscal_series: formData.fiscal_series,
      pos_workspace_enabled: formData.pos_workspace_enabled,
      menu_visible: formData.menu_visible,
      printer_kitchen: formData.printer_kitchen,
      printer_bar: formData.printer_bar,
      printer_pastry: formData.printer_pastry,
      channel_agreements: {
        toters_commission_pct: Number(formData.toters_commission_pct) || 0,
        noknok_commission_pct: Number(formData.noknok_commission_pct) || 0,
        whatsapp_promo_pct: Number(formData.whatsapp_promo_pct) || 0,
        pickup_discount_pct: Number(formData.pickup_discount_pct) || 0
      }
    };

    const saveToLocalSandbox = () => {
      const conceptId = editingConcept?.id || 'local-concept-' + Date.now();
      const conceptObj = {
        id: conceptId,
        code: cleanCode,
        name: formData.name.trim(),
        legal_entity_name: 'B.R.I.M.E. S.A.L.',
        mof_tax_number: '3870852',
        concept_type: formData.concept_type,
        status: formData.status,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        receipt_prefix: cleanPrefix,
        metadata
      };

      try {
        const stored = JSON.parse(localStorage.getItem('flow_custom_concepts') || '[]');
        const idx = stored.findIndex((s: any) => s.id === conceptId || s.code === cleanCode);
        if (idx >= 0) stored[idx] = conceptObj;
        else stored.push(conceptObj);
        localStorage.setItem('flow_custom_concepts', JSON.stringify(stored));

        const assignStored = JSON.parse(localStorage.getItem('flow_concept_branch_assignments') || '{}');
        assignStored[conceptId] = formData.selected_branches;
        localStorage.setItem('flow_concept_branch_assignments', JSON.stringify(assignStored));
      } catch (e) {}

      setIsModalOpen(false);
      setSuccessMsg(`Concept ${formData.name} saved in Local Sandbox Preview mode. (Database table 'public.business_concepts' is awaiting migration authorization).`);
      loadData();
    };

    if (!isSchemaMigrated) {
      saveToLocalSandbox();
      setSaving(false);
      return;
    }

    try {
      if (editingConcept) {
        // Update existing concept
        const { error } = await supabase
          .from('business_concepts')
          .update({
            name: formData.name.trim(),
            primary_color: formData.primary_color,
            secondary_color: formData.secondary_color,
            concept_type: formData.concept_type,
            status: formData.status,
            receipt_prefix: cleanPrefix,
            metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingConcept.id);

        if (error) {
          if (error.message.includes('schema cache') || (error as any).code === 'PGRST205') {
            saveToLocalSandbox();
            return;
          }
          throw error;
        }

        // Update branch assignments
        await supabase.from('concept_branch_assignments').delete().eq('concept_id', editingConcept.id);
        if (formData.selected_branches.length > 0) {
          const toInsert = formData.selected_branches.map(bId => ({
            concept_id: editingConcept.id,
            branch_id: bId,
            enabled: true
          }));
          await supabase.from('concept_branch_assignments').insert(toInsert);
        }

        setSuccessMsg(`Concept ${formData.name} updated successfully.`);
      } else {
        // Create brand concept
        const { data: newConcept, error } = await supabase
          .from('business_concepts')
          .insert([{
            code: cleanCode,
            name: formData.name.trim(),
            legal_entity_name: 'B.R.I.M.E. S.A.L.',
            mof_tax_number: '3870852',
            concept_type: formData.concept_type,
            status: formData.status, // Enforces INACTIVE on creation
            primary_color: formData.primary_color,
            secondary_color: formData.secondary_color,
            receipt_prefix: cleanPrefix,
            metadata
          }])
          .select()
          .single();

        if (error) {
          if (error.message.includes('schema cache') || (error as any).code === 'PGRST205') {
            saveToLocalSandbox();
            return;
          }
          throw error;
        }

        if (newConcept && formData.selected_branches.length > 0) {
          const toInsert = formData.selected_branches.map(bId => ({
            concept_id: newConcept.id,
            branch_id: bId,
            enabled: true
          }));
          await supabase.from('concept_branch_assignments').insert(toInsert);
        }

        setSuccessMsg(`Concept ${formData.name} created. (Status: ${formData.status} — pending activation).`);
      }

      // Synchronize Relational Channel Agreements in Staging (Phase 8 Multi-Concept Financials)
      const targetConceptId = editingConcept?.id || newConcept?.id;
      if (targetConceptId) {
        try {
          const agreementRows = [
            {
              concept_id: targetConceptId,
              channel: 'toters',
              commission_pct: Number(formData.toters_commission_pct) || 0,
              merchant_promo_pct: 0,
              marketplace_promo_pct: 0,
              delivery_fee_default: 0,
              receivable_account_code: '1140-TOTERS',
              is_active: true
            },
            {
              concept_id: targetConceptId,
              channel: 'noknok',
              commission_pct: Number(formData.noknok_commission_pct) || 0,
              merchant_promo_pct: 0,
              marketplace_promo_pct: 0,
              delivery_fee_default: 0,
              receivable_account_code: '1140-NOKNOK',
              is_active: true
            },
            {
              concept_id: targetConceptId,
              channel: 'whatsapp',
              commission_pct: 0,
              merchant_promo_pct: Number(formData.whatsapp_promo_pct) || 0,
              marketplace_promo_pct: 0,
              delivery_fee_default: 3.00,
              receivable_account_code: '1110-CASH',
              is_active: true
            },
            {
              concept_id: targetConceptId,
              channel: 'pos_pickup',
              commission_pct: 0,
              merchant_promo_pct: Number(formData.pickup_discount_pct) || 0,
              marketplace_promo_pct: 0,
              delivery_fee_default: 0,
              receivable_account_code: '1110-CASH',
              is_active: true
            },
            {
              concept_id: targetConceptId,
              channel: 'app',
              commission_pct: 0,
              merchant_promo_pct: 0,
              marketplace_promo_pct: 0,
              delivery_fee_default: 2.00,
              receivable_account_code: '1110-CASH',
              is_active: true
            }
          ];
          await supabase.from('concept_channel_agreements').upsert(agreementRows, { onConflict: 'concept_id,channel' });
        } catch (e) {
          console.warn('[ConceptManagement] Non-fatal notice: concept_channel_agreements sync deferred:', e);
        }
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.message && (err.message.includes('schema cache') || err.code === 'PGRST205')) {
        saveToLocalSandbox();
        return;
      }
      console.error('Save concept error:', err);
      setErrorMsg('Failed to save concept: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers size={22} />
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Commercial Concepts & Brands</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage multi-concept commercial identities, brand themes, POS workspaces, and fiscal invoice numbering under <strong className="text-gray-700">B.R.I.M.E. S.A.L.</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {isSuperAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition"
            >
              <Plus size={18} />
              Add Commercial Concept
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-sm">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
          <Check size={18} className="text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('concepts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === 'concepts'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Layers size={16} />
          Commercial Concepts & Brands
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('communications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === 'communications'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <MessageSquare size={16} />
          Communications & WhatsApp Senders
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-mono">
            Phase 1
          </span>
        </button>
      </div>

      {activeTab === 'concepts' ? (
        <>
          {/* Concept Architecture Notice */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-3">
        <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Enterprise Multi-Concept Architecture Rule:</span>
          <p className="text-blue-800 leading-relaxed">
            A <strong>Concept</strong> is a commercial brand (e.g., NÉO, OVRLOAD, WICKD) and is <strong>not a branch</strong>.
            Branches represent physical facilities (e.g., NÉO Badaro Central Facility). One branch can host multiple concepts with independent invoice sequences, segregated P&L attribution, and shared kitchen equipment.
          </p>
        </div>
      </div>

      {/* Schema Migration Status Banner */}
      {!isSchemaMigrated && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <span>Database Migration Gated for Production Safety</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200/70 text-amber-900 font-mono">
                PENDING_AUTHORIZATION
              </span>
            </span>
            <p className="text-amber-800 leading-relaxed">
              The canonical multi-concept database table (<code>public.business_concepts</code>) has been tested and verified in isolated staging (<code>flow_hotfix_test</code>), but is held back from live production (<code>postgres</code>) to safeguard existing operations.
              Concepts added or edited here will seamlessly save to your <strong>Local Sandbox Preview</strong>, allowing you to preview themes, prefixes, and POS workspaces without mutating live production.
            </p>
          </div>
        </div>
      )}

      {/* Concepts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {concepts.map((concept) => {
          const assignedBranchNames = (branchAssignments[concept.id] || [])
            .map(bId => branches.find(b => b.id === bId)?.name || bId)
            .filter(Boolean);

          const isActive = concept.status === 'ACTIVE';

          return (
            <div 
              key={concept.id}
              className={`bg-white rounded-2xl border ${isActive ? 'border-gray-200' : 'border-gray-300 opacity-80'} shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden`}
            >
              {/* Top Banner with Brand Primary Color */}
              <div 
                className="h-3 w-full"
                style={{ backgroundColor: concept.primary_color || '#1e5c4f' }}
              />

              <div className="p-5 flex-1 space-y-4">
                {/* Brand Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm"
                      style={{ backgroundColor: concept.primary_color || '#1e5c4f' }}
                    >
                      {concept.code.slice(0, 3)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        {concept.name}
                      </h3>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                        Code: {concept.code}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isActive 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {concept.status || 'INACTIVE'}
                  </span>
                </div>

                {/* Description & Tagline */}
                {concept.metadata?.description && (
                  <p className="text-sm text-gray-600 italic">
                    "{concept.metadata.description}"
                  </p>
                )}

                {/* Configuration Specs */}
                <div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Standard Series (POS / Aggregators):</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {concept.receipt_prefix || concept.code}-000001 (Counter: {invoiceSequences[concept.id]?.standard || 0})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">WhatsApp & App Series (-A-):</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {concept.receipt_prefix || concept.code}-A-000001 (Counter: {invoiceSequences[concept.id]?.aSeries || 0})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Concept Type:</span>
                    <span className="font-medium text-gray-800">
                      {concept.concept_type || 'RESTAURANT'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">POS Workspace:</span>
                    <span className="font-medium text-emerald-700 flex items-center gap-1">
                      <Check size={14} /> Enabled
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block mb-1">Associated Facilities:</span>
                    <div className="flex flex-wrap gap-1">
                      {assignedBranchNames.length > 0 ? (
                        assignedBranchNames.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">No branches linked</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleStatus(concept)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                    isActive 
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-100' 
                      : 'border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {isActive ? 'Deactivate' : 'Activate Concept'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenMenuModal(concept)}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm transition"
                    title="View and configure concept menu products"
                  >
                    <Utensils size={14} />
                    Menu Products
                  </button>

                  {isSuperAdmin && (
                    <button
                      onClick={() => handleOpenEditModal(concept)}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-indigo-700 hover:bg-indigo-50 shadow-sm transition"
                    >
                      <Edit2 size={14} />
                      Configure
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Channel-to-Series Configuration Table */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Channel-to-Invoice Series Authoritative Routing</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Persistent sales channels automatically map to independent sequential numbering counters per concept.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
            Two Active Series Per Concept
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">STANDARD Series (PREFIX-XXXXXX)</span>
              <span className="text-[11px] font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                Independent Counter
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Allocated to on-premise dining, counter orders, and marketplace delivery aggregators:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['DINE_IN', 'POS', 'POS_PICKUP', 'TOTERS', 'NOKNOK'].map(ch => (
                <span key={ch} className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded text-xs font-medium">
                  {ch}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-emerald-900 text-xs uppercase tracking-wider">A-SERIES (PREFIX-A-XXXXXX)</span>
              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                Shared WhatsApp & App Counter
              </span>
            </div>
            <p className="text-xs text-emerald-800 mb-3">
              Allocated to direct digital ordering channels and remote direct phone orders:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['WHATSAPP', 'DIRECT_APP', 'PHONE (Direct Remote)'].map(ch => (
                <span key={ch} className="px-2 py-0.5 bg-white text-emerald-800 border border-emerald-200 rounded text-xs font-medium">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      </>
      ) : (
        /* COMMUNICATIONS & SENDER ISOLATION TAB */
        <div className="space-y-6">
          {/* Architectural Rule Banner */}
          <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-3">
            <ShieldCheck size={20} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm">Concept-Specific Messaging & Strict Sender Isolation</span>
              <p className="text-indigo-900 leading-relaxed">
                Each brand concept operates exclusively through its dedicated, verified WhatsApp sender number.
                The messaging engine enforces strict isolation: <strong>NÉO and WICKD messages can never fall back to OVRLOAD's number</strong>.
                If a sender number is unprovisioned or disabled, automated dispatches are blocked and logged, alerting operations rather than causing customer brand confusion.
              </p>
            </div>
          </div>

          {/* Verification Log Display */}
          {verificationLog && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
              verificationLog.status === 'VERIFIED_ACTIVE'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {verificationLog.status === 'VERIFIED_ACTIVE' ? (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block">
                  Isolation Test Result for {verificationLog.conceptCode}: {verificationLog.status}
                </span>
                <p className="text-xs mt-0.5">{verificationLog.details}</p>
              </div>
            </div>
          )}

          {/* Concept Messaging Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {messagingConfigs.map((cfg) => {
              const isProvisioned = cfg.provisioning_status === 'PROVISIONED';
              const isPending = cfg.provisioning_status === 'PENDING';
              const templateKeys = Object.keys(cfg.approved_templates || {});

              return (
                <div
                  key={cfg.concept_id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Color Banner */}
                  <div
                    className="h-3 w-full"
                    style={{
                      backgroundColor:
                        cfg.concept_code === 'NEO' ? '#1e5c4f' :
                        cfg.concept_code === 'OVRLOAD' ? '#e11d48' : '#7c3aed'
                    }}
                  />

                  <div className="p-5 flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                          {cfg.display_name}
                        </h3>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                          Concept: {cfg.concept_code}
                        </span>
                      </div>

                      {/* Provisioning Status */}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                        isProvisioned
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPending
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isProvisioned ? <Check size={12} /> : isPending ? <AlertTriangle size={12} /> : <X size={12} />}
                        {cfg.provisioning_status}
                      </span>
                    </div>

                    {/* Sender Details */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          <Phone size={14} className="text-gray-400" />
                          Outgoing WhatsApp Sender:
                        </span>
                        <span className="font-mono font-bold text-gray-900">
                          {cfg.whatsapp_sender_number.startsWith('961') 
                            ? `+${cfg.whatsapp_sender_number}` 
                            : cfg.whatsapp_sender_number}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-200/60">
                        <span className="text-gray-500">Provider Gateway:</span>
                        <span className="font-semibold text-gray-800 uppercase text-[11px]">
                          Infobip WhatsApp Cloud
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-200/60">
                        <span className="text-gray-500">Automated Dispatch:</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          cfg.is_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {cfg.is_enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                    </div>

                    {/* Supported Languages */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        Supported Languages:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(cfg.supported_languages || ['en']).map((lang) => (
                          <span
                            key={lang}
                            className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 uppercase"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Approved Templates */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Approved Meta Templates ({templateKeys.length}):</span>
                      </span>
                      {templateKeys.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {templateKeys.map((k) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-100"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                          No approved templates registered yet. Messages will require carrier template sync.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleVerifySenderIsolation(cfg.concept_id, cfg.concept_code)}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm transition"
                    >
                      <ShieldCheck size={14} className="text-indigo-600" />
                      Verify Isolation
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditComm(cfg)}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
                      >
                        <Edit2 size={14} />
                        Configure
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Edit Concept Communications Configuration */}
      {isCommModalOpen && editingCommConfig && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-indigo-600" size={20} />
                <h3 className="font-bold text-lg text-gray-900">
                  Configure Communications: {editingCommConfig.display_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCommModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Brand Display Name
                </label>
                <input
                  type="text"
                  value={editingCommConfig.display_name}
                  onChange={(e) => setEditingCommConfig({ ...editingCommConfig, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  WhatsApp Outgoing Sender Number (E.164 without plus)
                </label>
                <input
                  type="text"
                  value={editingCommConfig.whatsapp_sender_number}
                  onChange={(e) => setEditingCommConfig({ ...editingCommConfig, whatsapp_sender_number: e.target.value })}
                  placeholder="e.g. 96181202607"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Must be registered and verified in your Meta WhatsApp Business Manager on Infobip.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Provisioning Status
                  </label>
                  <select
                    value={editingCommConfig.provisioning_status}
                    onChange={(e) => setEditingCommConfig({ ...editingCommConfig, provisioning_status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="PROVISIONED">PROVISIONED (Active)</option>
                    <option value="PENDING">PENDING (Carrier Review)</option>
                    <option value="UNPROVISIONED">UNPROVISIONED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Automated Messaging
                  </label>
                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingCommConfig.is_enabled}
                        onChange={(e) => setEditingCommConfig({ ...editingCommConfig, is_enabled: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Enabled</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Supported Languages (comma-separated)
                </label>
                <input
                  type="text"
                  value={(editingCommConfig.supported_languages || []).join(', ')}
                  onChange={(e) => setEditingCommConfig({
                    ...editingCommConfig,
                    supported_languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="en, ar, fr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900">
                <span className="font-bold block">Strict Brand Isolation Guarantee:</span>
                FLOW never falls back to another brand's phone number. Disabling or keeping a number unprovisioned ensures that customer messages are withheld until the dedicated line is active.
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCommModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={commSaving}
                onClick={handleSaveCommConfig}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                {commSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Concept */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Layers className="text-indigo-600" size={20} />
                <h3 className="font-bold text-lg text-gray-900">
                  {editingConcept ? `Configure Concept: ${editingConcept.name}` : 'Create Commercial Concept'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Brand Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingConcept)} // Cannot change code once created
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. OVRLOAD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">Immutable identifier</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. OVRLOAD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Brand Description & Tagline
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value, tagline: e.target.value })}
                  placeholder="e.g. loaded wraps and delivery"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Receipt / Invoice Prefix *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.receipt_prefix}
                    onChange={(e) => setFormData({ ...formData, receipt_prefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. OVR"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">Yields: {formData.receipt_prefix || 'PREFIX'}-000001</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Concept Type
                  </label>
                  <select
                    value={formData.concept_type}
                    onChange={(e) => setFormData({ ...formData, concept_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="RESTAURANT">Restaurant / Café (Table Service, Covers, Pacing)</option>
                    <option value="DELIVERY_PICKUP">Delivery & Pickup Only (Fast 5-Channel POS, No Tables)</option>
                    <option value="CLOUD_KITCHEN">Cloud Kitchen / Delivery</option>
                    <option value="VIRTUAL_BRAND">Virtual Brand</option>
                    <option value="RETAIL">Retail / Bakery</option>
                    <option value="BAR">Bar / Lounge</option>
                  </select>
                </div>
              </div>

              {/* Channel Commercial Terms & Marketplace Agreements */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                    <Building2 size={16} className="text-emerald-700" />
                    Channel Commercial Terms & Marketplace Agreements
                  </h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    Independent Terms per Brand
                  </span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Marketplace commission is an operating expense/receivable deduction retained by the aggregator upon remittance. It is <strong>never charged or deducted as a discount on the customer's sales invoice</strong>.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Toters Commission %</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.toters_commission_pct}
                      onChange={(e) => setFormData({ ...formData, toters_commission_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white"
                      placeholder="e.g. 15.0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">NokNok Commission %</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.noknok_commission_pct}
                      onChange={(e) => setFormData({ ...formData, noknok_commission_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white"
                      placeholder="e.g. 15.0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">WhatsApp Customer Promo %</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.whatsapp_promo_pct}
                      onChange={(e) => setFormData({ ...formData, whatsapp_promo_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white"
                      placeholder="e.g. 0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Pickup Customer Disc %</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.pickup_discount_pct}
                      onChange={(e) => setFormData({ ...formData, pickup_discount_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white"
                      placeholder="e.g. 0.0"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Identity & Theming */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <Palette size={16} className="text-indigo-600" />
                  Visual Identity & POS Theming
                </h4>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Primary Theme Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Theme Preview</label>
                    <div 
                      className="h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      {formData.name || 'Brand Preview'} (Active)
                    </div>
                  </div>
                </div>
              </div>

              {/* Associated Facilities */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Operating Facilities (Branch Assignments)
                </label>
                <div className="space-y-2 border border-gray-200 rounded-xl p-3 bg-white">
                  {branches.map(branch => {
                    const isChecked = formData.selected_branches.includes(branch.id);
                    return (
                      <label key={branch.id} className="flex items-center gap-3 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, selected_branches: [...formData.selected_branches, branch.id] });
                            } else {
                              setFormData({ ...formData, selected_branches: formData.selected_branches.filter(id => id !== branch.id) });
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="font-medium text-gray-800">{branch.name}</span>
                        <span className="text-xs text-gray-400 font-mono">({branch.id.slice(0, 8)}...)</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Activation Status Safety Guard */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>Safety Gate:</strong> New concepts are saved in <code>INACTIVE</code> status by default to prevent premature operational activity prior to physical hardware routing validation.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingConcept ? 'Update Concept' : 'Create Concept')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Concept Menu Products & Categories */}
      {isMenuModalOpen && menuConcept && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  style={{ backgroundColor: menuConcept.primary_color || '#1e5c4f' }}
                >
                  {menuConcept.code.slice(0, 3)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    {menuConcept.name} — Menu & Products
                  </h3>
                  <p className="text-xs text-gray-500">
                    Dedicated commercial catalog for POS workspace ({menuConcept.code})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddProductForm(!showAddProductForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition"
                >
                  <Plus size={16} />
                  {showAddProductForm ? 'Close Form' : 'Add Product'}
                </button>
                <button 
                  onClick={() => setIsMenuModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Subheader / Category Tabs */}
            <div className="px-6 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setActiveMenuCategory('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    activeMenuCategory === 'All'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  All Items ({menuProducts.length})
                </button>
                {menuCategories.map(cat => {
                  const count = menuProducts.filter(p => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveMenuCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                        activeMenuCategory === cat
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="shrink-0">
                {showAddCategoryForm ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Category name..."
                      className="px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleAddCategory}
                      className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowAddCategoryForm(false)}
                      className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddCategoryForm(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-100 rounded-md transition"
                  >
                    <Plus size={14} /> Add Category
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {menuLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
                  <RefreshCw className="animate-spin text-emerald-600" size={32} />
                  <p className="text-sm font-medium">Loading live menu products from database...</p>
                </div>
              ) : (
                <>
                  {/* Search and Filter Summary Bar */}
                  <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 flex-1">
                      <Search size={16} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={menuSearchQuery}
                        onChange={(e) => setMenuSearchQuery(e.target.value)}
                        placeholder={`Search across ${menuProducts.length} items (e.g. coffee, burger, wrap, salad)...`}
                        className="w-full text-xs outline-none bg-transparent"
                      />
                      {menuSearchQuery && (
                        <button onClick={() => setMenuSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-medium shrink-0">
                      Showing {
                        menuProducts.filter(p => {
                          const matchesCat = activeMenuCategory === 'All' || p.category === activeMenuCategory;
                          const matchesSearch = !menuSearchQuery.trim() || 
                            (p.name && p.name.toLowerCase().includes(menuSearchQuery.toLowerCase())) ||
                            (p.description && p.description.toLowerCase().includes(menuSearchQuery.toLowerCase()));
                          return matchesCat && matchesSearch;
                        }).length
                      } of {menuProducts.length} items
                    </span>
                  </div>

                  {/* Add Product Form Collapse */}
                  {showAddProductForm && (
                    <form onSubmit={handleAddProduct} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                        <span className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                          <Plus size={16} /> New Menu Item
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddProductForm(false)}
                          className="text-emerald-700 hover:text-emerald-900 text-xs"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                            Product / Dish Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={newProdName}
                            onChange={(e) => setNewProdName(e.target.value)}
                            placeholder="e.g. Double Truffle Beef Wrap"
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                            Price ($ USD) *
                          </label>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            required
                            value={newProdPrice}
                            onChange={(e) => setNewProdPrice(e.target.value)}
                            placeholder="e.g. 8.50"
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                            Menu Category *
                          </label>
                          <select
                            value={newProdCat}
                            onChange={(e) => setNewProdCat(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                          >
                            {menuCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                            Description / Ingredients
                          </label>
                          <input
                            type="text"
                            value={newProdDesc}
                            onChange={(e) => setNewProdDesc(e.target.value)}
                            placeholder="e.g. 100% Angus smash beef, truffle aioli, melted swiss cheese."
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm"
                        >
                          Save Menu Product
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Products List */}
                  <div className="space-y-2">
                    {menuProducts
                      .filter(p => {
                        const matchesCat = activeMenuCategory === 'All' || p.category === activeMenuCategory;
                        const matchesSearch = !menuSearchQuery.trim() || 
                          (p.name && p.name.toLowerCase().includes(menuSearchQuery.toLowerCase())) ||
                          (p.description && p.description.toLowerCase().includes(menuSearchQuery.toLowerCase()));
                        return matchesCat && matchesSearch;
                      })
                      .map(product => (
                        <div 
                          key={product.id}
                          className="p-3.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition flex items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-gray-900">{product.name}</h4>
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">
                                {product.category}
                              </span>
                            </div>
                            {product.description && (
                              <p className="text-xs text-gray-500 line-clamp-1">{product.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              ${Number(product.price).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                              title="Delete item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}

                    {menuProducts.filter(p => {
                      const matchesCat = activeMenuCategory === 'All' || p.category === activeMenuCategory;
                      const matchesSearch = !menuSearchQuery.trim() || 
                        (p.name && p.name.toLowerCase().includes(menuSearchQuery.toLowerCase())) ||
                        (p.description && p.description.toLowerCase().includes(menuSearchQuery.toLowerCase()));
                      return matchesCat && matchesSearch;
                    }).length === 0 && (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        No products match your search or selected category.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 shrink-0">
              <span>Items are linked to <strong>{menuConcept.name}</strong> and isolated from other brands.</span>
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
