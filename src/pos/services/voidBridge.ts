import { supabase } from '../../api/supabase';

export interface CanceledItemDetail {
  name: string;
  qty: number;
  price?: number;
  product_id?: number | string;
  comment?: string;
}

export interface VoidTransactionParams {
  voidType: 'item_void' | 'order_cancellation' | 'refund';
  branchName: string;
  orderId: string | number;
  tableNumber?: string | null;
  items: CanceledItemDetail[];
  reason: string;
  cashierName: string;
  authorizedBy?: string;
  orderType?: string;
  restaurantId?: string;
  executeCommerceMutation: () => Promise<{ success: boolean; error?: string }>;
}

export interface VoidTransactionResult {
  success: boolean;
  operationId: string;
  error?: string;
  voidReceiptId?: string;
}

/**
 * Two-Phase Recoverable Void Transaction:
 * Phase 1: Writes a pending audit record into FLOW void_receipts with a unique operation_id.
 * Phase 2: Executes the downstream commerce mutation.
 * Phase 3: Updates the audit record status to 'completed' or 'failed'.
 */
export async function executeVoidTransaction(
  params: VoidTransactionParams
): Promise<VoidTransactionResult> {
  const operationId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : 'void-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

  const defaultRestaurantId = params.restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';
  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toTimeString().slice(0, 5);

  let voidReceiptId: string | undefined;

  // PHASE 1: Create pending FLOW void audit record
  try {
    const { data, error: initError } = await supabase
      .from('void_receipts')
      .insert([{
        operation_id: operationId,
        status: 'pending',
        void_type: params.voidType,
        branch: params.branchName,
        order_number: String(params.orderId),
        table_number: params.tableNumber || null,
        receipt_date: todayStr,
        receipt_time: timeStr,
        canceled_items: params.items || [],
        reason_comment: params.reason,
        created_by: params.authorizedBy || params.cashierName,
        order_type: params.orderType || 'POS',
        restaurant_id: defaultRestaurantId,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (initError) {
      console.error('[voidBridge] Phase 1 failed to create pending audit log:', initError);
      // Continue anyway or reject based on audit strictness
    } else if (data) {
      voidReceiptId = data.id;
    }
  } catch (auditErr) {
    console.error('[voidBridge] Phase 1 exception creating audit log:', auditErr);
  }

  // PHASE 2: Execute Downstream Commerce Mutation
  let mutationResult: { success: boolean; error?: string };
  try {
    mutationResult = await params.executeCommerceMutation();
  } catch (mutationErr: any) {
    mutationResult = {
      success: false,
      error: mutationErr?.message || 'Exception during commerce mutation'
    };
  }

  // PHASE 3: Update FLOW Audit Record Status
  try {
    if (mutationResult.success) {
      await supabase
        .from('void_receipts')
        .update({
          status: 'completed',
          error_message: null
        })
        .eq('operation_id', operationId);

      return {
        success: true,
        operationId,
        voidReceiptId
      };
    } else {
      await supabase
        .from('void_receipts')
        .update({
          status: 'failed',
          error_message: mutationResult.error || 'Mutation failed'
        })
        .eq('operation_id', operationId);

      return {
        success: false,
        operationId,
        voidReceiptId,
        error: mutationResult.error || 'Downstream commerce update failed'
      };
    }
  } catch (phase3Err) {
    console.error('[voidBridge] Phase 3 error updating audit status:', phase3Err);
    return {
      success: mutationResult.success,
      operationId,
      voidReceiptId,
      error: mutationResult.error
    };
  }
}
