import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api/client';

export default function RecipeDeleteButton({ kind, recipeId, name, disabled = false, onDeleted, onBusyChange, linkedProductName }: {
  kind: 'menu' | 'production'; recipeId: string; name: string; disabled?: boolean;
  onDeleted: () => void; onBusyChange?: (busy: boolean) => void;
  linkedProductName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    if (busy || disabled) return;
    if (!window.confirm(`Delete "${name}" permanently?\n\nOnly unused recipes can be deleted. POS links, recipe references and usage history will block deletion. This cannot be undone.`)) return;
    setBusy(true); setError(''); onBusyChange?.(true);
    try {
      const result = kind === 'menu' ? await api.deleteMenuRecipe(recipeId) : await api.deleteProductionRecipe(recipeId);
      if (!result.success) throw new Error(result.error || 'Deletion was not confirmed.');
      onDeleted();
    } catch (cause) {
      const rawMsg = cause instanceof Error ? cause.message : 'Could not delete.';
      if (rawMsg.includes('linked to a POS product')) {
        setError(`Cannot delete: this recipe is linked to POS product "${linkedProductName || 'a POS product'}". Scroll down to "Linked Menu Product", change "Select Product" to "-- No Linked Product --", click Save Changes, then click Delete.`);
      } else {
        setError(rawMsg || 'Could not delete. Reload and check the record before trying again.');
      }
    }
    finally { setBusy(false); onBusyChange?.(false); }
  };
  return <div onClick={event => event.stopPropagation()} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: 360 }}>
    <button type="button" disabled={busy || disabled} onClick={remove} aria-label={`Delete ${name}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px', background: '#fff', color: '#b91c1c', cursor: busy || disabled ? 'not-allowed' : 'pointer' }}>
      <Trash2 size={16} /> {busy ? 'Checking and deleting…' : 'Delete'}
    </button>
    {error && <span role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>}
  </div>;
}
