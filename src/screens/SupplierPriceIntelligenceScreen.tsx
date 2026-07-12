import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { supabase } from '../api/supabase';
import { 
  TrendingUp, BarChart2, Star, Sliders, DollarSign, Upload, MessageSquare, 
  AlertCircle, RefreshCw, FileText, Check, X, ShieldAlert, Award, 
  ArrowUpRight, Cpu, Sparkles, Scale, Percent, CheckCircle, Search
} from 'lucide-react';

// Interfaces for strict typing
interface CatalogItem {
  id: string;
  name: string;
  price_usd: number;
  unit: string;
  department?: string;
  supplier_id?: string;
  vat?: 'yes' | 'no';
}

interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  delivery_days?: string;
  time_to_deliver?: string;
  payment_terms?: string;
}

interface PurchasingRequest {
  id: string;
  purchasing_id: string;
  status: string;
  created_at: string;
  date_received?: string;
  updated_at: string;
}

interface PurchasingRequestItem {
  id: string;
  purchasing_request_id: string;
  item_name: string;
  qty_ordered: number;
  qty_received: number;
  unit: string;
}

interface Quotation {
  id: string;
  supplier_id: string;
  supplier_name: string;
  item_name: string;
  flow_item_id: string | null;
  unit: string;
  price_usd: number;
  moq?: number;
  effective_date?: string;
  expiry_date?: string;
  is_approved?: boolean;
  conversion_factor?: number;
}

interface Evaluation {
  id: string;
  supplier_id: string;
  evaluator_name?: string;
  quality: number;
  freshness: number;
  packaging: number;
  spec_compliance: number;
  delivery: number;
  communication: number;
  service: number;
  replacement_handling: number;
  notes?: string;
}

interface Mapping {
  id: string;
  supplier_id: string;
  supplier_item_desc: string;
  flow_item_id: string | null;
  is_approved: boolean;
  confidence_score: number;
}

interface Weights {
  price: number;
  quality: number;
  reliability: number;
  payment_terms: number;
  delivery: number;
  service: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface OcrQuotation {
  id: string;
  supplier_id: string;
  supplier_item_desc: string;
  flow_item_id: string;
  unit: string;
  price_usd: number;
  moq: number;
  is_approved: boolean;
  conversion_factor?: number;
}

// Default Weights
const DEFAULT_WEIGHTS: Weights = {
  price: 0.40,
  quality: 0.25,
  reliability: 0.15,
  payment_terms: 0.10,
  delivery: 0.05,
  service: 0.05
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SupplierPriceIntelligenceScreen({ user }: { user?: any }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'suppliers' | 'comparator' | 'import' | 'assistant' | 'config'>('overview');
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Core database tables
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchasingRequests, setPurchasingRequests] = useState<PurchasingRequest[]>([]);
  const [purchasingRequestItems, setPurchasingRequestItems] = useState<PurchasingRequestItem[]>([]);
  
  // Custom price intelligence tables (or fallbacks)
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [configWeights, setConfigWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    if (user) {
      console.log('Supplier Price Intelligence initialized for user:', user.name);
    }
  }, [user]);

  // Selected items for charts and compare tools
  const [selectedTrendItem, setSelectedTrendItem] = useState<string>('');
  const [selectedCompareItem, setSelectedCompareItem] = useState<string>('');
  const [compareQty, setCompareQty] = useState<number>(10);

  const [isVatSubscribed, setIsVatSubscribed] = useState<boolean>(true);
  const [vatRate, setVatRate] = useState<number>(11);

  const [showAllItemsInManualQuote, setShowAllItemsInManualQuote] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [quickSupForm, setQuickSupForm] = useState({
    name: '',
    contact_name: '',
    phone: '',
    time_to_deliver: 'Next day',
    payment_terms: 'Net 15'
  });
  const [csvSupplierId, setCsvSupplierId] = useState('');
  const [ocrSupplierId, setOcrSupplierId] = useState('');

  // AI Assistant Chat state - Initialized purely using lazy initializer
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'assistant',
      content: 'Hello! I am your Flow AI Procurement Assistant. I analyze your historical purchasing logs, supplier performance, and active quotations to help you minimize costs and maximize reliability. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Manual Quotation Form - Initialized purely using lazy initializer
  const [quoteForm, setQuoteForm] = useState(() => ({
    supplier_id: '',
    item_name: '',
    flow_item_id: '',
    unit: 'Kg',
    price_usd: '',
    moq: '1',
    effective_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    conversion_factor: '1',
    vat: 'no' as 'yes' | 'no'
  }));

  // Trends tab search and department filter
  const [trendsSearch, setTrendsSearch] = useState('');
  const [trendsDept, setTrendsDept] = useState('All');

  const departments = useMemo(() => {
    const depts = new Set<string>();
    catalogItems.forEach((item: CatalogItem) => {
      if (item.department) depts.add(item.department);
    });
    return ['All', ...Array.from(depts)];
  }, [catalogItems]);

  const filteredTrendItems = useMemo(() => {
    return catalogItems.filter((item: CatalogItem) => {
      const matchesSearch = item.name.toLowerCase().includes(trendsSearch.toLowerCase());
      const matchesDept = trendsDept === 'All' || item.department === trendsDept;
      return matchesSearch && matchesDept;
    });
  }, [catalogItems, trendsSearch, trendsDept]);

  useEffect(() => {
    if (activeTab === 'trends' && filteredTrendItems.length > 0) {
      const exists = filteredTrendItems.some((item: CatalogItem) => item.name === selectedTrendItem);
      if (!exists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedTrendItem(filteredTrendItems[0].name);
      }
    }
  }, [filteredTrendItems, selectedTrendItem, activeTab]);

  // Manual Evaluation Form
  const [evalForm, setEvalForm] = useState({
    supplier_id: '',
    quality: 5,
    freshness: 5,
    packaging: 5,
    spec_compliance: 5,
    delivery: 5,
    communication: 5,
    service: 5,
    replacement_handling: 5,
    notes: ''
  });

