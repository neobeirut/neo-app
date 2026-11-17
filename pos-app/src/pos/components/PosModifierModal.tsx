import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, ArrowLeft } from 'lucide-react';

export interface PosModifierModalProps {
  isOpen: boolean;
  product: {
    id: string | number;
    name: string;
    unit_price_usd?: number;
    price?: number;
    customizations?: any[];
  } | null;
  allProducts?: any[];
  initialSelectedCustomizations?: any[];
  initialNote?: string;
  initialQty?: number;
  isEditing?: boolean;
  isCustomization86d?: (opt: any) => boolean;
  onClose: () => void;
  onSave: (result: {
    selectedCustomizations: any[];
    note: string;
    qty: number;
    unitPrice: number;
    extraCost: number;
  }) => void;
}

export function findMatchingProduct(optName: string, allProducts: any[] = []): any | null {
  if (!optName || !allProducts || allProducts.length === 0) return null;
  const raw = String(optName).trim();
  const norm = raw.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
  if (!norm) return null;

  let p = allProducts.find(p => p.name && p.name.toLowerCase().trim() === norm);
  if (p) return p;
  p = allProducts.find(p => p.name && (norm.startsWith(p.name.toLowerCase().trim()) || p.name.toLowerCase().trim().startsWith(norm)));
  if (p) return p;
  p = allProducts.find(p => p.name && (norm.includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().trim().includes(norm)));
  return p || null;
}

export function buildDynamicModifierGroups(
  baseCustomizations: any[] = [],
  currentSelected: any[] = [],
  allProducts: any[] = [],
  isBundle: boolean = false
): [string, any[]][] {
  const baseGroups = getOrderedModifierGroups(baseCustomizations);
  const result: [string, any[]][] = [];

  for (const [groupName, opts] of baseGroups) {
    result.push([groupName, opts]);

    const selectedInGroup = opts.filter(opt =>
      currentSelected.some(c => c.id === opt.id || c.original_id === opt.id)
    );

    for (const selOpt of selectedInGroup) {
      const optName = selOpt.name || selOpt.ingredient;
      const matchedProd = findMatchingProduct(optName, allProducts);

      if (matchedProd && matchedProd.customizations && matchedProd.customizations.length > 0) {
        const subGroups = getOrderedModifierGroups(matchedProd.customizations);

        for (const [subGroupName, subOpts] of subGroups) {
          const dynamicGroupName = `${optName} — ${subGroupName}`;

          const mappedSubOpts = subOpts.map(subO => ({
            ...subO,
            id: `sub_${selOpt.id}_${subO.id}`,
            original_id: subO.id,
            parent_option_id: selOpt.id,
            parent_option_name: optName,
            option_group_name: dynamicGroupName,
            price: isBundle ? 0 : (subO.price || 0),
          }));

          result.push([dynamicGroupName, mappedSubOpts]);
        }
      }
    }
  }

  return result;
}

/**
 * Organizes customizations into ordered screens for step-by-step modifier selection.
 */
