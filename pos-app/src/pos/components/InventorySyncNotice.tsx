import { useEffect, useState } from 'react';
import { supabase } from '../../api/supabase';
import { retryOrderInventoryDeduction, skipOrderInventoryDeduction } from '../services/posOrderService';

export default function InventorySyncNotice({
  restaurantId,
  branchId,
  legacyBranchId,
  revision = 0
}: {
  restaurantId: string;
  branchId?: string | number;
  legacyBranchId?: string | number;
  revision?: number;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setOrders([]);
    setError('');
    if (!restaurantId || !branchId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const branches = Array.from(new Set([branchId, legacyBranchId].filter(Boolean).map(String)));
        const { data, error } = await supabase
          .from('pos_orders')
          .select('id, inventory_error, status')
          .eq('restaurant_id', restaurantId)
          .in('branch_id', branches)
          .eq('inventory_status', 'FAILED')
          .order('id', { ascending: false })
          .limit(20);

        if (!cancelled) {
          if (error) {
            setError('Could not check pending stock updates.');
          } else {
            setOrders((data || []).filter(order => !['cancelled', 'voided', 'refunded'].includes(String(order.status).toLowerCase())));
            setError('');
          }
        }
      } catch {
        if (!cancelled) setError('Could not check pending stock updates.');
      }
    };

    void load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, [restaurantId, branchId, legacyBranchId, revision, refresh]);

  if (dismissed || (!orders.length && !error)) return null;

  return (
    <div role="status" className="bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs font-semibold shadow-xs transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <div>
            <strong className="font-extrabold text-amber-900">Stock updates need attention</strong>
            <span className="text-amber-800"> — Orders are safely saved. Do not charge customers again.</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-700 hover:text-amber-950 p-1 rounded-lg hover:bg-amber-100 transition cursor-pointer text-sm font-bold"
          title="Dismiss notice"
        >
          ✕
        </button>
      </div>

      {error && <div role="alert" className="mt-1 text-red-700 font-bold">{error}</div>}

      <div className="mt-1.5 space-y-1">
        {orders.map(order => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-amber-100/60 border border-amber-200">
            <span className="truncate">
              <strong className="text-amber-950 font-black">Order #{order.id}:</strong>{' '}
              <span className="text-amber-900">{order.inventory_error || 'Stock deduction could not be completed.'}</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={!!retrying}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-3 py-1 font-extrabold text-[11px] shadow-xs disabled:opacity-50 transition cursor-pointer"
                onClick={async () => {
                  setRetrying(String(order.id));
                  setError('');
                  try {
                    const result = await retryOrderInventoryDeduction(order.id);
                    if (!result?.success) {
                      setError(result?.error || 'Stock retry failed.');
                    } else {
                      setRefresh(n => n + 1);
                    }
                  } catch {
                    setError('Could not retry stock. The order remains saved.');
                  } finally {
                    setRetrying(null);
                  }
                }}
              >
                {retrying === String(order.id) ? 'Retrying…' : 'Retry update'}
              </button>
              <button
                type="button"
                disabled={!!retrying}
                className="rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 px-2.5 py-1 font-bold text-[11px] disabled:opacity-50 transition cursor-pointer"
                title="Dismiss stock error for this order (e.g. if the item was deleted from catalog)"
                onClick={async () => {
                  if (!window.confirm(`Dismiss and skip stock deduction for Order #${order.id}?\n\nUse this if an item was deleted or stock cannot be deducted.`)) return;
                  setRetrying(String(order.id));
                  try {
                    const res = await skipOrderInventoryDeduction(order.id, order.inventory_error);
                    if (res.success) {
                      setRefresh(n => n + 1);
                    } else {
                      setError(res.error || 'Could not dismiss order stock error.');
                    }
                  } catch (e: any) {
                    setError(e.message || 'Could not dismiss.');
                  } finally {
                    setRetrying(null);
                  }
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
