import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Store,
  Layers,
  ChevronDown,
  ChevronRight,
  Shield,
  Search,
  ExternalLink,
  Loader2,
  Info
} from 'lucide-react';
import { api } from '../../api/client';
import {
  generateSyntheticInvoices,
  type CatalogProduct,
  type GeneratorResult,
  type GeneratedInvoice
} from '../../utils/invoiceGenerationEngine';

const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: '#fff',
  font: 'inherit',
  fontSize: 14,
  boxSizing: 'border-box'
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-main)'
};

const primaryBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 8,
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  border: 'none',
  cursor: 'pointer'
};

const secondaryBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 16px',
  borderRadius: 8,
  background: '#fff',
  color: 'var(--text-main)',
  fontWeight: 600,
  fontSize: 14,
  border: '1px solid var(--border)',
  cursor: 'pointer'
};

export default function PosInvoiceGeneratorScreen({ user }: { user?: any }) {
  const isSuperAdmin =
    user?.role?.toLowerCase() === 'superadmin' || user?.is_super_admin === true;

  // Data Loading
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Inputs
  const [targetAmount, setTargetAmount] = useState<string>('10000');
  const [invoiceCount, setInvoiceCount] = useState<string>('350');
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [randomSeed, setRandomSeed] = useState<string>('42');

  // Preview / Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorResult, setGeneratorResult] = useState<GeneratorResult | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Database Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessResult, setSaveSuccessResult] = useState<{
    batchId: string;
    invoicesSaved: number;
    itemsSaved: number;
    totalAmount: number;
  } | null>(null);

  useEffect(() => {
    loadCatalogAndBranches();
  }, []);

  const loadCatalogAndBranches = async () => {
    setLoadingCatalog(true);
    setErrorMsg('');
    try {
      const [prodRes, brRes] = await Promise.all([
        (api as any).getProductsForInvoiceGenerator
          ? (api as any).getProductsForInvoiceGenerator()
          : Promise.resolve({ success: true, data: [] }),
        api.getBranches ? api.getBranches() : Promise.resolve({ success: true, data: [] })
      ]);

      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data);
        const uniqueCats = Array.from(
          new Set(
            (prodRes.data as CatalogProduct[])
              .map(p => p.category_name)
              .filter((c): c is string => Boolean(c))
          )
        ).sort();
        setSelectedCategories(uniqueCats);
      } else if (prodRes.error) {
        setErrorMsg(prodRes.error);
      }

      if (brRes.success && brRes.data) {
        setBranches(brRes.data);
        if (brRes.data.length > 0) {
          setSelectedBranchId(brRes.data[0].id);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load catalog.');
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Distinct categories available in catalog
  const availableCategories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map(p => p.category_name)
          .filter((c): c is string => Boolean(c))
      )
    ).sort();
  }, [products]);

  // Handle Category Toggle
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const selectAllCategories = () => setSelectedCategories(availableCategories);
  const deselectAllCategories = () => setSelectedCategories([]);

  const selectSectionCategories = (sectionName: string) => {
    const sectionCats = Array.from(
      new Set(
        products
          .filter(p => (p.department || '').toLowerCase() === sectionName.toLowerCase())
          .map(p => p.category_name)
          .filter((c): c is string => Boolean(c))
      )
    );
    setSelectedCategories(prev => Array.from(new Set([...prev, ...sectionCats])));
  };

  // Generate & Preview Action
  const handleGenerate = () => {
    setErrorMsg('');
    setSaveSuccessResult(null);

    const targetVal = parseFloat(targetAmount);
    const countVal = parseInt(invoiceCount, 10);

    if (isNaN(targetVal) || targetVal <= 0) {
      setErrorMsg('Please enter a valid positive target sales amount.');
      return;
    }
    if (isNaN(countVal) || countVal <= 0) {
      setErrorMsg('Please enter a valid positive number of invoices.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please specify both start date and end date.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg('Start date must be before or equal to end date.');
      return;
    }

    const branchObj = branches.find(b => b.id === selectedBranchId) || branches[0];
    const bId = branchObj ? branchObj.id : '1';
    const bName = branchObj ? branchObj.name : 'Main Branch';

    setIsGenerating(true);
    try {
      const res = generateSyntheticInvoices({
        targetAmount: targetVal,
        invoiceCount: countVal,
        startDate,
        endDate,
        restaurantId: branchObj?.restaurant_id || '79256f11-a9f8-4fec-901d-69baf929762d',
        branchId: bId,
        branchName: bName,
        products,
        categoriesIncluded: selectedCategories,
        randomSeed: randomSeed.trim() || undefined
      });

      setGeneratorResult(res);
      setPage(1);
    } catch (e: any) {
      setErrorMsg(e.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save to Database Action
  const handleSaveToDatabase = async () => {
    if (!generatorResult) return;

    const confirmMsg = `Are you sure you want to commit ${generatorResult.generatedCount} invoices totaling $${generatorResult.generatedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} into pos_orders?\n\nBatch ID: ${generatorResult.batchId}\nTag: SYNTHETIC_MIGRATION`;
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    setErrorMsg('');
    try {
      const res = await (api as any).saveSyntheticInvoiceBatch(
        generatorResult.batchId,
        generatorResult.invoices,
        user?.name || 'Admin Migration'
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to save batch to database.');
      }

      setSaveSuccessResult({
        batchId: generatorResult.batchId,
        invoicesSaved: res.data?.invoices_saved || generatorResult.generatedCount,
        itemsSaved: res.data?.items_saved || generatorResult.totalItemsCount,
        totalAmount: Number(res.data?.total_amount || generatorResult.generatedAmount)
      });
    } catch (e: any) {
      setErrorMsg(e.message || 'Could not save simulation batch.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered invoices for the preview explorer table
  const filteredInvoices = useMemo(() => {
    if (!generatorResult) return [];
    if (!searchFilter.trim()) return generatorResult.invoices;
    const q = searchFilter.toLowerCase();
    return generatorResult.invoices.filter(
      inv =>
        inv.id.toLowerCase().includes(q) ||
        inv.created_at.includes(q) ||
        inv.items.some(it => it.product_name.toLowerCase().includes(q))
    );
  }, [generatorResult, searchFilter]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, page]);

  // Access restriction guard
  if (!isSuperAdmin) {
    return (
      <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px' }}>
        <div style={{ ...card, textAlign: 'center', borderColor: '#fca5a5', background: '#fff5f5' }}>
          <Shield size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#991b1b', margin: '0 0 8px' }}>
            Restricted Access
          </h2>
          <p style={{ fontSize: 14, color: '#7f1d1d', maxWidth: 480, margin: '0 auto 20px' }}>
            The <strong>POS Invoice Generator</strong> is a high-privilege migration utility restricted exclusively to Super Administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--text-main)'
            }}
          >
            <span style={{ fontSize: 26 }}>⚡</span> POS Invoice Generator
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a'
              }}
            >
              One-Time Migration
            </span>
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Generate realistic product-based invoices directly into the FLOW POS database matching exact totals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a
            href="http://localhost:4173/#/pos"
            target="_blank"
            rel="noopener noreferrer"
            style={secondaryBtn}
            title="Open POS Terminal Orders Hub"
          >
            <Store size={16} /> Open POS App <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            ...card,
            background: '#fef2f2',
            borderColor: '#fca5a5',
            color: '#991b1b',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px'
          }}
        >
          <AlertTriangle size={18} color="#dc2626" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      {/* Success Save Banner */}
      {saveSuccessResult && (
        <div
          style={{
            ...card,
            background: '#f0fdf4',
            borderColor: '#86efac',
            marginBottom: 24,
            padding: '20px 24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <CheckCircle2 size={28} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#166534' }}>
                Batch Successfully Committed to POS Database!
              </h3>
              <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#15803d' }}>
                {saveSuccessResult.invoicesSaved} synthetic invoices with {saveSuccessResult.itemsSaved} product line items totaling{' '}
                <strong>${saveSuccessResult.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> were written to{' '}
                <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>pos_orders</code> and{' '}
                <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>pos_order_items</code>.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                  background: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #bbf7d0',
                  marginBottom: 16
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block' }}>BATCH ID</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{saveSuccessResult.batchId}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block' }}>DATE RANGE</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{startDate} to {endDate}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block' }}>CLASSIFICATION</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>SYNTHETIC_MIGRATION</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a
                  href="http://localhost:4173/#/pos"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...primaryBtn,
                    background: '#16a34a',
                    textDecoration: 'none'
                  }}
                >
                  <Store size={16} /> View Records in POS History <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSaveSuccessResult(null);
                    setGeneratorResult(null);
                  }}
                  style={secondaryBtn}
                >
                  <RotateCcw size={15} /> Create Another Batch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inputs Configuration Card */}
      <section style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📝</span> Invoice Generation Parameters
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Catalog: <strong>{products.length}</strong> active products loaded
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {/* Target Amount */}
          <label style={labelStyle}>
            Total Sales Target ($) *
            <input
              type="number"
              step="0.01"
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder="e.g. 10000"
              style={{ ...inputStyle, fontWeight: 700, fontSize: 16, color: '#0f172a' }}
              disabled={isGenerating || isSaving}
            />
          </label>

          {/* Invoice Count */}
          <label style={labelStyle}>
            Number of Invoices *
            <input
              type="number"
              step="1"
              value={invoiceCount}
              onChange={e => setInvoiceCount(e.target.value)}
              placeholder="e.g. 350"
              style={inputStyle}
              disabled={isGenerating || isSaving}
            />
          </label>

          {/* Start Date */}
          <label style={labelStyle}>
            Start Date *
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={inputStyle}
              disabled={isGenerating || isSaving}
            />
          </label>

          {/* End Date */}
          <label style={labelStyle}>
            End Date *
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={inputStyle}
              disabled={isGenerating || isSaving}
            />
          </label>

          {/* Branch */}
          <label style={labelStyle}>
            Target Branch *
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              style={inputStyle}
              disabled={isGenerating || isSaving}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name || 'Branch ' + b.id}
                </option>
              ))}
            </select>
          </label>

          {/* Random Seed */}
          <label style={labelStyle}>
            Random Seed (Optional)
            <input
              type="text"
              value={randomSeed}
              onChange={e => setRandomSeed(e.target.value)}
              placeholder="e.g. 42 for repeatable rolls"
              style={inputStyle}
              disabled={isGenerating || isSaving}
            />
          </label>
        </div>

        {/* Product Categories Selector */}
        {availableCategories.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                Included Product Categories ({selectedCategories.length} / {availableCategories.length})
              </span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={selectAllCategories}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllCategories}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Deselect All
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <button
                  type="button"
                  onClick={() => selectSectionCategories('Bistro')}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2px 8px', color: '#0f172a', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  title="Select Breakfast, Salads, Sandwiches, Mains, Wellness, Coffee"
                >
                  + Bistro & Food
                </button>
                <button
                  type="button"
                  onClick={() => selectSectionCategories('Store')}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2px 8px', color: '#0f172a', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  title="Select Retail Products: Bread, Cakes, Cookies, Pastry"
                >
                  + Retail / Store
                </button>
                <button
                  type="button"
                  onClick={() => selectSectionCategories('Bar')}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2px 8px', color: '#0f172a', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  title="Select Tea, Cocktails, Drinks, Wine"
                >
                  + Bar & Drinks
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableCategories.map(cat => {
                const isChecked = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: isChecked ? '#e6f4ea' : '#fff',
                      color: isChecked ? '#166534' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isChecked ? '✓ ' : ''}{cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isSaving || loadingCatalog}
            style={{
              ...primaryBtn,
              padding: '12px 24px',
              fontSize: 15,
              opacity: isGenerating || isSaving || loadingCatalog ? 0.7 : 1
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Solving Exact Constraint Matching...
              </>
            ) : (
              <>
                <span>⚡</span> Generate & Preview Invoices
              </>
            )}
          </button>

          {generatorResult && (
            <button
              type="button"
              onClick={() => {
                setRandomSeed(String(Math.floor(1000 + Math.random() * 9000)));
                setTimeout(handleGenerate, 50);
              }}
              style={secondaryBtn}
              title="Roll again with new seed"
            >
              <RotateCcw size={15} /> Re-roll New Sample
            </button>
          )}
        </div>
      </section>

      {/* Preview & Validation Section */}
      {generatorResult && (
        <section style={{ marginBottom: 40 }}>
          {/* Reconciliation Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 20
            }}
          >
            {/* Target vs Generated */}
            <div style={{ ...card, padding: 18 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Sales Reconciled
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                  ${generatorResult.generatedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  / ${generatorResult.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                {generatorResult.isExactMatch ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#16a34a',
                      background: '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: 12
                    }}
                  >
                    ✓ EXACT MATCH ($0.00 Diff)
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#dc2626',
                      background: '#fee2e2',
                      padding: '2px 8px',
                      borderRadius: 12
                    }}
                  >
                    Δ ${generatorResult.difference > 0 ? `+${generatorResult.difference}` : generatorResult.difference} Discrepancy
                  </span>
                )}
              </div>
            </div>

            {/* Invoices Count */}
            <div style={{ ...card, padding: 18 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Invoices Generated
              </span>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                {generatorResult.generatedCount} / {generatorResult.targetCount}
              </div>
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 8, display: 'block' }}>
                100% Count Satisfied
              </span>
            </div>

            {/* Average Ticket */}
            <div style={{ ...card, padding: 18 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Average Invoice Value
              </span>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                ${generatorResult.averageTicket.toFixed(2)}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'block' }}>
                Min: ${generatorResult.minTicket.toFixed(2)} • Max: ${generatorResult.maxTicket.toFixed(2)}
              </span>
            </div>

            {/* Total Items */}
            <div style={{ ...card, padding: 18 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Items Generated
              </span>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                {generatorResult.totalItemsCount}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'block' }}>
                ~{(generatorResult.totalItemsCount / generatorResult.generatedCount).toFixed(1)} items / invoice
              </span>
            </div>
          </div>

          {/* Action Bar before Table */}
          <div
            style={{
              ...card,
              background: '#f8fafc',
              borderColor: '#cbd5e1',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                Ready to Commit Batch: <code>{generatorResult.batchId}</code>
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Review generated invoices below. Clicking save writes all records transactionally into <code>pos_orders</code> and <code>pos_order_items</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              style={{
                ...primaryBtn,
                background: '#ea580c',
                padding: '12px 24px',
                fontSize: 15,
                opacity: isSaving ? 0.7 : 1
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Saving to Database...
                </>
              ) : (
                <>
                  <span>💾</span> Save Simulation Batch to POS Database
                </>
              )}
            </button>
          </div>

          {/* Invoices Explorer Table */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Generated Invoices Explorer</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  ({filteredInvoices.length} invoices)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 280 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => {
                      setSearchFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search invoice or item..."
                    style={{ ...inputStyle, paddingLeft: 30, fontSize: 13, height: 36 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569', fontSize: 12, fontWeight: 700 }}>
                    <th style={{ padding: '10px 16px', width: 40 }}></th>
                    <th style={{ padding: '10px 16px' }}>Invoice ID</th>
                    <th style={{ padding: '10px 16px' }}>Timestamp</th>
                    <th style={{ padding: '10px 16px' }}>Branch</th>
                    <th style={{ padding: '10px 16px' }}>Order Type</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Items</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((inv, idx) => {
                    const isExpanded = expandedInvoiceId === inv.id;
                    const dateFormatted = new Date(inv.created_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <React.Fragment key={inv.id}>
                        <tr
                          onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isExpanded ? '#f8fafc' : idx % 2 === 0 ? '#fff' : '#fafafa',
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                            {inv.id}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>
                            {dateFormatted}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>
                            {inv.branch_name}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: inv.order_type === 'dine_in' ? '#f3e8ff' : '#e0f2fe',
                                color: inv.order_type === 'dine_in' ? '#6b21a8' : '#0369a1'
                              }}
                            >
                              {inv.order_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>
                            {inv.items_count}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            ${inv.total_amount.toFixed(2)}
                          </td>
                        </tr>

                        {/* Expanded Items View */}
                        {isExpanded && (
                          <tr style={{ background: '#f1f5f9' }}>
                            <td colSpan={7} style={{ padding: '12px 24px 16px 48px' }}>
                              <div
                                style={{
                                  background: '#fff',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  padding: '12px 16px'
                                }}
                              >
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                                  Invoice Line Items ({inv.items.length})
                                </span>
                                <table style={{ width: '100%', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                                      <th style={{ padding: '4px 0' }}>Product Name</th>
                                      <th style={{ padding: '4px 8px' }}>Category</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Qty</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'right' }}>Unit Price</th>
                                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Line Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.items.map((it, i) => (
                                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '6px 0', fontWeight: 600 }}>{it.product_name}</td>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{it.category_name}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{it.quantity}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>${it.unit_price.toFixed(2)}</td>
                                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>${it.total_price.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
                color: '#64748b'
              }}
            >
              <span>
                Showing {Math.min(filteredInvoices.length, (page - 1) * pageSize + 1)} -{' '}
                {Math.min(filteredInvoices.length, page * pageSize)} of {filteredInvoices.length} invoices
              </span>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 12, opacity: page <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span style={{ padding: '4px 8px', fontWeight: 700, color: '#0f172a' }}>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 12, opacity: page >= totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
