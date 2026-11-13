import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  X, 
  Search, 
  Edit,
  Clipboard,
  Grid,
  CheckCircle,
  XCircle,
  MapPin,
  HelpCircle,
  FolderOpen,
  Lock,
  Package,
  Layers,
  Scale,
  Star,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  FileSpreadsheet,
  Upload,
  Download
} from 'lucide-react';
import { api } from '../api/client';
import { supabase } from '../api/supabase';
import { canonicalUnit, conversionFactor, getConvertibleUnits, unitDimension } from '../utils/inventoryConfiguration';
import {
  generatePackagingTemplate,
  parsePackagingExcelOrCsv,
  generateItemCatalogTemplate,
  parseItemCatalogExcel
} from '../utils/recipeExcelImport';
import './DashboardScreen.css';

export default function ItemCatalogScreen({ user, permissions }: { user: any; permissions?: any }) {
  const isPrivileged = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'admin';
  const canManage = isPrivileged || !!permissions?.can_manage_catalog;

  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [inventoryLocations, setInventoryLocations] = useState<any[]>([]);

  // Location Modal State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [locationFormName, setLocationFormName] = useState('');

  // Search & Filter State
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filterDept, setFilterDept] = useState('All');
  const [filterSubDept, setFilterSubDept] = useState('All');
  const [filterOrder, setFilterOrder] = useState('All');
  const [filterPurchasing, setFilterPurchasing] = useState('All');

  // Sort State
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Catalog Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Units & Packaging state
  const [formBaseUnit, setFormBaseUnit] = useState('kg');
  const [formPreferredRecipeUnit, setFormPreferredRecipeUnit] = useState('g');
  const [itemHistoryStatus, setItemHistoryStatus] = useState<any | null>(null);
  const [packagingOptions, setPackagingOptions] = useState<any[]>([]);
  const [itemConversions, setItemConversions] = useState<any[]>([]);
  const [allConversions, setAllConversions] = useState<any[]>([]);
  const [showAddPackForm, setShowAddPackForm] = useState(false);
  const [newPack, setNewPack] = useState({
    brand: '',
    supplier_id: '',
    supplier_sku: '',
    purchase_unit: '',
    pack_description: '',
    base_quantity_per_purchase_unit: '',
    purchase_unit_price: '',
    is_default: false,
    is_active: true
  });
  const [showAddConvForm, setShowAddConvForm] = useState(false);
  const [newConv, setNewConv] = useState({
    from_unit: '',
    to_unit: '',
    conversion_factor: ''
  });

  // Parent Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [deptFormName, setDeptFormName] = useState('');

  // Sub-Department Modal State
  const [showSubDeptModal, setShowSubDeptModal] = useState(false);

  // Item Delete & Usage Check State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<any>(null);
  const [checkingDeleteUsage, setCheckingDeleteUsage] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const [editingSubDept, setEditingSubDept] = useState<any | null>(null);
  const [subDeptFormName, setSubDeptFormName] = useState('');
  const [subDeptParentName, setSubDeptParentName] = useState('');

  // Item Form Fields
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formSubDept, setFormSubDept] = useState('');
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formParLevel, setFormParLevel] = useState('0');
  const [formStep, setFormStep] = useState('1');
  const [formOrder, setFormOrder] = useState<'yes' | 'no'>('yes');
  const [formPurchasing, setFormPurchasing] = useState<'yes' | 'no'>('no');
  const [formDeliveryTime, setFormDeliveryTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formPriceUsd, setFormPriceUsd] = useState('0.00');
  const [formVat, setFormVat] = useState<'yes' | 'no'>('no');



  useEffect(() => {
    loadLookups();
    loadCatalogItems();
  }, []);

  useEffect(() => {
    if (formBaseUnit) {
      const factor = conversionFactor(editItemId, formPreferredRecipeUnit, formBaseUnit, allConversions, packagingOptions);
      if (factor === null) {
        if (formBaseUnit === 'kg') setFormPreferredRecipeUnit('g');
        else if (formBaseUnit === 'l' || formBaseUnit === 'liter') setFormPreferredRecipeUnit('ml');
        else setFormPreferredRecipeUnit(formBaseUnit);
      }
    }
  }, [formBaseUnit]);

  const loadLookups = async () => {
    try {
      const [deptRes, subDeptRes, suppliersRes, locationsRes] = await Promise.all([
        api.getDepartmentsList(),
        api.getSubDepartmentsList(),
        api.getSuppliers(),
        api.getInventoryLocationsList()
      ]);
      if (deptRes.success && deptRes.data) {
        setDepartmentsList(deptRes.data);
        setDepartments(deptRes.data.map((d: any) => typeof d === 'string' ? d : d.name));
      } else {
        const fallback = [
          { id: 1, name: 'Bar' },
          { id: 2, name: 'Kitchen' },
          { id: 3, name: 'Pastry' },
          { id: 4, name: 'Storage' },
          { id: 5, name: 'Supplies' }
        ];
        setDepartmentsList(fallback);
        setDepartments(fallback.map(d => d.name));
      }

      if (subDeptRes.success && subDeptRes.data) {
        setSubDepartments(subDeptRes.data);
      } else {
        setSubDepartments([
          { department_name: 'Bar', name: 'Alcohol' },
          { department_name: 'Bar', name: 'Coffee' },
          { department_name: 'Bar', name: 'Soft Drinks' },
          { department_name: 'Bar', name: 'Consumables' },
          { department_name: 'Kitchen', name: 'Meats' },
          { department_name: 'Kitchen', name: 'Vegetables' },
          { department_name: 'Kitchen', name: 'Dry Goods' },
          { department_name: 'Kitchen', name: 'Dairy' },
          { department_name: 'Pastry', name: 'Desserts' },
          { department_name: 'Pastry', name: 'Chocolates' },
          { department_name: 'Storage', name: 'Packaging' },
          { department_name: 'Supplies', name: 'Cleaning' }
        ]);
      }

      if (suppliersRes.success && suppliersRes.data) {
        setSuppliers(suppliersRes.data);
      } else {
        setSuppliers([]);
      }

      const DEFAULT_LOCATIONS = [
        { id: 'loc-1', name: 'Main Kitchen' },
        { id: 'loc-2', name: 'Bar' },
        { id: 'loc-3', name: 'Cold Room / Fridge' },
        { id: 'loc-4', name: 'Bar Fridge' },
        { id: 'loc-5', name: 'Dry Storage' },
        { id: 'loc-6', name: 'Main Warehouse' }
      ];

      const dbLocs = (locationsRes && locationsRes.success && locationsRes.data) ? locationsRes.data : [];
      const locsMap = new Map();
      DEFAULT_LOCATIONS.forEach(l => locsMap.set(l.name, l));
      dbLocs.forEach((l: any) => locsMap.set(l.name, l));

      setInventoryLocations(Array.from(locsMap.values()));

      const convRes = await api.getInventoryUnitConversions();
      if (convRes.success && convRes.data) {
        setAllConversions(convRes.data);
      }
    } catch (e) {
      console.error('Error loading lookups:', e);
    }
  };

  const loadCatalogItems = async () => {
    setLoading(true);
    try {
      const res = await api.getAllCatalogItems();
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('Error loading catalog items:', e);
    }
    setLoading(false);
  };

  const getAvailableSubDepts = (deptName: string) => {
    return subDepartments
      .filter((s: any) => s.department_name === deptName)
      .map((s: any) => s.name);
  };

  const handleToggleLocation = (sugg: string) => {
    const current = formLocation
      ? formLocation.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const exists = current.includes(sugg);
    let updated;
    if (exists) {
      updated = current.filter(item => item !== sugg);
    } else {
      updated = [...current, sugg];
    }
    setFormLocation(updated.join(', '));
  };

  // --- Catalog Item Save & Delete ---
  const openCreateItemModal = () => {
    setIsEditingItem(false);
    setEditItemId(null);
    setFormName('');
    const initialDept = departments.length > 0 ? departments[0] : 'Kitchen';
    setFormDept(initialDept);
    
    const availableSubs = getAvailableSubDepts(initialDept);
    setFormSubDept(availableSubs.length > 0 ? availableSubs[0] : 'Other');
    
    setFormUnit('kg');
    setFormBaseUnit('kg');
    setFormPreferredRecipeUnit('g');
    setFormParLevel('0');
    setFormStep('1');
    setFormOrder('yes');
    setFormPurchasing('no');
    setFormDeliveryTime('');
    setFormLocation('');
    setFormSupplierId('');
    setFormPriceUsd('0.00');
    setFormVat('no');
    setItemHistoryStatus(null);
    setPackagingOptions([]);
    setItemConversions([]);
    setShowAddPackForm(false);
    setShowAddConvForm(false);
    setShowItemModal(true);
  };

  const closeModal = () => {
    setShowItemModal(false);
    setIsEditingItem(false);
    setEditItemId(null);
    setPackagingOptions([]);
    setItemConversions([]);
    setItemHistoryStatus(null);
    setShowAddPackForm(false);
    setShowAddConvForm(false);
  };

  const openEditItemModal = async (item: any) => {
    setIsEditingItem(true);
    setEditItemId(item.id);
    setFormName(item.name || '');
    setFormDept(item.department || '');
    setFormSubDept(item.sub_department || '');
    const bUnit = canonicalUnit(item.base_unit || item.unit || 'kg');
    const rUnit = canonicalUnit(item.preferred_recipe_unit || bUnit);
    setFormUnit(item.unit || bUnit);
    setFormBaseUnit(bUnit);
    setFormPreferredRecipeUnit(rUnit);
    setFormParLevel(String(item.par_level || '0'));
    setFormStep(String(item.step || '1'));
    setFormOrder(item.order === 'yes' ? 'yes' : 'no');
    setFormPurchasing(item.purchasing === 'yes' ? 'yes' : 'no');
    setFormDeliveryTime(item.delivery_time || '');
    setFormLocation(item.inventory_location || '');
    setFormSupplierId(item.supplier_id || '');
    setFormPriceUsd(String(item.price_usd || '0.00'));
    setFormVat(item.vat === 'yes' ? 'yes' : 'no');
    setShowAddPackForm(false);
    setShowAddConvForm(false);
    // Explicitly reset packaging options, conversions, and history for this item
    setPackagingOptions([]);
    setItemConversions([]);
    setItemHistoryStatus(null);
    setShowItemModal(true);

    // Load history lock status, packaging options, and item-specific conversions
    try {
      const [histRes, packRes, convRes] = await Promise.allSettled([
        api.checkItemHasHistory ? api.checkItemHasHistory(item.id) : Promise.resolve({ success: true, data: { has_history: false } }),
        api.getItemPackagingOptions(item.id),
        api.getInventoryUnitConversions()
      ]);

      if (histRes.status === 'fulfilled' && histRes.value?.success) {
        setItemHistoryStatus(histRes.value.data);
      }

      if (packRes.status === 'fulfilled' && packRes.value?.success) {
        const pData = packRes.value.data || [];
        setPackagingOptions(pData);
        const activePacks = pData.filter((p: any) => p.is_active !== false);
        const defPack = activePacks.find((p: any) => p.is_default) || activePacks[0];
        if (defPack && defPack.supplier_id) {
          setFormSupplierId(defPack.supplier_id);
          const bQty = Number(defPack.base_quantity_per_purchase_unit) || 1;
          const pPrice = Number(defPack.purchase_unit_price) || 0;
          if (bQty > 0 && pPrice > 0) {
            setFormPriceUsd((pPrice / bQty).toFixed(4));
          }
        }
      } else {
        setPackagingOptions([]);
      }

      if (convRes.status === 'fulfilled' && convRes.value?.success && convRes.value.data) {
        setAllConversions(convRes.value.data);
        setItemConversions(convRes.value.data.filter((c: any) => c.item_id === item.id));
      }
    } catch (e) {
      console.error('Error fetching item packaging/history:', e);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteUsage(null);
    setCheckingDeleteUsage(true);

    try {
      const usage = await api.checkCatalogItemUsage(id);
      setDeleteUsage(usage);
    } catch (e: any) {
      console.error('Error checking item usage:', e);
      setDeleteUsage({
        success: false,
        error: e.message,
        inUse: false,
        hasActiveRecipes: false,
        recipes: [],
        productionRecipes: [],
        modifiers: [],
        productMappings: [],
        packagingCount: 0,
        conversionCount: 0
      });
    } finally {
      setCheckingDeleteUsage(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return;
    setDeletingItem(true);
    try {
      const res = await api.deleteCatalogItem(deleteTarget.id);
      if (res.success) {
        setDeleteTarget(null);
        setDeleteUsage(null);
        if (editItemId === deleteTarget.id) {
          closeModal();
        }
        await loadCatalogItems();
      } else {
        alert('Error deleting item: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setDeletingItem(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Please enter an item name.');
      return;
    }
    if (!formDept) {
      alert('Please select a department.');
      return;
    }
    if (!formSubDept) {
      alert('Please select a sub-department.');
      return;
    }

    setSubmitting(true);
    try {
      const bUnit = canonicalUnit(formBaseUnit || formUnit || 'kg');
      let rUnit = canonicalUnit(formPreferredRecipeUnit || bUnit);

      // Validate preferred recipe unit can convert to base unit
      let checkFactor = conversionFactor(editItemId, rUnit, bUnit, allConversions, packagingOptions);
      if (checkFactor === null) {
        const baseFactor = conversionFactor(editItemId, bUnit, bUnit, allConversions, packagingOptions);
        if (baseFactor !== null) {
          rUnit = bUnit;
          setFormPreferredRecipeUnit(bUnit);
          checkFactor = baseFactor;
        }
      }
      if (checkFactor === null) {
        alert(`Cannot save: Preferred recipe unit "${rUnit}" does not have a valid conversion path to base unit "${bUnit}". Please configure a conversion or choose a compatible unit.`);
        setSubmitting(false);
        return;
      }

      // If packaging options are present, ensure supplier_id and price_usd sync with default pack
      const activePacks = packagingOptions.filter(p => p.is_active !== false);
      const defaultPack = activePacks.find(p => p.is_default) || activePacks[0];
      const effSupplierId = (activePacks.length > 0 && defaultPack?.supplier_id) ? defaultPack.supplier_id : (formSupplierId || null);
      let effPriceUsd = parseFloat(formPriceUsd) || 0;
      if (activePacks.length > 0 && defaultPack) {
        const bQty = Number(defaultPack.base_quantity_per_purchase_unit) || 1;
        const pPrice = Number(defaultPack.purchase_unit_price) || 0;
        if (bQty > 0 && pPrice > 0) {
          effPriceUsd = Number((pPrice / bQty).toFixed(4));
        }
      }

      const payload: any = {
        name: formName.trim(),
        department: formDept,
        sub_department: formSubDept,
        unit: bUnit,
        base_unit: bUnit,
        preferred_recipe_unit: rUnit,
        par_level: parseFloat(formParLevel) || 0,
        step: parseFloat(formStep) || 1,
        order: formOrder,
        purchasing: formPurchasing,
        delivery_time: formPurchasing === 'yes' ? formDeliveryTime.trim() : null,
        inventory_location: formLocation.trim() || null,
        supplier_id: effSupplierId,
        price_usd: effPriceUsd,
        vat: formVat,
        restaurant_id: user?.restaurant_id
      };

      if (isEditingItem && editItemId) {
        payload.id = editItemId;
      }

      const res = await api.saveCatalogItem(payload);
      if (res.success) {
        const savedItemId = editItemId || res.data?.id;
        if (savedItemId) {
          // If the user filled in the "New Purchase Pack Option" subform and directly clicked "Save Changes"
          if (newPack.purchase_unit.trim() && Number(newPack.base_quantity_per_purchase_unit) > 0 && Number(newPack.purchase_unit_price) > 0) {
            try {
              const bQty = Number(newPack.base_quantity_per_purchase_unit);
              const pPrice = Number(newPack.purchase_unit_price);
              const bPrice = Number((pPrice / bQty).toFixed(4));
              const packDesc = newPack.pack_description.trim() || `${newPack.purchase_unit.trim()} (${bQty} ${bUnit})`;
              await api.saveItemPackagingOption({
                item_id: savedItemId,
                brand: newPack.brand.trim() || null,
                supplier_id: newPack.supplier_id || null,
                supplier_sku: newPack.supplier_sku.trim() || null,
                purchase_unit: newPack.purchase_unit.trim(),
                pack_description: packDesc,
                base_quantity_per_purchase_unit: bQty,
                base_unit: bUnit,
                purchase_unit_price: pPrice,
                base_unit_price: bPrice,
                is_default: newPack.is_default || packagingOptions.length === 0,
                is_active: newPack.is_active
              });
            } catch (err) {
              console.error('Error auto-saving pending packaging option:', err);
            }
          }

          const tempPacks = packagingOptions.filter(p => String(p.id).startsWith('temp-'));
          for (const tp of tempPacks) {
            try {
              await api.saveItemPackagingOption({
                item_id: savedItemId,
                brand: tp.brand,
                supplier_id: tp.supplier_id,
                supplier_sku: tp.supplier_sku,
                purchase_unit: tp.purchase_unit,
                pack_description: tp.pack_description,
                base_quantity_per_purchase_unit: tp.base_quantity_per_purchase_unit,
                base_unit: tp.base_unit || bUnit,
                purchase_unit_price: tp.purchase_unit_price,
                base_unit_price: tp.base_unit_price,
                is_default: tp.is_default,
                is_active: tp.is_active !== false
              });
            } catch (err) {
              console.error('Error saving staged packaging option:', err);
            }
          }

          // If the user filled in the "Add Custom Conversion" subform and directly clicked "Save Changes"
          if (newConv.from_unit.trim() && Number(newConv.conversion_factor) > 0) {
            try {
              const toUnit = (newConv.to_unit.trim() || bUnit).trim();
              await api.saveItemUnitConversion({
                item_id: savedItemId,
                from_unit: newConv.from_unit.trim(),
                to_unit: toUnit,
                conversion_factor: Number(newConv.conversion_factor),
                conversion_type: 'STANDARD'
              });
            } catch (err) {
              console.error('Error auto-saving pending unit conversion:', err);
            }
          }

          const tempConvs = itemConversions.filter(c => String(c.id).startsWith('temp-'));
          for (const tc of tempConvs) {
            try {
              await api.saveItemUnitConversion({
                item_id: savedItemId,
                from_unit: tc.from_unit,
                to_unit: tc.to_unit,
                conversion_factor: tc.conversion_factor,
                conversion_type: 'STANDARD'
              });
            } catch (err) {
              console.error('Error saving staged unit conversion:', err);
            }
          }
        }

        alert(isEditingItem ? 'Item updated successfully.' : 'Item created successfully.');
        closeModal();
        loadCatalogItems();
      } else {
        alert('Error saving item: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };


  // Packaging Option Actions
  const handleAddPackagingOption = async () => {
    if (!newPack.purchase_unit.trim() || !newPack.base_quantity_per_purchase_unit) {
      alert('Please specify the purchase packaging unit (e.g. Container, Case) and base quantity per pack.');
      return;
    }
    const bQty = Number(newPack.base_quantity_per_purchase_unit);
    if (!Number.isFinite(bQty) || bQty <= 0) {
      alert('Base quantity per pack must be greater than zero.');
      return;
    }
    const pPrice = Number(newPack.purchase_unit_price);
    if (!Number.isFinite(pPrice) || pPrice <= 0) {
      alert('Please enter a Pack Purchase Price ($) greater than 0 (e.g. 19.00).\nSupplier price lists require a valid purchase price.');
      return;
    }
    const bPrice = Number((pPrice / bQty).toFixed(4));
    const packDesc = newPack.pack_description.trim() || `${newPack.purchase_unit.trim()} (${bQty} ${formBaseUnit})`;

    if (editItemId) {
      const payload = {
        item_id: editItemId,
        brand: newPack.brand.trim() || null,
        supplier_id: newPack.supplier_id || null,
        supplier_sku: newPack.supplier_sku.trim() || null,
        purchase_unit: newPack.purchase_unit.trim(),
        pack_description: packDesc,
        base_quantity_per_purchase_unit: bQty,
        base_unit: formBaseUnit,
        purchase_unit_price: pPrice,
        base_unit_price: bPrice,
        is_default: newPack.is_default,
        is_active: newPack.is_active
      };
      const res = await api.saveItemPackagingOption(payload);
      if (res.success) {
        const updated = await api.getItemPackagingOptions(editItemId);
        if (updated.success && updated.data) {
          setPackagingOptions(updated.data);
          const activePacks = updated.data.filter((p: any) => p.is_active !== false);
          const defPack = activePacks.find((p: any) => p.is_default) || activePacks[0];
          if (defPack && defPack.supplier_id) {
            setFormSupplierId(defPack.supplier_id);
            const defBQty = Number(defPack.base_quantity_per_purchase_unit) || 1;
            const defPPrice = Number(defPack.purchase_unit_price) || 0;
            if (defBQty > 0 && defPPrice > 0) {
              setFormPriceUsd((defPPrice / defBQty).toFixed(4));
            }
          }
        }
        setNewPack({
          brand: '',
          supplier_id: '',
          supplier_sku: '',
          purchase_unit: '',
          pack_description: '',
          base_quantity_per_purchase_unit: '',
          purchase_unit_price: '',
          is_default: false,
          is_active: true
        });
        setShowAddPackForm(false);
      } else {
        alert('Error saving packaging option: ' + res.error);
      }
    } else {
      // Local addition for new item
      const tempOption = {
        id: `temp-${Date.now()}`,
        brand: newPack.brand.trim() || null,
        supplier_id: newPack.supplier_id || null,
        supplier_sku: newPack.supplier_sku.trim() || null,
        purchase_unit: newPack.purchase_unit.trim(),
        pack_description: packDesc,
        base_quantity_per_purchase_unit: bQty,
        base_unit: formBaseUnit,
        purchase_unit_price: pPrice,
        base_unit_price: bPrice,
        is_default: newPack.is_default || packagingOptions.length === 0,
        is_active: newPack.is_active
      };
      setPackagingOptions(prev => [...prev, tempOption]);
      if (tempOption.is_default) {
        if (tempOption.supplier_id) setFormSupplierId(tempOption.supplier_id);
        if (bPrice > 0) setFormPriceUsd(bPrice.toFixed(4));
      }
      setNewPack({
        brand: '',
        supplier_id: '',
        supplier_sku: '',
        purchase_unit: '',
        pack_description: '',
        base_quantity_per_purchase_unit: '',
        purchase_unit_price: '',
        is_default: false,
        is_active: true
      });
      setShowAddPackForm(false);
    }
  };

  const handleSetDefaultPackaging = async (option: any) => {
    if (editItemId && !option.id.startsWith('temp-')) {
      const payload = {
        ...option,
        is_default: true
      };
      const res = await api.saveItemPackagingOption(payload);
      if (res.success) {
        const updated = await api.getItemPackagingOptions(editItemId);
        if (updated.success && updated.data) {
          setPackagingOptions(updated.data);
          if (option.supplier_id) setFormSupplierId(option.supplier_id);
          const bQty = Number(option.base_quantity_per_purchase_unit) || 1;
          const pPrice = Number(option.purchase_unit_price) || 0;
          if (bQty > 0 && pPrice > 0) {
            setFormPriceUsd((pPrice / bQty).toFixed(4));
          }
        }
      } else {
        alert('Error setting default packaging option: ' + res.error);
      }
    } else {
      setPackagingOptions(prev => prev.map(p => ({
        ...p,
        is_default: p.id === option.id
      })));
      if (option.supplier_id) setFormSupplierId(option.supplier_id);
      const bQty = Number(option.base_quantity_per_purchase_unit) || 1;
      const pPrice = Number(option.purchase_unit_price) || 0;
      if (bQty > 0 && pPrice > 0) {
        setFormPriceUsd((pPrice / bQty).toFixed(4));
      }
    }
  };

  const handleDeletePackagingOption = async (optionId: string) => {
    if (!window.confirm('Delete this packaging option?')) return;
    if (editItemId && !String(optionId).startsWith('temp-')) {
      const res = await api.deleteItemPackagingOption(optionId, false);
      if (res.success) {
        const [updated, convRes] = await Promise.all([
          api.getItemPackagingOptions(editItemId),
          api.getInventoryUnitConversions()
        ]);
        if (updated.success && updated.data) setPackagingOptions(updated.data);
        if (convRes.success && convRes.data) {
          setAllConversions(convRes.data);
          setItemConversions(convRes.data.filter((c: any) => c.item_id === editItemId));
        }
      } else {
        alert('Error: ' + res.error);
      }
    } else {
      setPackagingOptions(prev => prev.filter(p => p.id !== optionId));
    }
  };

  const handleDownloadItemsTemplate = () => {
    generateItemCatalogTemplate(items, suppliers);
  };

  const handleImportItemsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const parsed = await parseItemCatalogExcel(file);
      if (!parsed.success) {
        alert('Validation errors in catalog spreadsheet:\n\n' + parsed.errors.slice(0, 10).join('\n'));
        return;
      }
      if (parsed.data.length === 0) {
        alert('No catalog items found in spreadsheet to import.');
        return;
      }

      if (!window.confirm(`Found ${parsed.data.length} catalog item(s). Do you want to import / update them now?`)) return;

      let savedCount = 0;
      for (const row of parsed.data) {
        const existing = items.find(i => i.name.trim().toLowerCase() === row.name.trim().toLowerCase());
        
        let suppId = existing?.supplier_id || null;
        if (row.supplier_name) {
          const sMatch = suppliers.find(s => s.name.trim().toLowerCase() === row.supplier_name!.trim().toLowerCase());
          if (sMatch) suppId = sMatch.id;
        }

        const payload: any = {
          id: existing?.id,
          name: row.name,
          department: row.department,
          sub_department: row.sub_department,
          base_unit: row.base_unit,
          unit: row.base_unit,
          preferred_recipe_unit: row.preferred_recipe_unit,
          price_usd: row.price_usd,
          par_level: row.par_level,
          step: row.step,
          order: row.order,
          purchasing: row.purchasing,
          vat: row.vat,
          supplier_id: suppId,
          delivery_time: row.delivery_time || (existing?.delivery_time || null),
          inventory_location: row.inventory_location || (existing?.inventory_location || null),
          restaurant_id: user?.restaurant_id
        };

        const res = await api.saveCatalogItem(payload);
        if (res.success) {
          savedCount++;

          // If row includes packaging unit and pack size, auto-sync packaging option
          if (row.purchase_unit && row.pack_size) {
            try {
              let targetItemId = existing?.id;
              if (!targetItemId) {
                const refreshed = await api.getCatalogItems();
                const freshItem = refreshed.data?.find((i: any) => i.name.trim().toLowerCase() === row.name.trim().toLowerCase());
                targetItemId = freshItem?.id;
              }
              if (targetItemId) {
                await api.saveItemPackagingOption({
                  item_id: targetItemId,
                  purchase_unit: row.purchase_unit,
                  base_quantity_per_purchase_unit: row.pack_size,
                  purchase_unit_price: row.pack_price !== undefined ? row.pack_price : (row.price_usd * row.pack_size),
                  supplier_id: suppId,
                  is_default: true,
                  is_active: true
                });
              }
            } catch (packErr) {
              console.warn('Auto-pack creation warning:', packErr);
            }
          }
        }
      }

      alert(`Successfully imported/updated ${savedCount} of ${parsed.data.length} catalog item(s)!`);
      loadCatalogItems();
    } catch (err: any) {
      alert('Error importing catalog items: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDownloadPackagingTemplate = async () => {
    try {
      setLoading(true);
      const packRes = await api.getAllItemPackagingOptions();
      const allPacks = (packRes.success && packRes.data) ? packRes.data : [];
      generatePackagingTemplate(items, suppliers, allPacks);
    } catch (e: any) {
      console.warn('Could not fetch existing packs, generating template from items:', e);
      generatePackagingTemplate(items, suppliers);
    } finally {
      setLoading(false);
    }
  };

  const handleImportPackagingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const parsed = await parsePackagingExcelOrCsv(file, items, suppliers);
      if (!parsed.success) {
        alert('Validation errors in packaging spreadsheet:\n\n' + parsed.errors.slice(0, 10).join('\n') + (parsed.errors.length > 10 ? `\n...and ${parsed.errors.length - 10} more errors.` : ''));
        return;
      }

      if (parsed.data.length === 0) {
        alert('No packaging rows to import. Make sure at least one item has "Purchase Unit" and "Pack Size" filled in.');
        return;
      }

      const confirmMsg = `Found ${parsed.data.length} valid packaging option(s) for your catalog items.\n\nDo you want to import and save them now?`;
      if (!window.confirm(confirmMsg)) return;

      // Fetch existing options to update matching records instead of creating duplicate rows
      const packRes = await api.getAllItemPackagingOptions();
      const existingPacks = (packRes.success && packRes.data) ? packRes.data : [];

      let importedCount = 0;
      for (const row of parsed.data) {
        let itemId = row.item_id;

        // Auto-create item in items table if not yet present
        if (!itemId && row.autoCreateItem) {
          const createRes = await api.saveCatalogItem({
            name: row.autoCreateItem.name,
            department: row.autoCreateItem.department,
            sub_department: row.autoCreateItem.sub_department,
            base_unit: row.autoCreateItem.base_unit,
            unit: row.autoCreateItem.base_unit,
            preferred_recipe_unit: row.autoCreateItem.preferred_recipe_unit,
            price_usd: row.autoCreateItem.price,
            purchasing: 'yes',
            order: 'no'
          });
          if (createRes.success) {
            const { data: created } = await supabase.from('items').select('id').eq('name', row.autoCreateItem.name).order('created_at', { ascending: false }).limit(1).single();
            itemId = created?.id;
          }
        }

        if (!itemId) continue;

        const matchingExisting = existingPacks.find(
          (p: any) =>
            p.item_id === itemId &&
            String(p.purchase_unit || '').trim().toLowerCase() === row.purchase_unit.trim().toLowerCase() &&
            String(p.brand || '').trim().toLowerCase() === (row.brand || '').trim().toLowerCase() &&
            (p.supplier_id || null) === (row.supplier_id || null)
        );

        const payload: any = {
          id: matchingExisting?.id,
          item_id: itemId,
          brand: row.brand || null,
          supplier_id: row.supplier_id || null,
          purchase_unit: row.purchase_unit,
          pack_description: `${row.brand ? row.brand + ' ' : ''}${row.purchase_unit} (${row.pack_size} ${row.base_unit})`,
          base_quantity_per_purchase_unit: row.pack_size,
          base_unit: row.base_unit,
          purchase_unit_price: row.price || 0,
          base_unit_price: (row.price && row.pack_size > 0) ? (row.price / row.pack_size) : 0,
          is_default: row.is_default,
          is_active: true
        };
        const res = await api.saveItemPackagingOption(payload);
        if (res.success) importedCount++;
      }

      alert(`Successfully saved ${importedCount} of ${parsed.data.length} packaging option(s) to your item catalog!`);

      // Refresh packaging options if currently editing item
      if (editItemId) {
        const updated = await api.getItemPackagingOptions(editItemId);
        if (updated.success && updated.data) setPackagingOptions(updated.data);
      }
      loadCatalogItems();
    } catch (err: any) {
      alert('Error importing packaging spreadsheet: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // Unit Conversion Actions
  const handleAddUnitConversion = async () => {
    const toUnit = (newConv.to_unit.trim() || formBaseUnit).trim();
    if (!newConv.from_unit.trim() || !toUnit || !newConv.conversion_factor) {
      alert('Please specify From Unit, To Unit, and a positive conversion factor.');
      return;
    }
    const factor = Number(newConv.conversion_factor);
    if (!Number.isFinite(factor) || factor <= 0) {
      alert('Conversion factor must be greater than zero.');
      return;
    }

    if (editItemId) {
      const payload = {
        item_id: editItemId,
        from_unit: newConv.from_unit.trim(),
        to_unit: toUnit,
        conversion_factor: factor,
        conversion_type: 'STANDARD'
      };
      const res = await api.saveItemUnitConversion(payload);
      if (res.success) {
        const allRes = await api.getInventoryUnitConversions();
        if (allRes.success && allRes.data) {
          setAllConversions(allRes.data);
          setItemConversions(allRes.data.filter((c: any) => c.item_id === editItemId));
        }
        setNewConv({ from_unit: '', to_unit: '', conversion_factor: '' });
        setShowAddConvForm(false);
      } else {
        alert('Error saving conversion: ' + res.error);
      }
    } else {
      setItemConversions(prev => [...prev, {
        id: `temp-${Date.now()}`,
        from_unit: newConv.from_unit.trim(),
        to_unit: toUnit,
        conversion_factor: factor
      }]);
      setNewConv({ from_unit: '', to_unit: '', conversion_factor: '' });
      setShowAddConvForm(false);
    }
  };

  const handleDeleteUnitConversion = async (convId: string) => {
    if (!window.confirm('Delete this unit conversion?')) return;
    if (editItemId && convId && !String(convId).startsWith('temp-')) {
      const res = await api.deleteItemUnitConversion(convId);
      if (res.success) {
        setItemConversions(prev => prev.filter(c => c.id !== convId));
        setAllConversions(prev => prev.filter(c => c.id !== convId));
        const allRes = await api.getInventoryUnitConversions();
        if (allRes.success && allRes.data) {
          setAllConversions(allRes.data);
          setItemConversions(allRes.data.filter((c: any) => c.item_id === editItemId));
        }
      } else {
        alert('Error deleting unit conversion: ' + res.error);
      }
    } else {
      setItemConversions(prev => prev.filter(c => c.id !== convId));
    }
  };

  // --- Department Actions ---
  const openCreateDeptModal = () => {
    setEditingDept(null);
    setDeptFormName('');
    setShowDeptModal(true);
  };

  const openEditDeptModal = (dept: any) => {
    setEditingDept(dept);
    setDeptFormName(dept.name);
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptFormName.trim()) {
      alert('Please enter a department name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { 
        name: deptFormName.trim(),
        restaurant_id: user?.restaurant_id
      };
      if (editingDept?.id) {
        payload.id = editingDept.id;
      } else {
        payload.id = Math.floor(Date.now() / 1000);
      }
      const res = await api.saveDepartment(payload);
      if (res.success) {
        alert('Department saved successfully.');
        setShowDeptModal(false);
        await loadLookups();
      } else {
        alert('Error saving department: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteDept = async (id: number, name: string) => {
    const count = items.filter(item => item.department === name).length;
    if (count > 0) {
      alert(`Cannot delete department "${name}" because it is currently assigned to ${count} catalog items. Please reassign those items first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete department "${name}"? This will delete all sub-departments linked to it.`)) return;
    
    try {
      const res = await api.deleteDepartment(id);
      if (res.success) {
        alert('Department deleted successfully.');
        await loadLookups();
      } else {
        alert('Error deleting department: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // --- Sub-Department Actions ---
  const openCreateSubDeptModal = (parentDeptName: string) => {
    setEditingSubDept(null);
    setSubDeptFormName('');
    setSubDeptParentName(parentDeptName);
    setShowSubDeptModal(true);
  };

  const openEditSubDeptModal = (subDept: any, parentDeptName: string) => {
    setEditingSubDept(subDept);
    setSubDeptFormName(subDept.name);
    setSubDeptParentName(parentDeptName);
    setShowSubDeptModal(true);
  };

  const handleSaveSubDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subDeptFormName.trim()) {
      alert('Please enter a sub-department name.');
      return;
    }
    if (!subDeptParentName) {
      alert('Parent department is missing.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { 
        department_name: subDeptParentName,
        name: subDeptFormName.trim(),
        restaurant_id: user?.restaurant_id
      };
      if (editingSubDept?.id) {
        payload.id = editingSubDept.id;
      } else {
        payload.id = Math.floor(Date.now() / 1000);
      }
      const res = await api.saveSubDepartment(payload);
      if (res.success) {
        alert('Sub-department saved successfully.');
        setShowSubDeptModal(false);
        await loadLookups();
      } else {
        alert('Error saving sub-department: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteSubDept = async (id: number, name: string) => {
    const count = items.filter(item => item.sub_department === name).length;
    if (count > 0) {
      alert(`Cannot delete sub-department "${name}" because it is currently assigned to ${count} catalog items. Please reassign those items first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete sub-department "${name}"?`)) return;
    
    try {
      const res = await api.deleteSubDepartment(id);
      if (res.success) {
        alert('Sub-department deleted successfully.');
        await loadLookups();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // --- Location Actions ---
  const openCreateLocationModal = () => {
    setEditingLocation(null);
    setLocationFormName('');
    setShowLocationModal(true);
  };

  const openEditLocationModal = (loc: any) => {
    setEditingLocation(loc);
    setLocationFormName(loc.name);
    setShowLocationModal(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationFormName.trim()) {
      alert('Please enter a location name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { 
        name: locationFormName.trim(),
        restaurant_id: user?.restaurant_id
      };
      if (editingLocation?.id) {
        payload.id = editingLocation.id;
      }
      const res = await api.saveInventoryLocation(payload);
      if (res.success) {
        alert('Location saved successfully.');
        setShowLocationModal(false);
        await loadLookups();
      } else {
        alert('Error saving location: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    const count = items.filter(item => {
      const current = item.inventory_location ? item.inventory_location.split(',').map((s: string) => s.trim()) : [];
      return current.includes(name);
    }).length;

    if (count > 0) {
      alert(`Cannot delete location "${name}" because it is currently assigned to ${count} catalog items. Please reassign those items first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete location "${name}"?`)) return;
    
    try {
      const res = await api.deleteInventoryLocation(id);
      if (res.success) {
        alert('Location deleted successfully.');
        await loadLookups();
      } else {
        alert('Error deleting location: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortValue = (item: any, field: string) => {
    switch (field) {
      case 'name':
        return (item.name || '').toLowerCase().trim();
      case 'department':
        return (item.department || '').toLowerCase().trim();
      case 'sub_department':
        return (item.sub_department || '').toLowerCase().trim();
      case 'unit':
        return (item.unit || '').toLowerCase().trim();
      case 'par_level':
        return Number(item.par_level) || 0;
      case 'step':
        return Number(item.step) || 0;
      case 'order':
        return item.order === 'yes' ? 1 : 0;
      case 'purchasing':
        return item.purchasing === 'yes' ? 1 : 0;
      case 'vat':
        return item.vat === 'yes' ? 1 : 0;
      case 'supplier_id':
      case 'supplier': {
        const supp = suppliers.find(s => s.id === item.supplier_id);
        return (supp?.name || '').toLowerCase().trim();
      }
      case 'price_usd':
      case 'price':
        return Number(item.price_usd) || 0;
      case 'inventory_location':
      case 'location':
        return (item.inventory_location || '').toLowerCase().trim();
      default: {
        const val = item[field];
        if (typeof val === 'number') return val;
        return (val || '').toString().toLowerCase().trim();
      }
    }
  };

  // Filter & Sort Catalog Items
  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      item.name?.toLowerCase().includes(searchLower) || 
      item.department?.toLowerCase().includes(searchLower) || 
      item.sub_department?.toLowerCase().includes(searchLower) || 
      item.unit?.toLowerCase().includes(searchLower) || 
      String(item.par_level ?? '').toLowerCase().includes(searchLower) || 
      String(item.step ?? '').toLowerCase().includes(searchLower) || 
      item.inventory_location?.toLowerCase().includes(searchLower) ||
      (item.order === 'yes' ? 'yes ordering' : 'no ordering').includes(searchLower) ||
      (item.purchasing === 'yes' ? 'yes procurement' : 'no procurement').includes(searchLower);
    
    const matchesDept = filterDept === 'All' || item.department === filterDept;
    
    const matchesSubDept = filterSubDept === 'All' || item.sub_department === filterSubDept;
    
    const matchesOrder = filterOrder === 'All' || item.order === filterOrder;
    
    const matchesPurchasing = filterPurchasing === 'All' || item.purchasing === filterPurchasing;

    return matchesSearch && matchesDept && matchesSubDept && matchesOrder && matchesPurchasing;
  }).sort((a, b) => {
    const valA = getSortValue(a, sortField);
    const valB = getSortValue(b, sortField);

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }

    const strA = String(valA);
    const strB = String(valB);
    const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  // Calculate Metrics
  const totalCatalog = items.length;
  const orderingCount = items.filter(i => i.order === 'yes').length;
  const purchasingCount = items.filter(i => i.purchasing === 'yes').length;
  const bothCount = items.filter(i => i.order === 'yes' && i.purchasing === 'yes').length;

  // Style helpers
  const tableHeaderStyle: React.CSSProperties = {
    padding: '12px 16px',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid var(--border)'
  };

  const renderHeader = (label: string, field: string) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        style={{ 
          ...tableHeaderStyle, 
          cursor: 'pointer', 
          userSelect: 'none', 
          transition: 'all 0.15s ease',
          backgroundColor: isSorted ? '#f1f5f9' : undefined
        }}
        title={`Click to sort by ${label} (${isSorted && sortDirection === 'asc' ? 'descending' : 'ascending'})`}
        onMouseEnter={(e) => { 
          e.currentTarget.style.color = 'var(--text-main)'; 
          if (!isSorted) e.currentTarget.style.backgroundColor = '#f8fafc';
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.color = isSorted ? 'var(--text-main)' : 'var(--text-muted)'; 
          e.currentTarget.style.backgroundColor = isSorted ? '#f1f5f9' : 'transparent';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontWeight: isSorted ? 700 : 600, color: isSorted ? 'var(--text-main)' : undefined }}>
            {label}
          </span>
          <span style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            color: isSorted ? 'var(--primary)' : '#94a3b8',
            opacity: isSorted ? 1 : 0.45,
            transition: 'opacity 0.15s, color 0.15s'
          }}>
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ChevronUp size={15} style={{ strokeWidth: 3 }} />
              ) : (
                <ChevronDown size={15} style={{ strokeWidth: 3 }} />
              )
            ) : (
              <ArrowUpDown size={13} style={{ strokeWidth: 1.75 }} />
            )}
          </span>
        </div>
      </th>
    );
  };

  const tableCellStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--text-main)'
  };

  return (
    <div className="dashboard-container">
      {/* Title Row */}
      <div className="dashboard-title-row">
        <div>
          <h1>Item Catalog Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Unified catalog registry database of all operational goods, departments, sub-departments, and inventory locations.
          </p>
        </div>

        {/* Tab & Button Bar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                borderRadius: 0,
                backgroundColor: activeTab === 'items' ? 'var(--primary)' : '#ffffff',
                color: activeTab === 'items' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('items')}
            >
              Items Catalog
            </button>
            <button 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                borderRadius: 0,
                backgroundColor: activeTab === 'categories' ? 'var(--primary)' : '#ffffff',
                color: activeTab === 'categories' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('categories')}
            >
              Departments & Locations
            </button>
          </div>

          {canManage && (
            activeTab === 'items' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                {/* Unified Master Catalog Template & Import */}
                <button
                  type="button"
                  onClick={handleDownloadItemsTemplate}
                  className="auth-btn"
                  style={{
                    width: 'auto',
                    padding: '8px 14px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    whiteSpace: 'nowrap'
                  }}
                  title="Download complete Excel template matching 100% of catalog table & form fields"
                >
                  <FileSpreadsheet size={16} /> Catalog Template
                </button>
                <label
                  className="auth-btn"
                  style={{
                    width: 'auto',
                    padding: '8px 14px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    margin: 0,
                    whiteSpace: 'nowrap'
                  }}
                  title="Import complete catalog items and packaging from Excel or CSV"
                >
                  <Upload size={16} /> Import Catalog
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={handleImportItemsFile}
                  />
                </label>
                <button 
                  onClick={openCreateItemModal}
                  className="auth-btn"
                  style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={18} /> New Catalog Item
                </button>
              </div>
            ) : (
              <button 
                onClick={openCreateDeptModal}
                className="auth-btn"
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={18} /> Add Department
              </button>
            )
          )}
        </div>
      </div>

      {activeTab === 'items' && (
        <>
          {/* Metrics Cards */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Total Registry Items</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: 'var(--text-muted)' }}>
                  <Grid size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{totalCatalog}</span>
                <span className="kpi-card-label">Defined catalog inventory items</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Ordering Enabled</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <CheckCircle size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{orderingCount}</span>
                <span className="kpi-card-label">Items visible to branch orders</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Purchasing Enabled</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <Clipboard size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{purchasingCount}</span>
                <span className="kpi-card-label">Items visible to procurement</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">In Both Flows</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                  <HelpCircle size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{bothCount}</span>
                <span className="kpi-card-label">Items in both modules</span>
              </div>
            </div>
          </div>

          {/* Filter Row */}
          <div className="filters-card">
            <div className="filters-row">
              <div className="filter-group" style={{ minWidth: '220px' }}>
                <label>Search Registry</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="filter-input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="Search name, location..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-group">
                <label>Department</label>
                <select 
                  className="filter-select"
                  value={filterDept} 
                  onChange={(e) => {
                    setFilterDept(e.target.value);
                    setFilterSubDept('All');
                  }}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Sub-Department</label>
                <select 
                  className="filter-select"
                  value={filterSubDept} 
                  onChange={(e) => setFilterSubDept(e.target.value)}
                >
                  <option value="All">All Sub-Departments</option>
                  {filterDept !== 'All' && getAvailableSubDepts(filterDept).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '130px' }}>
                <label>Branch Ordering</label>
                <select 
                  className="filter-select"
                  value={filterOrder} 
                  onChange={(e) => setFilterOrder(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '130px' }}>
                <label>Procurement</label>
                <select 
                  className="filter-select"
                  value={filterPurchasing} 
                  onChange={(e) => setFilterPurchasing(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterDept('All');
                    setFilterSubDept('All');
                    setFilterOrder('All');
                    setFilterPurchasing('All');
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '42px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Items Registry Table */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div className="loading-container">
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p>Loading items registry...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <XCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title">No Catalog Items Found</span>
                <span className="empty-state-desc">Try modifying your query or filters.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      {renderHeader('Item Name', 'name')}
                      {renderHeader('Department', 'department')}
                      {renderHeader('Sub-Department', 'sub_department')}
                      {renderHeader('Unit', 'unit')}
                      {renderHeader('Par Level', 'par_level')}
                      {renderHeader('Step Size', 'step')}
                      {renderHeader('Ordering', 'order')}
                      {renderHeader('Procurement', 'purchasing')}
                      {renderHeader('VAT', 'vat')}
                      {renderHeader('Supplier', 'supplier_id')}
                      {renderHeader('Price', 'price_usd')}
                      {renderHeader('Location', 'inventory_location')}
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => openEditItemModal(item)}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s', cursor: 'pointer' }}
                      >
                        <td style={{ ...tableCellStyle, fontWeight: 700 }}>{item.name}</td>
                        <td style={tableCellStyle}>{item.department || '—'}</td>
                        <td style={tableCellStyle}>{item.sub_department || '—'}</td>
                        <td style={tableCellStyle}><span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>{item.unit || '—'}</span></td>
                        <td style={tableCellStyle}>{item.par_level ?? 0}</td>
                        <td style={tableCellStyle}>{item.step ?? 1}</td>
                        <td style={tableCellStyle}>
                          {item.order === 'yes' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Yes</span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>No</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {item.purchasing === 'yes' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
                              Yes{item.delivery_time ? ` (${item.delivery_time})` : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(156, 163, 175, 0.1)', color: 'var(--text-muted)' }}>No</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {item.vat === 'yes' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Yes</span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(156, 163, 175, 0.1)', color: 'var(--text-muted)' }}>No</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {suppliers.find(s => s.id === item.supplier_id)?.name || '—'}
                        </td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                          ${Number(item.price_usd || 0).toFixed(2)}
                        </td>
                        <td style={{ ...tableCellStyle, fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>
                          {item.inventory_location ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} /> {item.inventory_location}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditItemModal(item);
                              }}
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
                            >
                              {canManage ? (
                                <>
                                  <Edit size={12} /> Edit
                                </>
                              ) : (
                                <>
                                  <FolderOpen size={12} /> View
                                </>
                              )}
                            </button>
                            {canManage && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.id, item.name);
                                }}
                                className="auth-btn"
                                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {departmentsList.map((dept) => {
            const subs = subDepartments.filter(s => s.department_name === dept.name);
            return (
              <div key={dept.id} style={{ 
                backgroundColor: 'var(--surface)', 
                borderRadius: '12px', 
                border: '1px solid var(--border)', 
                boxShadow: 'var(--shadow)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px'
              }}>
                <div>
                  {/* Department Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderOpen size={20} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{dept.name}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEditDeptModal(dept)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(dept.id, dept.name)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Sub-departments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {subs.map((sub) => (
                      <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{sub.name}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditSubDeptModal(sub, dept.name)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '2px' }}
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubDept(sub.id, sub.name)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {subs.length === 0 && (
                      <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', padding: '8px 0' }}>
                        No sub-departments defined yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Sub-department button */}
                <button
                  type="button"
                  onClick={() => openCreateSubDeptModal(dept.name)}
                  className="auth-btn"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    fontSize: '12px', 
                    marginTop: '16px', 
                    border: '1px dashed var(--primary)', 
                    color: 'var(--primary)', 
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={12} /> Add Sub-department
                </button>
              </div>
            );
          })}

          {/* Inventory Locations Card */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '220px'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={20} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Inventory Locations</h3>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                {inventoryLocations.map((loc) => (
                  <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{loc.name}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEditLocationModal(loc)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '2px' }}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {inventoryLocations.length === 0 && (
                  <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', padding: '8px 0' }}>
                    No inventory locations defined yet.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateLocationModal}
              className="auth-btn"
              style={{
                marginTop: '16px',
                height: '36px',
                border: '1px dashed var(--primary)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                width: '100%'
              }}
            >
              <Plus size={14} /> Add Location
            </button>
          </div>

        </div>
      )}

      {/* CATALOG ITEM CREATE / EDIT DIALOG */}
      {showItemModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <form 
            onSubmit={handleSaveItem}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '550px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{isEditingItem ? 'Edit Catalog Item' : 'New Catalog Item'}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Provide item details for branch orders, inventories, and procurement catalogs.
                </p>
              </div>
              <button 
                type="button"
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Item Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Item Name *</label>
                <input 
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Almaza Beer 330ml, Tomatoes"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Department & Sub-Department Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Department *</label>
                  <select 
                    value={formDept}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      setFormDept(newDept);
                      const availableSubs = getAvailableSubDepts(newDept);
                      setFormSubDept(availableSubs.length > 0 ? availableSubs[0] : 'Other');
                    }}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Sub-Department *</label>
                  <select 
                    value={formSubDept}
                    onChange={(e) => setFormSubDept(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {(() => {
                      const subs = getAvailableSubDepts(formDept);
                      if (formSubDept && !subs.includes(formSubDept)) {
                        return [formSubDept, ...subs];
                      }
                      return subs;
                    })().map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {getAvailableSubDepts(formDept).length === 0 && formSubDept !== 'Other' && (
                      <option value="Other">Other</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Par Level and Step Size */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Par Level</label>
                  <input 
                    type="number"
                    step="any"
                    value={formParLevel}
                    onChange={(e) => setFormParLevel(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Step Size</label>
                  <input 
                    type="number"
                    step="any"
                    value={formStep}
                    onChange={(e) => setFormStep(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* SECTION: UNITS & PURCHASE PACKAGING */}
              <div style={{
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <Package size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Units & Purchase Packaging
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                      Ingredients represent a single stock item. Multiple brands and purchase pack sizes feed this exact item.
                    </p>
                  </div>
                </div>

                {/* Core Units: Base Unit & Preferred Recipe Unit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Inventory / Base Unit */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                        Inventory / Base Unit *
                      </label>
                      {itemHistoryStatus?.has_history && (
                        <span style={{ fontSize: '10px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
                          <Lock size={10} /> Locked
                        </span>
                      )}
                    </div>
                    <select
                      value={formBaseUnit}
                      disabled={!!itemHistoryStatus?.has_history}
                      onChange={(e) => {
                        const val = canonicalUnit(e.target.value);
                        setFormBaseUnit(val);
                        setFormUnit(val);
                        if (val === 'kg') setFormPreferredRecipeUnit('g');
                        else if (val === 'l' || val === 'liter') setFormPreferredRecipeUnit('ml');
                        else setFormPreferredRecipeUnit(val);
                      }}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        border: itemHistoryStatus?.has_history ? '1px solid #fca5a5' : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '13px',
                        backgroundColor: itemHistoryStatus?.has_history ? '#fef2f2' : '#ffffff',
                        fontWeight: 600
                      }}
                    >
                      <option value="kg">kg (Kilogram)</option>
                      <option value="g">g (Gram)</option>
                      <option value="l">l (Liter)</option>
                      <option value="ml">ml (Milliliter)</option>
                      <option value="pcs">pcs (Pieces / Count)</option>
                      <option value="portion">portion (Serving)</option>
                      <option value="bottle">bottle</option>
                      <option value="can">can</option>
                      <option value="box">box</option>
                    </select>
                    {itemHistoryStatus?.has_history ? (
                      <p style={{ fontSize: '11px', color: '#b91c1c', margin: 0 }}>
                        Item has {itemHistoryStatus.current_stock || 0} {formBaseUnit} stock or transactions. Direct relabeling is blocked to protect historical valuation.
                      </p>
                    ) : (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                        All stock balances, WAC costing, and consumption aggregate in this base unit.
                      </p>
                    )}
                  </div>

                  {/* Preferred Recipe Unit */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                      Preferred Recipe Unit *
                    </label>
                    <select
                      value={formPreferredRecipeUnit}
                      onChange={(e) => setFormPreferredRecipeUnit(canonicalUnit(e.target.value))}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '13px',
                        backgroundColor: '#ffffff',
                        fontWeight: 600
                      }}
                    >
                      {formBaseUnit === 'kg' && (
                        <>
                          <option value="g">g (Grams) - Recommended</option>
                          <option value="kg">kg (Kilograms)</option>
                          <option value="mg">mg (Milligrams)</option>
                        </>
                      )}
                      {formBaseUnit === 'g' && (
                        <>
                          <option value="g">g (Grams)</option>
                          <option value="kg">kg (Kilograms)</option>
                        </>
                      )}
                      {(formBaseUnit === 'l' || formBaseUnit === 'liter') && (
                        <>
                          <option value="ml">ml (Milliliters) - Recommended</option>
                          <option value="l">l (Liters)</option>
                          <option value="cl">cl (Centiliters)</option>
                        </>
                      )}
                      {(formBaseUnit === 'ml' || formBaseUnit === 'milliliter') && (
                        <>
                          <option value="ml">ml (Milliliters)</option>
                          <option value="l">l (Liters)</option>
                        </>
                      )}
                      {formBaseUnit === 'pcs' && (
                        <>
                          <option value="pcs">pcs (Pieces)</option>
                          <option value="portion">portion</option>
                        </>
                      )}
                      {['kg','g','l','ml','pcs'].indexOf(formBaseUnit) === -1 && (
                        <>
                          <option value={formBaseUnit}>{formBaseUnit}</option>
                          <option value="ml">ml (Milliliters)</option>
                          <option value="l">l (Liters)</option>
                          <option value="g">g (Grams)</option>
                          <option value="kg">kg (Kilograms)</option>
                          <option value="pcs">pcs</option>
                          <option value="portion">portion</option>
                        </>
                      )}
                    </select>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                      Default unit prefilled when adding this item to menu BOMs and prep recipes.
                    </p>
                  </div>
                </div>

                {/* Conversion Preview Badge */}
                {(() => {
                  let effectiveRecipeUnit = formPreferredRecipeUnit;
                  let factor = conversionFactor(editItemId, effectiveRecipeUnit, formBaseUnit, allConversions, packagingOptions);
                  if (factor === null && conversionFactor(editItemId, formBaseUnit, formBaseUnit, allConversions, packagingOptions) !== null) {
                    effectiveRecipeUnit = formBaseUnit;
                    factor = 1;
                  }
                  if (factor !== null) {
                    return (
                      <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Check size={14} />
                        <span>
                          Standard Conversion: <strong>1 {formBaseUnit} = {factor >= 1 ? (1/factor) : (1/factor).toFixed(0)} {effectiveRecipeUnit}</strong> (e.g. 80 {effectiveRecipeUnit} = {(80 * factor).toFixed(4)} {formBaseUnit} deducted).
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#991b1b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={14} />
                      <span>Warning: No conversion path from {formPreferredRecipeUnit} to {formBaseUnit}. Add an item conversion below.</span>
                    </div>
                  );
                })()}

                {/* Subsection: Multiple Purchase Packaging Options */}
                <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Purchase Packaging Options</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                        Different brands/pack sizes (e.g. 3.8 kg container vs 1 kg container vs Case of 4).
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleDownloadPackagingTemplate}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Download Excel template pre-populated with your catalog items"
                      >
                        <FileSpreadsheet size={13} /> Template
                      </button>
                      <label
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          margin: 0
                        }}
                        title="Upload Excel/CSV packaging spreadsheet"
                      >
                        <Upload size={13} /> Import
                        <input
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          style={{ display: 'none' }}
                          onChange={handleImportPackagingFile}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddPackForm(!showAddPackForm)}
                        className="auth-btn"
                        style={{
                          width: 'auto',
                          padding: '4px 10px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={13} /> {showAddPackForm ? 'Cancel' : 'Add Pack Option'}
                      </button>
                    </div>
                  </div>

                  {/* Add Packaging Option Form */}
                  {showAddPackForm && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <strong style={{ fontSize: '12px', color: 'var(--primary)' }}>New Purchase Pack Option</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block' }}>Brand</label>
                          <input
                            type="text"
                            placeholder="e.g. Brand A, Heinz"
                            value={newPack.brand}
                            onChange={(e) => setNewPack({ ...newPack, brand: e.target.value })}
                            style={{ height: '32px', width: '100%', fontSize: '12px', padding: '0 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block' }}>Purchase Unit *</label>
                          <input
                            type="text"
                            placeholder="e.g. Container, Case, Box"
                            value={newPack.purchase_unit}
                            onChange={(e) => setNewPack({ ...newPack, purchase_unit: e.target.value })}
                            style={{ height: '32px', width: '100%', fontSize: '12px', padding: '0 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block' }}>Base Qty per Pack ({formBaseUnit}) *</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 3.8, 1, 15.2"
                            value={newPack.base_quantity_per_purchase_unit}
                            onChange={(e) => {
                              const qtyVal = e.target.value;
                              const updates: any = { ...newPack, base_quantity_per_purchase_unit: qtyVal };
                              if (!newPack.purchase_unit_price && Number(qtyVal) > 0 && Number(formPriceUsd) > 0) {
                                updates.purchase_unit_price = (Number(formPriceUsd) * Number(qtyVal)).toFixed(2);
                              }
                              setNewPack(updates);
                            }}
                            style={{ height: '32px', width: '100%', fontSize: '12px', padding: '0 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block' }}>Supplier</label>
                          <select
                            value={newPack.supplier_id}
                            onChange={(e) => setNewPack({ ...newPack, supplier_id: e.target.value })}
                            style={{ height: '32px', width: '100%', fontSize: '12px', padding: '0 8px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: '#fff' }}
                          >
                            <option value="">No specific supplier</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block' }}>Supplier SKU</label>
                          <input
                            type="text"
                            placeholder="e.g. SKU-38"
                            value={newPack.supplier_sku}
                            onChange={(e) => setNewPack({ ...newPack, supplier_sku: e.target.value })}
                            style={{ height: '32px', width: '100%', fontSize: '12px', padding: '0 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', color: 'var(--text-main)' }}>
                            Pack Purchase Price ($) *
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            required
                            placeholder="e.g. 19.00"
                            value={newPack.purchase_unit_price}
                            onChange={(e) => setNewPack({ ...newPack, purchase_unit_price: e.target.value })}
                            style={{ height: '32px', width: '100%', fontSize: '12px', padding: '0 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          />
                        </div>
                      </div>

                      {/* Calculated Unit Cost preview */}
                      {Number(newPack.base_quantity_per_purchase_unit) > 0 && Number(newPack.purchase_unit_price) > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Calculated Base Cost: <strong>${(Number(newPack.purchase_unit_price) / Number(newPack.base_quantity_per_purchase_unit)).toFixed(4)} / {formBaseUnit}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newPack.is_default}
                            onChange={(e) => setNewPack({ ...newPack, is_default: e.target.checked })}
                          />
                          Set as Default Purchase Option
                        </label>
                        <button
                          type="button"
                          onClick={handleAddPackagingOption}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: 'var(--primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Save Packaging Option
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Packaging Options Table */}
                  {packagingOptions.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                      No packaging options added yet. Purchases will default to 1 {formBaseUnit}.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Brand</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Packaging / Unit</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Pack Size</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Supplier</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Pack Price</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cost / {formBaseUnit}</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>Default</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {packagingOptions.filter(p => p.is_active !== false).map((p) => {
                            const supp = suppliers.find(s => s.id === p.supplier_id) || p.suppliers;
                            const bQty = Number(p.base_quantity_per_purchase_unit) || 1;
                            const pPrice = Number(p.purchase_unit_price) || 0;
                            const unitCost = bQty > 0 ? (pPrice / bQty) : 0;
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{p.brand || '—'}</td>
                                <td style={{ padding: '6px 8px' }}>
                                  <strong>{p.purchase_unit}</strong>
                                  {p.pack_description && p.pack_description !== p.purchase_unit && (
                                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{p.pack_description}</span>
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                                  {bQty} {p.base_unit || formBaseUnit}
                                </td>
                                <td style={{ padding: '6px 8px' }}>{supp?.name || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>${pPrice.toFixed(2)}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                                  ${unitCost.toFixed(4)}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  {p.is_default ? (
                                    <span style={{ padding: '2px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                      DEFAULT
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSetDefaultPackaging(p)}
                                      style={{
                                        padding: '2px 6px',
                                        backgroundColor: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        color: '#475569',
                                        cursor: 'pointer'
                                      }}
                                      title="Set this pack option as default purchase packaging"
                                    >
                                      Set Default
                                    </button>
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePackagingOption(p.id)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                                    title="Delete option"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Subsection: Custom Unit Conversions */}
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>Custom Item Unit Conversions</strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                        e.g. Density conversion: 1 liter = 0.92 kg for oil.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddConvForm(!showAddConvForm)}
                      style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {showAddConvForm ? 'Cancel' : '+ Add Conversion'}
                    </button>
                  </div>

                  {showAddConvForm && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <input
                        type="text"
                        placeholder="From unit (e.g. L)"
                        value={newConv.from_unit}
                        onChange={(e) => setNewConv({ ...newConv, from_unit: e.target.value })}
                        style={{ height: '28px', fontSize: '11px', padding: '0 6px', border: '1px solid var(--border)', borderRadius: '4px', width: '100px' }}
                      />
                      <span>=</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="Factor (e.g. 0.92)"
                        value={newConv.conversion_factor}
                        onChange={(e) => setNewConv({ ...newConv, conversion_factor: e.target.value })}
                        style={{ height: '28px', fontSize: '11px', padding: '0 6px', border: '1px solid var(--border)', borderRadius: '4px', width: '100px' }}
                      />
                      <input
                        type="text"
                        placeholder="To unit (e.g. kg)"
                        value={newConv.to_unit || formBaseUnit}
                        onChange={(e) => setNewConv({ ...newConv, to_unit: e.target.value })}
                        style={{ height: '28px', fontSize: '11px', padding: '0 6px', border: '1px solid var(--border)', borderRadius: '4px', width: '100px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddUnitConversion}
                        style={{ height: '28px', padding: '0 10px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {itemConversions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {itemConversions.map(c => (
                        <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
                          1 {c.from_unit} = {c.conversion_factor} {c.to_unit}
                          <button
                            type="button"
                            onClick={() => handleDeleteUnitConversion(c.id)}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Show in Ordering and Show in Purchasing Flags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Branch Ordering Flow</label>
                  <select 
                    value={formOrder}
                    onChange={(e) => setFormOrder(e.target.value as 'yes' | 'no')}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="yes">Show in Ordering</option>
                    <option value="no">Hide from Ordering</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Procurement / Purchasing</label>
                  <select 
                    value={formPurchasing}
                    onChange={(e) => setFormPurchasing(e.target.value as 'yes' | 'no')}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="yes">Show in Purchasing</option>
                    <option value="no">Hide from Purchasing</option>
                  </select>
                </div>
              </div>

              {/* VAT Flag */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>VAT Status</label>
                <select 
                  value={formVat}
                  onChange={(e) => setFormVat(e.target.value as 'yes' | 'no')}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="no">No VAT (0%)</option>
                  <option value="yes">Subject to VAT (11% default)</option>
                </select>
              </div>

              {/* Delivery Time (Purchasing Only) */}
              {formPurchasing === 'yes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Delivery Lead Time</label>
                  <input 
                    type="text"
                    value={formDeliveryTime}
                    onChange={(e) => setFormDeliveryTime(e.target.value)}
                    placeholder="e.g. 24h, 48h, same day, weekly"
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}

              {/* Supplier and Price Section: Auto-Synced from Default Pack when packaging exists */}
              {(() => {
                const activePacks = packagingOptions.filter(p => p.is_active !== false);
                const defaultPack = activePacks.find(p => p.is_default) || activePacks[0];
                const hasPackaging = activePacks.length > 0;

                if (hasPackaging && defaultPack) {
                  const supp = suppliers.find(s => s.id === (defaultPack.supplier_id || formSupplierId));
                  const bQty = Number(defaultPack.base_quantity_per_purchase_unit) || 1;
                  const pPrice = Number(defaultPack.purchase_unit_price) || 0;
                  const unitCost = bQty > 0 && pPrice > 0 ? (pPrice / bQty) : (Number(formPriceUsd) || 0);

                  return (
                    <div style={{
                      padding: '14px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Primary Supplier & Base Price (Auto-Synced)
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', border: '1px solid #86efac' }}>
                          From Default: {defaultPack.brand ? `${defaultPack.brand} ` : ''}{defaultPack.purchase_unit}
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '2px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600, display: 'block' }}>Primary Supplier</span>
                          <strong style={{ fontSize: '13px', color: '#14532d' }}>{supp ? supp.name : 'No Supplier Assigned'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600, display: 'block' }}>Base Price ({formBaseUnit})</span>
                          <strong style={{ fontSize: '13px', color: '#14532d' }}>${unitCost.toFixed(4)} / {formBaseUnit}</strong>
                        </div>
                      </div>

                      <p style={{ fontSize: '11px', color: '#15803d', margin: '4px 0 0 0' }}>
                        Supplier and base cost are automatically derived from the default packaging option above.
                      </p>

                      {/* Manual Base Price Direct Edit/Override */}
                      <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Adjust base cost directly:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#14532d' }}>$</span>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            placeholder="0.0000"
                            value={formPriceUsd}
                            onChange={(e) => setFormPriceUsd(e.target.value)}
                            title="Direct cost per base unit"
                            style={{
                              width: '100px',
                              height: '32px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              border: '1px solid #86efac',
                              backgroundColor: '#fff',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#14532d'
                            }}
                          />
                          <span style={{ fontSize: '11px', color: '#166534' }}>/ {formBaseUnit}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Fallback for simple items with NO packaging options
                return (
                  <>
                    {/* Supplier Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Supplier</label>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Direct / Base Unit (No packaging options)</span>
                      </div>
                      <select
                        value={formSupplierId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormSupplierId(val);
                          if (val) {
                            const found = suppliers.find(s => s.id === val);
                            if (found && found.time_to_deliver) {
                              setFormDeliveryTime(found.time_to_deliver);
                            }
                          }
                        }}
                        style={{
                          height: '42px',
                          padding: '0 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontSize: '14px',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <option value="">No Supplier</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Price USD Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Price (USD / {formBaseUnit})</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={formPriceUsd}
                        onChange={(e) => setFormPriceUsd(e.target.value)}
                        placeholder="0.00"
                        style={{
                          height: '42px',
                          padding: '0 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </>
                );
              })()}

              {/* Inventory Location Checkbox Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Inventory Locations (Select to add)</label>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  padding: '12px', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius)', 
                  backgroundColor: '#f8fafc',
                  minHeight: '60px',
                  alignItems: 'center'
                }}>
                  {inventoryLocations.map((loc) => {
                    const currentSelected = formLocation ? formLocation.split(',').map(s => s.trim()).filter(Boolean) : [];
                    const isSelected = currentSelected.includes(loc.name);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleToggleLocation(loc.name)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--primary)' : '#ffffff',
                          color: isSelected ? '#ffffff' : 'var(--text-main)',
                          boxShadow: isSelected ? '0 2px 4px rgba(30,92,79,0.1)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{loc.name}
                      </button>
                    );
                  })}
                  {inventoryLocations.length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No inventory locations defined yet. Create them in the Categories tab.
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#f8fafc'
            }}>
              {canManage && isEditingItem && editItemId && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(editItemId, formName)}
                  className="auth-btn"
                  style={{
                    width: 'auto',
                    padding: '9px 14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    marginRight: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                >
                  <Trash2 size={14} /> Delete Item
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="auth-btn"
                style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              {canManage ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  {submitting && <RefreshCw className="spin" size={14} />}
                  {isEditingItem ? 'Save Changes' : 'Create Item'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                  Read-only view
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {showDeptModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <form 
            onSubmit={handleSaveDept}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{editingDept ? 'Edit Department' : 'New Department'}</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Department Name *</label>
                <input 
                  type="text"
                  required
                  value={deptFormName}
                  onChange={(e) => setDeptFormName(e.target.value)}
                  placeholder="e.g. Kitchen, Pastry"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowDeptModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-DEPARTMENT MODAL */}
      {showSubDeptModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <form 
            onSubmit={handleSaveSubDept}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{editingSubDept ? 'Edit Sub-department' : 'New Sub-department'}</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Parent Department: <strong>{subDeptParentName}</strong></span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Sub-department Name *</label>
                <input 
                  type="text"
                  required
                  value={subDeptFormName}
                  onChange={(e) => setSubDeptFormName(e.target.value)}
                  placeholder="e.g. Meat, Alcohol, Cleaning"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowSubDeptModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <form 
            onSubmit={handleSaveLocation}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{editingLocation ? 'Edit Location' : 'New Location'}</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Location Name *</label>
                <input 
                  type="text"
                  required
                  value={locationFormName}
                  onChange={(e) => setLocationFormName(e.target.value)}
                  placeholder="e.g. Dry Storage, Walk-in Fridge"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE USAGE & CONFIRMATION MODAL */}
      {deleteTarget && (
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
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: deleteUsage?.hasActiveRecipes
                ? '#fef2f2'
                : (deleteUsage?.inUse ? '#fffbeb' : '#f8fafc')
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {checkingDeleteUsage ? (
                  <RefreshCw className="spin" size={20} color="var(--primary)" />
                ) : deleteUsage?.hasActiveRecipes ? (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={18} color="#dc2626" />
                  </div>
                ) : deleteUsage?.inUse ? (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={18} color="#d97706" />
                  </div>
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={18} color="#dc2626" />
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    {checkingDeleteUsage 
                      ? 'Checking Item Usage...' 
                      : deleteUsage?.hasActiveRecipes 
                        ? 'Cannot Delete Item' 
                        : (deleteUsage?.inUse ? 'Confirm Unlinking & Deletion' : 'Delete Catalog Item')}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {deleteTarget.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => { setDeleteTarget(null); setDeleteUsage(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {checkingDeleteUsage ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <RefreshCw className="spin" size={28} color="var(--primary)" />
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                    Checking if <strong>"{deleteTarget.name}"</strong> is used in menu recipes, prep recipes, or modifiers...
                  </p>
                </div>
              ) : deleteUsage?.hasActiveRecipes ? (
                <>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: '#991b1b'
                  }}>
                    <strong>Active Recipe Dependency:</strong> This item is currently registered as an ingredient in active recipes. Deleting it would break recipe costing, inventory deductions, and kitchen display BOMs.
                  </div>

                  {deleteUsage.recipes?.length > 0 && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Menu Recipes ({deleteUsage.recipes.length})
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {deleteUsage.recipes.map((r: any) => (
                          <span key={r.id} style={{
                            padding: '4px 10px',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#334155'
                          }}>
                            📋 {r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {deleteUsage.productionRecipes?.length > 0 && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Production / Prep Recipes ({deleteUsage.productionRecipes.length})
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {deleteUsage.productionRecipes.map((p: any) => (
                          <span key={p.id} style={{
                            padding: '4px 10px',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#334155'
                          }}>
                            🍲 {p.name} ({p.role})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    To delete this item, please open the <strong>Recipe & BOM</strong> editor and remove it as an ingredient first.
                  </p>
                </>
              ) : deleteUsage?.inUse ? (
                <>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: '#92400e'
                  }}>
                    <strong>Linked Configurations:</strong> This item is not in any recipe BOMs, but is linked to modifiers or packaging options. Deleting it will remove the item and unlink it cleanly without database errors.
                  </div>

                  {deleteUsage.modifiers?.length > 0 && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Linked Modifiers ({deleteUsage.modifiers.length})
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                        {deleteUsage.modifiers.map((m: any) => (
                          <span key={m.id} style={{
                            padding: '4px 10px',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#78350f'
                          }}>
                            ⚡ {m.productName ? (m.name + ' (on ' + m.productName + ')') : m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {deleteUsage.productMappings?.length > 0 && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Mapped Retail Products ({deleteUsage.productMappings.length})
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {deleteUsage.productMappings.map((pm: any) => (
                          <span key={pm.id} style={{
                            padding: '4px 10px',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#334155'
                          }}>
                            🏷️ {pm.productName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {deleteUsage.packagingCount > 0 && (
                      <span>📦 {deleteUsage.packagingCount} Packaging Option(s)</span>
                    )}
                    {deleteUsage.conversionCount > 0 && (
                      <span>⚖️ {deleteUsage.conversionCount} Unit Conversion(s)</span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>
                    Are you sure you want to unlink and permanently delete "{deleteTarget.name}"?
                  </p>
                </>
              ) : (
                <div style={{ padding: '10px 0' }}>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    Are you sure you want to permanently delete <strong>"{deleteTarget.name}"</strong> from the catalog?
                  </p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    This item is not in use in recipes or modifiers. Once deleted, this action cannot be undone.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#f8fafc'
            }}>
              {deleteUsage?.hasActiveRecipes ? (
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(null); setDeleteUsage(null); }}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '9px 20px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={deletingItem}
                    onClick={() => { setDeleteTarget(null); setDeleteUsage(null); }}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '9px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={checkingDeleteUsage || deletingItem}
                    onClick={confirmDeleteItem}
                    className="auth-btn"
                    style={{
                      width: 'auto',
                      padding: '9px 20px',
                      backgroundColor: 'var(--danger)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600
                    }}
                  >
                    {deletingItem && <RefreshCw className="spin" size={14} />}
                    {deleteUsage?.inUse ? 'Unlink & Delete Item' : 'Delete Item'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
