import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';
import {
  type PosDiscountRule,
  getRestaurantDiscounts,
  saveRestaurantDiscounts
} from '../services/discountService';

interface DiscountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName?: string;
  currentBranchId?: string;
  currentBranchName?: string;
  onDiscountsUpdated?: (discounts: PosDiscountRule[]) => void;
}

interface RestaurantBranch {
  id: string;
  name: string;
}

export function DiscountManagerModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName = 'Restaurant',
  currentBranchId,
  currentBranchName,
  onDiscountsUpdated
}: DiscountManagerModalProps) {
  const [discounts, setDiscounts] = useState<PosDiscountRule[]>([]);
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add / Edit Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'percent' | 'fixed'>('percent');
  const [formValue, setFormValue] = useState<string>('15');
  const [formApplyAll, setFormApplyAll] = useState(true);
  const [formSelectedBranches, setFormSelectedBranches] = useState<string[]>([]);
  const [formRequirePin, setFormRequirePin] = useState(false);

  // Load discounts and branches for this restaurant
  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch restaurant discounts
      const discResult = await getRestaurantDiscounts(restaurantId);
      setDiscounts(discResult.discounts || []);

      // 2. Fetch all branches for this restaurant
      const { data: branchData, error: branchErr } = await supabase
        .from('branches')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .order('name');

      if (!branchErr && branchData) {
        setBranches(branchData);
      } else {
        console.warn('Could not fetch branches:', branchErr?.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load discount settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && restaurantId) {
      loadData();
    }
  }, [isOpen, restaurantId]);

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormName('');
    setFormType('percent');
    setFormValue('15');
    setFormApplyAll(true);
    // By default, if specific is selected later, pre-check the current branch
    setFormSelectedBranches(currentBranchId ? [currentBranchId] : []);
    setFormRequirePin(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditing(true);
  };

  const handleOpenEditForm = (rule: PosDiscountRule) => {
    setEditingId(rule.id);
    setFormName(rule.name);
    setFormType(rule.type);
    setFormValue(String(rule.value));
    setFormApplyAll(rule.apply_to_all_branches);
    setFormSelectedBranches(rule.branch_ids || []);
    setFormRequirePin(!!rule.requires_manager_pin);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditing(true);
  };

  const handleToggleBranchSelection = (branchId: string) => {
    setFormSelectedBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DiscountManager] handleSaveDiscount called!', { formName, formValue, formApplyAll, formSelectedBranches });
    const cleanName = formName.trim();
    if (!cleanName) {
      console.warn('[DiscountManager] cleanName is empty');
      setErrorMsg('Discount name is required.');
      return;
    }

    const numVal = parseFloat(formValue);
    if (isNaN(numVal) || numVal <= 0) {
      console.warn('[DiscountManager] numVal is invalid:', formValue);
      setErrorMsg('Please enter a valid discount value greater than 0.');
      return;
    }

    if (!formApplyAll && formSelectedBranches.length === 0) {
      console.warn('[DiscountManager] formSelectedBranches is empty');
      setErrorMsg('Please select at least one branch for branch-specific discount.');
      return;
    }

    // Resolve branch names from IDs for convenient caching
    const branchNames = branches
      .filter((b) => formSelectedBranches.includes(b.id))
      .map((b) => b.name);

    setIsSaving(true);
    setErrorMsg(null);


    let updatedList: PosDiscountRule[];

    if (editingId) {
      // Update existing
      updatedList = discounts.map((d) => {
        if (d.id === editingId) {
          return {
            ...d,
            name: cleanName,
            type: formType,
            value: numVal,
            apply_to_all_branches: formApplyAll,
            branch_ids: formApplyAll ? [] : formSelectedBranches,
            branch_names: formApplyAll ? [] : branchNames,
            requires_manager_pin: formRequirePin,
            updated_at: new Date().toISOString()
          };
        }
        return d;
      });
    } else {
      // Create new
      const newRule: PosDiscountRule = {
        id: `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        restaurant_id: restaurantId,
        name: cleanName,
        type: formType,
        value: numVal,
        apply_to_all_branches: formApplyAll,
        branch_ids: formApplyAll ? [] : formSelectedBranches,
        branch_names: formApplyAll ? [] : branchNames,
        is_active: true,
        requires_manager_pin: formRequirePin,
        sort_order: discounts.length + 1,
        color: formType === 'percent' ? 'emerald' : 'blue',
        created_at: new Date().toISOString()
      };
      updatedList = [...discounts, newRule];
    }

    const res = await saveRestaurantDiscounts(restaurantId, updatedList);
    setIsSaving(false);

    if (res.success) {
      setDiscounts(updatedList);
      setIsEditing(false);
      setSuccessMsg(`Discount "${cleanName}" saved successfully!`);
      if (onDiscountsUpdated) onDiscountsUpdated(updatedList);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.error || 'Failed to save discount to server.');
    }
  };

  const handleToggleActive = async (ruleId: string) => {
    const updatedList = discounts.map((d) =>
      d.id === ruleId ? { ...d, is_active: !d.is_active, updated_at: new Date().toISOString() } : d
    );
    setDiscounts(updatedList);

    const res = await saveRestaurantDiscounts(restaurantId, updatedList);
    if (res.success) {
      if (onDiscountsUpdated) onDiscountsUpdated(updatedList);
    } else {
      setErrorMsg('Failed to update discount status.');
      // Revert
      loadData();
    }
  };

  const handleDelete = async (ruleId: string) => {
    const target = discounts.find((d) => d.id === ruleId);
    if (!window.confirm(`Are you sure you want to delete the discount "${target?.name || 'this discount'}"?`)) {
      return;
    }

    const updatedList = discounts.filter((d) => d.id !== ruleId);
    setDiscounts(updatedList);

    const res = await saveRestaurantDiscounts(restaurantId, updatedList);
    if (res.success) {
      setSuccessMsg('Discount deleted.');
      if (onDiscountsUpdated) onDiscountsUpdated(updatedList);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg('Failed to delete discount.');
      loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col text-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-emerald-50 rounded-2xl border border-emerald-200 text-[#1e5c4f]">🏷️</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-slate-900 tracking-wide">
                  Discount Rules &amp; Presets
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {restaurantName}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Configure discounts proper to {restaurantName} and specify if they apply to all branches or separate branches.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center font-bold text-sm transition cursor-pointer shadow-xs"
          >
            ✕
          </button>
        </div>

        {/* ALERTS */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between shadow-xs">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="hover:text-rose-950 ml-2 cursor-pointer font-bold">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="hover:text-emerald-950 ml-2 cursor-pointer font-bold">✕</button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-bold animate-pulse">
              Loading discount configuration...
            </div>
          ) : isEditing ? (
            /* ADD / EDIT DISCOUNT FORM */
            <form onSubmit={handleSaveDiscount} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-sm font-black text-slate-900">
                  {editingId ? '✏️ Edit Discount' : '➕ Create New Discount'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Discount Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Discount Name / Reason <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Staff Meal, VIP Guest, Happy Hour, Owner Comp"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:border-[#1e5c4f] shadow-xs"
                  autoFocus
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setFormType('percent')}
                      className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                        formType === 'percent'
                          ? 'bg-[#1e5c4f] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      % Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('fixed')}
                      className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                        formType === 'fixed'
                          ? 'bg-[#1e5c4f] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      $ Fixed USD
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Value {formType === 'percent' ? '(%)' : '($ USD)'} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    step={formType === 'percent' ? '1' : '0.5'}
                    min="0.1"
                    placeholder={formType === 'percent' ? 'e.g. 20' : 'e.g. 5.00'}
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-[#1e5c4f] shadow-xs"
                  />
                </div>
              </div>

              {/* Branch Applicability Scope */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700">
                  Branch Applicability Scope:
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#1e5c4f] transition shadow-xs">
                    <input
                      type="radio"
                      name="branchScope"
                      checked={formApplyAll}
                      onChange={() => setFormApplyAll(true)}
                      className="accent-[#1e5c4f] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>🌐 Apply to ALL branches in {restaurantName}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                          Universal
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        This discount will automatically be available in every branch belonging to {restaurantName}.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#1e5c4f] transition shadow-xs">
                    <input
                      type="radio"
                      name="branchScope"
                      checked={!formApplyAll}
                      onChange={() => setFormApplyAll(false)}
                      className="accent-[#1e5c4f] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>📍 Specific branch(es) only</span>
                        <span className="text-[10px] bg-sky-50 text-sky-800 px-1.5 py-0.5 rounded font-bold border border-sky-200">
                          Branch-Specific
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Choose which branches are authorized to use this discount.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Specific Branch Checkboxes */}
                {!formApplyAll && (
                  <div className="mt-2 p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[11px] font-black text-slate-800 block uppercase">
                      Select Authorized Branches:
                    </span>
                    {branches.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No branches registered for this restaurant.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {branches.map((b) => {
                          const isChecked = formSelectedBranches.includes(b.id);
                          return (
                            <label
                              key={b.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                                isChecked
                                  ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleBranchSelection(b.id)}
                                className="accent-[#1e5c4f] w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="text-xs font-bold">{b.name}</span>
                              {currentBranchId === b.id && (
                                <span className="text-[9px] bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-bold ml-auto">
                                  Current
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manager PIN Security Option */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequirePin}
                    onChange={(e) => setFormRequirePin(e.target.checked)}
                    className="accent-[#1e5c4f] w-4 h-4 rounded cursor-pointer"
                  />
                  <span>Require Manager Approval / PIN to apply this discount</span>
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSaveDiscount}
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#1e5c4f] hover:bg-[#16473D] active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update Discount' : 'Save Discount'}
                </button>
              </div>
            </form>

          ) : (
            /* LIST OF EXISTING DISCOUNTS */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  Configured Discounts ({discounts.length})
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddForm}
                  className="px-4 py-2 bg-[#1e5c4f] hover:bg-[#16473D] active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+ Add Discount</span>
                </button>
              </div>

              {discounts.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6">
                  <span className="text-3xl mb-2 block">🏷️</span>
                  <p className="text-xs font-bold text-slate-700">No discounts configured yet for {restaurantName}.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Click "+ Add Discount" above to create your first discount preset.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {discounts.map((rule) => {
                    const isAll = rule.apply_to_all_branches;
                    const isBranchMatch =
                      isAll ||
                      (currentBranchId && rule.branch_ids?.includes(currentBranchId)) ||
                      (currentBranchName && rule.branch_names?.includes(currentBranchName));

                    return (
                      <div
                        key={rule.id}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 shadow-xs ${
                          rule.is_active
                            ? 'bg-white border-slate-200 hover:border-slate-300'
                            : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        {/* LEFT: Info & Badges */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Value Pill */}
                          <div
                            className={`w-14 h-11 rounded-xl flex flex-col items-center justify-center font-black flex-shrink-0 border ${
                              rule.type === 'percent'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-sky-50 border-sky-200 text-sky-800'
                            }`}
                          >
                            <span className="text-sm leading-tight">
                              {rule.type === 'percent' ? `${rule.value}%` : `$${rule.value}`}
                            </span>
                            <span className="text-[9px] uppercase tracking-tighter opacity-80 font-bold">OFF</span>
                          </div>

                          {/* Details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-slate-900 truncate">{rule.name}</span>
                              {rule.requires_manager_pin && (
                                <span className="text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded">
                                  🔒 PIN
                                </span>
                              )}
                              {!rule.is_active && (
                                <span className="text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded">
                                  Inactive
                                </span>
                              )}
                            </div>

                            {/* Scope Badge */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {isAll ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                  <span>🌐</span>
                                  <span>All Branches</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                                  <span>📍</span>
                                  <span>
                                    {rule.branch_names && rule.branch_names.length > 0
                                      ? rule.branch_names.join(', ')
                                      : `${rule.branch_ids?.length || 0} Branches`}
                                  </span>
                                </span>
                              )}

                              {isBranchMatch && (
                                <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                                  <span>✓</span>
                                  <span>Active for {currentBranchName || 'current branch'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Active Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(rule.id)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer shadow-xs ${
                              rule.is_active
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                            }`}
                            title={rule.is_active ? 'Click to disable' : 'Click to enable'}
                          >
                            {rule.is_active ? 'Enabled' : 'Disabled'}
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(rule)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer shadow-xs"
                            title="Edit discount"
                          >
                            ✏️
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(rule.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer shadow-xs"
                            title="Delete discount"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Active Branch: <strong className="text-slate-800">{currentBranchName || 'None'}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#1e5c4f] hover:bg-[#16473D] active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
