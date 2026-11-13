import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getActiveShift,
  openShift,
  closeShift,
  isShiftOverdue,
  holdShiftForManagerAudit,
  getHeldShifts
} from '../services/shiftCashBridge';
import type { ShiftCashRecord, OpenShiftParams, CloseShiftParams } from '../services/shiftCashBridge';

export function usePosShift(
  branchIdentifier: string | undefined,
  cashierName: string | undefined,
  terminalId?: string,
  branchId?: string,
  restaurantId?: string,
  conceptId?: string
) {
  const [activeShift, setActiveShift] = useState<ShiftCashRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isShiftReportModalOpen, setIsShiftReportModalOpen] = useState(false);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [isManagerHeldShiftsModalOpen, setIsManagerHeldShiftsModalOpen] = useState(false);
  const [heldShifts, setHeldShifts] = useState<ShiftCashRecord[]>([]);
  const [reportModalMode, setReportModalMode] = useState<'X' | 'CLOSE'>('X');

  const isOverdue = useMemo(() => {
    return Boolean(activeShift && isShiftOverdue(activeShift));
  }, [activeShift]);

  const refreshHeldShifts = useCallback(async () => {
    try {
      const held = await getHeldShifts(branchId, restaurantId);
      setHeldShifts(held);
    } catch (err) {
      console.warn('[usePosShift] Error refreshing held shifts:', err);
    }
  }, [branchId, restaurantId]);

  const checkShift = useCallback(async (): Promise<ShiftCashRecord | null> => {
    if (!branchIdentifier && !terminalId) {
      setActiveShift(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const shift = await getActiveShift(branchId || branchIdentifier, terminalId, restaurantId, conceptId);
      setActiveShift(shift);
      if (shift && isShiftOverdue(shift)) {
        setIsOverdueModalOpen(true);
      }
      await refreshHeldShifts();
      return shift;
    } catch (err) {
      console.error('[usePosShift] Error checking active shift:', err);
      setActiveShift(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [branchIdentifier, branchId, terminalId, restaurantId, conceptId, refreshHeldShifts]);

  useEffect(() => {
    checkShift();
  }, [checkShift, cashierName, restaurantId, conceptId]);

  const handleOpenShift = async (params: {
    openingUsd: number;
    openingLbp: number;
    shift?: 'AM' | 'PM' | 'ALL DAY';
  }) => {
    const effectiveBranch = branchIdentifier || branchId || 'Badaro';
    if (!effectiveBranch) return { success: false, error: 'No branch selected' };

    const res = await openShift({
      branchIdentifier: effectiveBranch,
      branchId: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      branchName: String(effectiveBranch),
      terminalId: terminalId || 'FLOW-TERM-01',
      userName: cashierName || 'Cashier',
      restaurantId: restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d',
      conceptId,
      shift: params.shift || 'ALL DAY',
      openingUsd: params.openingUsd,
      openingLbp: params.openingLbp
    });

    if (res.success && res.shift) {
      setActiveShift(res.shift);
      setIsOpenShiftModalOpen(false);
      setIsOverdueModalOpen(false);
      return { success: true };
    }

    const previous = await checkShift();
    if (previous && previous.shift !== params.shift) { setIsOpenShiftModalOpen(false); setIsOverdueModalOpen(true); }
    return { success: false, error: res.error || 'Failed to open shift' };
  };

  const handleCloseShift = async (params: CloseShiftParams) => {
    if (!activeShift) return { success: false, error: 'No active shift to close' };

    const res = await closeShift({
      ...params,
      shiftId: activeShift.id
    });

    if (res.success) {
      setActiveShift(null);
      setIsCloseShiftModalOpen(false);
      setIsOverdueModalOpen(false);
      await refreshHeldShifts();
      return { success: true, shift: res.shift };
    }

    return { success: false, error: res.error || 'Failed to close shift' };
  };

  const handleHoldShift = async (notes?: string, cashSnapshotUsd?: number, cashSnapshotLbp?: number) => {
    if (!activeShift) return { success: false, error: 'No active shift to hold' };

    const res = await holdShiftForManagerAudit({
      shiftId: activeShift.id,
      heldBy: cashierName || 'Cashier',
      notes,
      cashSnapshotUsd,
      cashSnapshotLbp
    });

    if (res.success) {
      setActiveShift(null);
      setIsOverdueModalOpen(false);
      setIsCloseShiftModalOpen(false);
      await refreshHeldShifts();
      // Prompt morning cashier to open their new shift
      setIsOpenShiftModalOpen(true);
      return { success: true, shift: res.shift };
    }

    return { success: false, error: res.error || 'Failed to put shift on hold' };
  };

  const openXReport = () => {
    setReportModalMode('X');
    setIsShiftReportModalOpen(true);
  };

  return {
    activeShift,
    isShiftOpen: !!activeShift,
    isOverdueShift: isOverdue,
    loading,
    terminalId,
    checkShift,
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    isCloseShiftModalOpen,
    setIsCloseShiftModalOpen,
    isShiftReportModalOpen,
    setIsShiftReportModalOpen,
    isOverdueModalOpen,
    setIsOverdueModalOpen,
    isManagerHeldShiftsModalOpen,
    setIsManagerHeldShiftsModalOpen,
    heldShifts,
    heldShiftsCount: heldShifts.length,
    refreshHeldShifts,
    reportModalMode,
    setReportModalMode,
    openXReport,
    handleOpenShift,
    handleCloseShift,
    handleHoldShift
  };
}
