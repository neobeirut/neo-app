import { useState, useEffect, useCallback } from 'react';
import { getActiveShift, openShift, closeShift } from '../services/shiftCashBridge';
import type { ShiftCashRecord, OpenShiftParams, CloseShiftParams } from '../services/shiftCashBridge';

export function usePosShift(
  branchIdentifier: string | undefined,
  cashierName: string | undefined,
  terminalId: string = 'TERM-1',
  branchId?: string
) {
  const [activeShift, setActiveShift] = useState<ShiftCashRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isShiftReportModalOpen, setIsShiftReportModalOpen] = useState(false);
  const [reportModalMode, setReportModalMode] = useState<'X' | 'CLOSE'>('X');

  const checkShift = useCallback(async () => {
    if (!branchIdentifier) {
      setActiveShift(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const shift = await getActiveShift(branchId || branchIdentifier, terminalId);
      setActiveShift(shift);
    } catch (err) {
      console.error('[usePosShift] Error checking active shift:', err);
      setActiveShift(null);
    } finally {
      setLoading(false);
    }
  }, [branchIdentifier, branchId, terminalId]);

  useEffect(() => {
    checkShift();
  }, [checkShift, cashierName]);

  const handleOpenShift = async (params: {
    openingUsd: number;
    openingLbp: number;
    shift?: 'AM' | 'PM' | 'ALL DAY';
  }) => {
    if (!branchIdentifier) return { success: false, error: 'No branch selected' };

    const res = await openShift({
      branchIdentifier,
      branchId,
      branchName: branchIdentifier,
      terminalId,
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

  const handleCloseShift = async (params: CloseShiftParams) => {
    if (!activeShift) return { success: false, error: 'No active shift to close' };

    const res = await closeShift({
      ...params,
      shiftId: activeShift.id
    });

    if (res.success) {
      setActiveShift(null);
      setIsCloseShiftModalOpen(false);
      return { success: true, shift: res.shift };
    }

    return { success: false, error: res.error || 'Failed to close shift' };
  };

  const openXReport = () => {
    setReportModalMode('X');
    setIsShiftReportModalOpen(true);
  };

  return {
    activeShift,
    isShiftOpen: !!activeShift,
    loading,
    terminalId,
    checkShift,
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    isCloseShiftModalOpen,
    setIsCloseShiftModalOpen,
    isShiftReportModalOpen,
    setIsShiftReportModalOpen,
    reportModalMode,
    setReportModalMode,
    openXReport,
    handleOpenShift,
    handleCloseShift
  };
}