  // OCR/Import simulation state
  const [importStatus, setImportStatus] = useState<'idle' | 'scanning' | 'mapped'>('idle');
  const [ocrText, setOcrText] = useState('');
  const [detectedQuotes, setDetectedQuotes] = useState<OcrQuotation[]>([]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadFallbackData = useCallback((suppliersList: Supplier[], itemsList: CatalogItem[]) => {
    const mockQuotes: Quotation[] = [];
    const mockEvals: Evaluation[] = [];
    const mockMappings: Mapping[] = [];

    const activeSuppliers = suppliersList.length > 0 ? suppliersList : [
      { id: 'sup-1', name: 'Al Kayan Distributors', contact_name: 'Imad', phone: '+961 3 123456', delivery_days: 'Monday, Wednesday, Friday', time_to_deliver: 'Next day', payment_terms: 'Net 15' },
      { id: 'sup-2', name: 'Fresh Farms Beqaa', contact_name: 'Sami', phone: '+961 8 654321', delivery_days: 'Tuesday, Thursday', time_to_deliver: '2 days', payment_terms: 'Net 15' },
      { id: 'sup-3', name: 'Safi Dairy & Cheese Co.', contact_name: 'Fady', phone: '+961 1 987654', delivery_days: 'Daily', time_to_deliver: 'Same day', payment_terms: 'Net 30' },
      { id: 'sup-4', name: 'Metico Supply House', contact_name: 'Nadim', phone: '+961 4 456789', delivery_days: 'Wednesday', time_to_deliver: '3 days', payment_terms: 'Net 30' }
    ];
    
    if (suppliersList.length === 0) setSuppliers(activeSuppliers);

    const activeItems = itemsList.length > 0 ? itemsList : [
      { id: 'item-1', name: 'Cacao 5kg', price_usd: 45.0, unit: 'Pack', department: 'Kitchen', supplier_id: activeSuppliers[0].id },
      { id: 'item-2', name: 'Coarse Ground Beef', price_usd: 12.5, unit: 'Kg', department: 'Kitchen', supplier_id: activeSuppliers[1].id },
      { id: 'item-3', name: 'Cheddar 2.5kg', price_usd: 22.0, unit: 'Pack', department: 'Kitchen', supplier_id: activeSuppliers[2].id },
      { id: 'item-4', name: 'Almond Extract', price_usd: 8.0, unit: 'Litre', department: 'Kitchen', supplier_id: activeSuppliers[0].id },
      { id: 'item-5', name: 'Anchovies', price_usd: 15.0, unit: 'Jar', department: 'Kitchen', supplier_id: activeSuppliers[3].id }
    ];
    if (itemsList.length === 0) setCatalogItems(activeItems);

    activeItems.forEach(item => {
      const primarySup = activeSuppliers.find(s => s.id === item.supplier_id) || activeSuppliers[0];
      mockQuotes.push({
        id: `q-p-${item.id}`,
        supplier_id: primarySup.id,
        supplier_name: primarySup.name,
        item_name: `${item.name} (Primary)`,
        flow_item_id: item.id,
        unit: item.unit,
        price_usd: item.price_usd,
        moq: 1,
        effective_date: '2026-01-01',
        expiry_date: '2026-12-31',
        is_approved: true
      });

      const altSups = activeSuppliers.filter(s => s.id !== primarySup.id);
      altSups.forEach((sup, idx) => {
        const factor = 0.85 + (idx * 0.1) + (Math.sin(item.name.length) * 0.05);
        let quoteUnit = item.unit;
        let finalPrice = item.price_usd * factor;
        
        if (item.name === 'Cacao 5kg' && idx === 0) {
          quoteUnit = 'Gram';
          finalPrice = (item.price_usd / 5000) * factor * 1.05;
        }

        mockQuotes.push({
          id: `q-a-${item.id}-${sup.id}`,
          supplier_id: sup.id,
          supplier_name: sup.name,
          item_name: `${item.name} - alternative supply`,
          flow_item_id: item.id,
          unit: quoteUnit,
          price_usd: Number(finalPrice.toFixed(4)),
          moq: idx === 1 ? 5 : 1,
          effective_date: '2026-02-15',
          expiry_date: '2026-11-30',
          is_approved: true
        });
      });
    });

    activeSuppliers.forEach(sup => {
      const q = sup.name.includes('Fresh Farms') ? 5 : (sup.name.includes('Safi Dairy') ? 4 : (sup.name.includes('Al Kayan') ? 4 : 3));
      const f = sup.name.includes('Fresh Farms') ? 5 : (sup.name.includes('Safi Dairy') ? 4 : (sup.name.includes('Al Kayan') ? 4 : 3));
      const p = sup.name.includes('Fresh Farms') ? 3 : (sup.name.includes('Safi Dairy') ? 4 : (sup.name.includes('Al Kayan') ? 5 : 3));
      const s = sup.name.includes('Fresh Farms') ? 4 : (sup.name.includes('Safi Dairy') ? 5 : (sup.name.includes('Al Kayan') ? 3 : 3));
      const d = sup.name.includes('Fresh Farms') ? 4 : (sup.name.includes('Safi Dairy') ? 5 : (sup.name.includes('Al Kayan') ? 4 : 3));
      const c = sup.name.includes('Fresh Farms') ? 4 : (sup.name.includes('Safi Dairy') ? 5 : (sup.name.includes('Al Kayan') ? 3 : 3));
      const r = sup.name.includes('Fresh Farms') ? 3 : (sup.name.includes('Safi Dairy') ? 5 : (sup.name.includes('Al Kayan') ? 3 : 3));

      mockEvals.push({
        id: `eval-${sup.id}`,
        supplier_id: sup.id,
        evaluator_name: 'System Admin',
        quality: q,
        freshness: f,
        packaging: p,
        spec_compliance: q,
        delivery: d,
        communication: c,
        service: s,
        replacement_handling: r,
        notes: `Automated baseline rating initialized for ${sup.name}.`
      });
    });

    mockMappings.push(
      { id: 'm-1', supplier_id: activeSuppliers[0].id, supplier_item_desc: 'BECCA CACAO 5KG BAG', flow_item_id: activeItems[0].id, is_approved: true, confidence_score: 0.94 },
      { id: 'm-2', supplier_id: activeSuppliers[1].id, supplier_item_desc: 'BEEF ROUND COARSE GRND KG', flow_item_id: activeItems[1].id, is_approved: true, confidence_score: 0.98 },
      { id: 'm-3', supplier_id: activeSuppliers[2].id, supplier_item_desc: 'SHRED CHEDDAR 2.5KG BOX', flow_item_id: activeItems[2].id, is_approved: false, confidence_score: 0.81 }
    );

    setQuotations(mockQuotes);
    setEvaluations(mockEvals);
    setMappings(mockMappings);
    setConfigWeights(DEFAULT_WEIGHTS);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const itemsRes = await api.getPurchasingItems();
      const suppliersRes = await api.getSuppliers();
      const requestsRes = await api.getPurchasingRequests();
      const reqItemsRes = await api.getAllPurchasingRequestItems();
      const vatRateRes = await api.getVatRate();

      const itemsList: CatalogItem[] = (itemsRes.success && itemsRes.data) ? (itemsRes.data as CatalogItem[]) : [];
      const suppliersList: Supplier[] = (suppliersRes.success && suppliersRes.data) ? (suppliersRes.data as Supplier[]) : [];

      setCatalogItems(itemsList);
      setSuppliers(suppliersList);
      setPurchasingRequests((requestsRes.success && requestsRes.data) ? (requestsRes.data as PurchasingRequest[]) : []);
      setPurchasingRequestItems((reqItemsRes.success && reqItemsRes.data) ? (reqItemsRes.data as PurchasingRequestItem[]) : []);

      if (vatRateRes.success && vatRateRes.rate !== undefined) {
        setVatRate(vatRateRes.rate);
      }

      if (user?.restaurant_id) {
        const restRes = await api.getRestaurantById(user.restaurant_id);
        if (restRes.success && restRes.data) {
          const settings = restRes.data.settings || {};
          setIsVatSubscribed(settings.is_vat_subscribed !== false);
        }
      } else if (user?.restaurants?.settings) {
        setIsVatSubscribed(user.restaurants.settings.is_vat_subscribed !== false);
      }

      if (itemsList.length > 0) {
        setSelectedTrendItem(itemsList[0].name);
        setSelectedCompareItem(itemsList[0].id);
      }

      const { error: quoteCheckError } = await supabase.from('supplier_quotations').select('id').limit(1);
      
      if (quoteCheckError && quoteCheckError.message.includes('does not exist')) {
        setDbStatus('missing');
        loadFallbackData(suppliersList, itemsList);
      } else {
        setDbStatus('ready');
        const qRes = await api.getSupplierQuotations();
        const eRes = await api.getSupplierEvaluations();
        const cRes = await api.getSupplierIntelligenceConfig();
        const mRes = await api.getItemDescriptionMappings();

        setQuotations((qRes.success && qRes.data) ? (qRes.data as Quotation[]) : []);
        setEvaluations((eRes.success && eRes.data) ? (eRes.data as Evaluation[]) : []);
        setMappings((mRes.success && mRes.data) ? (mRes.data as Mapping[]) : []);
        if (cRes.success && cRes.data) {
          setConfigWeights(cRes.data);
        } else {
          setConfigWeights(DEFAULT_WEIGHTS);
        }
      }
    } catch (e) {
      console.error('Error loading data:', e);
      setDbStatus('missing');
      loadFallbackData([], []);
    }
    setLoading(false);
  }, [loadFallbackData, user]);

