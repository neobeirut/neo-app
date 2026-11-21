import React, { useState, useEffect } from 'react';
import { X, Sliders, Layers, CheckCircle, RefreshCw, Loader, ToggleLeft, ToggleRight, Copy, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Gift, PlusCircle, Check, Sparkles } from 'lucide-react';
import { crmService } from '../../api/crmService';
import { api } from '../../api/client';
import type { CustomizationItem, ProductCustomization, Product } from '../../api/crmService';

interface ProductModifierModalProps {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}

interface GroupSettings {
  is_required: boolean;
  is_multi_select: boolean;
}

export default function ProductModifierModal({ product, onClose, onSaved }: ProductModifierModalProps) {
  const isBundleProduct = Boolean(
    (product as any).is_bundle ||
    (product as any).category_id === 30 ||
    ((product as any).category_name && (product as any).category_name.toLowerCase().includes('bundle')) ||
    ((product as any).category && String((product as any).category).toLowerCase().includes('bundle')) ||
    (product.name && (
      product.name.toLowerCase().includes('bundle') ||
      product.name.toLowerCase().includes('combo') ||
      product.name.toLowerCase().includes('formula') ||
      product.name.toLowerCase().includes('formule') ||
      product.name.toLowerCase().includes('parisien')
    ))
  );

  const [allModifiers, setAllModifiers] = useState<CustomizationItem[]>([]);
  const [linkedLinks, setLinkedLinks] = useState<ProductCustomization[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [savingGroupSetting, setSavingGroupSetting] = useState<string | null>(null);
  const [groupSettings, setGroupSettings] = useState<Record<string, GroupSettings>>({});
  const [sourceProducts, setSourceProducts] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [menuCategories, setMenuCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [rawProductsList, setRawProductsList] = useState<Array<any>>([]);
  const [zeroingPrices, setZeroingPrices] = useState(false);
  const [bulkPriceValue, setBulkPriceValue] = useState<string>('');
  const [settingBulkPrice, setSettingBulkPrice] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<number, string>>({});

  // Add Products Drawer/Modal state
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [addProductsCategory, setAddProductsCategory] = useState<number | ''>('');
  const [addProductsGroupName, setAddProductsGroupName] = useState('');
  const [addProductsPrice, setAddProductsPrice] = useState<number>(0);
  const [addProductsUseOriginalPrice, setAddProductsUseOriginalPrice] = useState(false);
  const [addProductsRequired, setAddProductsRequired] = useState(true);
  const [addProductsMultiSelect, setAddProductsMultiSelect] = useState(false);
  const [addProductsIsDefault, setAddProductsIsDefault] = useState(false);
  const [selectedProductIdsToAdd, setSelectedProductIdsToAdd] = useState<Set<number>>(new Set());
  const [addingProductsLoading, setAddingProductsLoading] = useState(false);
  const [addProductsIncludeModifiers, setAddProductsIncludeModifiers] = useState(true);
  const [allProductLinks, setAllProductLinks] = useState<ProductCustomization[]>([]);

  const toggleGroupCollapse = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allNames = [
      ...sortedRegularEntries.map(([g]) => g),
      ...sortedRemovalEntries.map(([g]) => g)
    ];
    setExpandedGroups(new Set(allNames));
  };

  const handleCollapseAll = () => {
    setExpandedGroups(new Set());
  };
  const [selectedSourceProductId, setSelectedSourceProductId] = useState<string>('');
  const [copyingFromProduct, setCopyingFromProduct] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [items, links, allProdLinks, allProdsRes, cats] = await Promise.all([
        crmService.getCustomizationItems(),
        crmService.getProductCustomizations(product.id),
        crmService.getProductCustomizations().catch(() => [] as ProductCustomization[]),
        api.getProductsSimpleList().catch(() => ({ success: false, data: [] as any[] })),
        crmService.getCategories().catch(() => [] as any[]),
      ]);
      setAllModifiers(items.filter(i => i.is_active));
      const validItemIds = new Set(items.map(i => i.id));
      const orphanLinks = links.filter(l => l.customization_item_id && !validItemIds.has(l.customization_item_id));
      if (orphanLinks.length > 0) {
        orphanLinks.forEach(o => {
          crmService.unlinkModifierFromProduct(o.id).catch(() => {});
        });
        setLinkedLinks(links.filter(l => !l.customization_item_id || validItemIds.has(l.customization_item_id)));
      } else {
        setLinkedLinks(links);
      }
      setMenuCategories(cats || []);
      let prodsData: any[] = allProdsRes?.data || [];
      if (!prodsData || prodsData.length === 0) {
        prodsData = await crmService.getProducts().catch(() => []);
      }
      setRawProductsList(prodsData);
      setAllProductLinks(allProdLinks || []);

      const countByProd = new Map<number, number>();
      (allProdLinks || []).forEach(l => {
        if (l.product_id && Number(l.product_id) !== Number(product.id)) {
          countByProd.set(Number(l.product_id), (countByProd.get(Number(l.product_id)) || 0) + 1);
        }
      });
      const prodsList = prodsData
        .filter((p: any) => countByProd.has(Number(p.id)))
        .map((p: any) => ({ id: Number(p.id), name: p.name, count: countByProd.get(Number(p.id)) || 0 }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      setSourceProducts(prodsList);

      const gs: Record<string, GroupSettings> = {};
      links.forEach(link => {
        const gName = normalizeGroupName(link.option_group_name || '', link.customization_type || '');
        if (!gs[gName]) {
          gs[gName] = {
            is_required: Boolean(link.is_required),
            is_multi_select: Boolean(link.is_multi_select),
          };
        } else {
          if (link.is_required) gs[gName].is_required = true;
          if (link.is_multi_select) gs[gName].is_multi_select = true;
        }
      });
      setGroupSettings(gs);
    } finally {
      setLoading(false);
    }
  };

  const handleZeroOutPrices = async () => {
    setZeroingPrices(true);
    try {
      await crmService.zeroOutProductCustomizationPrices(product.id);
      setLinkedLinks(prev => prev.map(l => ({ ...l, price: 0 })));
      onSaved();
      alert('All modifier choices for this bundle are now $0.00 (free)!');
    } catch (err: any) {
      alert('Failed to zero out prices: ' + err.message);
    } finally {
      setZeroingPrices(false);
    }
  };

  const handleApplyBulkPriceToAll = async () => {
    const p = parseFloat(bulkPriceValue);
    if (isNaN(p) || p < 0) {
      alert('Please enter a valid price (e.g. 0 for free, or 5 for $5.00).');
      return;
    }
    setSettingBulkPrice(true);
    try {
      await crmService.updateProductCustomizationPrices(product.id, p);
      setLinkedLinks(prev => prev.map(l => ({ ...l, price: p })));
      onSaved();
      alert(`All modifier choices for this bundle are now set to $${p.toFixed(2)}!`);
    } catch (err: any) {
      alert('Failed to update prices: ' + err.message);
    } finally {
      setSettingBulkPrice(false);
    }
  };

  const handleSetGroupPrice = async (groupName: string, items: CustomizationItem[]) => {
    const currentPriceStr = prompt(`Enter price for all linked options in "${groupName}" ($0 for free):`, '0');
    if (currentPriceStr === null) return;
    const p = parseFloat(currentPriceStr);
    if (isNaN(p) || p < 0) {
      alert('Please enter a valid price number.');
      return;
    }
    setSavingGroupSetting(`${groupName}:price`);
    try {
      await crmService.updateProductCustomizationPrices(product.id, p, groupName);
      setLinkedLinks(prev => prev.map(l => {
        const itemGroup = normalizeGroupName(l.option_group_name || '', l.customization_type || '');
        return itemGroup === groupName ? { ...l, price: p } : l;
      }));
      onSaved();
    } catch (err: any) {
      alert('Failed to set group price: ' + err.message);
    } finally {
      setSavingGroupSetting(null);
    }
  };

  const handleUpdateItemPrice = async (linkId: number, newPrice: number) => {
    try {
      await crmService.updateProductCustomization(linkId, { price: newPrice });
      setLinkedLinks(prev => prev.map(l => l.id === linkId ? { ...l, price: newPrice } : l));
      setEditingPrices(prev => {
        const next = { ...prev };
        delete next[linkId];
        return next;
      });
      onSaved();
    } catch (err: any) {
      alert('Failed to update price: ' + err.message);
    }
  };

  const handleSyncMenuPricesForGroup = async (groupName: string, items: CustomizationItem[]) => {
    setSavingGroupSetting(`${groupName}:sync`);
    try {
      const groupLinks = linkedLinks.filter(l => {
        const itemGroup = normalizeGroupName(l.option_group_name || '', l.customization_type || '');
        return itemGroup === groupName;
      });

      for (const link of groupLinks) {
        const matchedProd = rawProductsList.find(p => p.name.toLowerCase() === link.ingredient.toLowerCase());
        if (matchedProd) {
          const menuPrice = Number(matchedProd.price ?? matchedProd.unit_price_usd ?? 0);
          await crmService.updateProductCustomization(link.id, { price: menuPrice });
          link.price = menuPrice;
        }
      }
      setLinkedLinks([...linkedLinks]);
      onSaved();
      alert(`Synchronized prices from menu for "${groupName}"!`);
    } catch (err: any) {
      alert('Failed to sync menu prices: ' + err.message);
    } finally {
      setSavingGroupSetting(null);
    }
  };

  const handleAddProductsToGroup = async () => {
    if (!addProductsGroupName.trim()) {
      alert('Please enter or select a group name (e.g. Your Eggs, Your Coffee, Your Croissant, Included Items).');
      return;
    }
    if (selectedProductIdsToAdd.size === 0) {
      alert('Please select at least one product from the list.');
      return;
    }

    setAddingProductsLoading(true);
    try {
      const prodsToAdd = rawProductsList.filter(p => selectedProductIdsToAdd.has(p.id));
      const gName = addProductsGroupName.trim();

      for (const prodItem of prodsToAdd) {
        const itemEffectivePrice = addProductsUseOriginalPrice
          ? Number(prodItem.price ?? prodItem.unit_price_usd ?? 0)
          : addProductsPrice;

        // 1. Check if customization_item exists by name or create one
        let cItem = allModifiers.find(m => m.name.toLowerCase() === prodItem.name.toLowerCase());
        if (!cItem) {
          cItem = await crmService.createCustomizationItem({
            name: prodItem.name,
            option_group_name: gName,
            customization_type: 'option',
            default_price: itemEffectivePrice,
            is_active: true,
            is_default: addProductsIsDefault,
            is_required: addProductsRequired,
            is_multi_select: addProductsMultiSelect,
          });
        } else {
          // If item already exists and user specified a target group name, update customization_item if it had generic Add On / blank group
          if (gName && (!cItem.option_group_name || normalizeGroupName(cItem.option_group_name, cItem.customization_type) === 'Add On')) {
            await crmService.updateCustomizationItem(cItem.id, {
              option_group_name: gName,
              default_price: itemEffectivePrice !== 0 ? itemEffectivePrice : cItem.default_price,
            });
            cItem = { ...cItem, option_group_name: gName };
          }
        }

        // 2. Link to product_customizations with explicit target group name and settings (or update existing link)
        await crmService.linkModifierToProduct(
          product.id,
          cItem,
          itemEffectivePrice,
          gName,
          {
            is_required: addProductsRequired,
            is_multi_select: addProductsMultiSelect,
            is_default: addProductsIsDefault,
          }
        );
        if (gName) {
          await crmService.updateProductModifierGroupSettings(product.id, gName, {
            is_required: addProductsRequired,
            is_multi_select: addProductsMultiSelect,
          });
        }

        // 3. If requested, also import modifier groups of this product (e.g. Milk, Cooking, Bread)
        if (addProductsIncludeModifiers) {
          const childCustomizations = allProductLinks.filter(l => Number(l.product_id) === Number(prodItem.id));
          for (const childC of childCustomizations) {
            const childGroupName = normalizeGroupName(childC.option_group_name || '', childC.customization_type || '');
            let childItem = allModifiers.find(m => m.name.toLowerCase() === childC.ingredient.toLowerCase());
            if (!childItem) {
              childItem = await crmService.createCustomizationItem({
                name: childC.ingredient,
                option_group_name: childGroupName,
                customization_type: childC.customization_type || 'option',
                default_price: isBundleProduct ? 0 : (childC.price || 0),
                is_active: true,
                is_required: Boolean(childC.is_required),
                is_multi_select: Boolean(childC.is_multi_select),
              });
            }
            await crmService.linkModifierToProduct(
              product.id,
              childItem,
              isBundleProduct ? 0 : childC.price,
              childGroupName,
              {
                is_required: Boolean(childC.is_required),
                is_multi_select: Boolean(childC.is_multi_select),
                is_default: Boolean(childC.is_default),
              }
            );
            if (childGroupName) {
              await crmService.updateProductModifierGroupSettings(product.id, childGroupName, {
                is_required: Boolean(childC.is_required),
                is_multi_select: Boolean(childC.is_multi_select),
              });
            }
          }
        }
      }

      setExpandedGroups(prev => new Set(prev).add(gName));
      setShowAddProductsPanel(false);
      setSelectedProductIdsToAdd(new Set());
      await load();
      onSaved();
    } catch (err: any) {
      alert('Failed to add products: ' + err.message);
    } finally {
      setAddingProductsLoading(false);
    }
  };

  useEffect(() => { load(); }, [product.id]);

  /** Normalize group name: blank/General/Add-ons → "Add On"; Remove/removals → "Remove"; keep specific names */
  const normalizeGroupName = (rawGroup: string, type: string) => {
    const g = rawGroup.trim();
    const lower = g.toLowerCase();
    const tLower = (type || '').toLowerCase();
    if (lower === 'remove' || lower === 'removal' || lower === 'removals' || lower.startsWith('remove ingredient') || tLower === 'remove' || tLower === 'removal') {
      return 'Remove';
    }
    if (!g || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons') {
      return 'Add On';
    }
    return g;
  };

  const getItemGroupName = (item: CustomizationItem) => {
    const link = linkedLinks.find(l =>
      (l.customization_item_id && l.customization_item_id === item.id) ||
      l.ingredient.toLowerCase() === item.name.toLowerCase()
    );
    const rawG = link?.option_group_name || item.option_group_name || '';
    return normalizeGroupName(rawG, link?.customization_type || item.customization_type);
  };

  const linkedItemIds = new Set(
    linkedLinks.map(l => l.customization_item_id).filter(Boolean) as number[]
  );

  const handleToggleItem = async (item: CustomizationItem) => {
    setSavingItemId(item.id);
    try {
      if (linkedItemIds.has(item.id)) {
        const linkRow = linkedLinks.find(l => l.customization_item_id === item.id);
        if (linkRow) {
          await crmService.unlinkModifierFromProduct(linkRow.id);
          setLinkedLinks(prev => prev.filter(l => l.id !== linkRow.id));
        }
      } else {
        const groupName = getItemGroupName(item);
        const currentGs = groupSettings[groupName] || { is_required: false, is_multi_select: false };
        const newLink = await crmService.linkModifierToProduct(
          product.id,
          item,
          isBundleProduct ? 0 : undefined,
          groupName,
          {
            is_required: currentGs.is_required,
            is_multi_select: currentGs.is_multi_select,
          }
        );
        if (currentGs.is_required || currentGs.is_multi_select) {
          await crmService.updateProductModifierGroupSettings(product.id, groupName, currentGs);
        }
        setLinkedLinks(prev => [...prev.filter(l => l.id !== newLink.id), { ...newLink, is_required: currentGs.is_required, is_multi_select: currentGs.is_multi_select }]);
      }
      onSaved();
    } catch (err: any) {
      alert('Failed to update modifier: ' + err.message);
    } finally {
      setSavingItemId(null);
    }
  };

  const handleSetDefaultItem = async (e: React.MouseEvent, targetItem: CustomizationItem, groupItems: CustomizationItem[]) => {
    e.stopPropagation();
    setSavingItemId(targetItem.id);
    try {
      const newStatus = !targetItem.is_default;
      // If setting to true, unset is_default on other items in the same group so only one is default
      if (newStatus) {
        for (const item of groupItems) {
          if (item.id !== targetItem.id && item.is_default) {
            await crmService.updateCustomizationItem(item.id, { is_default: false });
          }
        }
      }
      await crmService.updateCustomizationItem(targetItem.id, { is_default: newStatus });
      setAllModifiers(prev => prev.map(i => {
        if (i.id === targetItem.id) return { ...i, is_default: newStatus };
        if (newStatus && groupItems.some(g => g.id === i.id)) return { ...i, is_default: false };
        return i;
      }));
      onSaved();
    } catch (err: any) {
      alert('Failed to set default modifier: ' + err.message);
    } finally {
      setSavingItemId(null);
    }
  };

  const handleToggleEntireGroup = async (groupName: string, items: CustomizationItem[]) => {
    const unlinked = items.filter(i => !linkedItemIds.has(i.id));
    setSavingGroupSetting(`${groupName}:bulk`);
    try {
      if (unlinked.length > 0) {
        const currentGs = groupSettings[groupName] || { is_required: false, is_multi_select: false };
        const newLinks: ProductCustomization[] = [];
        for (const item of unlinked) {
          const created = await crmService.linkModifierToProduct(
            product.id,
            item,
            isBundleProduct ? 0 : undefined,
            groupName,
            {
              is_required: currentGs.is_required,
              is_multi_select: currentGs.is_multi_select,
            }
          );
          newLinks.push({ ...created, is_required: currentGs.is_required, is_multi_select: currentGs.is_multi_select });
        }
        if (currentGs.is_required || currentGs.is_multi_select) {
          await crmService.updateProductModifierGroupSettings(product.id, groupName, currentGs);
        }
        setLinkedLinks(prev => [...prev.filter(l => !newLinks.some(n => n.id === l.id)), ...newLinks]);
      } else {
        const itemIds = new Set(items.map(i => i.id));
        const toRemove = linkedLinks.filter(l => l.customization_item_id && itemIds.has(l.customization_item_id));
        for (const row of toRemove) {
          await crmService.unlinkModifierFromProduct(row.id);
        }
        setLinkedLinks(prev => prev.filter(l => !toRemove.some(r => r.id === l.id)));
      }
      onSaved();
    } catch (err: any) {
      alert('Failed to update modifier group: ' + err.message);
    } finally {
      setSavingGroupSetting(null);
    }
  };

  const handleCopyFromProduct = async () => {
    if (!selectedSourceProductId || copyingFromProduct) return;
    setCopyingFromProduct(true);
    try {
      const res = await api.copyProductModifiersAndEffects(Number(selectedSourceProductId), Number(product.id));
      if (!res.success) {
        alert(res.error || 'Failed to copy modifiers.');
        return;
      }
      await load();
      onSaved();
      setSelectedSourceProductId('');
    } finally {
      setCopyingFromProduct(false);
    }
  };

  const handleToggleGroupSetting = async (groupName: string, field: 'is_required' | 'is_multi_select') => {
    setSavingGroupSetting(`${groupName}:${field}`);
    const current = groupSettings[groupName] || { is_required: false, is_multi_select: false };
    const newValue = !current[field];
    const newGs = { ...current, [field]: newValue };
    try {
      await crmService.updateProductModifierGroupSettings(product.id, groupName, { [field]: newValue });
      setGroupSettings(prev => ({ ...prev, [groupName]: newGs }));
      setLinkedLinks(prev => prev.map(l =>
        normalizeGroupName(l.option_group_name || '', l.customization_type || '') === groupName
          ? { ...l, [field]: newValue } : l
      ));
    } catch (err: any) {
      alert('Failed to update setting: ' + err.message);
    } finally {
      setSavingGroupSetting(null);
    }
  };

  // Separate modifiers into "remove" vs everything else
  const isRemoval = (t?: string) => {
    const lower = (t || '').toLowerCase();
    return lower === 'remove' || lower === 'removal';
  };
  const regularModifiers = allModifiers.filter(i => !isRemoval(i.customization_type));
  const removalModifiers = allModifiers.filter(i => isRemoval(i.customization_type));

  // Group regular modifiers by effective group name
  const groupedRegular = regularModifiers.reduce((acc, item) => {
    const g = getItemGroupName(item);
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {} as Record<string, CustomizationItem[]>);

  // Group removal modifiers by effective group name
  const groupedRemoval = removalModifiers.reduce((acc, item) => {
    const g = getItemGroupName(item);
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {} as Record<string, CustomizationItem[]>);

  const [draggedScreenIdx, setDraggedScreenIdx] = useState<number | null>(null);

  const getGroupOrderPriority = (groupName: string) => {
    const groupLinks = linkedLinks.filter(
      l => normalizeGroupName(l.option_group_name || '', l.customization_type || '') === groupName
    );
    for (const l of groupLinks) {
      const ca = String(l.created_at || '');
      const m = ca.match(/^2020-01-01T00:(\d{2}):/);
      if (m) {
        const ord = parseInt(m[1], 10);
        if (ord > 0) return ord;
      }
    }
    const lower = groupName.toLowerCase().trim();
    if (lower.includes('size') || lower.includes('temp')) return 105;
    if (lower === 'milk' || lower.includes('milk')) return 110;
    if (lower.includes('protein') || lower.includes('base')) return 115;
    if (lower === 'coffee' || lower.includes('coffee') || lower.includes('espresso') || lower.includes('shot')) return 120;
    if (lower.includes('dressing') || lower.includes('sauce')) return 125;
    if (lower === 'syrups' || lower === 'syrup' || lower.includes('syrup')) return 130;
    if (lower.includes('remove')) return 190;
    return 150;
  };

  const sortedRegularEntries = Object.entries(groupedRegular).sort(([a], [b]) => {
    const pa = getGroupOrderPriority(a);
    const pb = getGroupOrderPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const sortedRemovalEntries = Object.entries(groupedRemoval).sort(([a], [b]) => {
    const pa = getGroupOrderPriority(a);
    const pb = getGroupOrderPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const activePosScreens = [
    ...sortedRegularEntries.filter(([, grpItems]) => grpItems.some(i => linkedItemIds.has(i.id))).map(([g]) => g),
    ...sortedRemovalEntries.filter(([, grpItems]) => grpItems.some(i => linkedItemIds.has(i.id))).map(([g]) => g),
  ].sort((a, b) => {
    const pa = getGroupOrderPriority(a);
    const pb = getGroupOrderPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const handleReorderPosScreen = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= activePosScreens.length || toIdx >= activePosScreens.length) {
      return;
    }
    const newOrder = [...activePosScreens];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);

    const markerByGroup = new Map<string, string>();
    newOrder.forEach((gName, idx) => {
      markerByGroup.set(gName, new Date(Date.UTC(2020, 0, 1, 0, idx + 1, 0)).toISOString());
    });

    setLinkedLinks(prev =>
      prev.map(l => {
        const g = normalizeGroupName(l.option_group_name || '', l.customization_type || '');
        const marker = markerByGroup.get(g);
        return marker ? { ...l, created_at: marker } : l;
      })
    );

    try {
      const res = await api.saveProductModifierScreenOrder(product.id, newOrder);
      if (res && res.error) {
        console.error('Failed to save POS screen order:', res.error);
      }
      onSaved();
    } catch (err: any) {
      console.error('Failed to save POS screen order:', err);
    }
  };

  const totalLinked = linkedLinks.length;

  const renderGroup = (groupName: string, items: CustomizationItem[], isRemoveSection: boolean) => {
    const gs = groupSettings[groupName] || { is_required: false, is_multi_select: false };
    const linkedCount = items.filter(i => linkedItemIds.has(i.id)).length;
    const hasAnyLinked = linkedCount > 0;
    const allGroupLinked = linkedCount === items.length && items.length > 0;
    const isBulkSaving = savingGroupSetting === `${groupName}:bulk`;
    const screenNumber = activePosScreens.indexOf(groupName) + 1;
    const isCollapsed = !expandedGroups.has(groupName);

    return (
      <div key={groupName} style={{
        border: hasAnyLinked ? (isRemoveSection ? '1.5px solid #fed7aa' : '1.5px solid #93c5fd') : '1px solid #e2e8f0',
        borderRadius: '10px', overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}>
        {/* Group header (clickable to collapse/expand) */}
        <div
          onClick={() => toggleGroupCollapse(groupName)}
          style={{
            padding: '8px 12px',
            backgroundColor: isRemoveSection ? '#fff7ed' : hasAnyLinked ? '#eff6ff' : '#f8fafc',
            borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', color: isRemoveSection ? '#ea580c' : '#64748b' }}>
              {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </span>
            <Layers size={13} color={isRemoveSection ? '#ea580c' : 'var(--primary)'} />
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{groupName}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>({items.length})</span>
            {screenNumber > 0 && (
              <span style={{
                fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px',
                backgroundColor: '#1d4ed8', color: '#ffffff', marginLeft: '4px'
              }}>
                POS Screen {screenNumber} of {activePosScreens.length}
              </span>
            )}
            {isCollapsed && hasAnyLinked && (
              <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                {gs.is_required && (
                  <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                    Required
                  </span>
                )}
                {gs.is_multi_select ? (
                  <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                    Multi
                  </span>
                ) : (
                  <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                    Single
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasAnyLinked && (
              <button
                type="button"
                disabled={Boolean(savingGroupSetting) || Boolean(savingItemId)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetGroupPrice(groupName, items);
                }}
                style={{
                  fontSize: '11px', fontWeight: 700,
                  padding: '2px 8px', borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f766e',
                  cursor: 'pointer'
                }}
                title={`Set custom price for all choices in "${groupName}" ($0 for free)`}
              >
                Set Price ($)
              </button>
            )}
            {hasAnyLinked && (
              <button
                type="button"
                disabled={Boolean(savingGroupSetting) || Boolean(savingItemId)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSyncMenuPricesForGroup(groupName, items);
                }}
                style={{
                  fontSize: '11px', fontWeight: 700,
                  padding: '2px 8px', borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#2563eb',
                  cursor: 'pointer'
                }}
                title={`Sync prices from menu products for all items in "${groupName}"`}
              >
                Use Menu Prices
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(savingGroupSetting) || Boolean(savingItemId)}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleEntireGroup(groupName, items);
              }}
              style={{
                fontSize: '11px', fontWeight: 700,
                padding: '2px 8px', borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: allGroupLinked ? '#f1f5f9' : '#eff6ff',
                color: allGroupLinked ? '#475569' : '#2563eb',
                cursor: 'pointer'
              }}
            >
              {isBulkSaving ? 'Saving…' : allGroupLinked ? 'Clear Group' : 'Select All'}
            </button>
            <span style={{
              fontSize: '10px', fontWeight: 700,
              color: hasAnyLinked ? '#16a34a' : '#cbd5e1',
            }}>
              {linkedCount}/{items.length}
            </span>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* 2-column grid of options */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '1px', backgroundColor: '#f1f5f9',
            }}>
          {items.map(item => {
            const isLinked = linkedItemIds.has(item.id);
            const isSaving = savingItemId === item.id;
            const link = linkedLinks.find(l =>
              (l.customization_item_id && l.customization_item_id === item.id) ||
              l.ingredient.toLowerCase() === item.name.toLowerCase()
            );
            const currentItemPrice = link ? (link.price ?? 0) : (item.default_price ?? 0);
            const displayPriceVal = link && editingPrices[link.id] !== undefined
              ? editingPrices[link.id]
              : currentItemPrice;

            return (
              <div
                key={item.id}
                onClick={() => !isSaving && !savingGroupSetting && handleToggleItem(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px',
                  backgroundColor: isLinked ? '#f0fdf4' : '#ffffff',
                  cursor: isSaving ? 'default' : 'pointer',
                  transition: 'background-color 0.12s',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                  border: isLinked ? '2px solid #16a34a' : '2px solid #cbd5e1',
                  backgroundColor: isLinked ? '#16a34a' : '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {isSaving ? (
                    <Loader size={9} color="#fff" />
                  ) : isLinked ? (
                    <CheckCircle size={10} color="#fff" strokeWidth={3} />
                  ) : null}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontWeight: 600, fontSize: '12px', color: '#0f172a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.name}
                  </div>
                  {!isLinked && item.default_price > 0 && (
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      Menu: +${item.default_price.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Price editor when linked to this product */}
                {isLinked && link && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      backgroundColor: currentItemPrice > 0 ? '#eff6ff' : '#f0fdf4',
                      border: `1px solid ${currentItemPrice > 0 ? '#93c5fd' : '#86efac'}`,
                      borderRadius: '6px',
                      padding: '2px 5px',
                      flexShrink: 0,
                    }}
                    title="Price for this product ($0 = free in bundle, or enter custom price like $5.00)"
                  >
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: currentItemPrice > 0 ? '#1d4ed8' : '#15803d'
                    }}>
                      $
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={displayPriceVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingPrices(prev => ({ ...prev, [link.id]: val }));
                      }}
                      onBlur={async () => {
                        const rawVal = editingPrices[link.id];
                        if (rawVal !== undefined) {
                          const num = Math.max(0, parseFloat(rawVal) || 0);
                          await handleUpdateItemPrice(link.id, num);
                        }
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      style={{
                        width: '42px',
                        border: 'none',
                        background: 'transparent',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: currentItemPrice > 0 ? '#1d4ed8' : '#15803d',
                        textAlign: 'right',
                        outline: 'none',
                        padding: 0
                      }}
                    />
                    {currentItemPrice === 0 && (
                      <span style={{ fontSize: '9px', fontWeight: 800, color: '#16a34a', marginLeft: '1px' }}>
                        Free
                      </span>
                    )}
                  </div>
                )}

                {isLinked && (
                  <button
                    type="button"
                    onClick={(e) => handleSetDefaultItem(e, item, items)}
                    title={item.is_default ? "Default option for this group (click to unset)" : "Click to set as default option"}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: item.is_default ? '1px solid #93c5fd' : '1px dashed #cbd5e1',
                      backgroundColor: item.is_default ? '#eff6ff' : 'transparent',
                      color: item.is_default ? '#1d4ed8' : '#94a3b8',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {item.is_default ? '★ Default' : '+ Set Default'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Per-product rule settings (available for all groups, including removals) */}
        {hasAnyLinked && (
          <div style={{
            padding: '10px 12px',
            backgroundColor: isRemoveSection ? '#fff7ed' : '#fafbff',
            borderTop: isRemoveSection ? '1px solid #fed7aa' : '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: isRemoveSection ? '#c2410c' : '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rules for <span style={{ color: isRemoveSection ? '#ea580c' : 'var(--primary)' }}>{product.name}</span> {isRemoveSection ? '(Removals)' : ''}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Required */}
              <div
                onClick={e => { e.stopPropagation(); handleToggleGroupSetting(groupName, 'is_required'); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: '7px', cursor: 'pointer',
                  backgroundColor: gs.is_required ? '#dcfce7' : '#f1f5f9',
                  border: `1px solid ${gs.is_required ? '#86efac' : '#e2e8f0'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: gs.is_required ? '#15803d' : '#475569' }}>
                    Required
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {gs.is_required ? 'Must select' : 'Optional'}
                  </div>
                </div>
                {savingGroupSetting === `${groupName}:is_required` ? (
                  <Loader size={16} color="#94a3b8" />
                ) : gs.is_required ? (
                  <ToggleRight size={24} color="#16a34a" />
                ) : (
                  <ToggleLeft size={24} color="#cbd5e1" />
                )}
              </div>

              {/* Multi-select */}
              <div
                onClick={e => { e.stopPropagation(); handleToggleGroupSetting(groupName, 'is_multi_select'); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: '7px', cursor: 'pointer',
                  backgroundColor: gs.is_multi_select ? '#eff6ff' : '#f1f5f9',
                  border: `1px solid ${gs.is_multi_select ? '#93c5fd' : '#e2e8f0'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: gs.is_multi_select ? '#1d4ed8' : '#475569' }}>
                    Multi-select
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {gs.is_multi_select ? 'Pick many' : 'Pick one only'}
                  </div>
                </div>
                {savingGroupSetting === `${groupName}:is_multi_select` ? (
                  <Loader size={16} color="#94a3b8" />
                ) : gs.is_multi_select ? (
                  <ToggleRight size={24} color="#2563eb" />
                ) : (
                  <ToggleLeft size={24} color="#cbd5e1" />
                )}
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '14px',
        width: '100%', maxWidth: '700px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <Sliders size={15} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Modifier Rules — <span style={{ color: 'var(--primary)' }}>{product.name}</span>
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              {totalLinked} modifier{totalLinked !== 1 ? 's' : ''} linked &nbsp;·&nbsp;
              Check options to link · Set Required & Multi-select rules per group
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <RefreshCw size={20} style={{ display: 'inline' }} />
              <p style={{ marginTop: '10px', fontSize: '13px' }}>Loading…</p>
            </div>
          ) : (
            <>
              {/* ── Bundle Product Notice Banner ── */}
              {isBundleProduct && (
                <div style={{
                  marginBottom: '16px', padding: '12px 14px',
                  backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0',
                  borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: '12px', flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Gift size={18} color="#059669" />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Bundle / Combo Product
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#10b981', color: '#fff', fontWeight: 700 }}>
                          Pricing Options
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
                        Make all choices free ($0.00), set a price for all, or customize individual item prices below (e.g. $5 for red wine or salad).
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={zeroingPrices || settingBulkPrice}
                      onClick={handleZeroOutPrices}
                      style={{
                        padding: '6px 14px', borderRadius: '7px',
                        backgroundColor: '#059669', color: '#ffffff',
                        border: 'none', fontSize: '11px', fontWeight: 700,
                        cursor: (zeroingPrices || settingBulkPrice) ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                      title="Set all linked modifier choices for this bundle to $0.00 (free)"
                    >
                      <Sparkles size={13} />
                      {zeroingPrices ? 'Resetting…' : 'Make All Choices Free ($0.00)'}
                    </button>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      backgroundColor: '#ffffff', padding: '3px 8px', borderRadius: '7px',
                      border: '1px solid #6ee7b7'
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#065f46' }}>or set price: $</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="5.00"
                        value={bulkPriceValue}
                        onChange={e => setBulkPriceValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleApplyBulkPriceToAll(); }}
                        style={{
                          width: '52px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px',
                          fontSize: '11px', fontWeight: 700, textAlign: 'right', outline: 'none', color: '#065f46'
                        }}
                      />
                      <button
                        type="button"
                        disabled={zeroingPrices || settingBulkPrice || !bulkPriceValue}
                        onClick={handleApplyBulkPriceToAll}
                        style={{
                          padding: '4px 10px', borderRadius: '5px',
                          backgroundColor: '#047857', color: '#ffffff',
                          border: 'none', fontSize: '11px', fontWeight: 700,
                          cursor: (zeroingPrices || settingBulkPrice || !bulkPriceValue) ? 'default' : 'pointer'
                        }}
                        title="Set all linked modifier choices to this price"
                      >
                        {settingBulkPrice ? 'Applying…' : 'Set Price'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Action Bar: Import Products & Copy from another product ── */}
              <div style={{
                marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProductsPanel(!showAddProductsPanel);
                    if (!showAddProductsPanel && menuCategories.length > 0 && !addProductsCategory) {
                      setAddProductsCategory(menuCategories[0].id);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '8px 14px', borderRadius: '8px',
                    backgroundColor: showAddProductsPanel ? '#1e293b' : 'var(--primary)',
                    color: '#ffffff', border: 'none', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <PlusCircle size={15} />
                  {showAddProductsPanel ? 'Close Product Selector' : '+ Add Menu Products as Options'}
                </button>
              </div>

              {/* ── Menu Products Selection Builder Panel ── */}
              {showAddProductsPanel && (
                <div style={{
                  marginBottom: '20px', padding: '16px',
                  backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1',
                  borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        Import Menu Products as Modifier / Bundle Choices
                      </h4>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        Select products from a category (e.g. Breakfast eggs, Viennoiseries croissants, Coffee) to add them directly as options.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddProductsPanel(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 1. Category and Target Group Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        1. Select Menu Category:
                      </label>
                      <select
                        value={addProductsCategory}
                        onChange={e => {
                          const catId = Number(e.target.value);
                          setAddProductsCategory(catId);
                          setSelectedProductIdsToAdd(new Set());
                          const catObj = menuCategories.find(c => c.id === catId);
                          if (catObj && !addProductsGroupName) {
                            if (catObj.name.toLowerCase().includes('coffee')) setAddProductsGroupName('Your Coffee');
                            else if (catObj.name.toLowerCase().includes('viennoiser')) setAddProductsGroupName('Your Croissant');
                            else if (catObj.name.toLowerCase().includes('breakfast')) setAddProductsGroupName('Your Eggs');
                            else if (catObj.name.toLowerCase().includes('bread')) setAddProductsGroupName('Bread Basket');
                            else setAddProductsGroupName(catObj.name);
                          }
                        }}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: '7px',
                          border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff'
                        }}
                      >
                        <option value="">Choose category…</option>
                        {menuCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        2. Target Option Group Name:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Your Coffee, Your Eggs, Your Croissant, Included Items"
                        value={addProductsGroupName}
                        onChange={e => setAddProductsGroupName(e.target.value)}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: '7px',
                          border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff'
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Group Name suggestions pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Quick names:</span>
                    {['Your Coffee', 'Your Croissant', 'Your Eggs', 'Viennoiseries', 'Milk', 'Included Items'].map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setAddProductsGroupName(name)}
                        style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                          backgroundColor: addProductsGroupName === name ? '#dbeafe' : '#f1f5f9',
                          color: addProductsGroupName === name ? '#1d4ed8' : '#475569',
                          border: `1px solid ${addProductsGroupName === name ? '#93c5fd' : '#cbd5e1'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>

                  {/* 2. Group Rules */}
                  <div style={{
                    display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
                    marginBottom: '14px', padding: '10px 12px', backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0', borderRadius: '8px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addProductsRequired}
                        onChange={e => setAddProductsRequired(e.target.checked)}
                      />
                      Required Choice (pick 1 to advance)
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addProductsMultiSelect}
                        onChange={e => setAddProductsMultiSelect(e.target.checked)}
                      />
                      Multi-select (allow choosing multiple)
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addProductsIsDefault}
                        onChange={e => setAddProductsIsDefault(e.target.checked)}
                      />
                      Included by default (pre-checked on ticket)
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#1d4ed8', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addProductsIncludeModifiers}
                        onChange={e => setAddProductsIncludeModifiers(e.target.checked)}
                      />
                      ⚙️ Also import modifier options of these products (Milk, Bread, Cooking, etc.)
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#047857', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addProductsUseOriginalPrice}
                        onChange={e => setAddProductsUseOriginalPrice(e.target.checked)}
                      />
                      💰 Use original product price (e.g. $25 for Bœuf Bourguignon)
                    </label>

                    {!addProductsUseOriginalPrice && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Price:</span>
                        <input
                          type="number"
                          step="0.5"
                          value={addProductsPrice}
                          onChange={e => setAddProductsPrice(parseFloat(e.target.value) || 0)}
                          style={{
                            width: '65px', padding: '4px 6px', borderRadius: '6px',
                            border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 700, textAlign: 'right'
                          }}
                        />
                        <span style={{ fontSize: '10px', color: '#64748b' }}>($0 for free bundle items)</span>
                      </div>
                    )}
                  </div>

                  {/* 3. Product Checklist */}
                  {addProductsCategory ? (() => {
                    const filteredProds = rawProductsList.filter(p => Number(p.category_id) === Number(addProductsCategory));
                    const allCatSelected = filteredProds.length > 0 && filteredProds.every(p => selectedProductIdsToAdd.has(p.id));

                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                            Products in Category ({filteredProds.length}):
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (allCatSelected) {
                                setSelectedProductIdsToAdd(new Set());
                              } else {
                                setSelectedProductIdsToAdd(new Set(filteredProds.map(p => p.id)));
                              }
                            }}
                            style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
                              backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#2563eb', cursor: 'pointer'
                            }}
                          >
                            {allCatSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        {filteredProds.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                            No products found in this category.
                          </div>
                        ) : (
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                            maxHeight: '220px', overflowY: 'auto', padding: '4px',
                            backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0'
                          }}>
                            {filteredProds.map(p => {
                              const isChecked = selectedProductIdsToAdd.has(p.id);
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedProductIdsToAdd(prev => {
                                      const next = new Set(prev);
                                      if (next.has(p.id)) next.delete(p.id);
                                      else next.add(p.id);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                                    backgroundColor: isChecked ? '#eff6ff' : '#f8fafc',
                                    border: `1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}`,
                                    transition: 'all 0.1s'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '16px', height: '16px', borderRadius: '4px',
                                      border: isChecked ? 'none' : '1.5px solid #94a3b8',
                                      backgroundColor: isChecked ? '#2563eb' : '#fff',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                      {isChecked && <Check size={12} color="#fff" />}
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: isChecked ? 700 : 500, color: '#0f172a' }}>
                                      {p.name}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                                    Menu: ${Number(p.price || 0).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setShowAddProductsPanel(false)}
                            style={{
                              padding: '6px 14px', borderRadius: '7px',
                              backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
                              fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={addingProductsLoading || selectedProductIdsToAdd.size === 0 || !addProductsGroupName.trim()}
                            onClick={handleAddProductsToGroup}
                            style={{
                              padding: '6px 16px', borderRadius: '7px',
                              backgroundColor: (selectedProductIdsToAdd.size > 0 && addProductsGroupName.trim()) ? 'var(--primary)' : '#e2e8f0',
                              color: (selectedProductIdsToAdd.size > 0 && addProductsGroupName.trim()) ? '#ffffff' : '#94a3b8',
                              border: 'none', fontSize: '12px', fontWeight: 800,
                              cursor: (selectedProductIdsToAdd.size > 0 && addProductsGroupName.trim()) ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {addingProductsLoading ? 'Adding Products…' : `Add ${selectedProductIdsToAdd.size} Product${selectedProductIdsToAdd.size !== 1 ? 's' : ''} to "${addProductsGroupName || 'Group'}"`}
                          </button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '12px' }}>
                      Please select a category above to view products.
                    </div>
                  )}
                </div>
              )}

              {sourceProducts.length > 0 && (
                <div style={{
                  marginBottom: '16px', padding: '10px 12px',
                  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '10px', display: 'flex', alignItems: 'center',
                  gap: '10px', flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                    <Copy size={14} color="var(--primary)" />
                    Copy from another product:
                  </div>
                  <select
                    value={selectedSourceProductId}
                    onChange={e => setSelectedSourceProductId(e.target.value)}
                    style={{
                      flex: 1, minWidth: '180px', padding: '6px 10px',
                      borderRadius: '7px', border: '1px solid #cbd5e1',
                      fontSize: '12px', backgroundColor: '#fff'
                    }}
                  >
                    <option value="">Select a product with modifiers…</option>
                    {sourceProducts.map(sp => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name} ({sp.count} modifier{sp.count !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSourceProductId || copyingFromProduct}
                    onClick={handleCopyFromProduct}
                    style={{
                      padding: '6px 14px', borderRadius: '7px',
                      backgroundColor: selectedSourceProductId ? 'var(--primary)' : '#e2e8f0',
                      color: selectedSourceProductId ? '#fff' : '#94a3b8',
                      border: 'none', fontSize: '12px', fontWeight: 700,
                      cursor: selectedSourceProductId && !copyingFromProduct ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {copyingFromProduct ? 'Copying…' : 'Copy Modifiers & Effects'}
                  </button>
                </div>
              )}

              {activePosScreens.length > 0 && (
                <div style={{
                  marginBottom: '16px', padding: '10px 14px',
                  backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Dynamic POS Modifier Screens ({activePosScreens.length} Sequential Screen{activePosScreens.length !== 1 ? 's' : ''})
                    </div>
                    {activePosScreens.length > 1 && (
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                        Drag or use arrows to sort screen order (first, middle, last)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {activePosScreens.map((grp, idx) => {
                      const isDragging = draggedScreenIdx === idx;
                      return (
                        <React.Fragment key={grp}>
                          <div
                            draggable={activePosScreens.length > 1}
                            onDragStart={() => setDraggedScreenIdx(idx)}
                            onDragOver={(e) => {
                              if (activePosScreens.length > 1) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedScreenIdx !== null && draggedScreenIdx !== idx) {
                                handleReorderPosScreen(draggedScreenIdx, idx);
                              }
                              setDraggedScreenIdx(null);
                            }}
                            onDragEnd={() => setDraggedScreenIdx(null)}
                            title={activePosScreens.length > 1 ? 'Drag to reorder screen order or use arrows' : undefined}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: '999px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #93c5fd',
                              overflow: 'hidden',
                              opacity: isDragging ? 0.5 : 1,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {activePosScreens.length > 1 && idx > 0 && (
                              <button
                                type="button"
                                title={`Move "${grp}" earlier (Screen ${idx})`}
                                onClick={() => handleReorderPosScreen(idx, idx - 1)}
                                style={{
                                  border: 'none',
                                  borderRight: '1px solid #e2e8f0',
                                  backgroundColor: 'transparent',
                                  color: '#3b82f6',
                                  padding: '4px 6px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  fontWeight: 800
                                }}
                              >
                                ◀
                              </button>
                            )}
                            <span style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              cursor: activePosScreens.length > 1 ? 'grab' : 'default',
                              userSelect: 'none'
                            }}>
                              Screen {idx + 1}: {grp}
                            </span>
                            {activePosScreens.length > 1 && idx < activePosScreens.length - 1 && (
                              <button
                                type="button"
                                title={`Move "${grp}" later (Screen ${idx + 2})`}
                                onClick={() => handleReorderPosScreen(idx, idx + 1)}
                                style={{
                                  border: 'none',
                                  borderLeft: '1px solid #e2e8f0',
                                  backgroundColor: 'transparent',
                                  color: '#3b82f6',
                                  padding: '4px 6px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  fontWeight: 800
                                }}
                              >
                                ▶
                              </button>
                            )}
                          </div>
                          {idx < activePosScreens.length - 1 && (
                            <span style={{ color: '#64748b', fontWeight: 800, fontSize: '12px' }}>→</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Expand / Collapse All Toolbar ── */}
              {(sortedRegularEntries.length > 0 || sortedRemovalEntries.length > 0) && (() => {
                const totalGroups = sortedRegularEntries.length + sortedRemovalEntries.length;
                const isAllExpanded = totalGroups > 0 && expandedGroups.size >= totalGroups;
                const isAllCollapsed = expandedGroups.size === 0;

                return (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '14px', padding: '6px 10px',
                    backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                      {totalGroups} Modifier Group{totalGroups !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleExpandAll}
                        disabled={isAllExpanded}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          backgroundColor: isAllExpanded ? '#f1f5f9' : '#eff6ff',
                          color: isAllExpanded ? '#94a3b8' : '#2563eb',
                          border: `1px solid ${isAllExpanded ? '#e2e8f0' : '#bfdbfe'}`,
                          cursor: isAllExpanded ? 'default' : 'pointer'
                        }}
                      >
                        <ChevronsUpDown size={13} />
                        Expand All
                      </button>
                      <button
                        type="button"
                        onClick={handleCollapseAll}
                        disabled={isAllCollapsed}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          backgroundColor: isAllCollapsed ? '#f1f5f9' : '#ffffff',
                          color: isAllCollapsed ? '#94a3b8' : '#475569',
                          border: `1px solid ${isAllCollapsed ? '#e2e8f0' : '#cbd5e1'}`,
                          cursor: isAllCollapsed ? 'default' : 'pointer'
                        }}
                      >
                        <ChevronsDownUp size={13} />
                        Collapse All
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Add On / Option groups ── */}
              {sortedRegularEntries.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#475569',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: '10px', paddingBottom: '6px',
                    borderBottom: '2px solid #e2e8f0',
                  }}>
                    Add On &amp; Options
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sortedRegularEntries.map(([groupName, items]) =>
                      renderGroup(groupName, items, false)
                    )}
                  </div>
                </div>
              )}

              {/* ── Remove section ── */}
              {sortedRemovalEntries.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#ea580c',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: '10px', paddingBottom: '6px',
                    borderBottom: '2px solid #fed7aa',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    🗑 Remove Ingredients
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sortedRemovalEntries.map(([groupName, items]) =>
                      renderGroup(groupName, items, true)
                    )}
                  </div>
                </div>
              )}

              {Object.keys(groupedRegular).length === 0 && Object.keys(groupedRemoval).length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '13px' }}>
                  No modifier items found. Create them in the <strong>Modifiers</strong> tab first.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, backgroundColor: '#f8fafc',
        }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Changes save <strong>automatically</strong>.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '8px',
              backgroundColor: 'var(--primary)', color: '#fff',
              border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
