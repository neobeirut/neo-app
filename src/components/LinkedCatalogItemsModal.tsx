import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, X, ExternalLink, Edit, CheckCircle2, AlertCircle, ChefHat, Layers } from 'lucide-react';

export interface LinkedCatalogItemDetail {
  id?: string;
  name: string;
  role: 'Output Item' | 'Ingredient' | 'BOM Component' | 'Catalog Item' | 'Reference Prep Recipe' | 'Modifier Option';
  quantity?: number | string;
  unit?: string;
  department?: string;
  subDepartment?: string;
  priceUsd?: number | null;
  wastePercentage?: number;
  notes?: string;
}

export interface LinkedCatalogItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeName: string;
  recipeCodeOrSection?: string;
  recipeType?: 'production' | 'menu';
  editUrl?: string;
  outputItem?: LinkedCatalogItemDetail | null;
  items: LinkedCatalogItemDetail[];
}

export default function LinkedCatalogItemsModal({
  isOpen,
  onClose,
  recipeName,
  recipeCodeOrSection,
  recipeType = 'production',
  editUrl,
  outputItem,
  items
}: LinkedCatalogItemsModalProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalItemsCount = (outputItem ? 1 : 0) + items.length;

  const getRoleBadgeStyle = (role: LinkedCatalogItemDetail['role']): React.CSSProperties => {
    switch (role) {
      case 'Output Item':
        return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
      case 'Ingredient':
        return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
      case 'BOM Component':
        return { background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' };
      case 'Catalog Item':
        return { background: '#fdf4ff', color: '#a21caf', border: '1px solid #f0abfc' };
      case 'Reference Prep Recipe':
        return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
      case 'Modifier Option':
        return { background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
      default:
        return { background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' };
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="linked-catalog-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#fafbfc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <h2 id="linked-catalog-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                Linked Catalog Items
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{recipeName}</span>
                {recipeCodeOrSection && (
                  <>
                    <span>•</span>
                    <span>{recipeCodeOrSection}</span>
                  </>
                )}
                <span>•</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '1px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    ...getRoleBadgeStyle(recipeType === 'production' ? 'Ingredient' : 'BOM Component')
                  }}
                >
                  {recipeType === 'production' ? 'Production Recipe' : 'Product Recipe'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Production Recipe: Output Item Card */}
          {recipeType === 'production' && (
            <div
              style={{
                background: outputItem ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${outputItem ? '#bbf7d0' : '#fef08a'}`,
                borderRadius: 10,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: outputItem ? '#15803d' : '#a16207', marginBottom: 4 }}>
                  Produced Catalog Item (Output)
                </div>
                {outputItem ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>{outputItem.name}</span>
                    <span style={{ fontSize: 13, color: '#15803d' }}>
                      Yield: <strong>{outputItem.quantity} {outputItem.unit}</strong>
                    </span>
                    {outputItem.department && (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534' }}>
                        {outputItem.department}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#854d0e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={15} /> No output inventory item mapped to this production recipe.
                  </div>
                )}
              </div>

              {outputItem?.priceUsd != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#15803d' }}>Unit Cost</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>
                    ${Number(outputItem.priceUsd).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Items Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#374151' }}>
              {recipeType === 'production' ? 'Recipe Ingredients' : 'Linked Catalog Items & Components'} ({items.length})
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {items.length === 0 ? 'No items linked' : `${items.length} item${items.length !== 1 ? 's' : ''} in total`}
            </span>
          </div>

          {/* Empty State */}
          {items.length === 0 ? (
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 10,
                padding: '32px 20px',
                textAlign: 'center',
                backgroundColor: '#fafbfc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10
              }}
            >
              <Package size={36} color="var(--text-muted)" style={{ opacity: 0.5 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: 15 }}>
                  No catalog items linked to this recipe yet
                </p>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13, maxWidth: 440 }}>
                  {recipeType === 'production'
                    ? 'This production recipe does not have any ingredient catalog items assigned.'
                    : 'This product recipe has no Bill of Materials ingredients, product mappings, or matching catalog items.'}
                </p>
              </div>
              {editUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(editUrl);
                  }}
                  style={{
                    marginTop: 6,
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Edit size={14} /> Edit Recipe to Link Items
                </button>
              )}
            </div>
          ) : (
            /* Items Table */
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#4b5563' }}>Catalog Item</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#4b5563' }}>Role</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#4b5563' }}>Quantity</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#4b5563' }}>Department</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Price/Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                        background: idx % 2 === 0 ? '#fff' : '#fcfcfd'
                      }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{item.name}</div>
                        {item.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.notes}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            ...getRoleBadgeStyle(item.role)
                          }}
                        >
                          {item.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {item.quantity != null ? (
                          <span>
                            <strong>{item.quantity}</strong> {item.unit || ''}
                            {item.wastePercentage ? (
                              <span style={{ fontSize: 11, color: '#b45309', marginLeft: 4 }}>
                                (+{item.wastePercentage}% waste)
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        {item.department ? (
                          <span>
                            {item.department}
                            {item.subDepartment && ` > ${item.subDepartment}`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                        {item.priceUsd != null ? `$${Number(item.priceUsd).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#fafbfc'
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Total linked catalog items: <strong style={{ color: 'var(--text-main)' }}>{totalItemsCount}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/catalog');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              <ExternalLink size={14} /> Open Catalog
            </button>
            {editUrl && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(editUrl);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <Edit size={14} /> Edit Recipe
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
