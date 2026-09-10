import { useState, useEffect, useCallback } from 'react';
import { getActiveShift, openShift, closeShift } from '../services/shiftCashBridge';
import type { ShiftCashRecord, OpenShiftParams, CloseShiftParams } from '../services/shiftCashBridge';

export function usePosShift(branchName: string | undefined, cashierName: string | undefined) {
  const [activeShift, setActiveShift] = useState<ShiftCashRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);

  const checkShift = useCallback(async () => {
    if (!branchName) {
      setActiveShift(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const shift = await getActiveShift(branchName);
      setActiveShift(shift);
    } catch (err) {
      console.error('[usePosShift] Error checking active shift:', err);
      setActiveShift(null);
    } finally {
      setLoading(false);
    }
  }, [branchName]);

  useEffect(() => {
    checkShift();
  }, [checkShift, cashierName]);

  const handleOpenShift = async (params: { openingUsd: number; openingLbp: number; shift?: 'AM' | 'PM' | 'ALL DAY' }) => {
    if (!branchName) return { success: false, error: 'No branch selected' };

    const res = await openShift({
      branchName,
      userName: cashierName || 'Cashier',
      shift: params.shift,
      openingUsd: params.openingUsd,
      openingLbp: params.openingLbp
    });

    if (res.success && res.shift) {
      setActiveShift(res.shift);
      setIsOpenShiftModalOpen(false);
      return { success: true };
    }

    return { success: false, error: res.error || 'Failed to open shift' };
  };

  const handleCloseShift = async (params: { actualUsd: number; actualLbp: number; differenceUsd?: number }) => {
    if (!activeShift) return { success: false, error: 'No active shift to close' };

    const res = await closeShift({
      shiftId: activeShift.id,
      actualUsd: params.actualUsd,
      actualLbp: params.actualLbp,
      differenceUsd: params.differenceUsd
    });

    if (res.success) {
      setActiveShift(null);
      setIsCloseShiftModalOpen(false);
      return { success: true };
    }

    return { success: false, error: res.error || 'Failed to close shift' };
  };

  return {
    activeShift,
    isShiftOpen: !!activeShift,
    loading,
    checkShift,
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    isCloseShiftModalOpen,
    setIsCloseShiftModalOpen,
    handleOpenShift,
    handleCloseShift
  };
}