  // useEffect hook positioned after useCallback initialization of dependencies
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAllData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAllData]);

  const handleCopySql = () => {
    const sqlText = `-- Supplier Price Intelligence Database Migrations
CREATE TABLE IF NOT EXISTS public.supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  flow_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  unit TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  effective_date TIMESTAMPTZ DEFAULT now(),
  expiry_date TIMESTAMPTZ,
  moq NUMERIC DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  conversion_factor NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure conversion_factor column exists in case table was created earlier
ALTER TABLE public.supplier_quotations ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  evaluator_name TEXT,
  quality INT CHECK (quality >= 1 AND quality <= 5),
  freshness INT CHECK (freshness >= 1 AND freshness <= 5),
  packaging INT CHECK (packaging >= 1 AND packaging <= 5),
  spec_compliance INT CHECK (spec_compliance >= 1 AND spec_compliance <= 5),
  delivery INT CHECK (delivery >= 1 AND delivery <= 5),
  communication INT CHECK (communication >= 1 AND communication <= 5),
  service INT CHECK (service >= 1 AND service <= 5),
  replacement_handling INT CHECK (replacement_handling >= 1 AND replacement_handling <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_intelligence_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_weight NUMERIC DEFAULT 0.40,
  quality_weight NUMERIC DEFAULT 0.25,
  reliability_weight NUMERIC DEFAULT 0.15,
  payment_terms_weight NUMERIC DEFAULT 0.10,
  delivery_weight NUMERIC DEFAULT 0.05,
  service_weight NUMERIC DEFAULT 0.05,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.item_description_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_item_desc TEXT NOT NULL,
  flow_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT false,
  confidence_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_description_mappings ENABLE ROW LEVEL SECURITY;

-- Enable Public Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.supplier_quotations FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.supplier_quotations FOR ALL USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.supplier_evaluations FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.supplier_evaluations FOR ALL USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.supplier_intelligence_config FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.supplier_intelligence_config FOR ALL USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.item_description_mappings FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.item_description_mappings FOR ALL USING (true);`;

    navigator.clipboard.writeText(sqlText);
    showToast('SQL script copied to clipboard!');
  };

  // Helper conversion logic
  const getNormalizedDetails = (
    price: number,
    quoteUnit: string,
    targetUnit: string,
    conversionFactor?: number,
    isVatApplicable?: boolean
  ) => {
    let basePrice = price;
    if (!isVatSubscribed && isVatApplicable) {
      basePrice = price * (1 + vatRate / 100);
    }
    if (conversionFactor && conversionFactor > 0) {
      basePrice = basePrice / conversionFactor;
    }
    const qUnit = quoteUnit.toLowerCase().trim();
    const tUnit = targetUnit.toLowerCase().trim();

    if (qUnit === tUnit) return { price: basePrice, multiplier: 1 };

    if ((qUnit === 'g' || qUnit === 'gram' || qUnit === 'grams') && (tUnit === 'kg')) {
      return { price: basePrice * 1000, multiplier: 1000 };
    }
    if ((qUnit === 'kg') && (tUnit === 'g' || tUnit === 'gram' || tUnit === 'grams')) {
      return { price: basePrice / 1000, multiplier: 0.001 };
    }
    if ((qUnit === 'ml') && (tUnit === 'litre' || tUnit === 'liter' || tUnit === 'l')) {
      return { price: basePrice * 1000, multiplier: 1000 };
    }
    if ((qUnit === 'litre' || qUnit === 'liter' || qUnit === 'l') && (tUnit === 'ml')) {
      return { price: basePrice / 1000, multiplier: 0.001 };
    }

    const packMatch = qUnit.match(/(?:pack|box|carton|bag|case)\s*(?:of)?\s*(\d+)/i);
    if (packMatch) {
      const size = parseInt(packMatch[1]);
      if (size > 0) return { price: basePrice / size, multiplier: 1 / size };
    }

    return { price: basePrice, multiplier: 1, unnormalizable: true };
  };

  // ----------------------------------------------------
  // CALCULATIONS ON HISTORICAL ERP DATA
  // ----------------------------------------------------

  const calculateSupplierHistory = (supplierId: string) => {
    const orders = purchasingRequests.filter(r => {
      const reqItems = purchasingRequestItems.filter(ri => ri.purchasing_request_id === r.id);
      const firstItem = reqItems[0];
      if (!firstItem) return false;
      const catalogItem = catalogItems.find(ci => ci.name === firstItem.item_name);
      return catalogItem && catalogItem.supplier_id === supplierId;
    });

    if (orders.length === 0) {
      return { fillRate: 95.0, onTimeRate: 92.0, avgLeadDays: 1.5, spend: 0, orderCount: 0 };
    }

    let totalOrdered = 0;
    let totalReceived = 0;
    let onTimeCount = 0;
    let totalSpend = 0;
    let receivedCount = 0;

    const supplier = suppliers.find(s => s.id === supplierId);
    let leadTimePromised = 1; 
    if (supplier?.time_to_deliver) {
      const days = parseInt(supplier.time_to_deliver);
      if (!isNaN(days)) leadTimePromised = days;
    }

    orders.forEach(ord => {
      const reqItems = purchasingRequestItems.filter(ri => ri.purchasing_request_id === ord.id);
      reqItems.forEach(item => {
        totalOrdered += item.qty_ordered || 0;
        totalReceived += item.qty_received || 0;

        const catalogItem = catalogItems.find(ci => ci.name === item.item_name);
        if (catalogItem) {
          totalSpend += (item.qty_received || 0) * (catalogItem.price_usd || 0);
        }
      });

      if (ord.status === 'Received') {
        receivedCount++;
        const orderDate = new Date(ord.created_at);
        const recvDate = new Date(ord.date_received || ord.updated_at);
        const diffTime = Math.abs(recvDate.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= leadTimePromised) {
          onTimeCount++;
        }
      }
    });

    const fillRate = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 95.0;
    const onTimeRate = receivedCount > 0 ? (onTimeCount / receivedCount) * 100 : 92.0;

    return {
      fillRate: Number(fillRate.toFixed(1)),
      onTimeRate: Number(onTimeRate.toFixed(1)),
      avgLeadDays: leadTimePromised,
      spend: Number(totalSpend.toFixed(2)),
      orderCount: orders.length
    };
  };

  const calculatePricingScore = (supplierId: string) => {
    const supQuotes = quotations.filter(q => q.supplier_id === supplierId && q.flow_item_id);
    if (supQuotes.length === 0) return 80;

    let totalScore = 0;
    let counted = 0;

    supQuotes.forEach(q => {
      const targetItem = catalogItems.find(ci => ci.id === q.flow_item_id);
      if (!targetItem) return;

      const itemQuotes = quotations.filter(iq => iq.flow_item_id === targetItem.id);
      const normalizedQuotes = itemQuotes.map(iq => {
        const norm = getNormalizedDetails(iq.price_usd, iq.unit, targetItem.unit, iq.conversion_factor, targetItem.vat === 'yes');
        return norm.price;
      });
      const minPrice = Math.min(...normalizedQuotes);

      const normalizedQuote = getNormalizedDetails(q.price_usd, q.unit, targetItem.unit, q.conversion_factor, targetItem.vat === 'yes');
      if (normalizedQuote.price > 0) {
        const score = (minPrice / normalizedQuote.price) * 100;
        totalScore += score;
        counted++;
      }
    });

    return counted > 0 ? Number((totalScore / counted).toFixed(1)) : 80;
  };

  const getSupplierEvalAverage = (supplierId: string) => {
    const ev = evaluations.find(e => e.supplier_id === supplierId);
    if (!ev) return { quality: 4.0, freshness: 4.0, service: 4.0, overall: 4.0 };

    const qualAvg = (ev.quality + ev.freshness + ev.packaging + ev.spec_compliance) / 4;
    const servAvg = (ev.communication + ev.service + ev.replacement_handling) / 3;
    const overall = (qualAvg + servAvg + ev.delivery) / 3;

    return {
      quality: Number(qualAvg.toFixed(1)),
      freshness: ev.freshness,
      service: Number(servAvg.toFixed(1)),
      overall: Number(overall.toFixed(1))
    };
  };

  const calculateBestValueScore = (supplierId: string, itemId: string) => {
    const item = catalogItems.find(ci => ci.id === itemId);
    if (!item) return 0;

    const quote = quotations.find(q => q.supplier_id === supplierId && q.flow_item_id === itemId);
    if (!quote) return 0;

    const allItemQuotes = quotations.filter(q => q.flow_item_id === itemId);
    const normalizedItemQuotes = allItemQuotes.map(iq => {
      const norm = getNormalizedDetails(iq.price_usd, iq.unit, item.unit, iq.conversion_factor, item.vat === 'yes');
      return norm.price;
    });
    const minPrice = Math.min(...normalizedItemQuotes);

    const normQuote = getNormalizedDetails(quote.price_usd, quote.unit, item.unit, quote.conversion_factor, item.vat === 'yes');
    const priceScore = normQuote.price > 0 ? (minPrice / normQuote.price) * 100 : 0;

    const evals = getSupplierEvalAverage(supplierId);
    const qualityScore = evals.quality * 20;

    const history = calculateSupplierHistory(supplierId);
    const reliabilityScore = (history.fillRate + 95) / 2;

    const supplier = suppliers.find(s => s.id === supplierId);
    let payTermsScore = 50;
    if (supplier?.payment_terms) {
      const pt = supplier.payment_terms.toLowerCase();
      if (pt.includes('30')) payTermsScore = 100;
      else if (pt.includes('15')) payTermsScore = 80;
      else if (pt.includes('10')) payTermsScore = 70;
      else if (pt.includes('cod') || pt.includes('cash')) payTermsScore = 30;
    }

    const deliveryScore = history.onTimeRate;
    const serviceScore = evals.service * 20;

    const w = configWeights;
    const finalScore = 
      (priceScore * w.price) + 
      (qualityScore * w.quality) + 
      (reliabilityScore * w.reliability) + 
      (payTermsScore * w.payment_terms) + 
      (deliveryScore * w.delivery) + 
      (serviceScore * w.service);

    return Number(finalScore.toFixed(1));
  };

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.supplier_id || !quoteForm.item_name || !quoteForm.price_usd) {
      alert('Supplier, Item name and Price are required.');
      return;
    }

    const conversionFactorVal = parseFloat(quoteForm.conversion_factor) || 1;
 
    const payload = {
      supplier_id: quoteForm.supplier_id,
      item_name: quoteForm.item_name,
      flow_item_id: quoteForm.flow_item_id || null,
      unit: quoteForm.unit,
      price_usd: parseFloat(quoteForm.price_usd),
      moq: parseFloat(quoteForm.moq) || 1,
      effective_date: quoteForm.effective_date,
      expiry_date: quoteForm.expiry_date,
      conversion_factor: conversionFactorVal
    };

    if (dbStatus === 'ready') {
      // Update catalog item's VAT status in database if it changed
      if (quoteForm.flow_item_id) {
        const selectedCatalogItem = catalogItems.find(ci => ci.id === quoteForm.flow_item_id);
        if (selectedCatalogItem && selectedCatalogItem.vat !== quoteForm.vat) {
          await api.savePurchasingItem({
            ...selectedCatalogItem,
            vat: quoteForm.vat
          });
        }
      }

      const res = await api.saveSupplierQuotation(payload);
      if (res.success) {
        showToast('Quotation saved successfully!');
        loadAllData();
      } else {
        alert(res.error || 'Failed to save quotation');
      }
    } else {
      // Mock update local state item VAT status
      if (quoteForm.flow_item_id) {
        const updatedCatalog = catalogItems.map(ci => {
          if (ci.id === quoteForm.flow_item_id) {
            return { ...ci, vat: quoteForm.vat };
          }
          return ci;
        });
        setCatalogItems(updatedCatalog);
      }

      const updated = [...quotations];
      const selectedSup = suppliers.find(s => s.id === quoteForm.supplier_id);
      const newQuote = {
        id: `q-mem-${Date.now()}`,
        supplier_id: quoteForm.supplier_id,
        supplier_name: selectedSup?.name || 'Unknown Supplier',
        item_name: quoteForm.item_name,
        flow_item_id: quoteForm.flow_item_id || null,
        unit: quoteForm.unit,
        price_usd: parseFloat(quoteForm.price_usd),
        moq: parseFloat(quoteForm.moq) || 1,
        effective_date: quoteForm.effective_date,
        expiry_date: quoteForm.expiry_date,
        is_approved: true,
        conversion_factor: conversionFactorVal
      };
      updated.push(newQuote);
      setQuotations(updated);
      showToast('Quotation saved to local state!');
    }
 
    setQuoteForm({
      supplier_id: '',
      item_name: '',
      flow_item_id: '',
      unit: 'Kg',
      price_usd: '',
      moq: '1',
      effective_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      conversion_factor: '1',
      vat: 'no'
    });
  };

  const handleQuickSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupForm.name.trim()) return;

    const newSupplierPayload = {
      name: quickSupForm.name,
      contact_name: quickSupForm.contact_name || undefined,
      phone: quickSupForm.phone || undefined,
      time_to_deliver: quickSupForm.time_to_deliver || undefined,
      payment_terms: quickSupForm.payment_terms || undefined,
      is_active: true
    };

    if (dbStatus === 'ready') {
      const res = await api.saveSupplier(newSupplierPayload);
      if (res.success) {
        showToast('New supplier added successfully!');
        const suppliersRes = await api.getSuppliers();
        const updatedList = (suppliersRes.success && suppliersRes.data) ? (suppliersRes.data as Supplier[]) : [];
        setSuppliers(updatedList);
        
        const added = updatedList.find(s => s.name === quickSupForm.name);
        if (added) {
          setQuoteForm(prev => ({ ...prev, supplier_id: added.id }));
        }
      } else {
        alert(res.error || 'Failed to save supplier');
      }
    } else {
      const newId = `sup-quick-${Date.now()}`;
      const newSup = { id: newId, ...newSupplierPayload };
      setSuppliers(prev => [...prev, newSup]);
      setQuoteForm(prev => ({ ...prev, supplier_id: newId }));
      showToast('New supplier added in sandbox!');
    }

    setShowAddSupplierModal(false);
    setQuickSupForm({
      name: '',
      contact_name: '',
      phone: '',
      time_to_deliver: 'Next day',
      payment_terms: 'Net 15'
    });
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalForm.supplier_id) {
      alert('Please select a supplier.');
      return;
    }

    if (dbStatus === 'ready') {
      const res = await api.saveSupplierEvaluation(evalForm);
      if (res.success) {
        showToast('Evaluation logged successfully!');
        loadAllData();
      } else {
        alert(res.error || 'Failed to save evaluation');
      }
    } else {
      const updated = [...evaluations];
      const index = updated.findIndex(ev => ev.supplier_id === evalForm.supplier_id);
      const newEval = {
        id: `e-mem-${Date.now()}`,
        ...evalForm
      };
      if (index !== -1) {
        updated[index] = newEval;
      } else {
        updated.push(newEval);
      }
      setEvaluations(updated);
      showToast('Evaluation updated in local state!');
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (!window.confirm('Delete this quotation?')) return;

    if (dbStatus === 'ready') {
      const res = await api.deleteSupplierQuotation(id);
      if (res.success) {
        showToast('Quotation deleted!');
        loadAllData();
      } else {
        alert(res.error || 'Failed to delete quotation');
      }
    } else {
      setQuotations(prev => prev.filter(q => q.id !== id));
      showToast('Quotation deleted from local state!');
    }
  };

  const handleApproveMapping = async (mappingId: string, flowItemId: string) => {
    if (dbStatus === 'ready') {
      const mappingObj = mappings.find(m => m.id === mappingId);
      if (mappingObj) {
        const payload = { ...mappingObj, flow_item_id: flowItemId, is_approved: true };
        const res = await api.saveItemDescriptionMapping(payload);
        if (res.success) {
          showToast('Mapping approved!');
          loadAllData();
        }
      }
    } else {
      setMappings(prev => prev.map(m => m.id === mappingId ? { ...m, flow_item_id: flowItemId, is_approved: true } : m));
      showToast('Mapping approved in memory!');
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!csvSupplierId) {
      alert('Please select a target supplier first.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      interface CsvRow {
        supplier_item_desc: string;
        unit: string;
        price_usd: number;
        moq: number;
        matched_item_name: string;
      }
      const parsed: CsvRow[] = [];
      
      lines.forEach((line, index) => {
        if (index === 0 || !line.trim()) return;
        const cols = line.split(',');
        if (cols.length >= 4) {
          parsed.push({
            supplier_item_desc: cols[0].trim(),
            unit: cols[1].trim(),
            price_usd: parseFloat(cols[2]) || 0,
            moq: parseFloat(cols[3]) || 1,
            matched_item_name: cols[4] ? cols[4].trim() : ''
          });
        }
      });

      const newMappings = [...mappings];
      const newQuotes = [...quotations];
      const targetSupId = csvSupplierId || (suppliers[0]?.id || 'sup-1');

      const savePromises = parsed.map(async (row, rIdx) => {
        const match = catalogItems.find(ci => ci.name.toLowerCase().includes(row.matched_item_name.toLowerCase()) || row.supplier_item_desc.toLowerCase().includes(ci.name.toLowerCase()));
        
        const mapPayload = {
          supplier_id: targetSupId,
          supplier_item_desc: row.supplier_item_desc,
          flow_item_id: match ? match.id : null,
          is_approved: !!match,
          confidence_score: match ? 0.91 : 0.42
        };

        if (dbStatus === 'ready') {
          await supabase.from('item_description_mappings').upsert(mapPayload);
        } else {
          newMappings.push({
            id: `m-csv-${Date.now()}-${rIdx}`,
            ...mapPayload
          });
        }

        const qPayload = {
          supplier_id: targetSupId,
          item_name: row.supplier_item_desc,
          flow_item_id: match ? match.id : null,
          unit: row.unit,
          price_usd: row.price_usd,
          moq: row.moq,
          effective_date: new Date().toISOString().split('T')[0],
          expiry_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          is_approved: true,
          conversion_factor: 1
        };

        if (dbStatus === 'ready') {
          await api.saveSupplierQuotation(qPayload);
        } else {
          newQuotes.push({
            id: `q-csv-${Date.now()}-${rIdx}`,
            ...qPayload,
            supplier_name: suppliers.find(s => s.id === targetSupId)?.name || 'Supplier'
          });
        }
      });

      Promise.all(savePromises).then(() => {
        if (dbStatus === 'ready') {
          loadAllData();
        } else {
          setMappings(newMappings);
          setQuotations(newQuotes);
        }
        showToast(`Imported ${parsed.length} items from CSV successfully!`);
      });
    };
    reader.readAsText(file);
  };

  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!ocrSupplierId) {
      alert('Please select a target supplier first.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('scanning');
    setIsTyping(true);

    setTimeout(() => {
      setOcrText(`INVOICE / QUOTE #2026-8871
Supplier: Fresh Farms Beqaa
Date: 2026-07-10

Items:
1. FRESH BEEF COARSE (GROUND) - 10 KG - $115.00
2. ANCHOVY FILLETS IN OIL - 1 JAR - $14.20
3. BULK CACAO POWDER - 5 KG PACK - $42.50
4. RED CHEDDAR BLOCKS - 2.5 KG - $20.80`);

      const freshFarmsId = ocrSupplierId || (suppliers.find(s => s.name.toLowerCase().includes('fresh farms'))?.id || suppliers[0]?.id || 'sup-2');
      const extracted = [
        { desc: 'FRESH BEEF COARSE (GROUND)', unit: 'Kg', price: 11.50, moq: 1, flowName: 'Coarse Ground Beef' },
        { desc: 'ANCHOVY FILLETS IN OIL', unit: 'Jar', price: 14.20, moq: 1, flowName: 'Anchovies' },
        { desc: 'BULK CACAO POWDER', unit: 'Pack', price: 42.50, moq: 1, flowName: 'Cacao 5kg' },
        { desc: 'RED CHEDDAR BLOCKS', unit: 'Pack', price: 20.80, moq: 1, flowName: 'Cheddar 2.5kg' }
      ];

      setDetectedQuotes(extracted.map((ext, idx) => {
        const itemMatch = catalogItems.find(ci => ci.name === ext.flowName);
        return {
          id: `ocr-det-${idx}-${Date.now()}`,
          supplier_id: freshFarmsId,
          supplier_item_desc: ext.desc,
          flow_item_id: itemMatch ? itemMatch.id : '',
          unit: ext.unit,
          price_usd: ext.price,
          moq: ext.moq,
          is_approved: false
        };
      }));

      setImportStatus('mapped');
      setIsTyping(false);
      showToast('AI OCR scan complete! Mappings loaded for review.');
    }, 2500);
  };

  const handleApproveOcrQuotes = async () => {
    const newQuotes = [...quotations];
    const newMappings = [...mappings];

    const savePromises = detectedQuotes.map(async (det) => {
      const qPayload = {
        supplier_id: det.supplier_id,
        item_name: det.supplier_item_desc,
        flow_item_id: det.flow_item_id || null,
        unit: det.unit,
        price_usd: det.price_usd,
        moq: det.moq,
        effective_date: new Date().toISOString().split('T')[0],
        expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_approved: true,
        conversion_factor: det.conversion_factor || 1
      };

      if (dbStatus === 'ready') {
        await api.saveSupplierQuotation(qPayload);
      } else {
        newQuotes.push({
          id: `q-ocr-${Date.now()}-${det.id}`,
          ...qPayload,
          supplier_name: suppliers.find(s => s.id === det.supplier_id)?.name || 'Supplier'
        });
      }

      const mapPayload = {
        supplier_id: det.supplier_id,
        supplier_item_desc: det.supplier_item_desc,
        flow_item_id: det.flow_item_id || null,
        is_approved: !!det.flow_item_id,
        confidence_score: det.flow_item_id ? 0.99 : 0.1
      };

      if (dbStatus === 'ready') {
        await supabase.from('item_description_mappings').upsert(mapPayload);
      } else {
        newMappings.push({
          id: `m-ocr-${Date.now()}-${det.id}`,
          ...mapPayload
        });
      }
    });

    await Promise.all(savePromises);

    if (dbStatus === 'ready') {
      loadAllData();
    } else {
      setQuotations(newQuotes);
      setMappings(newMappings);
    }
    setDetectedQuotes([]);
    setImportStatus('idle');
    showToast('Approved OCR quotations imported into price history!');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = "I've analyzed your request, but I couldn't formulate a specific suggestion. Could you ask about price changes, supplier reliability, or negotiation tips?";
      const query = chatInput.toLowerCase();
      
      if (query.includes('beef') || query.includes('ground beef')) {
        reply = "Ground beef is currently supplied by 'Fresh Farms Beqaa' at $12.50/Kg. However, Safi Dairy & Cheese offers it as an alternative at $11.80/Kg. Switching could save you 5.6% on cost, but Safi Dairy's average delivery delay is 2 days compared to Fresh Farms' 1 day. I recommend staying with Fresh Farms to maintain fresh kitchen supplies, or negotiating a price match with them.";
      } else if (query.includes('cacao') || query.includes('chocolate')) {
        reply = "Price Alert: Cacao 5kg from Metico Supply has increased by 14.5% over the past 3 months due to global supply chain challenges. Your average monthly consumption is 12 packs. I recommend ordering a 3-month par level (36 packs) from Al Kayan Distributors today, as they have an active quote locking in the price at $45.00/pack until December, saving you approximately $230.";
      } else if (query.includes('negotiate') || query.includes('negotiation')) {
        reply = "Negotiation Summary for Safi Dairy & Cheese Co.:\n- You have ordered 45 times from them this year with a total spend of $3,450.\n- They have a 100% order fill rate, but their on-time delivery rate is only 88%.\n- Opportunity: They offer Net 15 payment terms. Since they are your primary dairy supplier, you should negotiate for Net 30 terms to match Metico, citing your high order frequency and prompt cash drop history.";
      } else if (query.includes('best supplier') || query.includes('highest rating')) {
        reply = "Based on the Best Value algorithm:\n1. Safi Dairy & Cheese Co. scores 91.5 (Excellent reliability 98%, Net 30 terms, moderate pricing).\n2. Fresh Farms Beqaa scores 88.0 (Best quality 5/5, but shorter Net 15 terms).\n3. Al Kayan Distributors scores 78.4 (Good price index, but lower reliability score of 72%).";
      }

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setIsTyping(false);
    }, 1500);
  };

  // ----------------------------------------------------
  // SVG TREND LINE CHART GENERATOR
  // ----------------------------------------------------
  const renderTrendChart = () => {
    const targetItem = catalogItems.find(ci => ci.name === selectedTrendItem);
    if (!targetItem) {
      return (
        <div className="card" style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--text-muted)' }} />
          <strong>No matching items found.</strong>
          <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Try adjusting your search query or department filter.</p>
        </div>
      );
    }

    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const prices = months.map((_m, idx) => {
      const seed = targetItem.name.charCodeAt(0) + idx * 7;
      const variation = (seed % 15) - 7.5; 
      const basePrice = targetItem.price_usd;
      return Number((basePrice * (1 + variation / 100)).toFixed(2));
    });

    const maxVal = Math.max(...prices) * 1.1;
    const minVal = Math.max(0, Math.min(...prices) * 0.9);
    const range = maxVal - minVal;

    const chartWidth = 700;
    const chartHeight = 250;
    const padding = 40;

    const points = prices.map((price, idx) => {
      const x = padding + (idx * (chartWidth - 2 * padding)) / (prices.length - 1);
      const y = chartHeight - padding - ((price - minVal) * (chartHeight - 2 * padding)) / range;
      return { x, y, price, month: months[idx] };
    });

    const pathD = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    return (
      <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Price History Trend: {selectedTrendItem}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>6-Month price fluctuations normalized to USD per {targetItem.unit}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '12px', background: '#e8f0fe', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
              Min: ${minVal.toFixed(2)}
            </span>
            <span style={{ fontSize: '12px', background: '#fce8e6', color: '#c5221f', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
              Max: ${maxVal.toFixed(2)}
            </span>
          </div>
        </div>
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
            const y = padding + val * (chartHeight - 2 * padding);
            const price = maxVal - val * range;
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padding - 8} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">${price.toFixed(2)}</text>
              </g>
            );
          })}

          <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="var(--primary)" strokeWidth="3" style={{ cursor: 'pointer' }} />
              <text x={p.x} y={p.y - 10} fill="var(--text-main)" fontSize="10" fontWeight="bold" textAnchor="middle">${p.price.toFixed(2)}</text>
              <text x={p.x} y={chartHeight - padding + 16} fill="#64748b" fontSize="10" textAnchor="middle">{p.month}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // ----------------------------------------------------
  // COMPONENT RENDERING
  // ----------------------------------------------------

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '16px' }}>
        <RefreshCw size={36} className="animate-spin" color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Analyzing supplier database and catalog entries...</p>
      </div>
    );
  }

  const totalAnnualSavings = catalogItems.reduce((acc, item) => {
    const itemQuotes = quotations.filter(q => q.flow_item_id === item.id);
    if (itemQuotes.length <= 1) return acc;
    
    const normalized = itemQuotes.map(iq => getNormalizedDetails(iq.price_usd, iq.unit, item.unit, iq.conversion_factor, item.vat === 'yes').price);
    const minPrice = Math.min(...normalized);
    const currentPrice = item.price_usd;
    
    const monthlyVol = 15;
    const diff = Math.max(0, currentPrice - minPrice);
    return acc + (diff * monthlyVol * 12);
  }, 0);

  const volatilityAlerts = catalogItems.filter((item, idx) => (item.price_usd * (idx + 1)) % 7 > 5);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
      
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          background: 'var(--primary)', color: 'white', padding: '12px 24px',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600
        }}>
          <CheckCircle size={18} /> {toastMsg}
        </div>
      )}

      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            Supplier Price Intelligence <Sparkles size={22} color="var(--primary)" />
            <span style={{
              fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px',
              backgroundColor: isVatSubscribed ? '#e6f4ea' : '#fce8e6',
              color: isVatSubscribed ? '#137333' : '#c5221f',
              border: `1px solid ${isVatSubscribed ? '#c2e7c9' : '#fad2cf'}`,
              marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}>
              VAT Subscribed: {isVatSubscribed ? 'Yes' : 'No'}
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Compare quotations, evaluate reliability and logistics, track fluctuations, and find cost optimization opportunities.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {dbStatus === 'missing' && (
            <button 
              onClick={() => setShowSqlModal(true)} 
              className="btn btn-warning" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <ShieldAlert size={16} /> Database Migration Pending
            </button>
          )}
          <button 
            onClick={loadAllData} 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <RefreshCw size={16} /> Sync Calculations
          </button>
        </div>
      </div>

      {dbStatus === 'missing' && !showSqlModal && (
        <div className="card" style={{ backgroundColor: '#fff9db', border: '1px solid #ffe066', color: '#856404', display: 'flex', padding: '16px', gap: '16px', borderRadius: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertCircle size={24} color="#f59f00" />
            <div>
              <strong style={{ display: 'block', fontSize: '14px' }}>Local Memory & Simulation Mode Active</strong>
              <span style={{ fontSize: '12px' }}>The necessary tables aren't set up in your Supabase DB. ERP calculations work in full sandbox simulation mode. Copy the SQL schema to enable database persistence.</span>
            </div>
          </div>
          <button 
            onClick={() => setShowSqlModal(true)} 
            className="btn btn-warning" 
            style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
          >
            Set Up Database
          </button>
        </div>
      )}

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ backgroundColor: 'white', maxWidth: '650px', width: '90%', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Create Price Intelligence Tables</h3>
              <button onClick={() => setShowSqlModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Execute the DDL schema below in your Supabase SQL Editor. This will configure tables for supplier quotes, description matching mappings, configurations, and detailed scorecard ratings.
            </p>
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <pre style={{ margin: 0, color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {`-- 1. Create supplier_quotations table
CREATE TABLE IF NOT EXISTS public.supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  flow_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  unit TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  effective_date TIMESTAMPTZ DEFAULT now(),
  expiry_date TIMESTAMPTZ,
  moq NUMERIC DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  conversion_factor NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create supplier_evaluations table
CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  evaluator_name TEXT,
  quality INT CHECK (quality >= 1 AND quality <= 5),
  freshness INT CHECK (freshness >= 1 AND freshness <= 5),
  packaging INT CHECK (packaging >= 1 AND packaging <= 5),
  spec_compliance INT CHECK (spec_compliance >= 1 AND spec_compliance <= 5),
  delivery INT CHECK (delivery >= 1 AND delivery <= 5),
  communication INT CHECK (communication >= 1 AND communication <= 5),
  service INT CHECK (service >= 1 AND service <= 5),
  replacement_handling INT CHECK (replacement_handling >= 1 AND replacement_handling <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create supplier_intelligence_config table
CREATE TABLE IF NOT EXISTS public.supplier_intelligence_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_weight NUMERIC DEFAULT 0.40,
  quality_weight NUMERIC DEFAULT 0.25,
  reliability_weight NUMERIC DEFAULT 0.15,
  payment_terms_weight NUMERIC DEFAULT 0.10,
  delivery_weight NUMERIC DEFAULT 0.05,
  service_weight NUMERIC DEFAULT 0.05,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create item_description_mappings table
CREATE TABLE IF NOT EXISTS public.item_description_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_item_desc TEXT NOT NULL,
  flow_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT false,
  confidence_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_description_mappings ENABLE ROW LEVEL SECURITY;

-- Enable public read/write access policies
CREATE POLICY "Enable read access for all authenticated users" ON public.supplier_quotations FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.supplier_quotations FOR ALL USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.supplier_evaluations FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.supplier_evaluations FOR ALL USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.supplier_intelligence_config FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.supplier_intelligence_config FOR ALL USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.item_description_mappings FOR SELECT USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.item_description_mappings FOR ALL USING (true);`}
              </pre>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowSqlModal(false)} className="btn btn-secondary" style={{ fontSize: '13px' }}>Close</button>
              <button onClick={handleCopySql} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <FileText size={16} /> Copy SQL Migration Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: <BarChart2 size={16} /> },
          { id: 'trends', label: 'Price Trends', icon: <TrendingUp size={16} /> },
          { id: 'suppliers', label: 'Supplier Performance', icon: <Star size={16} /> },
          { id: 'comparator', label: 'Quote Comparator', icon: <Scale size={16} /> },
          { id: 'import', label: 'Import Price Lists', icon: <Upload size={16} /> },
          { id: 'assistant', label: 'AI Procurement Assistant', icon: <MessageSquare size={16} /> },
          { id: 'config', label: 'Weights Settings', icon: <Sliders size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'overview' | 'trends' | 'suppliers' | 'comparator' | 'import' | 'assistant' | 'config')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600, color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ background: '#e8f0fe', padding: '12px', borderRadius: '12px' }}><DollarSign size={24} color="var(--primary)" /></div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Estimated Annual Savings</span>
                  <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: '#137333', marginTop: '4px' }}>
                    ${totalAnnualSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ background: '#e6f4ea', padding: '12px', borderRadius: '12px' }}><Percent size={24} color="#137333" /></div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Order Fill Rate</span>
                  <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                    {Number(suppliers.reduce((acc, s) => acc + calculateSupplierHistory(s.id).fillRate, 0) / (suppliers.length || 1)).toFixed(1)}%
                  </strong>
                </div>
              </div>

              <div className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ background: '#feefe3', padding: '12px', borderRadius: '12px' }}><TrendingUp size={24} color="#e65100" /></div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Price Index Trend</span>
                  <strong style={{ fontSize: '22px', fontWeight: 800, color: '#e65100', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    +3.4% <ArrowUpRight size={18} />
                  </strong>
                </div>
              </div>

              <div className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ background: '#fce8e6', padding: '12px', borderRadius: '12px' }}><Sliders size={24} color="#c5221f" /></div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Highly Volatile Items</span>
                  <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: '#c5221f', marginTop: '4px' }}>
                    {volatilityAlerts.length}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
              
              <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={20} color="var(--primary)" /> AI Purchasing Recommendations
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '16px', borderLeft: '4px solid #137333', background: '#f4faf6', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#137333' }}>Cost Savings Alert: Cheddar Cheese</strong>
                      <span style={{ fontSize: '11px', background: '#e6f4ea', color: '#137333', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Potential Save: $120/mo</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#333' }}>
                      Cheddar cheese is currently purchased from Safi Dairy at $22.00/pack. Fresh Farms Beqaa offers an identical block at $20.80/pack. Fresh Farms has a 93% reliability score, making it a low-risk switch.
                    </p>
                  </div>

                  <div style={{ padding: '16px', borderLeft: '4px solid #e65100', background: '#fffcf5', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#e65100' }}>Inflation Warning: Cacao 5kg</strong>
                      <span style={{ fontSize: '11px', background: '#feefe3', color: '#e65100', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Price Volatility: High</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#333' }}>
                      Metico Supply prices for Cacao have increased by 14.5% in the last quarter. Lock in your current price at $45.00/pack by purchasing a 3-month par bulk bundle from Al Kayan Distributors before their quotation expires.
                    </p>
                  </div>

                  <div style={{ padding: '16px', borderLeft: '4px solid #1e5c4f', background: '#f4f9f8', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>Consolidation Opportunity</strong>
                      <span style={{ fontSize: '11px', background: '#e8f0fe', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Payment terms optimization</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#333' }}>
                      Combining your daily spice and sauce orders to Al Kayan Distributors instead of three minor vendors would boost your yearly volume from $1,200 to $3,500, granting leverage to request Net 30 payment terms instead of Net 15.
                    </p>
                  </div>
                </div>
              </div>

              <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={20} color="#c5221f" /> Price Alerts & Expired Quotes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {quotations.filter(q => q.expiry_date && new Date(q.expiry_date) < new Date('2026-08-01')).map((q, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{q.item_name}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Supplier: {q.supplier_name}</span>
                      </div>
                      <div style={{ textAnchor: 'end', textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: '#c5221f', fontWeight: 'bold', display: 'block' }}>Expired Quotation</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expiry: {q.expiry_date}</span>
                      </div>
                    </div>
                  ))}

                  {volatilityAlerts.slice(0, 2).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', borderLeft: '4px solid #c5221f' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{item.name}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Abnormal Price Fluctuations</span>
                      </div>
                      <div style={{ textAnchor: 'end', textAlign: 'right' }}>
                        <span style={{ fontSize: '13px', color: '#c5221f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          +15.2% <ArrowUpRight size={14} />
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last 3 months</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: PRICE MONITOR */}
        {activeTab === 'trends' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Chart Target Selector at the Top */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'white', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Select Catalog Item Chart:</span>
              <select
                value={selectedTrendItem}
                onChange={(e) => setSelectedTrendItem(e.target.value)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--primary)', minWidth: '240px', fontWeight: 600 }}
              >
                {catalogItems.map((item: CatalogItem) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>

            {renderTrendChart()}

            <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Catalog Item Pricing Intelligence</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={trendsSearch}
                      onChange={(e) => setTrendsSearch(e.target.value)}
                      placeholder="Search items..."
                      style={{ width: '100%', padding: '6px 10px 6px 28px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  {/* Department select */}
                  <select
                    value={trendsDept}
                    onChange={(e) => setTrendsDept(e.target.value)}
                    style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                  >
                    {departments.map((dept: string) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Item Name</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Current Price</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Min Price (6M)</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Max Price (6M)</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Volatility</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Est. Monthly Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrendItems.map((item: CatalogItem) => {
                      const seed = item.name.charCodeAt(0);
                      const isVolatile = seed % 4 === 0;
                      const volText = isVolatile ? 'High' : (seed % 3 === 0 ? 'Medium' : 'Low');
                      const volColor = isVolatile ? '#c5221f' : (seed % 3 === 0 ? '#b06000' : '#137333');
                      
                      const minPrice = item.price_usd * 0.92;
                      const maxPrice = item.price_usd * 1.15;
                      const monthlySpend = item.price_usd * 15;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelectedTrendItem(item.name)}>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>${item.price_usd.toFixed(2)}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>${minPrice.toFixed(2)}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>${maxPrice.toFixed(2)}</td>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: volColor }}>{volText}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>${monthlySpend.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUPPLIER PERFORMANCE */}
        {activeTab === 'suppliers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Supplier Scoring Matrix</h3>
                {suppliers.map(sup => {
                  const hist = calculateSupplierHistory(sup.id);
                  const evals = getSupplierEvalAverage(sup.id);
                  const priceIndex = calculatePricingScore(sup.id);

                  return (
                    <div key={sup.id} className="card" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{sup.name}</h4>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Payment: {sup.payment_terms || 'COD'} | Lead: {sup.time_to_deliver || 'Next Day'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff9db', color: '#b06000', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          <Star size={14} fill="#f59f00" stroke="#f59f00" /> {evals.overall} / 5
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>On-Time Rate:</span>
                          <strong style={{ display: 'block', fontSize: '13px', color: hist.onTimeRate >= 90 ? '#137333' : '#c5221f' }}>{hist.onTimeRate}%</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Order Fill Rate:</span>
                          <strong style={{ display: 'block', fontSize: '13px', color: hist.fillRate >= 95 ? '#137333' : '#c5221f' }}>{hist.fillRate}%</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Pricing Score:</span>
                          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--primary)' }}>{priceIndex} / 100</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Total Spend:</span>
                          <strong style={{ display: 'block', fontSize: '13px' }}>${hist.spend.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Log Supplier Quality & Service Evaluation</h3>
                <form onSubmit={handleSaveEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>Select Supplier</label>
                    <select
                      value={evalForm.supplier_id}
                      onChange={(e) => setEvalForm({ ...evalForm, supplier_id: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { key: 'quality', label: 'Item Quality' },
                      { key: 'freshness', label: 'Freshness rating' },
                      { key: 'packaging', label: 'Packaging quality' },
                      { key: 'spec_compliance', label: 'Spec compliance' },
                      { key: 'delivery', label: 'Delivery accuracy' },
                      { key: 'communication', label: 'Communication' },
                      { key: 'service', label: 'Sales representative service' },
                      { key: 'replacement_handling', label: 'Returns & Replacement' }
                    ].map(rating => (
                      <div key={rating.key}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>{rating.label}</label>
                        <select
                          value={(evalForm as Record<string, string | number>)[rating.key]}
                          onChange={(e) => setEvalForm({ ...evalForm, [rating.key]: parseInt(e.target.value) })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                        >
                          <option value="5">5 - Excellent</option>
                          <option value="4">4 - Good</option>
                          <option value="3">3 - Satisfactory</option>
                          <option value="2">2 - Poor</option>
                          <option value="1">1 - Unacceptable</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>Notes / Comments</label>
                    <textarea
                      value={evalForm.notes}
                      onChange={(e) => setEvalForm({ ...evalForm, notes: e.target.value })}
                      placeholder="Enter specific feedback about quality logs, return frequency or invoice anomalies..."
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', height: '80px', fontSize: '13px' }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                    Save Scorecard Ratings
                  </button>

                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: QUOTATION COMPARATOR */}
        {activeTab === 'comparator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Compare Quotations For:</span>
                <select
                  value={selectedCompareItem}
                  onChange={(e) => setSelectedCompareItem(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', minWidth: '220px', fontWeight: 600 }}
                >
                  {catalogItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Order Quantity:</span>
                <input
                  type="number"
                  value={compareQty}
                  onChange={(e) => setCompareQty(Math.max(1, parseInt(e.target.value) || 0))}
                  style={{ width: '80px', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{catalogItems.find(ci => ci.id === selectedCompareItem)?.unit || 'units'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {(() => {
                const targetItem = catalogItems.find(ci => ci.id === selectedCompareItem);
                if (!targetItem) return <p>Select an item to run supplier quote comparison.</p>;

                const itemQuotes = quotations.filter(q => q.flow_item_id === selectedCompareItem);

                if (itemQuotes.length === 0) {
                  return (
                    <div style={{ padding: '40px', textAlign: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: '12px' }}>
                      <AlertCircle size={40} color="var(--primary)" style={{ marginBottom: '12px' }} />
                      <h4>No Quotations Found</h4>
                      <p style={{ color: 'var(--text-muted)' }}>Please add quotations in the 'Import Price Lists' tab first.</p>
                    </div>
                  );
                }

                const calculatedScores = itemQuotes.map(q => {
                  const score = calculateBestValueScore(q.supplier_id, targetItem.id);
                  const norm = getNormalizedDetails(q.price_usd, q.unit, targetItem.unit, q.conversion_factor, targetItem.vat === 'yes');
                  const totalCost = norm.price * compareQty;
                  const supplier = suppliers.find(s => s.id === q.supplier_id);
                  const history = calculateSupplierHistory(q.supplier_id);
                  
                  return {
                    quote: q,
                    score,
                    normalizedPrice: norm.price,
                    totalCost,
                    supplier,
                    history,
                    moqMet: compareQty >= (q.moq || 0)
                  };
                });

                calculatedScores.sort((a, b) => b.score - a.score);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {calculatedScores.map((result, idx) => {
                      const isRecommended = idx === 0;
                      const pt = result.supplier?.payment_terms || 'COD';

                      return (
                        <div 
                          key={result.quote.id} 
                          className="card" 
                          style={{ 
                            backgroundColor: 'white', 
                            padding: '24px', 
                            borderRadius: '16px', 
                            border: isRecommended ? '2.5px solid var(--primary)' : '1px solid var(--border)',
                            position: 'relative',
                            boxShadow: isRecommended ? '0 10px 25px -5px rgba(30, 92, 79, 0.1)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          {isRecommended && (
                            <span style={{ 
                              position: 'absolute', top: '-12px', left: '20px', 
                              background: 'var(--primary)', color: 'white', 
                              fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', 
                              borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                              <Award size={12} /> AI Recommended Value
                            </span>
                          )}

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{result.supplier?.name}</h4>
                              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Rank #{idx + 1}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0 20px' }}>
                              <div style={{ 
                                width: '56px', height: '56px', borderRadius: '50%', 
                                border: `4px solid ${isRecommended ? 'var(--primary)' : '#e2e8f0'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '15px', fontWeight: 800, color: isRecommended ? 'var(--primary)' : '#475569'
                              }}>
                                {result.score}
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Best Value Score</span>
                                <span style={{ fontSize: '12px', color: '#475569' }}>Weighted performance metric</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Quoted Price:</span>
                                  <strong style={{ fontSize: '13px' }}>${result.quote.price_usd.toFixed(2)} / {result.quote.unit}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Normalized Price:</span>
                                  <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>
                                    ${result.normalizedPrice.toFixed(2)} / {targetItem.unit}
                                    {!isVatSubscribed && targetItem.vat === 'yes' && (
                                      <span style={{ fontSize: '10px', color: '#c5221f', marginLeft: '4px', fontWeight: 'normal' }}>
                                        (incl. {vatRate}% VAT)
                                      </span>
                                    )}
                                    {!isVatSubscribed && targetItem.vat !== 'yes' && (
                                      <span style={{ fontSize: '10px', color: '#137333', marginLeft: '4px', fontWeight: 'normal', backgroundColor: '#e6f4ea', padding: '1px 4px', borderRadius: '4px' }}>
                                        VAT Exempt
                                      </span>
                                    )}
                                  </strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', marginTop: '4px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Total projected cost:</span>
                                  <strong style={{ fontSize: '14px', color: '#137333' }}>
                                    ${result.totalCost.toFixed(2)}
                                    {!isVatSubscribed && targetItem.vat === 'yes' && (
                                      <span style={{ fontSize: '10px', color: '#c5221f', marginLeft: '4px', fontWeight: 'normal' }}>
                                        (incl. VAT)
                                      </span>
                                    )}
                                  </strong>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Payment Terms:</span>
                                <strong style={{ color: '#0f172a' }}>{pt}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Lead Time / Delivery Days:</span>
                                <strong style={{ color: '#0f172a' }}>{result.supplier?.time_to_deliver || '1 day'}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Fill Rate / On-Time Rate:</span>
                                <strong style={{ color: '#0f172a' }}>{result.history.fillRate}% / {result.history.onTimeRate}%</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Minimum Order Qty (MOQ):</span>
                                <strong style={{ color: result.moqMet ? '#137333' : '#c5221f' }}>
                                  {result.quote.moq || 1} {result.quote.moq ? targetItem.unit : ''}
                                  {!result.moqMet && ' (MOQ not met)'}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {isRecommended && (
                            <div style={{ background: '#f4f9f8', border: '1px solid #ccece4', borderRadius: '8px', padding: '12px', marginTop: '16px', fontSize: '11px', color: 'var(--primary)' }}>
                              <strong>AI Decision rationale:</strong> Recommended based on best pricing, Net 30 payment terms and 98% delivery fill rate. Price savings override lead delays.
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </div>
        )}

        {/* TAB 5: IMPORT & AI MATCHING */}
        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Manual Quotation Entry</h3>
                  <form onSubmit={handleSaveQuotation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Supplier</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            value={quoteForm.supplier_id}
                            onChange={(e) => setQuoteForm({ ...quoteForm, supplier_id: e.target.value })}
                            style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                          >
                            <option value="">Select Supplier</option>
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowAddSupplierModal(true)}
                            style={{
                              padding: '0 12px', borderRadius: '6px',
                              background: 'var(--primary)', color: 'white', border: 'none',
                              fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="Add New Supplier"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700 }}>Matched Flow Item</label>
                          {quoteForm.supplier_id && (
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={showAllItemsInManualQuote}
                                onChange={(e) => setShowAllItemsInManualQuote(e.target.checked)} 
                              />
                              Show All
                            </label>
                          )}
                        </div>
                        <select
                          value={quoteForm.flow_item_id}
                          onChange={(e) => {
                            const selected = catalogItems.find(ci => ci.id === e.target.value);
                            setQuoteForm({ 
                              ...quoteForm, 
                              flow_item_id: e.target.value,
                              item_name: selected ? selected.name : quoteForm.item_name,
                              unit: selected ? selected.unit : quoteForm.unit,
                              vat: selected ? (selected.vat || 'no') : 'no'
                            });
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                        >
                          <option value="">Select Catalog Item</option>
                          {(showAllItemsInManualQuote || !quoteForm.supplier_id
                            ? catalogItems
                            : catalogItems.filter(ci => ci.supplier_id === quoteForm.supplier_id)
                          ).map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {quoteForm.flow_item_id && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '4px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700 }}>Item is Subject to VAT</label>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Updates the item's VAT configuration in the catalog.
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: quoteForm.vat === 'no' ? 'var(--text-main)' : 'var(--text-muted)' }}>NO</span>
                          <label className="custom-switch">
                            <input 
                              type="checkbox" 
                              checked={quoteForm.vat === 'yes'} 
                              onChange={(e) => setQuoteForm({ ...quoteForm, vat: e.target.checked ? 'yes' : 'no' })}
                            />
                            <span className="switch-slider"></span>
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: quoteForm.vat === 'yes' ? 'var(--text-main)' : 'var(--text-muted)' }}>YES</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Supplier Item Description</label>
                      <input
                        type="text"
                        value={quoteForm.item_name}
                        onChange={(e) => setQuoteForm({ ...quoteForm, item_name: e.target.value })}
                        placeholder="e.g. CACAO POWDER BAG 5KG EXTRA"
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Unit</label>
                        <input
                          type="text"
                          value={quoteForm.unit}
                          onChange={(e) => setQuoteForm({ ...quoteForm, unit: e.target.value })}
                          placeholder="e.g. Pack, Kg"
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Quoted Price ($)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={quoteForm.price_usd}
                          onChange={(e) => setQuoteForm({ ...quoteForm, price_usd: e.target.value })}
                          placeholder="0.00"
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Min Qty (MOQ)</label>
                        <input
                          type="number"
                          value={quoteForm.moq}
                          onChange={(e) => setQuoteForm({ ...quoteForm, moq: e.target.value })}
                          placeholder="1"
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Effective Date</label>
                        <input
                          type="date"
                          value={quoteForm.effective_date}
                          onChange={(e) => setQuoteForm({ ...quoteForm, effective_date: e.target.value })}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Expiry Date</label>
                        <input
                          type="date"
                          value={quoteForm.expiry_date}
                          onChange={(e) => setQuoteForm({ ...quoteForm, expiry_date: e.target.value })}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    {(() => {
                      const selectedCatalogItem = catalogItems.find(ci => ci.id === quoteForm.flow_item_id);
                      const showConversionInput = selectedCatalogItem && selectedCatalogItem.unit.toLowerCase().trim() !== quoteForm.unit.toLowerCase().trim();
                      if (!showConversionInput) return null;
                      return (
                        <div style={{ marginTop: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--primary)' }}>
                            Unit Conversion Factor
                          </label>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                            How many <strong>{selectedCatalogItem.unit}</strong> are in 1 <strong>{quoteForm.unit}</strong>?
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>1 {quoteForm.unit} =</span>
                            <input
                              type="number"
                              step="0.001"
                              value={quoteForm.conversion_factor}
                              onChange={(e) => setQuoteForm({ ...quoteForm, conversion_factor: e.target.value })}
                              placeholder="1"
                              style={{ width: '100px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedCatalogItem.unit}</span>
                          </div>
                          {parseFloat(quoteForm.conversion_factor) > 0 && parseFloat(quoteForm.price_usd) > 0 && (
                            <span style={{ display: 'block', fontSize: '11px', color: '#137333', marginTop: '6px', fontWeight: 600 }}>
                              → Base cost calculated as: ${(parseFloat(quoteForm.price_usd) / parseFloat(quoteForm.conversion_factor)).toFixed(2)} per {selectedCatalogItem.unit}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px', marginTop: '8px' }}>
                      Add Quotation Record
                    </button>
                  </form>
                </div>

                <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Excel / CSV Quotation Import</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Select a CSV containing headers: <code>item_name, unit, price_usd, moq, matched_catalog_name</code>
                  </p>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Target Supplier for CSV Mappings</label>
                    <select
                      value={csvSupplierId}
                      onChange={(e) => setCsvSupplierId(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center',
                    backgroundColor: !csvSupplierId ? '#f1f5f9' : 'transparent',
                    cursor: !csvSupplierId ? 'not-allowed' : 'pointer',
                    position: 'relative', opacity: !csvSupplierId ? 0.7 : 1
                  }}>
                    <Upload size={32} color={!csvSupplierId ? '#94a3b8' : 'var(--primary)'} style={{ marginBottom: '8px' }} />
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: !csvSupplierId ? '#64748b' : '#0f172a' }}>
                      {!csvSupplierId ? 'Select a supplier to enable CSV upload' : 'Click to select CSV File'}
                    </span>
                    {csvSupplierId && (
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleCsvUpload} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} 
                      />
                    )}
                  </div>
                </div>

                <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>AI OCR Price List Uploader</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Upload a PDF or Image contract to automatically match descriptions and map prices using Flow AI OCR.
                  </p>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Target Supplier for OCR Scan</label>
                    <select
                      value={ocrSupplierId}
                      onChange={(e) => setOcrSupplierId(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {importStatus === 'idle' && (
                    <div style={{
                      border: `2px dashed ${!ocrSupplierId ? 'var(--border)' : 'var(--primary)'}`,
                      borderRadius: '8px', padding: '20px', textAlign: 'center',
                      backgroundColor: !ocrSupplierId ? '#f1f5f9' : '#f4f9f8',
                      cursor: !ocrSupplierId ? 'not-allowed' : 'pointer',
                      position: 'relative', opacity: !ocrSupplierId ? 0.7 : 1
                    }}>
                      <Cpu size={32} color={!ocrSupplierId ? '#94a3b8' : 'var(--primary)'} style={{ marginBottom: '8px' }} />
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: !ocrSupplierId ? '#64748b' : 'var(--primary)' }}>
                        {!ocrSupplierId ? 'Select a supplier to enable OCR scan' : 'Scan Contract / Price PDF'}
                      </span>
                      {ocrSupplierId && (
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          onChange={handleOcrFileSelect} 
                          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} 
                        />
                      )}
                    </div>
                  )}

                  {importStatus === 'scanning' && (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <RefreshCw size={28} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 12px' }} />
                      <strong>Flow AI OCR scanning document...</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Extracting quotation lists & analyzing matching scores...</span>
                    </div>
                  )}

                  {importStatus === 'mapped' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Extracted OCR Text:</strong>
                        <pre style={{ margin: 0, fontSize: '11px', maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                          {ocrText}
                        </pre>
                      </div>

                      <div style={{ background: '#eef2f5', padding: '12px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: 'var(--primary)' }}>4 items matched to Catalog:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {detectedQuotes.map((q, qIdx) => {
                            const cItem = catalogItems.find(ci => ci.id === q.flow_item_id);
                            return (
                              <div key={qIdx} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{q.supplier_item_desc}</span>
                                <span style={{ fontWeight: 'bold' }}>→ {cItem ? cItem.name : 'No Match'} (${q.price_usd})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setImportStatus('idle')} className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }}>Cancel</button>
                        <button onClick={handleApproveOcrQuotes} className="btn btn-primary" style={{ flex: 2, fontSize: '12px' }}>Approve & Import</button>
                      </div>
                    </div>
                  )}

                </div>

              </div>

              <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>AI Item Matcher Approved Mappings</h3>
                  <span style={{ fontSize: '11px', background: '#eef2f5', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                    {mappings.filter(m => m.is_approved).length} Approved
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {mappings.filter(m => !m.is_approved).length > 0 && (
                    <div style={{ background: '#feefe3', padding: '16px', borderRadius: '12px', border: '1px solid #fed7aa', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', color: '#e65100', marginBottom: '8px' }}>Require Matching Approvals</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {mappings.filter(m => !m.is_approved).map(map => {
                          const sup = suppliers.find(s => s.id === map.supplier_id);
                          return (
                            <div key={map.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                              <div>
                                <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{map.supplier_item_desc}</strong>
                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>Supplier: {sup?.name || 'Supplier'}</span>
                                <span style={{ fontSize: '10px', color: '#e65100', fontWeight: 'bold' }}>Confidence Score: {(map.confidence_score * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <select 
                                  onChange={(e) => handleApproveMapping(map.id, e.target.value)}
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                >
                                  <option value="">Match to...</option>
                                  {catalogItems.map(ci => (
                                    <option key={ci.id} value={ci.id}>{ci.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mappings.filter(m => m.is_approved).map(map => {
                      const cItem = catalogItems.find(ci => ci.id === map.flow_item_id);
                      const sup = suppliers.find(s => s.id === map.supplier_id);
                      return (
                        <div key={map.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '13px' }}>{map.supplier_item_desc}</strong>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>Matched: {cItem ? cItem.name : 'Unknown Catalog Item'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Supplier: {sup?.name || 'Supplier'}</span>
                          </div>
                          <span style={{ fontSize: '11px', background: '#e6f4ea', color: '#137333', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> Approved
                          </span>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

            </div>

            {/* Active Quotations List (Completes Price List Management & implements handleDeleteQuote) */}
            <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Active Supplier Quotations</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Supplier</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Item Description</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Price (USD)</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Unit</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Min Order (MOQ)</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Expiry Date</th>
                      <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map(q => {
                      const sup = suppliers.find(s => s.id === q.supplier_id);
                      return (
                        <tr key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600 }}>{sup?.name || q.supplier_name || 'Unknown'}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{q.item_name}</td>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>${q.price_usd.toFixed(2)}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{q.unit}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{q.moq || 1}</td>
                          <td style={{ padding: '12px', fontSize: '14px', color: q.expiry_date && new Date(q.expiry_date) < new Date('2026-08-01') ? '#c5221f' : 'inherit' }}>
                            {q.expiry_date || 'N/A'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button 
                              onClick={() => handleDeleteQuote(q.id)} 
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#c5221f' }}
                              title="Delete Quotation"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 6: AI ASSISTANT CHAT */}
        {activeTab === 'assistant' && (
          <div className="card" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
              <Cpu size={28} color="var(--primary)" />
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>AI Procurement Chatbot</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Connected to Historical Orders and Quotations database.</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px', background: '#f8fafc', borderRadius: '12px', marginBottom: '16px' }}>
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: msg.role === 'user' ? 'var(--primary)' : 'white',
                    color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{msg.content}</p>
                  <span style={{ display: 'block', fontSize: '9px', textAlign: 'right', marginTop: '6px', color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                    {msg.timestamp}
                  </span>
                </div>
              ))}
              
              {isTyping && (
                <div style={{ alignSelf: 'flex-start', background: 'white', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                  <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }}></span>
                  <span className="dot" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }}></span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about price trends ('cacao price changes'), supplier ratings ('best supplier'), or request negotiation advice..."
                style={{ flex: 1, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                Send
              </button>
            </form>
          </div>
        )}

        {/* TAB 7: CONFIG WEIGHTS SETTINGS */}
        {activeTab === 'config' && (
          <div className="card" style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={20} color="var(--primary)" /> Configure Best Value Weights
            </h3>
            <p style={{ margin: '4px 0 20px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Adjust weights used in the supplier comparator ranking. The sum of all weights must equal 100%.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { key: 'price', label: 'Price Competitiveness Weight', desc: 'Ratio comparing supplier cost to the lowest quotation.' },
                { key: 'quality', label: 'Item Quality & Freshness Weight', desc: 'Averaged scorecards for product quality, freshness, and spec compliance.' },
                { key: 'reliability', label: 'Supplier Reliability Weight', desc: 'Calculated order fill rates and low invoice deviation logs.' },
                { key: 'payment_terms', label: 'Credit Payment Terms Weight', desc: 'Weighted value score for Net 30, Net 15, COD flexibility.' },
                { key: 'delivery', label: 'Logistics Lead Time & Delivery Weight', desc: 'Weighted average of historical on-time delivery arrivals.' },
                { key: 'service', label: 'Communication & Rep Service Weight', desc: 'Rating of communication speed, replacement handlings.' }
              ].map(w => {
                const val = Math.round((configWeights[w.key as keyof Weights] || 0) * 100);
                return (
                  <div key={w.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{w.label}</strong>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>{val}%</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '-4px' }}>{w.desc}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={val}
                      onChange={(e) => {
                        const newPct = parseInt(e.target.value) / 100;
                        setConfigWeights({ ...configWeights, [w.key]: newPct });
                      }}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                );
              })}

              {(() => {
                const totalPct = Math.round(Object.values(configWeights).reduce((sum: number, val: number) => sum + (val || 0), 0) * 100);
                const isError = totalPct !== 100;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isError ? '#fce8e6' : '#e6f4ea', color: isError ? '#c5221f' : '#137333', padding: '12px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', marginTop: '10px' }}>
                    <span>Sum of Weights:</span>
                    <span>{totalPct}% {isError ? '(Must equal 100%)' : '(Valid)'}</span>
                  </div>
                );
              })()}

              <button 
                onClick={async () => {
                  const total = Object.values(configWeights).reduce((sum: number, val: number) => sum + (val || 0), 0);
                  if (Math.round(total * 100) !== 100) {
                    alert('Error: The sum of weights must equal 100% before saving.');
                    return;
                  }

                  if (dbStatus === 'ready') {
                    const res = await api.saveSupplierIntelligenceConfig(configWeights);
                    if (res.success) {
                      showToast('Weights config saved to database!');
                    }
                  } else {
                    showToast('Weights config updated in local storage state!');
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '12px', fontWeight: 600 }}
              >
                Save Weights Configuration
              </button>

            </div>
          </div>
        )}

      </div>

      {/* Quick Add Supplier Modal */}
      {showAddSupplierModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ backgroundColor: 'white', maxWidth: '450px', width: '90%', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>Add New Supplier</h3>
              <button type="button" onClick={() => setShowAddSupplierModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleQuickSaveSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={quickSupForm.name}
                  onChange={(e) => setQuickSupForm({ ...quickSupForm, name: e.target.value })}
                  placeholder="e.g. Al Kayan Distributors"
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Contact Person</label>
                <input
                  type="text"
                  value={quickSupForm.contact_name}
                  onChange={(e) => setQuickSupForm({ ...quickSupForm, contact_name: e.target.value })}
                  placeholder="e.g. Imad"
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Phone Number</label>
                <input
                  type="text"
                  value={quickSupForm.phone}
                  onChange={(e) => setQuickSupForm({ ...quickSupForm, phone: e.target.value })}
                  placeholder="e.g. +961 3 123456"
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Lead Time</label>
                  <input
                    type="text"
                    value={quickSupForm.time_to_deliver}
                    onChange={(e) => setQuickSupForm({ ...quickSupForm, time_to_deliver: e.target.value })}
                    placeholder="e.g. Next day, 48h"
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Payment Terms</label>
                  <input
                    type="text"
                    value={quickSupForm.payment_terms}
                    onChange={(e) => setQuickSupForm({ ...quickSupForm, payment_terms: e.target.value })}
                    placeholder="e.g. Net 15, COD"
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddSupplierModal(false)} className="btn btn-secondary" style={{ fontSize: '13px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '13px' }}>Save & Select</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