export function getOrderedModifierGroups(customizations: any[] = []): [string, any[]][] {
  const grouped: Record<string, any[]> = {};
  for (const c of customizations) {
    const rawG = (c.option_group_name || '').trim();
    const lower = rawG.toLowerCase();
    const tLower = (c.customization_type || '').toLowerCase();
    let group = rawG;
    if (
      lower === 'remove' ||
      lower === 'removal' ||
      lower === 'removals' ||
      lower.startsWith('remove ingredient') ||
      tLower === 'remove' ||
      tLower === 'removal'
    ) {
      group = 'Remove Ingredients';
    } else if (
      !rawG ||
      lower === 'general' ||
      lower === 'add on' ||
      lower === 'add-on' ||
      lower === 'addon' ||
      lower === 'add-ons' ||
      lower === 'addons' ||
      lower === 'add ons' ||
      lower === 'add_on' ||
      lower === 'add_ons' ||
      tLower === 'addon'
    ) {
      group = 'Add On';
    }
    if (!group) group = 'Custom Options';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(c);
  }

  const getExplicitScreenOrder = (opts: any[]): number | null => {
    for (const o of opts) {
      const ca = String(o?.created_at || '');
      const m = ca.match(/^2020-01-01T00:(\d{2}):/);
      if (m) {
        const ord = parseInt(m[1], 10);
        if (ord > 0) return ord;
      }
    }
    return null;
  };

  const groupPriority = (groupName: string, opts: any[]): number => {
    const explicitOrd = getExplicitScreenOrder(opts);
    if (explicitOrd !== null) return explicitOrd;
    const lower = groupName.trim().toLowerCase();
    if (lower === 'milk') return 110;
    if (lower === 'coffee' || lower === 'coffee type' || lower === 'your coffee') return 120;
    if (lower === 'syrups' || lower === 'syrup') return 130;
    const isRemove =
      opts.every((o: any) => o.customization_type === 'removal' || o.customization_type === 'remove') ||
      lower.startsWith('remove');
    if (isRemove) return 190;
    const isReq = opts.some((o: any) => o.is_required);
    const isMulti = opts.some((o: any) => o.is_multi_select);
    if (isReq && !isMulti) return 140;
    if (isReq && isMulti) return 150;
    if (!isMulti) return 160;
    return 170;
  };

  return Object.entries(grouped).sort(([aName, aOpts], [bName, bOpts]) => {
    const pa = groupPriority(aName, aOpts);
    const pb = groupPriority(bName, bOpts);
    if (pa !== pb) return pa - pb;
    return aName.localeCompare(bName);
  });
}

/**
 * Utility to partition customizations into addons and removals for UI pills
 */
export function partitionCustomizations(customizations: any): { addons: string[]; removals: string[] } {
  const addons: string[] = [];
  const removals: string[] = [];

  if (!customizations) return { addons, removals };

  let parsed = customizations;
  while (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        break;
      }
    } else {
      break;
    }
  }

  let itemsList: any[] = [];
  if (Array.isArray(parsed)) {
    itemsList = parsed;
  } else if (typeof parsed === 'string') {
    itemsList = parsed.split(',').map(s => s.trim());
  } else if (parsed && typeof parsed === 'object') {
    itemsList = Object.values(parsed);
  }

  for (const item of itemsList) {
    if (!item) continue;
    let name = '';
    let isRemoval = false;
    let qty = 1;

    if (typeof item === 'string') {
      name = item.trim();
      if (
        name.toLowerCase().startsWith('no ') ||
        name.toLowerCase().startsWith('without ') ||
        name.toLowerCase().startsWith('remove ')
      ) {
        isRemoval = true;
      }
    } else if (typeof item === 'object') {
      const baseName = (item.name || item.ingredient || item.option_name || '').trim();
      name = item.parent_option_name ? `${item.parent_option_name} → ${baseName}` : baseName;
      const type = (item.customization_type || '').toLowerCase();
      isRemoval =
        type === 'removal' ||
        type === 'remove' ||
        name.toLowerCase().startsWith('no ') ||
        name.toLowerCase().startsWith('without ');
      qty = Number(item.quantity || item.qty || 1);
    }

    const isInc = typeof item === 'object' && Boolean(
      item.option_group_name?.toLowerCase().includes('included') ||
      item.name?.toLowerCase().includes('(included)') ||
      item.ingredient?.toLowerCase().includes('(included)') ||
      item.is_default
    );
    if (!name) continue;
    const label = !isInc && qty > 1 ? `${name} ×${qty}` : name;
    if (isRemoval) {
      removals.push(label);
    } else {
      addons.push(label);
    }
  }

  return { addons, removals };
}

