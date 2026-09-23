import React, { useState, useEffect } from 'react';
import { X, Sliders, Layers, CheckCircle, RefreshCw, Loader, ToggleLeft, ToggleRight } from 'lucide-react';
import { crmService } from '../../api/crmService';
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
  const [allModifiers, setAllModifiers] = useState<CustomizationItem[]>([]);
  const [linkedLinks, setLinkedLinks] = useState<ProductCustomization[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [savingGroupSetting, setSavingGroupSetting] = useState<string | null>(null);
  const [groupSettings, setGroupSettings] = useState<Record<string, GroupSettings>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [items, links] = await Promise.all([
        crmService.getCustomizationItems(),
        crmService.getProductCustomizations(product.id),
      ]);
      setAllModifiers(items.filter(i => i.is_active));
      setLinkedLinks(links);

      const gs: Record<string, GroupSettings> = {};
      links.forEach(link => {
        const gName = normalizeGroupName(link.option_group_name || '', link.customization_type || '');
        if (!gs[gName]) {
          gs[gName] = {
            is_required: Boolean(link.is_required),
            is_multi_select: Boolean(link.is_multi_select),
          };
        }
      });
      setGroupSettings(gs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [product.id]);

  /** Normalize group name: blank/General → "Add On"; keep everything else as-is */
  const normalizeGroupName = (rawGroup: string, type: string) => {
    const g = rawGroup.trim();
    if (!g || g.toLowerCase() === 'general') return 'Add On';
    return g;
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
        const groupName = normalizeGroupName(item.option_group_name || '', item.customization_type);
        const currentGs = groupSettings[groupName] || { is_required: false, is_multi_select: false };
        const newLink = await crmService.linkModifierToProduct(product.id, item);
        if (currentGs.is_required || currentGs.is_multi_select) {
          await crmService.updateProductModifierGroupSettings(product.id, groupName, currentGs);
        }
        setLinkedLinks(prev => [...prev, { ...newLink, is_required: currentGs.is_required, is_multi_select: currentGs.is_multi_select }]);
      }
      onSaved();
    } catch (err: any) {
      alert('Failed to update modifier: ' + err.message);
    } finally {
      setSavingItemId(null);
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
  const regularModifiers = allModifiers.filter(i => i.customization_type !== 'removal');
  const removalModifiers = allModifiers.filter(i => i.customization_type === 'removal');

  // Group regular modifiers by normalized name
  const groupedRegular = regularModifiers.reduce((acc, item) => {
    const g = normalizeGroupName(item.option_group_name || '', item.customization_type);
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {} as Record<string, CustomizationItem[]>);

  // Group removal modifiers by normalized name
  const groupedRemoval = removalModifiers.reduce((acc, item) => {
    const g = normalizeGroupName(item.option_group_name || '', item.customization_type);
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {} as Record<string, CustomizationItem[]>);

  const totalLinked = linkedLinks.length;

  const renderGroup = (groupName: string, items: CustomizationItem[], isRemoveSection: boolean) => {
    const gs = groupSettings[groupName] || { is_required: false, is_multi_select: false };
    const linkedCount = items.filter(i => linkedItemIds.has(i.id)).length;
    const hasAnyLinked = linkedCount > 0;

    return (
      <div key={groupName} style={{
        border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden',
      }}>
        {/* Group header */}
        <div style={{
          padding: '8px 12px', backgroundColor: isRemoveSection ? '#fff7ed' : '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={13} color={isRemoveSection ? '#ea580c' : 'var(--primary)'} />
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{groupName}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>({items.length})</span>
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 700,
            color: hasAnyLinked ? '#16a34a' : '#cbd5e1',
          }}>
            {linkedCount}/{items.length}
          </span>
        </div>

        {/* 2-column grid of options */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '1px', backgroundColor: '#f1f5f9',
        }}>
          {items.map(item => {
            const isLinked = linkedItemIds.has(item.id);
            const isSaving = savingItemId === item.id;
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
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: '12px', color: '#0f172a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.name}
                  </div>
                  {item.default_price > 0 && (
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      +${item.default_price.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-product rule settings (only for non-removal groups, only when items are linked) */}
        {hasAnyLinked && !isRemoveSection && (
          <div style={{
            padding: '10px 12px', backgroundColor: '#fafbff',
            borderTop: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rules for <span style={{ color: 'var(--primary)' }}>{product.name}</span>
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
                    Must select
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

        {/* Removal groups note */}
        {hasAnyLinked && isRemoveSection && (
          <div style={{
            padding: '7px 12px', backgroundColor: '#fff7ed',
            borderTop: '1px solid #fed7aa',
            fontSize: '11px', color: '#9a3412',
          }}>
            🗑 Removal groups always allow multiple selections.
          </div>
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
              {/* ── Add On / Option groups ── */}
              {Object.keys(groupedRegular).length > 0 && (
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
                    {Object.entries(groupedRegular).map(([groupName, items]) =>
                      renderGroup(groupName, items, false)
                    )}
                  </div>
                </div>
              )}

              {/* ── Remove section ── */}
              {Object.keys(groupedRemoval).length > 0 && (
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
                    {Object.entries(groupedRemoval).map(([groupName, items]) =>
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
