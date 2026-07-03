import { useState, useEffect, useMemo, Fragment } from 'react';
import { api } from '../api/client';
import { 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Award, 
  AlertTriangle, 
  PieChart as PieIcon, 
  BarChart3, 
  RefreshCw,
  Info
} from 'lucide-react';

interface FinanceDashboardScreenProps {
  user: any;
  permissions: any;
}

export default function FinanceDashboardScreen({ user }: FinanceDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'compare' | 'available-cash'>('overview');
  const [loading, setLoading] = useState(true);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [reelCreditMap, setReelCreditMap] = useState<Record<string, number>>({});
  const [reelShiftDefs, setReelShiftDefs] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  
  // Branch Filter (restricted if not Admin)
  const [branchFilter, setBranchFilter] = useState(user?.role === 'Admin' ? 'All' : user?.branch || 'All');

  // Yesterday date generator for default values
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  // Overview Date Filters
  const [fromDate, setFromDate] = useState(getYesterdayStr());
  const [toDate, setToDate] = useState(getYesterdayStr());

  // Weekly Comparison Anchor Date
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);

  // Load branch list
  useEffect(() => {
    if (user?.role === 'Admin') {
      api.getBranchesList().then(res => {
        if (res.success && res.data) {
          // Map array of objects [{id, name}] to array of string names
          const branchNames = res.data.map((b: any) => b.name);
          setBranches(['All', ...branchNames]);
        }
      });
    } else {
      setBranches([user?.branch || 'All']);
    }
  }, [user]);

  // Load data when filters change
  useEffect(() => {
    fetchData();
  }, [branchFilter, fromDate, toDate, anchorDate, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'overview' || activeTab === 'available-cash') {
      const [shiftRes, payRes] = await Promise.all([
        api.getShiftCashLogs({ startDate: fromDate, endDate: toDate, branch: branchFilter }),
        api.getAllDailyPayments({ startDate: fromDate, endDate: toDate, branch: branchFilter })
      ]);

      if (shiftRes.success && shiftRes.data) {
        setShiftData(shiftRes.data);
        // Load shift defs first (or reuse cached), then compute reel credit
        const defsRes = await api.getBranchShifts(branchFilter !== 'All' ? branchFilter : undefined);
        const defs = defsRes.success && defsRes.data ? defsRes.data : reelShiftDefs;
        if (defsRes.success && defsRes.data) setReelShiftDefs(defsRes.data);
        api.getReelCreditByShifts(shiftRes.data, fromDate, toDate, branchFilter, defs).then(rc => {
          if (rc.success && rc.data) setReelCreditMap(rc.data);
        });
      }
      if (payRes.success && payRes.data) {
        setPaymentData(payRes.data);
      }
    } else {
      // Comparison tab needs 14 days ending on anchorDate
      const toDateObj = new Date(anchorDate);
      const startDateObj = new Date(toDateObj.getTime() - 13 * 24 * 60 * 60 * 1000);
      const startDateStr = startDateObj.toISOString().split('T')[0];

      const shiftRes = await api.getShiftCashLogs({ 
        startDate: startDateStr, 
        endDate: anchorDate, 
        branch: branchFilter 
      });

      if (shiftRes.success && shiftRes.data) {
        setShiftData(shiftRes.data);
      }
    }
    setLoading(false);
  };

  const num = (val: any) => Number(val) || 0;

  // -------------------------------------------------------------
  // OVERVIEW MEMOS & METRICS
  // -------------------------------------------------------------
  const overviewMetrics = useMemo(() => {
    let totalSalesUsd = 0;
    let totalCashUsd = 0;
    let totalCardUsd = 0;
    let totalOnAccountUsd = 0;
    let totalShortagesUsd = 0;
    let totalCashOutUsd = 0;
    let totalSupplierUsd = 0;

    // Shift Performance Breakdown
    let amSalesUsd = 0;
    let pmSalesUsd = 0;
    let amShortagesUsd = 0;
    let pmShortagesUsd = 0;

    // Branch Ranking Map
    const branchMap: Record<string, { sales: number; card: number; cash: number; shortages: number }> = {};

    // Daily Sales Trend Map
    const dailyMap: Record<string, number> = {};

    // Weekday averages
    const dayOfWeekTotal: Record<string, number> = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
    const dayOfWeekDates: Record<string, Set<string>> = { 'Mon': new Set(), 'Tue': new Set(), 'Wed': new Set(), 'Thu': new Set(), 'Fri': new Set(), 'Sat': new Set(), 'Sun': new Set() };
    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Group shifts by date and branch to handle PM cumulative values
    const dayBranchMap: Record<string, { AM?: any; PM?: any }> = {};

    shiftData.forEach(row => {
      const key = `${row.date.split('T')[0]}_${row.branch}`;
      if (!dayBranchMap[key]) dayBranchMap[key] = {};
      dayBranchMap[key][row.shift as 'AM' | 'PM'] = row;
    });

    Object.values(dayBranchMap).forEach(group => {
      const am = group.AM;
      const pm = group.PM;

      const amRate = am ? (num(am.rate) || 90000) : 90000;
      const pmRate = pm ? (num(pm.rate) || 90000) : 90000;

      // Raw AM values
      const amRawSalesUsd = am ? num(am.sales_lbp) / amRate : 0;
      const amRawOnAccUsd = am ? num(am.on_credit_lbp) / amRate : 0;
      const amDiffUsd = am ? num(am.difference_usd) : 0;

      // Card, Cash, CashOut are per-shift additive
      const amCardUsd = am ? num(am.credit_card_usd) + (num(am.credit_card_lbp) / amRate) : 0;
      const amCashUsd = am ? num(am.actual_usd) + (num(am.actual_lbp) / amRate) : 0;
      const amCashOutUsd = am ? num(am.cash_out_usd) + (num(am.cash_out_lbp) / amRate) : 0;

      const pmCardUsd = pm ? num(pm.credit_card_usd) + (num(pm.credit_card_lbp) / pmRate) : 0;
      const pmCashUsd = pm ? num(pm.actual_usd) + (num(pm.actual_lbp) / pmRate) : 0;
      const pmCashOutUsd = pm ? num(pm.cash_out_usd) + (num(pm.cash_out_lbp) / pmRate) : 0;

      totalCardUsd += amCardUsd + pmCardUsd;
      totalCashUsd += amCashUsd + pmCashUsd;
      totalCashOutUsd += amCashOutUsd + pmCashOutUsd;

      let daySalesUsd = 0;
      let dayOnAccUsd = 0;
      let dayShortageUsd = 0;

      if (pm) {
        // PM contains cumulative values for Sales, On Account, and Shortages
        daySalesUsd = num(pm.sales_lbp) / pmRate;
        dayOnAccUsd = num(pm.on_credit_lbp) / pmRate;
        dayShortageUsd = num(pm.difference_usd) < 0 ? num(pm.difference_usd) : 0;

        amSalesUsd += amRawSalesUsd;
        pmSalesUsd += Math.max(0, daySalesUsd - amRawSalesUsd);

        if (amDiffUsd < 0) amShortagesUsd += amDiffUsd;
        const pmDiffRaw = num(pm.difference_usd);
        if (pmDiffRaw < 0) pmShortagesUsd += pmDiffRaw;
      } else if (am) {
        daySalesUsd = amRawSalesUsd;
        dayOnAccUsd = amRawOnAccUsd;
        dayShortageUsd = amDiffUsd < 0 ? amDiffUsd : 0;

        amSalesUsd += amRawSalesUsd;
        if (amDiffUsd < 0) amShortagesUsd += amDiffUsd;
      }

      totalSalesUsd += daySalesUsd;
      totalOnAccountUsd += dayOnAccUsd;
      totalShortagesUsd += dayShortageUsd;

      // Daily trend mapping
      const refRow = pm || am;
      const dateStr = refRow.date.split('T')[0];
      const branch = refRow.branch;

      if (!dailyMap[dateStr]) dailyMap[dateStr] = 0;
      dailyMap[dateStr] += daySalesUsd;

      // Weekday tracking
      const dayIdx = new Date(dateStr).getUTCDay();
      const dayName = daysArr[dayIdx];
      dayOfWeekTotal[dayName] += daySalesUsd;
      dayOfWeekDates[dayName].add(dateStr);

      // Branch details mapping
      if (!branchMap[branch]) {
        branchMap[branch] = { sales: 0, card: 0, cash: 0, shortages: 0 };
      }
      branchMap[branch].sales += daySalesUsd;
      branchMap[branch].shortages += dayShortageUsd;
      branchMap[branch].card += amCardUsd + pmCardUsd;
      branchMap[branch].cash += amCashUsd + pmCashUsd;
    });

    let totalUnpaidUsd = 0;
    // Process daily payments for supplier expenses
    paymentData.forEach(row => {
      if (row.type === 'Supplier' || row.type === 'Delivery') {
        const rate = 90000; // standard constant conversion or payment rate
        if (row.status !== 'Unpaid') {
          totalSupplierUsd += num(row.amount_usd) + (num(row.amount_lbp) / rate);
        } else {
          totalUnpaidUsd += num(row.amount_usd) + (num(row.amount_lbp) / rate);
        }
      }
    });

    // 7-day trend arrays
    const sortedDates = Object.keys(dailyMap).sort();
    const chartDates = sortedDates.slice(-7);
    const chartSales = chartDates.map(d => dailyMap[d]);

    // Averages by weekday
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayAverages = dayLabels.map(day => {
      const count = dayOfWeekDates[day].size;
      return count > 0 ? dayOfWeekTotal[day] / count : 0;
    });

    const branchList = Object.keys(branchMap).map(k => ({
      branch: k,
      ...branchMap[k]
    })).sort((a, b) => b.sales - a.sales);

    return {
      totalSalesUsd,
      totalCashUsd,
      totalCardUsd,
      totalOnAccountUsd,
      totalShortagesUsd,
      totalCashOutUsd,
      totalSupplierUsd,
      totalUnpaidUsd,
      amSalesUsd,
      pmSalesUsd,
      amShortagesUsd,
      pmShortagesUsd,
      chartDates: chartDates.map(d => d.slice(5)), // MM-DD
      chartSales: chartSales.length ? chartSales : [0],
      dayLabels,
      dayAverages,
      branchList
    };
  }, [shiftData, paymentData]);

  // Top 5 worst shortages
  const topShortages = useMemo(() => {
    return shiftData
      .filter(s => num(s.difference_usd) < 0)
      .sort((a, b) => num(a.difference_usd) - num(b.difference_usd))
      .slice(0, 5);
  }, [shiftData]);

  // -------------------------------------------------------------
  // WEEKLY COMPARISON MEMOS & METRICS
  // -------------------------------------------------------------
  const compareMetrics = useMemo(() => {
    if (activeTab !== 'compare') return null;

    const exactToStr = anchorDate;
    const toDateObj = new Date(exactToStr);

    const prev13 = new Date(toDateObj.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const prev6 = new Date(toDateObj.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const prev7 = new Date(toDateObj.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Period mapping (Mon to Sun)
    const thisWeekMap: Record<string, number> = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
    const lastWeekMap: Record<string, number> = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const dayBranchMap: Record<string, { AM?: any; PM?: any }> = {};
    shiftData.forEach(row => {
      const d = row.date.split('T')[0];
      if (d >= prev13 && d <= exactToStr) {
        const key = `${d}_${row.branch}`;
        if (!dayBranchMap[key]) dayBranchMap[key] = {};
        dayBranchMap[key][row.shift as 'AM' | 'PM'] = row;
      }
    });

    Object.values(dayBranchMap).forEach(group => {
      const am = group.AM;
      const pm = group.PM;
      const pmRate = pm ? (num(pm.rate) || 90000) : 90000;
      const amRate = am ? (num(am.rate) || 90000) : 90000;

      let daySalesUsd = 0;
      if (pm) {
        daySalesUsd = num(pm.sales_lbp) / pmRate;
      } else if (am) {
        daySalesUsd = num(am.sales_lbp) / amRate;
      }

      const dateStr = (pm || am).date.split('T')[0];
      const dayName = daysArr[new Date(dateStr).getUTCDay()];

      if (dateStr >= prev6 && dateStr <= exactToStr) {
        thisWeekMap[dayName] += daySalesUsd;
      } else if (dateStr >= prev13 && dateStr <= prev7) {
        lastWeekMap[dayName] += daySalesUsd;
      }
    });

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const thisWeekData = labels.map(l => Number(thisWeekMap[l].toFixed(2)));
    const lastWeekData = labels.map(l => Number(lastWeekMap[l].toFixed(2)));

    const thisWeekTotal = thisWeekData.reduce((a, b) => a + b, 0);
    const lastWeekTotal = lastWeekData.reduce((a, b) => a + b, 0);
    const diffUsd = thisWeekTotal - lastWeekTotal;
    const diffPct = lastWeekTotal > 0 ? (diffUsd / lastWeekTotal) * 100 : 0;

    return {
      labels,
      thisWeekData,
      lastWeekData,
      thisWeekTotal,
      lastWeekTotal,
      diffUsd,
      diffPct,
      dateRanges: {
        thisWeek: `${prev6} to ${exactToStr}`,
        lastWeek: `${prev13} to ${prev7}`
      }
    };
  }, [shiftData, anchorDate, activeTab]);

  // Payment Mix Computations
  const calculatedCashUsd = Math.max(0, overviewMetrics.totalSalesUsd - overviewMetrics.totalCardUsd - overviewMetrics.totalOnAccountUsd);
  const totalMix = overviewMetrics.totalCardUsd + calculatedCashUsd + overviewMetrics.totalOnAccountUsd;
  const cardPct = totalMix > 0 ? ((overviewMetrics.totalCardUsd / totalMix) * 100).toFixed(1) : '0.0';
  const cashPct = totalMix > 0 ? ((calculatedCashUsd / totalMix) * 100).toFixed(1) : '0.0';
  const accPct = totalMix > 0 ? ((overviewMetrics.totalOnAccountUsd / totalMix) * 100).toFixed(1) : '0.0';

  const pieData = [
    { name: 'Card', pct: cardPct, amount: Number(overviewMetrics.totalCardUsd.toFixed(2)), color: '#3b82f6' }, // Blue-500
    { name: 'Cash', pct: cashPct, amount: Number(calculatedCashUsd.toFixed(2)), color: '#10b981' }, // Emerald-500
    { name: 'On Account', pct: accPct, amount: Number(overviewMetrics.totalOnAccountUsd.toFixed(2)), color: '#f59e0b' } // Amber-500
  ];

  // Hover states for line chart tooltips
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredCompareIdx, setHoveredCompareIdx] = useState<number | null>(null);

  // Track expanded daily available cash logs
  const [expandedDailyRows, setExpandedDailyRows] = useState<Record<string, boolean>>({});

  // -------------------------------------------------------------
  // DAILY AVAILABLE CASH MEMOS & METRICS
  // -------------------------------------------------------------
  const dailyAvailableCash = useMemo(() => {
    if (activeTab !== 'available-cash') return [];

    const grouped: Record<string, { AM?: any; PM?: any }> = {};
    
    shiftData.forEach(row => {
      const dateStr = row.date.split('T')[0];
      const key = `${dateStr}_${row.branch}`;
      if (!grouped[key]) {
        grouped[key] = {};
      }
      grouped[key][row.shift as 'AM' | 'PM'] = row;
    });

    return Object.keys(grouped).map(key => {
      const { AM, PM } = grouped[key];
      // Extract date & branch from the actual row data to avoid splitting issues
      // when branch names contain underscores
      const refRow = AM || PM;
      const date = refRow.date.split('T')[0];
      const branch = refRow.branch;
      
      const rate = PM?.rate || AM?.rate || 90000;
      
      const getConverted = (usd: number, lbp: number) => usd + (lbp / rate);

      // Opening cash: AM opening if exists, otherwise PM opening
      const openingUsd = AM ? num(AM.opening_usd) : num(PM?.opening_usd);
      const openingLbp = AM ? num(AM.opening_lbp) : num(PM?.opening_lbp);
      const totalOpening = getConverted(openingUsd, openingLbp);

      // Closing cash: PM actual if exists, otherwise AM actual
      const closingUsd = PM ? num(PM.actual_usd) : num(AM?.actual_usd);
      const closingLbp = PM ? num(PM.actual_lbp) : num(AM?.actual_lbp);
      const totalClosing = getConverted(closingUsd, closingLbp);

      // Cash In
      const cashInUsd = num(AM?.cash_in_usd) + num(PM?.cash_in_usd);
      const cashInLbp = num(AM?.cash_in_lbp) + num(PM?.cash_in_lbp);
      const totalCashIn = getConverted(cashInUsd, cashInLbp);

      // Payments from daily_payments split by type
      const dayPayments = paymentData.filter(
        p => p.branch === branch && p.date?.split('T')[0] === date
      );

      // Suppliers sum — paid-only (unpaid suppliers appear in the Unpaid Invoices info row)
      const suppliersUsd = dayPayments.filter(p => p.type === 'Supplier' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const suppliersLbp = dayPayments.filter(p => p.type === 'Supplier' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const totalSuppliers = getConverted(suppliersUsd, suppliersLbp);

      // Delivery sum — paid-only (delivery is always paid; if entered as unpaid it goes to Unpaid Invoices)
      const deliveryUsd = dayPayments.filter(p => p.type === 'Delivery' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const deliveryLbp = dayPayments.filter(p => p.type === 'Delivery' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const totalDelivery = getConverted(deliveryUsd, deliveryLbp);

      // Unpaid Invoices sum (for info only)
      const unpaidUsd = dayPayments.filter(p => (p.type === 'Supplier' || p.type === 'Delivery') && p.status === 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const unpaidLbp = dayPayments.filter(p => (p.type === 'Supplier' || p.type === 'Delivery') && p.status === 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const totalUnpaid = getConverted(unpaidUsd, unpaidLbp);

      // Credit Card
      const creditCardUsd = num(AM?.credit_card_usd) + num(PM?.credit_card_usd);
      const creditCardLbp = num(AM?.credit_card_lbp) + num(PM?.credit_card_lbp);
      const totalCreditCard = getConverted(creditCardUsd, creditCardLbp);

      // On Credit (only LBP stored in DB)
      const onCreditLbp = num(AM?.on_credit_lbp) + num(PM?.on_credit_lbp);
      const totalOnCredit = getConverted(0, onCreditLbp);

      // Safe Drops / Cash Out
      const cashOutUsd = num(AM?.cash_out_usd) + num(PM?.cash_out_usd);
      const cashOutLbp = num(AM?.cash_out_lbp) + num(PM?.cash_out_lbp);
      const totalCashOut = getConverted(cashOutUsd, cashOutLbp);

      // Shift level payments for details drawer — paid-only per shift
      const amPayments = dayPayments.filter(p => p.shift === 'AM');
      const amSuppliersUsd = amPayments.filter(p => p.type === 'Supplier' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const amSuppliersLbp = amPayments.filter(p => p.type === 'Supplier' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const amDeliveryUsd = amPayments.filter(p => p.type === 'Delivery' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const amDeliveryLbp = amPayments.filter(p => p.type === 'Delivery' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const amUnpaidUsd = amPayments.filter(p => (p.type === 'Supplier' || p.type === 'Delivery') && p.status === 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const amUnpaidLbp = amPayments.filter(p => (p.type === 'Supplier' || p.type === 'Delivery') && p.status === 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);

      const pmPayments = dayPayments.filter(p => p.shift === 'PM');
      const pmSuppliersUsd = pmPayments.filter(p => p.type === 'Supplier' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const pmSuppliersLbp = pmPayments.filter(p => p.type === 'Supplier' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const pmDeliveryUsd = pmPayments.filter(p => p.type === 'Delivery' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const pmDeliveryLbp = pmPayments.filter(p => p.type === 'Delivery' && p.status !== 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);
      const pmUnpaidUsd = pmPayments.filter(p => (p.type === 'Supplier' || p.type === 'Delivery') && p.status === 'Unpaid').reduce((sum, p) => sum + num(p.amount_usd), 0);
      const pmUnpaidLbp = pmPayments.filter(p => (p.type === 'Supplier' || p.type === 'Delivery') && p.status === 'Unpaid').reduce((sum, p) => sum + num(p.amount_lbp), 0);

      // Variance
      const variance = num(AM?.difference_usd) + num(PM?.difference_usd);

      // Reel Credit from imported transactions, partitioned by shift time window
      const reelCreditAM = reelCreditMap[`${date}||${branch}||AM`] || 0;
      const reelCreditPM = reelCreditMap[`${date}||${branch}||PM`] || 0;
      const totalReelCredit = reelCreditAM + reelCreditPM;

      return {
        key,
        date,
        branch,
        rate,
        openingUsd,
        openingLbp,
        totalOpening,
        closingUsd,
        closingLbp,
        totalClosing,
        cashInUsd,
        cashInLbp,
        totalCashIn,
        suppliersUsd,
        suppliersLbp,
        totalSuppliers,
        deliveryUsd,
        deliveryLbp,
        totalDelivery,
        creditCardUsd,
        creditCardLbp,
        totalCreditCard,
        onCreditLbp,
        totalOnCredit,
        cashOutUsd,
        cashOutLbp,
        totalCashOut,
        variance,
        reelCreditAM,
        reelCreditPM,
        totalReelCredit,
        amSuppliersUsd,
        amSuppliersLbp,
        amDeliveryUsd,
        amDeliveryLbp,
        amUnpaidUsd,
        amUnpaidLbp,
        pmSuppliersUsd,
        pmSuppliersLbp,
        pmDeliveryUsd,
        pmDeliveryLbp,
        pmUnpaidUsd,
        pmUnpaidLbp,
        unpaidUsd,
        unpaidLbp,
        totalUnpaid,
        AM,
        PM
      };
    }).sort((a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch));
  }, [shiftData, paymentData, reelCreditMap, activeTab]);

  const dailyCashTotals = useMemo(() => {
    let totalOpeningUsd = 0;
    let totalClosingUsd = 0;
    let totalSuppliersUsd = 0;
    let totalDeliveryUsd = 0;
    let totalCashOutUsd = 0;
    let totalCreditCardUsd = 0;
    let totalOnCreditUsd = 0;
    let totalVariance = 0;
    let totalCashInUsd = 0;
    let totalUnpaidUsd = 0;
    let totalReelCreditUsd = 0;

    dailyAvailableCash.forEach(item => {
      totalOpeningUsd += item.totalOpening;
      totalClosingUsd += item.totalClosing;
      totalSuppliersUsd += item.totalSuppliers;
      totalDeliveryUsd += item.totalDelivery;
      totalCashOutUsd += item.totalCashOut;
      totalCreditCardUsd += item.totalCreditCard;
      totalOnCreditUsd += item.totalOnCredit;
      totalVariance += item.variance;
      totalCashInUsd += item.totalCashIn;
      totalUnpaidUsd += item.totalUnpaid;
      totalReelCreditUsd += item.totalReelCredit;
    });

    return {
      totalOpeningUsd,
      totalClosingUsd,
      totalSuppliersUsd,
      totalDeliveryUsd,
      totalCashOutUsd,
      totalCreditCardUsd,
      totalOnCreditUsd,
      totalVariance,
      totalCashInUsd,
      totalUnpaidUsd,
      totalReelCreditUsd
    };
  }, [dailyAvailableCash]);

  return (
    <div className="finance-dashboard-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={28} style={{ color: 'var(--primary)' }} /> Financial Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Track sales, branch performance, and payment distributions.
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'overview' ? 'white' : 'transparent',
              color: activeTab === 'overview' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'overview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Overview Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('compare')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'compare' ? 'white' : 'transparent',
              color: activeTab === 'compare' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'compare' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Weekly Comparison
          </button>
          <button 
            onClick={() => setActiveTab('available-cash')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'available-cash' ? 'white' : 'transparent',
              color: activeTab === 'available-cash' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'available-cash' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Daily Available Cash
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: 'white',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        flexWrap: 'wrap'
      }}>
        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
          <MapPin size={18} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Branch:</span>
          <select 
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={user?.role !== 'Admin'}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              background: '#f9fafb',
              fontWeight: 500,
              cursor: user?.role === 'Admin' ? 'pointer' : 'not-allowed'
            }}
          >
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Date Filters depending on Tab */}
        {activeTab === 'overview' || activeTab === 'available-cash' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Calendar size={18} style={{ color: 'var(--text-muted)', marginLeft: '10px' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Period:</span>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => {
                const newFromDate = e.target.value;
                setFromDate(newFromDate);
                if (toDate && newFromDate > toDate) {
                  setToDate(newFromDate);
                }
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: '#f9fafb'
              }}
            />
            <span style={{ color: '#9ca3af' }}>to</span>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => {
                const newToDate = e.target.value;
                if (fromDate && newToDate < fromDate) {
                  setToDate(fromDate);
                } else {
                  setToDate(newToDate);
                }
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: '#f9fafb'
              }}
            />
            <button 
              onClick={fetchData}
              title="Refresh Data"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '6px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              <RefreshCw size={16} style={{ color: '#4b5563' }} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--text-muted)', marginLeft: '10px' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Anchor End Date:</span>
            <input 
              type="date" 
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                background: '#f9fafb'
              }}
            />
            <button 
              onClick={fetchData}
              title="Refresh Data"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '6px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              <RefreshCw size={16} style={{ color: '#4b5563' }} />
            </button>
          </div>
        )}
      </div>

      {/* LOADING SPINNER */}
      {loading ? (
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f4f6',
              borderTop: '4px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto'
            }} />
            <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Fetching financial logs...</p>
          </div>
        </div>
      ) : activeTab === 'overview' ? (
        /* ==================================================================== */
        /* OVERVIEW DASHBOARD VIEW                                              */
        /* ==================================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* KPI CARDS SUMMARY */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px'
          }}>
            {/* Card 1: Total Sales */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #bfdbfe',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Gross Sales</span>
                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a', margin: '8px 0 0 0' }}>
                  ${overviewMetrics.totalSalesUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#3b82f6', marginTop: '12px', fontWeight: 600 }}>Includes card, cash, and account sales</span>
            </div>

            {/* Card 2: Net Cash */}
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #a7f3d0',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Cash Collected</span>
                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#064e3b', margin: '8px 0 0 0' }}>
                  ${calculatedCashUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#10b981', marginTop: '12px', fontWeight: 600 }}>Total sales minus cards and accounts</span>
            </div>

            {/* Card 3: Shortages */}
            <div style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              border: '1px solid #fca5a5',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Register Shortages</span>
                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#7f1d1d', margin: '8px 0 0 0' }}>
                  ${Math.abs(overviewMetrics.totalShortagesUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '12px', fontWeight: 600 }}>Cumulative shift reconciliation variance</span>
            </div>

            {/* Card 4: Supplier Payments */}
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #fde68a',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supplier Payments</span>
                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#78350f', margin: '8px 0 0 0' }}>
                  ${overviewMetrics.totalSupplierUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#f59e0b', marginTop: '12px', fontWeight: 600 }}>Supplier and delivery cash paid out</span>
            </div>

            {/* Card 5: Unpaid Invoices */}
            <div style={{
              background: 'linear-gradient(135deg, #fffaf0 0%, #ffedd5 100%)',
              border: '1px solid #fed7aa',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unpaid Invoices (Info)</span>
                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#9a3412', margin: '8px 0 0 0' }}>
                  ${overviewMetrics.totalUnpaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#ea580c', marginTop: '12px', fontWeight: 600 }}>Unpaid supplier invoices (informational only)</span>
            </div>
          </div>

          {/* TWO COLUMN GRAPHS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px'
          }}>
            {/* Chart 1: Payment Method Mix Donut */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieIcon size={18} style={{ color: 'var(--primary)' }} /> Payment Method Breakdown
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', flex: 1 }}>
                {/* SVG Ring Donut */}
                <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    {/* Background Circle */}
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
                    
                    {/* Render Segments */}
                    {(() => {
                      const r = 38;
                      const circ = 2 * Math.PI * r; // ~238.76
                      let accumOffset = 0;
                      
                      return pieData.map((item, idx) => {
                        const pctVal = Number(item.pct);
                        const strokeLength = (pctVal / 100) * circ;
                        const strokeOffset = circ - accumOffset;
                        accumOffset += strokeLength;
                        
                        return (
                          <circle 
                            key={idx}
                            cx="50" 
                            cy="50" 
                            r={r} 
                            fill="transparent" 
                            stroke={item.color} 
                            strokeWidth="12"
                            strokeDasharray={`${strokeLength} ${circ}`}
                            strokeDashoffset={strokeOffset}
                            transform="rotate(-90 50 50)"
                            style={{ transition: 'stroke-dashoffset 0.6s ease-in-out' }}
                          />
                        );
                      });
                    })()}
                  </svg>
                  
                  {/* Center Text inside Donut */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Total Mix</span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>
                      ${totalMix >= 1000 ? (totalMix/1000).toFixed(1) + 'k' : totalMix.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Legend Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '150px' }}>
                  {pieData.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color, marginTop: '4px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{item.name}</span>
                        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({item.pct}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 2: Daily Sales Trend Line */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              position: 'relative'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} style={{ color: 'var(--primary)' }} /> Daily Sales Trend
              </h3>

              <div style={{ flex: 1, minHeight: '180px', position: 'relative' }}>
                {overviewMetrics.chartSales.length && overviewMetrics.chartSales.reduce((a,b)=>a+b, 0) > 0 ? (
                  (() => {
                    const maxVal = Math.max(...overviewMetrics.chartSales, 100);
                    const width = 450;
                    const height = 150;
                    const paddingLeft = 45;
                    const paddingRight = 15;
                    const paddingTop = 15;
                    const paddingBottom = 20;
                    
                    const innerW = width - paddingLeft - paddingRight;
                    const innerH = height - paddingTop - paddingBottom;
                    
                    const points = overviewMetrics.chartSales.map((val, idx) => {
                      const x = paddingLeft + idx * (innerW / (overviewMetrics.chartSales.length - 1 || 1));
                      const y = height - paddingBottom - (val / maxVal) * innerH;
                      return { x, y, val, label: overviewMetrics.chartDates[idx] };
                    });

                    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

                    return (
                      <div style={{ position: 'relative', width: '100%' }}>
                        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                          <defs>
                            <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                            const y = height - paddingBottom - ratio * innerH;
                            return (
                              <g key={i}>
                                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af" fontWeight="500">
                                  ${Math.round(ratio * maxVal)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Gradient */}
                          <path d={areaD} fill="url(#trend-grad)" />

                          {/* Line */}
                          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Interactive Hover Vertical Areas & Points */}
                          {points.map((p, idx) => (
                            <g key={idx}>
                              {/* Hover Highlight Ring */}
                              {hoveredTrendIdx === idx && (
                                <>
                                  <line x1={p.x} y1={paddingTop} x2={p.x} y2={height - paddingBottom} stroke="#bfdbfe" strokeWidth="1.5" />
                                  <circle cx={p.x} cy={p.y} r="7" fill="#bfdbfe" opacity="0.6" />
                                </>
                              )}
                              {/* Anchor Dot */}
                              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#3b82f6" strokeWidth="2.5" />

                              {/* Invisible Trigger Rect for Hover */}
                              <rect 
                                x={p.x - innerW / 12}
                                y={paddingTop}
                                width={innerW / 6}
                                height={innerH}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredTrendIdx(idx)}
                                onMouseLeave={() => setHoveredTrendIdx(null)}
                              />
                            </g>
                          ))}

                          {/* X-Axis Labels */}
                          {points.map((p, idx) => (
                            <text key={idx} x={p.x} y={height - 4} textAnchor="middle" fontSize="9" fill="#6b7280" fontWeight="600">
                              {p.label}
                            </text>
                          ))}
                        </svg>

                        {/* Trend Chart Floating Tooltip */}
                        {hoveredTrendIdx !== null && points[hoveredTrendIdx] && (
                          <div style={{
                            position: 'absolute',
                            left: `${(points[hoveredTrendIdx].x / width) * 100}%`,
                            top: `${(points[hoveredTrendIdx].y / height) * 100 - 30}%`,
                            transform: 'translate(-50%, -100%)',
                            background: '#1f2937',
                            color: 'white',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            pointerEvents: 'none',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                            zIndex: 10,
                            whiteSpace: 'nowrap'
                          }}>
                            {points[hoveredTrendIdx].label}: ${points[hoveredTrendIdx].val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    )
                  })()
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                    No daily trend data available for this range.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TWO COLUMN PERFORMANCE BAR CHARTS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px'
          }}>
            {/* Chart 3: AM vs PM Shift Comparison */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} style={{ color: 'var(--primary)' }} /> Shift Performance Breakdown
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 20px 0' }}>Morning vs Afternoon Sales comparison.</p>

              <div style={{ flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {overviewMetrics.amSalesUsd > 0 || overviewMetrics.pmSalesUsd > 0 ? (
                  (() => {
                    const maxVal = Math.max(overviewMetrics.amSalesUsd, overviewMetrics.pmSalesUsd, 100);
                    const amHeight = (overviewMetrics.amSalesUsd / maxVal) * 120;
                    const pmHeight = (overviewMetrics.pmSalesUsd / maxVal) * 120;
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '140px', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb' }}>
                          {/* AM Shift Bar */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>
                              ${overviewMetrics.amSalesUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            <div style={{
                              width: '45px',
                              height: `${amHeight}px`,
                              background: 'linear-gradient(to top, #3b82f6, #60a5fa)',
                              borderRadius: '6px 6px 0 0',
                              transition: 'height 0.5s ease-in-out'
                            }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '8px' }}>Morning (AM)</span>
                          </div>

                          {/* PM Shift Bar */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>
                              ${overviewMetrics.pmSalesUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            <div style={{
                              width: '45px',
                              height: `${pmHeight}px`,
                              background: 'linear-gradient(to top, #1e3a8a, #3b82f6)',
                              borderRadius: '6px 6px 0 0',
                              transition: 'height 0.5s ease-in-out'
                            }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginTop: '8px' }}>Afternoon (PM)</span>
                          </div>
                        </div>

                        {/* Shift Shortage Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                          <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 700 }}>
                            AM Shortages: ${Math.abs(overviewMetrics.amShortagesUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ color: '#dc2626', fontSize: '13px', fontWeight: 700 }}>
                            PM Shortages: ${Math.abs(overviewMetrics.pmShortagesUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                    No shift data available for this range.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 4: Day of Week Averages Bar Chart */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} style={{ color: 'var(--primary)' }} /> Weekday Averages
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 20px 0' }}>Average sales volume by day of the week.</p>

              <div style={{ flex: 1, minHeight: '180px', position: 'relative' }}>
                {overviewMetrics.dayAverages.reduce((a,b)=>a+b, 0) > 0 ? (
                  (() => {
                    const maxVal = Math.max(...overviewMetrics.dayAverages, 100);
                    const width = 450;
                    const height = 150;
                    const paddingLeft = 10;
                    const paddingRight = 10;
                    const paddingTop = 15;
                    const paddingBottom = 20;

                    const innerW = width - paddingLeft - paddingRight;
                    const innerH = height - paddingTop - paddingBottom;
                    const barSpacing = innerW / 7;
                    const barWidth = Math.max(14, barSpacing * 0.5);

                    return (
                      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                        {/* Horizontal Gridline at Max */}
                        <line x1={0} y1={paddingTop} x2={width} y2={paddingTop} stroke="#f3f4f6" strokeWidth="1" />
                        <line x1={0} y1={height - paddingBottom} x2={width} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="1.5" />

                        {overviewMetrics.dayLabels.map((day, idx) => {
                          const val = overviewMetrics.dayAverages[idx];
                          const barH = (val / maxVal) * innerH;
                          const x = paddingLeft + idx * barSpacing + (barSpacing - barWidth) / 2;
                          const y = height - paddingBottom - barH;

                          return (
                            <g key={day}>
                              {/* Hover background highlighting */}
                              <rect 
                                x={paddingLeft + idx * barSpacing}
                                y={paddingTop}
                                width={barSpacing}
                                height={innerH}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                              >
                                <title>{day} Average: ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</title>
                              </rect>

                              {/* Value Label */}
                              {val > 0 && (
                                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="#4b5563" fontWeight="700">
                                  ${Math.round(val)}
                                </text>
                              )}

                              {/* Bar */}
                              <rect 
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barH}
                                fill="url(#bar-grad)"
                                rx="3"
                                ry="3"
                              />

                              {/* X Axis label */}
                              <text x={paddingLeft + idx * barSpacing + barSpacing / 2} y={height - 4} textAnchor="middle" fontSize="9" fill="#6b7280" fontWeight="600">
                                {day}
                              </text>
                            </g>
                          );
                        })}

                        {/* Defs Gradient */}
                        <defs>
                          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#047857" />
                          </linearGradient>
                        </defs>
                      </svg>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                    No historical logs to compute averages.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TWO COLUMN TABLES: BRANCH RANKINGS AND WORST REGISTER SHORTAGES */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px'
          }}>
            {/* Branch Rankings (Visible only for ALL branches filter) */}
            {branchFilter === 'All' ? (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} style={{ color: 'var(--primary)' }} /> Branch Performance Rankings
                </h3>
                
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 'bold' }}>
                        <th style={{ padding: '8px 4px' }}>Rank</th>
                        <th style={{ padding: '8px' }}>Branch</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Shortage</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewMetrics.branchList.length > 0 ? (
                        overviewMetrics.branchList.map((item, idx) => (
                          <tr key={item.branch} style={{ borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>
                            <td style={{ padding: '12px 4px', color: idx === 0 ? '#f59e0b' : '#9ca3af', fontWeight: 'bold' }}>#{idx + 1}</td>
                            <td style={{ padding: '12px', fontWeight: 700, color: '#111827' }}>{item.branch}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: item.shortages < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                              ${Math.abs(item.shortages).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                              ${item.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No branch data logs.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <Info size={36} style={{ color: '#9ca3af', marginBottom: '12px' }} />
                <h4 style={{ margin: 0, fontWeight: 700, color: '#374151' }}>Detailed Branch View Active</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', maxWidth: '300px' }}>Rankings table is hidden when filtered to a single branch. Select "All" branches to enable comparison ranking.</p>
              </div>
            )}

            {/* Top 5 Register Shortages */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} /> Worst Register Discrepancies
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {topShortages.length > 0 ? (
                  topShortages.map((s, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#fef2f2',
                      borderRadius: '8px',
                      border: '1px solid #fee2e2'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px' }}>
                          {s.user_name} ({s.shift} Shift)
                        </div>
                        <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '2px', fontWeight: 500 }}>
                          {s.date.split('T')[0]} | Branch: <span style={{ fontWeight: 700 }}>{s.branch}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: 900, color: '#b91c1c' }}>
                        -${Math.abs(num(s.difference_usd)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '150px', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                    No shortage records exist for selected branch and date.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'compare' ? (
        /* ==================================================================== */
        /* WEEKLY COMPARISON REPORT VIEW                                       */
        /* ==================================================================== */
        compareMetrics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* COMPARISON METRICS SUMMARY */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {/* This Week */}
              <div style={{ textAlign: 'center', borderRight: '1px solid #f3f4f6', paddingRight: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Week Sales</span>
                <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#111827', margin: '8px 0' }}>
                  ${compareMetrics.thisWeekTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>{compareMetrics.dateRanges.thisWeek}</span>
              </div>

              {/* Last Week */}
              <div style={{ textAlign: 'center', borderRight: '1px solid #f3f4f6', paddingRight: '20px', paddingLeft: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Week Sales</span>
                <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#4b5563', margin: '8px 0' }}>
                  ${compareMetrics.lastWeekTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>{compareMetrics.dateRanges.lastWeek}</span>
              </div>

              {/* Absolute Difference & Percentage Change */}
              <div style={{ textAlign: 'center', paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reconciliation Variance</span>
                <h2 style={{ 
                  fontSize: '32px', 
                  fontWeight: 900, 
                  color: compareMetrics.diffUsd >= 0 ? '#10b981' : '#ef4444', 
                  margin: '8px 0' 
                }}>
                  {compareMetrics.diffUsd >= 0 ? '+' : ''}${compareMetrics.diffUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 800, 
                  color: compareMetrics.diffUsd >= 0 ? '#059669' : '#dc2626'
                }}>
                  {compareMetrics.diffUsd >= 0 ? '▲' : '▼'} {compareMetrics.diffPct.toFixed(1)}% compared to last week
                </span>
              </div>
            </div>

            {/* WEEKLY LINE COMPARISON CHART */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              position: 'relative'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px 0' }}>Weekly Comparison chart (This Week vs Last Week)</h3>
              
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#3b82f6' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>This Week</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ef4444' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Last Week</span>
                </div>
              </div>

              {/* Responsive Double Line SVG */}
              <div style={{ minHeight: '220px', position: 'relative' }}>
                {compareMetrics.thisWeekTotal > 0 || compareMetrics.lastWeekTotal > 0 ? (
                  (() => {
                    const maxVal = Math.max(...compareMetrics.thisWeekData, ...compareMetrics.lastWeekData, 100);
                    const width = 500;
                    const height = 180;
                    const paddingLeft = 45;
                    const paddingRight = 15;
                    const paddingTop = 15;
                    const paddingBottom = 20;
                    
                    const innerW = width - paddingLeft - paddingRight;
                    const innerH = height - paddingTop - paddingBottom;
                    
                    const thisWeekPoints = compareMetrics.thisWeekData.map((val, idx) => {
                      const x = paddingLeft + idx * (innerW / 6);
                      const y = height - paddingBottom - (val / maxVal) * innerH;
                      return { x, y, val };
                    });

                    const lastWeekPoints = compareMetrics.lastWeekData.map((val, idx) => {
                      const x = paddingLeft + idx * (innerW / 6);
                      const y = height - paddingBottom - (val / maxVal) * innerH;
                      return { x, y, val };
                    });

                    const twPathD = thisWeekPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const lwPathD = lastWeekPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                    return (
                      <div style={{ position: 'relative', width: '100%' }}>
                        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                          {/* Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                            const y = height - paddingBottom - ratio * innerH;
                            return (
                              <g key={i}>
                                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af" fontWeight="500">
                                  ${Math.round(ratio * maxVal)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Last Week Line */}
                          <path d={lwPathD} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                          {/* This Week Line */}
                          <path d={twPathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Active Hover Points */}
                          {thisWeekPoints.map((twP, idx) => {
                            const lwP = lastWeekPoints[idx];
                            return (
                              <g key={idx}>
                                {hoveredCompareIdx === idx && (
                                  <line x1={twP.x} y1={paddingTop} x2={twP.x} y2={height - paddingBottom} stroke="#9ca3af" strokeWidth="1" strokeDasharray="2 2" />
                                )}
                                <circle cx={twP.x} cy={twP.y} r="3.5" fill="white" stroke="#3b82f6" strokeWidth="2" />
                                <circle cx={lwP.x} cy={lwP.y} r="3.5" fill="white" stroke="#ef4444" strokeWidth="2" />

                                <rect 
                                  x={twP.x - innerW / 12}
                                  y={paddingTop}
                                  width={innerW / 6}
                                  height={innerH}
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => setHoveredCompareIdx(idx)}
                                  onMouseLeave={() => setHoveredCompareIdx(null)}
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Interactive Compare Tooltip */}
                        {hoveredCompareIdx !== null && (
                          <div style={{
                            position: 'absolute',
                            left: `${((thisWeekPoints[hoveredCompareIdx].x) / width) * 100}%`,
                            top: '10px',
                            transform: 'translateX(-50%)',
                            background: '#1f2937',
                            color: 'white',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            <div style={{ fontWeight: 800, borderBottom: '1px solid #374151', paddingBottom: '4px', marginBottom: '2px', textAlign: 'center' }}>
                              {compareMetrics.labels[hoveredCompareIdx]} Day Breakdown
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                              <span>This Week:</span>
                              <span style={{ fontWeight: 700, color: '#60a5fa' }}>
                                ${compareMetrics.thisWeekData[hoveredCompareIdx].toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                              <span>Last Week:</span>
                              <span style={{ fontWeight: 700, color: '#f87171' }}>
                                ${compareMetrics.lastWeekData[hoveredCompareIdx].toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                    No shift reconciliation records available for these 14 days.
                  </div>
                )}
              </div>
            </div>

            {/* COMPARISON DATA TABLE DETAILED BREAKDOWN */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px 0' }}>Daily Comparison Log Table</h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 'bold' }}>
                      <th style={{ padding: '10px 8px' }}>Day of Week</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>This Week</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Last Week</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareMetrics.labels.map((day, idx) => {
                      const twVal = compareMetrics.thisWeekData[idx];
                      const lwVal = compareMetrics.lastWeekData[idx];
                      const diffVal = twVal - lwVal;
                      
                      return (
                        <tr key={day} style={{ borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: '#111827' }}>{day}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                            ${twVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#6b7280' }}>
                            ${lwVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ 
                            padding: '12px 8px', 
                            textAlign: 'right', 
                            fontWeight: 700,
                            color: diffVal >= 0 ? '#10b981' : '#ef4444' 
                          }}>
                            {diffVal >= 0 ? '+' : ''}${diffVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ==================================================================== */
        /* DAILY AVAILABLE CASH VIEW                                           */
        /* ==================================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* KPI CARDS SUMMARY */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px'
          }}>
            {/* Card 1: Total Opening Cash */}
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #cbd5e1',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Drawer Opening Cash</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#334155', margin: '8px 0 0 0' }}>
                  ${dailyCashTotals.totalOpeningUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '12px', fontWeight: 600 }}>Initial cash in drawer at start of days</span>
            </div>

            {/* Card 2: Cash In / Added */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #bfdbfe',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cash Added (In)</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#1e3a8a', margin: '8px 0 0 0' }}>
                  ${dailyCashTotals.totalCashInUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#3b82f6', marginTop: '12px', fontWeight: 600 }}>Additional cash injected into registers</span>
            </div>

            {/* Card 3: Payments Out */}
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #fde68a',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Paid Out (Payments)</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#78350f', margin: '8px 0 0 0' }}>
                  ${(dailyCashTotals.totalSuppliersUsd + dailyCashTotals.totalDeliveryUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#f59e0b', marginTop: '12px', fontWeight: 600 }}>Cash paid to suppliers and delivery</span>
            </div>

            {/* Card 4: Cash out */}
            <div style={{
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
              border: '1px solid #ddd6fe',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cash out</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#5b21b6', margin: '8px 0 0 0' }}>
                  ${dailyCashTotals.totalCashOutUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '12px', fontWeight: 600 }}>Cash out of the drawer / banking</span>
            </div>

            {/* Card 5: Closing Available Cash */}
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #a7f3d0',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closing Cash In Drawer</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#064e3b', margin: '8px 0 0 0' }}>
                  ${dailyCashTotals.totalClosingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#10b981', marginTop: '12px', fontWeight: 600 }}>Ending cash counted in drawers</span>
            </div>

            {/* Card 6: Unpaid Invoices */}
            <div style={{
              background: 'linear-gradient(135deg, #fffaf0 0%, #ffedd5 100%)',
              border: '1px solid #fed7aa',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unpaid Invoices (Info)</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#9a3412', margin: '8px 0 0 0' }}>
                  ${dailyCashTotals.totalUnpaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#ea580c', marginTop: '12px', fontWeight: 600 }}>Unpaid supplier invoices (informational only)</span>
            </div>

            {/* Card 7: Reel Credit */}
            <div style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '1px solid #bae6fd',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#075985', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💳 Reel Credit (Cashed)</span>
                <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#0c4a6e', margin: '8px 0 0 0' }}>
                  ${dailyCashTotals.totalReelCreditUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: '#0284c7', marginTop: '12px', fontWeight: 600 }}>Credit card settlements per shift window</span>
            </div>
          </div>

          {/* DAILY AVAILABLE CASH TABLE */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Daily Available Cash Log Table</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Grouped by date and branch. Click a row to expand shift-level breakdown details.</p>
              </div>
            </div>

            {dailyAvailableCash.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                No daily cash entries available for the selected range and branch filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 'bold' }}>
                      <th style={{ padding: '12px 8px', width: '40px' }}></th>
                      <th style={{ padding: '12px 8px' }}>Date</th>
                      <th style={{ padding: '12px 8px' }}>Branch</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Opening Cash</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Cash In (Add)</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Suppliers</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Delivery</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Cash out</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Credit Card</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', color: '#0369a1' }}>💳 Reel Credit</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>On Credit</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Variance (Short)</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Closing (Actual)</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Shifts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyAvailableCash.map((item) => {
                      const isExpanded = !!expandedDailyRows[item.key];
                      
                      const toggleRow = () => {
                        setExpandedDailyRows(prev => ({
                          ...prev,
                          [item.key]: !prev[item.key]
                        }));
                      };

                      const getConverted = (usd: number, lbp: number) => usd + (lbp / item.rate);

                      return (
                        <Fragment key={item.key}>
                          {/* Daily Group Row */}
                          <tr 
                            onClick={toggleRow}
                            style={{ 
                              borderBottom: '1px solid #f3f4f6', 
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#f8fafc' : 'transparent',
                              transition: 'background-color 0.2s',
                              fontWeight: 500
                            }}
                            className="hover-row"
                          >
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
                              {isExpanded ? '▼' : '▶'}
                            </td>
                            <td style={{ padding: '12px 8px', fontWeight: 700, color: '#111827' }}>{item.date}</td>
                            <td style={{ padding: '12px 8px', fontWeight: 700, color: '#1e3a8a' }}>{item.branch}</td>
                            
                            {/* Opening */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 600 }}>${item.totalOpening.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              {item.AM && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  ${item.openingUsd} / {item.openingLbp.toLocaleString()} LBP
                                </div>
                              )}
                            </td>

                            {/* Cash In */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: item.totalCashIn > 0 ? '#3b82f6' : '#374151' }}>
                                ${item.totalCashIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {item.totalCashIn > 0 && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  ${item.cashInUsd} / {item.cashInLbp.toLocaleString()} LBP
                                </div>
                              )}
                            </td>

                            {/* Suppliers */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                               <div style={{ fontWeight: 600, color: item.totalSuppliers > 0 ? '#d97706' : '#374151' }}>
                                 ${item.totalSuppliers.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                               </div>
                               {item.totalSuppliers > 0 && (
                                 <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                   ${item.suppliersUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.suppliersLbp.toLocaleString()} LBP
                                 </div>
                               )}
                             </td>

                             {/* Delivery */}
                             <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                               <div style={{ fontWeight: 600, color: item.totalDelivery > 0 ? '#d97706' : '#374151' }}>
                                 ${item.totalDelivery.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                               </div>
                               {item.totalDelivery > 0 && (
                                 <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                   ${item.deliveryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.deliveryLbp.toLocaleString()} LBP
                                 </div>
                               )}
                            </td>

                            {/* Cash Out / Cash out */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: item.totalCashOut > 0 ? '#6d28d9' : '#374151' }}>
                                ${item.totalCashOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {item.totalCashOut > 0 && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  ${item.cashOutUsd} / {item.cashOutLbp.toLocaleString()} LBP
                                </div>
                              )}
                            </td>

                            {/* Credit Card */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: item.totalCreditCard > 0 ? '#3b82f6' : '#374151' }}>
                                ${item.totalCreditCard.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {item.totalCreditCard > 0 && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  ${item.creditCardUsd} / {item.creditCardLbp.toLocaleString()} LBP
                                </div>
                              )}
                            </td>

                            {/* Reel Credit */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: item.totalReelCredit > 0 ? '#0369a1' : '#374151' }}>
                                ${item.totalReelCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {item.totalReelCredit > 0 && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  AM: ${item.reelCreditAM.toLocaleString(undefined, { minimumFractionDigits: 2 })} · PM: ${item.reelCreditPM.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              )}
                            </td>

                            {/* On Credit */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: item.totalOnCredit > 0 ? '#f59e0b' : '#374151' }}>
                                ${item.totalOnCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {item.totalOnCredit > 0 && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  {item.onCreditLbp.toLocaleString()} LBP
                                </div>
                              )}
                            </td>

                            {/* Variance */}
                            <td style={{ 
                              padding: '12px 8px', 
                              textAlign: 'right', 
                              fontWeight: 700,
                              color: item.variance < 0 ? '#dc2626' : item.variance > 0 ? '#10b981' : '#6b7280' 
                            }}>
                              {item.variance > 0 ? '+' : ''}{item.variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Closing / Closing drawer */}
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: '#047857', fontSize: '14px' }}>
                                ${item.totalClosing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                ${item.closingUsd} / {item.closingLbp.toLocaleString()} LBP
                              </div>
                            </td>

                            {/* Shifts Badges */}
                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                {item.AM && (
                                  <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>AM</span>
                                )}
                                {item.PM && (
                                  <span style={{ fontSize: '10px', background: '#ede9fe', color: '#5b21b6', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>PM</span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Shifts Detail Row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={14} style={{ padding: '0 0 16px 0', backgroundColor: '#f8fafc' }}>
                                <div style={{ 
                                  margin: '12px 24px 12px 48px', 
                                  padding: '16px', 
                                  backgroundColor: 'white', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e2e8f0',
                                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                  <h4 style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569', margin: '0 0 12px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Shift Breakdown Details — Exchange Rate: <span style={{ color: '#10b981' }}>{item.rate.toLocaleString()} LBP/USD</span>
                                  </h4>
                                  
                                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    {/* AM details */}
                                    {item.AM ? (
                                      <div style={{ flex: 1, minWidth: '240px', background: '#eff6ff', padding: '12px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                                        <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <span>☀️ MORNING (AM SHIFT)</span>
                                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#4b5563', textAlign: 'right' }}>
                                            By: {item.AM.user_name}<br/>
                                            <span style={{ color: '#1e40af', fontWeight: 700 }}>
                                              Submitted: {new Date(item.AM.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Sales:</span>
                                          <span style={{ fontWeight: 700 }}>${(num(item.AM.sales_lbp) / item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {num(item.AM.sales_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Opening Cash:</span>
                                          <span>${item.AM.opening_usd} / {num(item.AM.opening_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Cash In:</span>
                                          <span>${item.AM.cash_in_usd} / {num(item.AM.cash_in_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Suppliers:</span>
                                          <span>${item.amSuppliersUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.amSuppliersLbp.toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Delivery:</span>
                                          <span>${item.amDeliveryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.amDeliveryLbp.toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Cash out:</span>
                                          <span>${item.AM.cash_out_usd} / {num(item.AM.cash_out_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Credit Card:</span>
                                          <span>${item.AM.credit_card_usd} / {num(item.AM.credit_card_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#0369a1', padding: '4px 0', borderBottom: '1px dashed #dbeafe', fontWeight: 600 }}>
                                          <span>💳 Reel Credit (Cashed):</span>
                                          <span>${item.reelCreditAM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>On Credit:</span>
                                          <span>{num(item.AM.on_credit_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#c2410c', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Unpaid Invoices (Info):</span>
                                          <span style={{ fontWeight: 700 }}>
                                            ${item.amUnpaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {item.amUnpaidLbp.toLocaleString()} LBP
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Shortage/Overage:</span>
                                          <span style={{ color: num(item.AM.difference_usd) < 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                                            ${item.AM.difference_usd}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #dbeafe' }}>
                                          <span>Actual Cash:</span>
                                          <span>${num(item.AM.actual_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {num(item.AM.actual_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#1e40af', padding: '4px 0', borderTop: '1px solid #bfdbfe', paddingTop: '6px', marginTop: '6px', fontWeight: 800 }}>
                                          <span>Shift Closing Drawer Cash:</span>
                                          <span>
                                            ${getConverted(num(item.AM.actual_usd), num(item.AM.actual_lbp)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ flex: 1, minWidth: '240px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                                        No AM Shift recorded for this date.
                                      </div>
                                    )}

                                    {/* PM details */}
                                    {item.PM ? (
                                      <div style={{ flex: 1, minWidth: '240px', background: '#f5f3ff', padding: '12px', borderRadius: '6px', border: '1px solid #ede9fe' }}>
                                        <div style={{ fontWeight: 800, color: '#5b21b6', fontSize: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <span>🌙 AFTERNOON (PM SHIFT)</span>
                                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#4b5563', textAlign: 'right' }}>
                                            By: {item.PM.user_name}<br/>
                                            <span style={{ color: '#5b21b6', fontWeight: 700 }}>
                                              Submitted: {new Date(item.PM.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Cumulative Sales:</span>
                                          <span style={{ fontWeight: 700 }}>${(num(item.PM.sales_lbp) / item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {num(item.PM.sales_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Opening Cash:</span>
                                          <span>${item.PM.opening_usd} / {num(item.PM.opening_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Cash In:</span>
                                          <span>${item.PM.cash_in_usd} / {num(item.PM.cash_in_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Suppliers:</span>
                                          <span>${item.pmSuppliersUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.pmSuppliersLbp.toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Delivery:</span>
                                          <span>${item.pmDeliveryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.pmDeliveryLbp.toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Cash out:</span>
                                          <span>${item.PM.cash_out_usd} / {num(item.PM.cash_out_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Credit Card:</span>
                                          <span>${item.PM.credit_card_usd} / {num(item.PM.credit_card_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#0369a1', padding: '4px 0', borderBottom: '1px dashed #ede9fe', fontWeight: 600 }}>
                                          <span>💳 Reel Credit (Cashed):</span>
                                          <span>${item.reelCreditPM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>On Credit:</span>
                                          <span>{num(item.PM.on_credit_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#c2410c', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Unpaid Invoices (Info):</span>
                                          <span style={{ fontWeight: 700 }}>
                                            ${item.pmUnpaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {item.pmUnpaidLbp.toLocaleString()} LBP
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Cumulative Shortage/Overage:</span>
                                          <span style={{ color: num(item.PM.difference_usd) < 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                                            ${item.PM.difference_usd}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #ede9fe' }}>
                                          <span>Actual Cash:</span>
                                          <span>${num(item.PM.actual_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {num(item.PM.actual_lbp).toLocaleString()} LBP</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#5b21b6', padding: '4px 0', borderTop: '1px solid #ddd6fe', paddingTop: '6px', marginTop: '6px', fontWeight: 800 }}>
                                          <span>Shift Closing Drawer Cash:</span>
                                          <span>
                                            ${getConverted(num(item.PM.actual_usd), num(item.PM.actual_lbp)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                    </div>
                                     ) : (
                                      <div style={{ flex: 1, minWidth: '240px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                                        No PM Shift recorded for this date.
                                      </div>
                                    )}

                                    {/* All Day Shift details */}
                                    <div style={{ flex: 1, minWidth: '240px', background: '#ecfdf5', padding: '12px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                                      <div style={{ fontWeight: 800, color: '#065f46', fontSize: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>☀️🌙 ALL DAY SHIFT</span>
                                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#4b5563' }}>
                                          {item.AM && item.PM ? 'AM + PM Combined' : item.AM ? 'AM Only' : 'PM Only'}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Sales:</span>
                                        <span style={{ fontWeight: 700 }}>
                                          ${((item.PM ? num(item.PM.sales_lbp) : num(item.AM?.sales_lbp)) / item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(item.PM ? num(item.PM.sales_lbp) : num(item.AM?.sales_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Opening Cash:</span>
                                        <span>
                                          ${(item.AM ? num(item.AM.opening_usd) : num(item.PM?.opening_usd))} / {(item.AM ? num(item.AM.opening_lbp) : num(item.PM?.opening_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Cash In:</span>
                                        <span>
                                          ${(num(item.AM?.cash_in_usd) + num(item.PM?.cash_in_usd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(num(item.AM?.cash_in_lbp) + num(item.PM?.cash_in_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Suppliers:</span>
                                        <span>
                                          ${(num(item.amSuppliersUsd) + num(item.pmSuppliersUsd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(num(item.amSuppliersLbp) + num(item.pmSuppliersLbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Delivery:</span>
                                        <span>
                                          ${(num(item.amDeliveryUsd) + num(item.pmDeliveryUsd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(num(item.amDeliveryLbp) + num(item.pmDeliveryLbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Cash out:</span>
                                        <span>
                                          ${(num(item.AM?.cash_out_usd) + num(item.PM?.cash_out_usd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(num(item.AM?.cash_out_lbp) + num(item.PM?.cash_out_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Credit Card:</span>
                                        <span>
                                          ${(num(item.AM?.credit_card_usd) + num(item.PM?.credit_card_usd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(num(item.AM?.credit_card_lbp) + num(item.PM?.credit_card_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#0369a1', padding: '4px 0', borderBottom: '1px dashed #a7f3d0', fontWeight: 700 }}>
                                        <span>💳 Reel Credit (Cashed):</span>
                                        <span>${item.totalReelCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>On Credit:</span>
                                        <span>
                                          {(item.PM ? num(item.PM.on_credit_lbp) : num(item.AM?.on_credit_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#c2410c', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Total Unpaid Invoices (Info):</span>
                                        <span style={{ fontWeight: 700 }}>
                                          ${item.unpaidUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {item.unpaidLbp.toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Shortage/Overage:</span>
                                        <span style={{ color: item.variance < 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                                          {item.variance > 0 ? '+' : ''}${item.variance.toFixed(2)}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#334155', padding: '4px 0', borderBottom: '1px dashed #a7f3d0' }}>
                                        <span>Actual Cash:</span>
                                        <span>
                                          ${(item.PM ? num(item.PM.actual_usd) : num(item.AM?.actual_usd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {(item.PM ? num(item.PM.actual_lbp) : num(item.AM?.actual_lbp)).toLocaleString()} LBP
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#065f46', padding: '4px 0', borderTop: '1px solid #a7f3d0', paddingTop: '6px', marginTop: '6px', fontWeight: 800 }}>
                                        <span>Shift Closing Drawer Cash:</span>
                                        <span>
                                          ${((item.PM ? getConverted(num(item.PM.actual_usd), num(item.PM.actual_lbp)) : getConverted(num(item.AM?.actual_usd), num(item.AM?.actual_lbp)))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