export function PosModifierModal({
  isOpen,
  product,
  allProducts = [],
  initialSelectedCustomizations = [],
  initialNote = '',
  initialQty = 1,
  isEditing = false,
  isCustomization86d,
  onClose,
  onSave
}: PosModifierModalProps) {
  if (!isOpen || !product) return null;

  const isBundle = Boolean(
    (product as any).category_id === 30 ||
    ((product as any).category_name && (product as any).category_name.toLowerCase().includes('bundle')) ||
    ((product as any).category && (product as any).category.toLowerCase().includes('bundle')) ||
    (product.name && product.name.toLowerCase().includes('bundle'))
  );

  const getSubDefaultsForOption = (opt: any) => {
    const optName = opt.name || opt.ingredient;
    const matchedProd = findMatchingProduct(optName, allProducts);
    const subDefs: any[] = [];
    if (matchedProd && matchedProd.customizations && matchedProd.customizations.length > 0) {
      const subGroups = getOrderedModifierGroups(matchedProd.customizations);
      for (const [subGroupName, subOpts] of subGroups) {
        const dynamicGroupName = `${optName} — ${subGroupName}`;
        const defs = subOpts.filter((so: any) => Boolean(so.is_default));
        defs.forEach((subO: any) => {
          subDefs.push({
            ...subO,
            id: `sub_${opt.id}_${subO.id}`,
            original_id: subO.id,
            parent_option_id: opt.id,
            parent_option_name: optName,
            option_group_name: dynamicGroupName,
            price: isBundle ? 0 : (subO.price || 0),
            quantity: 1,
          });
        });
      }
    }
    return subDefs;
  };

  const [selectedCustomizations, setSelectedCustomizations] = useState<any[]>(() => {
    if (initialSelectedCustomizations && initialSelectedCustomizations.length > 0) {
      return [...initialSelectedCustomizations];
    }
    // Pre-select defaults + their sub-defaults
    const baseDefaultOpts = (product.customizations || [])
      .filter((c: any) => Boolean(c.is_default))
      .map((c: any) => ({ ...c, quantity: 1 }));

    const allDefaults = [...baseDefaultOpts];
    baseDefaultOpts.forEach((bOpt: any) => {
      allDefaults.push(...getSubDefaultsForOption(bOpt));
    });
    return allDefaults;
  });

  const [itemNote, setItemNote] = useState<string>(initialNote || '');
  const [customizationQty, setCustomizationQty] = useState<number>(initialQty || 1);
  const [customizationStep, setCustomizationStep] = useState<number>(0);
  const [customizationError, setCustomizationError] = useState<string>('');

  // Re-sync if product or initial state changes
  useEffect(() => {
    if (initialSelectedCustomizations && initialSelectedCustomizations.length > 0) {
      setSelectedCustomizations([...initialSelectedCustomizations]);
    } else {
      const baseDefaultOpts = (product.customizations || [])
        .filter((c: any) => Boolean(c.is_default))
        .map((c: any) => ({ ...c, quantity: 1 }));

      const allDefaults = [...baseDefaultOpts];
      baseDefaultOpts.forEach((bOpt: any) => {
        allDefaults.push(...getSubDefaultsForOption(bOpt));
      });
      setSelectedCustomizations(allDefaults);
    }
    setItemNote(initialNote || '');
    setCustomizationQty(initialQty || 1);
    setCustomizationStep(0);
    setCustomizationError('');
  }, [product, initialSelectedCustomizations, initialNote, initialQty]);

  const orderedGroups = buildDynamicModifierGroups(
    product.customizations || [],
    selectedCustomizations,
    allProducts || [],
    isBundle
  );
  const totalScreens = Math.max(orderedGroups.length, 1);
  const safeStep = Math.min(Math.max(customizationStep, 0), totalScreens - 1);
  const activeGroupEntry = orderedGroups[safeStep] || null;
  const activeGroupName = activeGroupEntry ? activeGroupEntry[0] : '';
  const activeGroupOpts: any[] = activeGroupEntry ? activeGroupEntry[1] : [];
  const activeIsRequired = activeGroupOpts.some((o: any) => o.is_required);
  const activeHasSelection = selectedCustomizations.some((c: any) =>
    activeGroupOpts.some((o: any) => o.id === c.id || o.original_id === c.id || o.id === c.original_id || (o.original_id && c.original_id && o.original_id === c.original_id && o.parent_option_id === c.parent_option_id))
  );

  const allRequiredSatisfied = orderedGroups.every(([, opts]) => {
    const isReq = (opts as any[]).some((o: any) => o.is_required);
    return !isReq || selectedCustomizations.some((c: any) =>
      (opts as any[]).some((o: any) => o.id === c.id || o.original_id === c.id || o.id === c.original_id || (o.original_id && c.original_id && o.original_id === c.original_id && o.parent_option_id === c.parent_option_id))
    );
  });

  let extraCost = 0;
  if (!isBundle) {
    selectedCustomizations.forEach((c: any) => {
      const q = Number(c.quantity || 1);
      if (c.price) extraCost += c.price * q;
    });
  }
  const basePrice = product.unit_price_usd !== undefined ? product.unit_price_usd : (product.price || 0);
  const finalUnitPrice = basePrice + extraCost;

  const handleToggleOption = (custOption: any, isMultiSelect: boolean, totalSteps: number = 1) => {
    setCustomizationError('');
    if (isCustomization86d && isCustomization86d(custOption)) {
      setCustomizationError(`⚠️ "${custOption.name || custOption.ingredient || 'This option'}" is currently unavailable.`);
      return;
    }
    const groupName = custOption.option_group_name;
    if (isMultiSelect) {
      // Checkbox-style: toggle individual option within group
      const exists = selectedCustomizations.some((c: any) => c.id === custOption.id || c.original_id === custOption.id);
      if (exists) {
        setSelectedCustomizations(selectedCustomizations.filter((c: any) => c.id !== custOption.id && c.original_id !== custOption.id && c.parent_option_id !== custOption.id));
      } else {
        setSelectedCustomizations([...selectedCustomizations, { ...custOption, quantity: 1 }]);
      }
    } else {
      // Radio-style: clear other selections in this group and their sub-options, select this one
      const alreadySelected = selectedCustomizations.some((c: any) => c.id === custOption.id || c.original_id === custOption.id);
      const previousInGroup = selectedCustomizations.find((c: any) => c.option_group_name === groupName);
      const prevId = previousInGroup?.id;

      const filtered = selectedCustomizations.filter((c: any) =>
        c.option_group_name !== groupName && (!prevId || c.parent_option_id !== prevId)
      );

      if (alreadySelected) {
        setSelectedCustomizations(filtered.filter((c: any) => c.parent_option_id !== custOption.id));
      } else {
        const subDefaults = getSubDefaultsForOption(custOption);
        setSelectedCustomizations([...filtered, { ...custOption, quantity: 1 }, ...subDefaults]);
        // Automatically advance to the next modifier screen when picking a single-choice option
        if (customizationStep < totalSteps - 1) {
          setTimeout(() => {
            setCustomizationStep(prev => Math.min(prev + 1, totalSteps - 1));
          }, 160);
        }
      }
    }
  };

  const handleUpdateOptionQty = (custOption: any, delta: number) => {
    setCustomizationError('');
    const existing = selectedCustomizations.find((c: any) => c.id === custOption.id);
    if (!existing) {
      if (delta > 0) {
        setSelectedCustomizations([...selectedCustomizations, { ...custOption, quantity: 1 }]);
      }
      return;
    }
    const currentQty = Number(existing.quantity || 1);
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      setSelectedCustomizations(selectedCustomizations.filter((c: any) => c.id !== custOption.id));
    } else {
      setSelectedCustomizations(
        selectedCustomizations.map((c: any) =>
          c.id === custOption.id ? { ...c, quantity: newQty } : c
        )
      );
    }
  };

  const handleNextStep = () => {
    setCustomizationError('');
    if (activeIsRequired && !activeHasSelection) {
      setCustomizationError(`⚠️ "${activeGroupName}" is REQUIRED — please select an option before continuing.`);
      return;
    }
    if (safeStep < totalScreens - 1) {
      setCustomizationStep(safeStep + 1);
    } else {
      handleFinalSave();
    }
  };

  const handleFinalSave = () => {
    if (orderedGroups.length > 0) {
      for (let idx = 0; idx < orderedGroups.length; idx++) {
        const [groupName, opts] = orderedGroups[idx];
        const isReq = (opts as any[]).some((o: any) => o.is_required);
        if (isReq) {
          const hasSelected = selectedCustomizations.some((c: any) =>
            (opts as any[]).some((o: any) => o.id === c.id)
          );
          if (!hasSelected) {
            setCustomizationStep(idx);
            setCustomizationError(`⚠️ "${groupName}" (Screen ${idx + 1} of ${orderedGroups.length}) is REQUIRED — please make a selection.`);
            return;
          }
        }
      }
    }

    onSave({
      selectedCustomizations,
      note: itemNote.trim(),
      qty: customizationQty,
      unitPrice: finalUnitPrice,
      extraCost
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl md:max-w-2xl p-5 sm:p-6 space-y-4 text-slate-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">{product.name}</h3>
              {orderedGroups.length > 0 && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-pos-primary/10 text-pos-primary border border-pos-primary/30">
                  Screen {safeStep + 1} of {totalScreens}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-pos-primary">${finalUnitPrice.toFixed(2)}</span>
              {extraCost > 0 && (
                <span className="text-[10px] text-slate-500 font-medium">
                  (base ${basePrice.toFixed(2)} + ${extraCost.toFixed(2)} options)
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DYNAMIC MODIFIER SCREENS STEPPER BAR */}
        {orderedGroups.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0">
            {orderedGroups.map(([gName, gOpts], idx) => {
              const isCurrent = idx === safeStep;
              const hasSel = selectedCustomizations.some((c: any) =>
                (gOpts as any[]).some((o: any) => o.id === c.id || o.original_id === c.id || o.id === c.original_id || (o.original_id && c.original_id && o.original_id === c.original_id && o.parent_option_id === c.parent_option_id))
              );
              const isReq = (gOpts as any[]).some((o: any) => o.is_required);
              return (
                <React.Fragment key={gName}>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomizationError('');
                      setCustomizationStep(idx);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap border cursor-pointer ${
                      isCurrent
                        ? 'bg-pos-primary text-white border-pos-primary shadow-sm'
                        : hasSel
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                        : isReq
                        ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                      {hasSel ? '✓' : idx + 1}
                    </span>
                    <span>{gName}</span>
                  </button>
                  {idx < orderedGroups.length - 1 && (
                    <span className="text-slate-400 text-xs font-bold">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {customizationError && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 text-xs px-3.5 py-2 rounded-xl font-bold flex-shrink-0 animate-pulse">
            {customizationError}
          </div>
        )}

        {/* CURRENT MODIFIER SCREEN CONTENT */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeGroupEntry ? (
            (() => {
              const groupName = activeGroupName;
              const opts = activeGroupOpts;
              const isMultiSelect =
                opts.some((o: any) => o.is_multi_select) || opts[0]?.customization_type === 'removal';
              const isRequired = activeIsRequired;
              const isRemoveGroup = opts.every(
                (o: any) => o.customization_type === 'removal' || o.customization_type === 'remove'
              );
              const groupHasSelection = activeHasSelection;

              const modeBadge = isRemoveGroup
                ? { label: 'REMOVE', cls: 'bg-rose-100 text-rose-800 border-rose-300' }
                : isMultiSelect
                ? { label: 'MULTI SELECT', cls: 'bg-blue-100 text-blue-800 border-blue-300' }
                : { label: 'SINGLE CHOICE', cls: 'bg-purple-100 text-purple-800 border-purple-300' };

              return (
                <div
                  key={groupName}
                  className={`space-y-3 p-4 rounded-xl border transition-all ${
                    isRequired && !groupHasSelection
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                        {safeStep + 1}. {groupName}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${modeBadge.cls}`}>
                        {modeBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isRequired ? (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            groupHasSelection
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                          }`}
                        >
                          {groupHasSelection ? '✓ SATISFIED' : 'REQUIRED'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Optional
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hint text */}
                  <p className="text-[11px] text-slate-500 -mt-1">
                    {isRemoveGroup
                      ? 'Select any ingredients to remove from the dish.'
                      : isMultiSelect
                      ? 'Select one or more options below, then tap Next.'
                      : `Select one option${safeStep < totalScreens - 1 ? ' (automatically advances to the next screen)' : ''}.`}
                  </p>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {opts.map((opt: any) => {
                      const selectedEntry = selectedCustomizations.find((c: any) =>
                        c.id === opt.id ||
                        (c.original_id && c.original_id === opt.id) ||
                        (opt.original_id && c.id === opt.original_id) ||
                        (c.original_id && opt.original_id && c.original_id === opt.original_id && c.parent_option_id === opt.parent_option_id)
                      );
                      const isSelected = Boolean(selectedEntry);
                      const optQty = Number(selectedEntry?.quantity || 1);
                      const matchedSubProd = findMatchingProduct(opt.name || opt.ingredient, allProducts);
                      const hasSubModifiers = Boolean(matchedSubProd && matchedSubProd.customizations && matchedSubProd.customizations.length > 0);
                      const isIncludedItem = Boolean(
                        opt.option_group_name?.toLowerCase().includes('included') ||
                        opt.name?.toLowerCase().includes('included') ||
                        opt.ingredient?.toLowerCase().includes('included') ||
                        opt.is_default
                      );
                      const rawOptName = opt.name || opt.ingredient || '';
                      const displayName = rawOptName.replace(/\s*\(\s*included\s*\)/gi, '').trim();
                      const hasExtraPrice = !isBundle && opt.price > 0;
                      const isOptUnavailable = Boolean(isCustomization86d && isCustomization86d(opt));

                      return (
                        <div key={opt.id} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleOption(opt, isMultiSelect, totalScreens)}
                            disabled={isOptUnavailable}
                            title={isOptUnavailable ? `⚠️ "${displayName}" is currently unavailable` : displayName}
                            className={`w-full p-3.5 rounded-xl text-xs font-bold transition-all border shadow-xs flex items-center justify-between gap-2.5 min-h-[48px] ${
                              isOptUnavailable
                                ? 'bg-slate-100 border-dashed border-rose-300 opacity-40 cursor-not-allowed text-slate-400'
                                : isSelected
                                  ? isRemoveGroup
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-300 cursor-pointer'
                                    : isMultiSelect
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300 cursor-pointer'
                                    : 'bg-pos-primary text-white border-pos-primary shadow-sm ring-2 ring-pos-primary/30 cursor-pointer'
                                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className={`w-4 h-4 rounded-${isMultiSelect ? 'sm' : 'full'} border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'border-white bg-white/30' : 'border-slate-400 bg-transparent'
                                }`}
                              >
                                {isSelected && (
                                  <span className={`${isMultiSelect ? 'text-[9px]' : 'w-2 h-2 rounded-full bg-white block'}`}>
                                    {isMultiSelect ? '✓' : ''}
                                  </span>
                                )}
                              </span>
                              <span className={`text-xs font-bold text-left leading-snug break-words ${isOptUnavailable ? 'line-through text-slate-400' : ''}`}>
                                {displayName}
                              </span>
                              {isOptUnavailable && (
                                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 ml-1.5 shrink-0">
                                  Unavailable
                                </span>
                              )}
                            </div>

                            {hasExtraPrice && (
                              <span className={`text-[11px] font-black whitespace-nowrap flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                +${(opt.price * (isSelected ? optQty : 1)).toFixed(2)}
                              </span>
                            )}
                          </button>

                          {/* Modifier Quantity Stepper Controls (- 1 +) */}
                          {isMultiSelect && isSelected && !isRemoveGroup && !isBundle && !isIncludedItem && (
                            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl px-1.5 py-1.5 gap-1.5 shadow-xs flex-shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateOptionQty(opt, -1);
                                }}
                                className="w-5 h-5 rounded-lg flex items-center justify-center bg-white hover:bg-slate-200 text-xs font-black text-slate-800 border border-slate-200 cursor-pointer shadow-xs"
                                title="Decrease quantity"
                              >
                                -
                              </button>
                              <span className="text-xs font-black text-slate-900 min-w-[14px] text-center">
                                {optQty}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateOptionQty(opt, 1);
                                }}
                                className="w-5 h-5 rounded-lg flex items-center justify-center bg-white hover:bg-slate-200 text-xs font-black text-slate-800 border border-slate-200 cursor-pointer shadow-xs"
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
              No extra modifier options configured for this product.
            </div>
          )}

          {/* Summary of selections across all screens */}
          {selectedCustomizations.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                Selected:
              </span>
              {selectedCustomizations.map((c: any) => {
                const isInc = Boolean(
                  c.option_group_name?.toLowerCase().includes('included') ||
                  c.name?.toLowerCase().includes('(included)') ||
                  c.ingredient?.toLowerCase().includes('(included)') ||
                  c.is_default
                );
                const showQty = !isInc && !isBundle && Number(c.quantity || 1) > 1;
                const rawCustName = c.name || c.ingredient || '';
                const displayName = rawCustName.replace(/\s*\(\s*included\s*\)/gi, '').trim();

                return (
                  <span
                    key={c.id}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-xs"
                  >
                    {displayName}
                    {showQty ? ` ×${c.quantity}` : ''}
                  </span>
                );
              })}
            </div>
          )}

          {/* Special Note (shown on final screen or when only 1 screen) */}
          {(safeStep === totalScreens - 1 || orderedGroups.length === 0) && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 block">Special Preparation Note:</label>
              <input
                type="text"
                placeholder="e.g. Extra hot, syrup on the side, well done..."
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pos-primary"
              />
            </div>
          )}
        </div>

        {/* MODAL BOTTOM NAVIGATION */}
        <div className="flex gap-2.5 pt-3 border-t border-slate-200 flex-shrink-0">
          {safeStep > 0 ? (
            <button
              type="button"
              onClick={() => {
                setCustomizationError('');
                setCustomizationStep(safeStep - 1);
              }}
              className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs whitespace-nowrap transition cursor-pointer shadow-xs"
            >
              ← Back: {orderedGroups[safeStep - 1]?.[0]}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
            >
              Cancel
            </button>
          )}

          {safeStep < totalScreens - 1 ? (
            <>
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-1 py-3 bg-pos-primary hover:bg-pos-primary-hover text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {activeHasSelection
                  ? `Next: ${orderedGroups[safeStep + 1]?.[0]} (${safeStep + 2}/${totalScreens}) →`
                  : activeIsRequired
                  ? `Select ${activeGroupName} to Continue →`
                  : `Skip / Next: ${orderedGroups[safeStep + 1]?.[0]} (${safeStep + 2}/${totalScreens}) →`}
              </button>
              {allRequiredSatisfied && (
                <button
                  type="button"
                  onClick={handleFinalSave}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer shadow-md"
                  title="All required choices are satisfied — save directly to ticket"
                >
                  {isEditing ? 'Update Now' : 'Add Now'} (${(finalUnitPrice * customizationQty).toFixed(2)})
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleFinalSave}
              className="flex-1 py-3 bg-pos-primary hover:bg-pos-primary-hover text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isEditing ? 'UPDATE ITEM' : 'ADD TO TICKET'} — ${(finalUnitPrice * customizationQty).toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
