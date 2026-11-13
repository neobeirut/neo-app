import RecipeDeleteButton from '../components/RecipeDeleteButton';
import SearchableSelect from '../components/SearchableSelect';
import { useEffect, useRef, useState, useMemo, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChefHat,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Plus,
  Save,
  Trash2,
  Package,
  Flame
} from 'lucide-react';
import LinkedCatalogItemsModal from '../components/LinkedCatalogItemsModal';
import { api } from '../api/client';
import { emptyProductionRecipe, validateProductionRecipe, type ProductionIngredient, type ProductionRecipeDraft } from '../utils/productionRecipe';
import { conversionFactor, getConvertibleUnits, formatConversionPreview, resolveItemEffectiveCost } from '../utils/inventoryConfiguration';
import {
  generateProductionRecipeTemplate,
  parseProductionRecipeExcel,
  type ParsedProductionRecipe
} from '../utils/recipeExcelImport';

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', font: 'inherit', boxSizing: 'border-box' };
const label: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 };
const button: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'inherit', cursor: 'pointer', textDecoration: 'none', fontWeight: 600 };
const primary: CSSProperties = { ...button, background: 'var(--primary)', color: '#fff' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 };

export default function ProductionRecipesScreen({ canEdit = false }: { canEdit?: boolean }) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<any | null>(null);

  // Excel Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [parsedImport, setParsedImport] = useState<{
    recipes: ParsedProductionRecipe[];
    errors: string[];
    fileName: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentRecipeName: string;
  } | null>(null);
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api.getProductionRecipeCatalog(),
      api.getInventoryItemsSimpleList(),
      api.getInventoryLocationsSimpleList(),
      api.getInventoryUnitConversions(),
      api.getAllItemPackagingOptions()
    ])
      .then(([recipesRes, itemsRes, locsRes, convRes, packRes]) => {
        if (cancelled) return;
        if (!recipesRes.success || !itemsRes.success) {
          throw new Error(recipesRes.error || itemsRes.error || 'Could not load production recipes.');
        }
        setRecipes(recipesRes.data || []);
        setItems(itemsRes.data || []);
        setLocations(locsRes.data || []);
        setConversions(convRes.data || []);
        setPackagingOptions(packRes?.data || []);
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const res = await parseProductionRecipeExcel(file, items, conversions, locations, packagingOptions);
      setParsedImport({
        recipes: res.recipes,
        errors: res.errors,
        fileName: file.name
      });
      setImportModalOpen(true);
    } catch (err: any) {
      alert(`Failed to read Excel file: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedImport || !parsedImport.recipes.length) return;
    setImporting(true);
    const user = JSON.parse(localStorage.getItem('neo_admin_user') || '{}');
    const userName = user.name || 'Admin';
    let successCount = 0;
    const failures: string[] = [];

    for (let i = 0; i < parsedImport.recipes.length; i++) {
      const r = parsedImport.recipes[i];
      setImportProgress({
        current: i + 1,
        total: parsedImport.recipes.length,
        currentRecipeName: r.name
      });

      // Find if this recipe already exists by recipe_code
      const existing = recipes.find(
        rec => rec.recipe_code.trim().toLowerCase() === r.recipe_code.trim().toLowerCase()
      );

      const res = await api.upsertProductionRecipe({
        existing_recipe_id: existing?.id,
        recipe_code: r.recipe_code,
        name: r.name,
        output_item_id: r.output_item_id,
        target_yield_quantity: r.target_yield_quantity,
        yield_unit: r.yield_unit,
        default_location_id: r.default_location_id,
        shelf_life_days: r.shelf_life_days,
        prep_time_minutes: r.prep_time_minutes,
        instructions: r.instructions,
        items: r.items.map(it => ({
          item_id: it.item_id,
          quantity: it.quantity,
          unit: it.unit,
          waste_percentage: it.waste_percentage,
          source_location_id: it.source_location_id,
          notes: it.notes
        })),
        user_name: userName
      });

      if (res.success) {
        successCount++;
      } else {
        failures.push(`${r.name} (${r.recipe_code}): ${res.error || 'Failed to save'}`);
      }
    }

    setImporting(false);
    setImportProgress(null);

    if (failures.length === 0) {
      setSuccessToast(`Successfully imported ${successCount} production recipe${successCount > 1 ? 's' : ''}!`);
      setImportModalOpen(false);
      setParsedImport(null);
      setRevision(n => n + 1);
    } else {
      setParsedImport(prev =>
        prev
          ? {
              ...prev,
              errors: [...prev.errors, ...failures]
            }
          : null
      );
      setRevision(n => n + 1);
    }
  };

  const [selectedDept, setSelectedDept] = useState<string>('All');

  const availableDepts = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach(r => {
      const output = items.find(i => i.id === r.output_item_id);
      if (output?.department) set.add(output.department);
    });
    return Array.from(set).sort();
  }, [recipes, items]);

  const filtered = recipes.filter(r => {
    const matchesSearch = `${r.name} ${r.recipe_code}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedDept !== 'All') {
      const output = items.find(i => i.id === r.output_item_id);
      if (output?.department !== selectedDept) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center'
        }}
      >
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChefHat /> Production Recipes
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>
            Ingredients and batch yields for sauces, prep items and other kitchen sub-recipes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link
            to="/daily-production"
            style={{
              ...button,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff7ed',
              borderColor: '#fdba74',
              color: '#c2410c'
            }}
            title="Log daily kitchen batch cooking, actual yields, and variance"
          >
            <Flame size={17} color="#ea580c" /> Daily Production
          </Link>

          <button
            type="button"
            style={button}
            onClick={() => generateProductionRecipeTemplate(items, locations)}
            title="Download Excel template with sample recipes, approved items and locations"
          >
            <Download size={17} /> Download Template
          </button>

          {canEdit && (
            <>
              <button
                type="button"
                style={button}
                onClick={() => fileInputRef.current?.click()}
                title="Upload and bulk import production recipes from Excel"
              >
                <Upload size={17} /> Import Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Link to="/production-recipes/new" style={primary}>
                <Plus size={18} /> New Production Recipe
              </Link>
            </>
          )}
        </div>
      </header>

      {successToast && (
        <div
          role="status"
          style={{
            ...card,
            background: '#ecfdf5',
            borderColor: '#a7f3d0',
            color: '#065f46',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <CheckCircle2 size={18} /> {successToast}
          </span>
          <button
            type="button"
            onClick={() => setSuccessToast('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          aria-label="Search production recipes"
          style={{ ...input, flex: 1, minWidth: 260 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by recipe name or code…"
        />
        {availableDepts.length > 0 && (
          <select
            style={{ ...input, width: 'auto', minWidth: 160 }}
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="All">All Departments</option>
            {availableDepts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div role="alert" style={{ ...card, color: '#b91c1c' }}>
          {error} <button onClick={() => setRevision(n => n + 1)} style={button}>Retry</button>
        </div>
      )}

      {loading ? (
        <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 className="spin" size={18} /> Loading production recipes…
        </p>
      ) : !error && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                {['Recipe', 'Output inventory item', 'Linked Catalog Items', 'Batch yield', 'Unit Cost', 'Status', ''].map((title, i) => (
                  <th key={i} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const ingCount = r.production_recipe_items?.length || 0;
                const hasOutput = Boolean(r.output_item_id);
                const isLinked = ingCount > 0 || hasOutput;
                const outItem = items.find(i => i.id === r.output_item_id);
                const unitCost = Number(outItem?.price_usd) || 0;
                return (
                  <tr key={r.id}>
                    <td style={{ padding: 12 }}>
                      <strong>{r.name}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.recipe_code}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      {outItem?.name || 'Output item unavailable'}
                    </td>
                    <td style={{ padding: 12 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedRecipeForModal(r)}
                        title="Click to view linked catalog items"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: isLinked ? '#eff6ff' : '#f3f4f6',
                          color: isLinked ? '#1d4ed8' : '#6b7280',
                          border: isLinked ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                          cursor: 'pointer'
                        }}
                      >
                        <Package size={13} />
                        {ingCount} item{ingCount !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td style={{ padding: 12 }}>
                      {r.target_yield_quantity} {r.yield_unit}
                    </td>
                    <td style={{ padding: 12 }}>
                      {unitCost > 0 ? (
                        <strong style={{ color: '#15803d' }}>
                          ${unitCost.toFixed(2)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/ {r.yield_unit || outItem?.unit}</span>
                        </strong>
                      ) : (
                        <span style={{ color: '#d97706', fontSize: 12, fontWeight: 600 }}>Unpriced</span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: r.is_active ? '#ecfdf5' : '#f3f4f6',
                          color: r.is_active ? '#065f46' : '#6b7280'
                        }}
                      >
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Link style={button} to={`/production-recipes/${r.id}`}>
                        {canEdit ? 'Edit Recipe' : 'View Recipe'}
                      </Link>{' '}
                      {canEdit && (
                        <RecipeDeleteButton
                          kind="production"
                          recipeId={r.id}
                          name={r.name}
                          onDeleted={() => setRevision(n => n + 1)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <p style={{ margin: '16px 0 0', color: 'var(--text-muted)' }}>
              No production recipes found. Click "Download Template" to prepare your recipes in Excel or click "New Production Recipe" to add manually.
            </p>
          )}
        </div>
      )}

      {/* Linked Catalog Items Details Popup Modal */}
      <LinkedCatalogItemsModal
        isOpen={Boolean(selectedRecipeForModal)}
        onClose={() => setSelectedRecipeForModal(null)}
        recipeName={selectedRecipeForModal?.name || ''}
        recipeCodeOrSection={selectedRecipeForModal?.recipe_code || ''}
        recipeType="production"
        editUrl={selectedRecipeForModal ? `/production-recipes/${selectedRecipeForModal.id}` : undefined}
        outputItem={
          selectedRecipeForModal?.output_item_id
            ? {
                id: selectedRecipeForModal.output_item_id,
                name: selectedRecipeForModal.output_item?.name || items.find(i => i.id === selectedRecipeForModal.output_item_id)?.name || 'Output item',
                role: 'Output Item',
                quantity: selectedRecipeForModal.target_yield_quantity,
                unit: selectedRecipeForModal.yield_unit,
                department: selectedRecipeForModal.output_item?.department || items.find(i => i.id === selectedRecipeForModal.output_item_id)?.department,
                priceUsd: selectedRecipeForModal.output_item?.price_usd ?? items.find(i => i.id === selectedRecipeForModal.output_item_id)?.price_usd
              }
            : null
        }
        items={(selectedRecipeForModal?.production_recipe_items || []).map((it: any) => {
          const itemObj = it.items || items.find(i => i.id === it.item_id);
          return {
            id: it.item_id,
            name: itemObj?.name || 'Unknown item',
            role: 'Ingredient' as const,
            quantity: it.quantity,
            unit: it.unit,
            wastePercentage: it.waste_percentage,
            notes: it.notes,
            department: itemObj?.department,
            subDepartment: itemObj?.sub_department,
            priceUsd: itemObj?.price_usd
          };
        })}
      />

      {/* Excel Import Preview Modal */}
      {importModalOpen && parsedImport && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 820,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={22} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Import Production Recipes</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{parsedImport.fileName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!importing) {
                    setImportModalOpen(false);
                    setParsedImport(null);
                  }
                }}
                disabled={importing}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Errors Alert if any */}
              {parsedImport.errors.length > 0 && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8 }}>
                    <AlertTriangle size={18} />
                    Validation Issues ({parsedImport.errors.length})
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13 }}>
                    Please review the following errors from your file before importing:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, maxHeight: 180, overflowY: 'auto' }}>
                    {parsedImport.errors.map((err, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success / Parsed Recipes Summary */}
              {parsedImport.recipes.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: 12,
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 8,
                      color: '#166534',
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <CheckCircle2 size={18} />
                    Found {parsedImport.recipes.length} production recipe(s) with{' '}
                    {parsedImport.recipes.reduce((acc, r) => acc + r.items.length, 0)} total ingredient rows.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {parsedImport.recipes.map((r, idx) => {
                      const isUpdate = recipes.some(
                        rec => rec.recipe_code.trim().toLowerCase() === r.recipe_code.trim().toLowerCase()
                      );

                      return (
                        <div
                          key={idx}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: 16,
                            background: '#fafafa'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: 8,
                              marginBottom: 8
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: 15 }}>{r.name}</strong>
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  color: 'var(--text-muted)'
                                }}
                              >
                                [{r.recipe_code}]
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: isUpdate ? '#fef3c7' : '#e0f2fe',
                                color: isUpdate ? '#92400e' : '#0369a1'
                              }}
                            >
                              {isUpdate ? 'Will Update Existing' : 'New Recipe'}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: 8,
                              fontSize: 13,
                              color: 'var(--text-muted)',
                              marginBottom: 10
                            }}
                          >
                            <div>
                              <strong>Yield:</strong> {r.target_yield_quantity} {r.yield_unit}
                            </div>
                            <div>
                              <strong>Output Item:</strong> {r.output_item_name}
                            </div>
                            {r.default_location_name && (
                              <div>
                                <strong>Location:</strong> {r.default_location_name}
                              </div>
                            )}
                            {r.prep_time_minutes !== undefined && (
                              <div>
                                <strong>Prep Time:</strong> {r.prep_time_minutes} min
                              </div>
                            )}
                          </div>

                          {/* Ingredients list breakdown */}
                          <div style={{ fontSize: 12 }}>
                            <strong style={{ color: 'var(--text)' }}>
                              Ingredients ({r.items.length}):
                            </strong>{' '}
                            {r.items.map((it, iIdx) => (
                              <span
                                key={iIdx}
                                style={{
                                  display: 'inline-block',
                                  background: '#fff',
                                  border: '1px solid var(--border)',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  margin: '2px 4px 2px 0'
                                }}
                              >
                                {it.item_name} ({it.quantity} {it.unit}
                                {it.waste_percentage > 0 ? `, ${it.waste_percentage}% waste` : ''})
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {parsedImport.recipes.length === 0 && parsedImport.errors.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>No production recipes found in the uploaded file.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                {importing && importProgress && (
                  <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)' }}>
                    <Loader2 className="spin" size={16} />
                    Importing {importProgress.current} of {importProgress.total}: {importProgress.currentRecipeName}…
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  style={button}
                  disabled={importing}
                  onClick={() => {
                    setImportModalOpen(false);
                    setParsedImport(null);
                  }}
                >
                  Cancel
                </button>
                {parsedImport.recipes.length > 0 && parsedImport.errors.length === 0 && (
                  <button
                    type="button"
                    style={primary}
                    disabled={importing}
                    onClick={handleConfirmImport}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="spin" size={16} /> Importing…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Confirm & Import {parsedImport.recipes.length} Recipe{parsedImport.recipes.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductionRecipeEditor({ canEdit = false }: { canEdit?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ProductionRecipeDraft>(emptyProductionRecipe);
  const [ingredients, setIngredients] = useState<ProductionIngredient[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<any[]>([]);
  const [allRecipes, setAllRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const [savedOutput, setSavedOutput] = useState('');
  const [revision, setRevision] = useState(0);
  const fingerprint = JSON.stringify([draft, ingredients]);
  const dirty = !!savedFingerprint && fingerprint !== savedFingerprint;
  const error = validateProductionRecipe(draft, ingredients, items, conversions, locations);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(''); setSaveError(''); setSuccess(''); setSavedFingerprint('');
    Promise.all([
      api.getInventoryItemsSimpleList(),
      api.getInventoryLocationsSimpleList(),
      api.getInventoryUnitConversions(),
      api.getAllItemPackagingOptions(),
      api.getProductionRecipeCatalog(),
      id ? api.getProductionRecipeForEdit(id) : Promise.resolve(null)
    ])
      .then(([inventory, locations, units, packRes, allRecsRes, recipe]) => {
        if (cancelled) return;
        for (const result of [inventory, locations, units]) if (result && !result.success) throw new Error(result.error || 'Could not load the production recipe.');
        setItems(inventory.data || []);
        setLocations(locations.data || []);
        setConversions(units.data || []);
        setPackagingOptions(packRes?.data || []);
        setAllRecipes(allRecsRes?.data || []);
        const data = recipe?.data;
        const next: ProductionRecipeDraft = data ? {
          recipe_code: data.recipe_code, name: data.name, output_item_id: data.output_item_id,
          target_yield_quantity: data.target_yield_quantity, yield_unit: data.yield_unit,
          default_location_id: data.default_location_id || '', shelf_life_days: data.shelf_life_days ?? '',
          prep_time_minutes: data.prep_time_minutes ?? '', instructions: data.instructions || ''
        } : emptyProductionRecipe();
        const rows: ProductionIngredient[] = (data?.items || []).map((r: any) => ({ item_id: r.item_id, quantity: r.quantity, unit: r.unit, waste_percentage: r.waste_percentage ?? 0, source_location_id: r.source_location_id || '', notes: r.notes || '' }));
        setDraft(next); setIngredients(rows); setSavedOutput(next.output_item_id); setSavedFingerprint(JSON.stringify([next, rows]));
      }).catch(e => { if (!cancelled) setLoadError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, revision]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const field = (name: keyof ProductionRecipeDraft, value: string) => { setDraft(prev => ({ ...prev, [name]: value })); setSuccess(''); };
  const updateIngredient = (index: number, name: keyof ProductionIngredient, value: string) => {
    setSuccess('');
    setIngredients(rows => rows.map((row, i) => i !== index ? row : { ...row, [name]: value,
      ...(name === 'item_id' ? { unit: items.find(item => item.id === value)?.preferred_recipe_unit || items.find(item => item.id === value)?.base_unit || items.find(item => item.id === value)?.unit || '', source_location_id: '' } : {}) }));
  };

  const ingredientCosts = useMemo(() => {
    return ingredients.map((row) => {
      const item = items.find(i => i.id === row.item_id);
      if (!item) {
        return {
          unitCost: 0,
          baseUnit: '',
          factor: 1,
          wasteFactor: 1,
          netBaseQty: 0,
          grossBaseQty: 0,
          lineCost: 0,
          isSubRecipe: false,
          recipeName: '',
          hasError: false,
          unpriced: false
        };
      }
      const effective = resolveItemEffectiveCost(item.id, items, allRecipes, conversions, packagingOptions);
      const baseUnit = item.base_unit || item.unit || row.unit || '';
      const factor = conversionFactor(item.id, row.unit, baseUnit, conversions, packagingOptions);
      const waste = Number(row.waste_percentage) || 0;
      const wasteFactor = (waste > 0 && waste < 100) ? 1 / (1 - waste / 100) : 1;
      const qty = Number(row.quantity) || 0;
      const validFactor = factor !== null ? factor : 0;
      const netBaseQty = qty * validFactor;
      const grossBaseQty = netBaseQty * wasteFactor;
      const lineCost = factor !== null ? grossBaseQty * effective.unitCost : 0;

      return {
        unitCost: effective.unitCost,
        baseUnit,
        factor,
        wasteFactor,
        netBaseQty,
        grossBaseQty,
        lineCost,
        isSubRecipe: effective.isFromProductionRecipe,
        recipeName: effective.recipeName,
        hasError: factor === null,
        unpriced: effective.unitCost <= 0
      };
    });
  }, [ingredients, items, allRecipes, conversions, packagingOptions]);

  const batchCostSummary = useMemo(() => {
    let totalBatchCost = 0;
    let unpricedCount = 0;
    let unitErrorCount = 0;

    ingredientCosts.forEach((c, idx) => {
      if (!ingredients[idx]?.item_id) return;
      totalBatchCost += c.lineCost;
      if (c.unpriced) unpricedCount++;
      if (c.hasError) unitErrorCount++;
    });

    const yieldQty = Number(draft.target_yield_quantity) || 0;
    const costPerYieldUnit = yieldQty > 0 ? totalBatchCost / yieldQty : 0;

    return {
      totalBatchCost,
      costPerYieldUnit,
      yieldQty,
      unpricedCount,
      unitErrorCount
    };
  }, [ingredientCosts, ingredients, draft.target_yield_quantity]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || saving || deleting || loading || loadError) return;
    setSaveError(''); setSuccess('');
    if (error) { setSaveError(error); return; }
    if (id && draft.output_item_id !== savedOutput && !window.confirm('Change the output inventory item? Existing menu BOMs will continue consuming their currently selected item. Review those BOMs separately.')) return;
    setSaving(true);
    try {
      const result = await api.upsertProductionRecipe({
        existing_recipe_id: id, recipe_code: draft.recipe_code.trim(), name: draft.name.trim(), output_item_id: draft.output_item_id,
        target_yield_quantity: Number(draft.target_yield_quantity), yield_unit: draft.yield_unit.trim(), default_location_id: draft.default_location_id || undefined,
        shelf_life_days: draft.shelf_life_days === '' ? undefined : Number(draft.shelf_life_days), prep_time_minutes: draft.prep_time_minutes === '' ? undefined : Number(draft.prep_time_minutes), instructions: draft.instructions,
        items: ingredients.map(row => ({ item_id: row.item_id, quantity: Number(row.quantity), unit: row.unit.trim(), waste_percentage: Number(row.waste_percentage), source_location_id: row.source_location_id || undefined, notes: row.notes })),
        user_name: JSON.parse(localStorage.getItem('neo_admin_user') || '{}').name || 'Admin'
      });
      if (!result?.success || !result.recipe_id) throw new Error(result?.error || 'The production recipe save was not confirmed.');
      setSavedFingerprint(fingerprint); setSavedOutput(draft.output_item_id);

      // Auto-sync calculated production cost into output item price
      try {
        const yieldQty = Number(draft.target_yield_quantity);
        if (yieldQty > 0 && batchCostSummary.totalBatchCost > 0 && draft.output_item_id) {
          const unitCost = Math.round((batchCostSummary.totalBatchCost / yieldQty) * 10000) / 10000;
          await api.updateItemPrice(draft.output_item_id, unitCost);
        }
      } catch (costErr) {
        console.warn('Could not auto-sync output item cost:', costErr);
      }

      if (!id) navigate(`/production-recipes/${result.recipe_id}`, { replace: true });
      else setSuccess('Production recipe saved. Stock and menu portion quantities have not changed.');
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Could not save production recipe. Your edits are still here.'); }
    finally { setSaving(false); }
  };
  const units = Array.from(new Set(['g','kg','ml','l','pcs', ...items.flatMap(i => [i.unit,i.base_unit]), ...conversions.flatMap(c => [c.from_unit,c.to_unit])])).filter(Boolean);
  if (loading) return <p role="status"><Loader2 className="spin" /> Loading production recipe…</p>;
  if (loadError) return <div role="alert" style={card}><p>{loadError}</p><button style={button} onClick={() => setRevision(n => n + 1)}>Retry</button> <Link to="/production-recipes">Back to Production Recipes</Link></div>;
  return <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div><button type="button" disabled={saving} style={button} onClick={() => { if (!dirty || window.confirm('Leave without saving your recipe changes?')) navigate('/production-recipes'); }}><ArrowLeft size={18} /> Production Recipes</button><h1>{id ? 'Edit Production Recipe' : 'New Production Recipe'}</h1><p>Define how the kitchen makes a batch. A separate production batch records actual stock movements.</p></div>
      {canEdit && id && <RecipeDeleteButton kind="production" recipeId={id} name={draft.name} disabled={saving || deleting} onBusyChange={setDeleting} onDeleted={() => navigate('/production-recipes', { replace: true })} />}
      {canEdit && <button type="submit" disabled={saving || deleting} style={primary}>{saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />} {saving ? 'Saving…' : 'Save Production Recipe'}</button>}
    </header>
    {!canEdit && <p role="status">You have read-only access to production recipes.</p>}
    {saveError && <div role="alert" style={{ ...card, color: '#b91c1c' }}>{saveError}</div>}
    {success && <div role="status" style={{ ...card, color: '#15803d' }}>{success}</div>}
    <fieldset disabled={saving || deleting || !canEdit} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section style={card}><h2 style={{ marginTop: 0 }}>Recipe & Batch Yield</h2><div style={grid}>
        <label style={label}>Recipe Name<input aria-label="Recipe Name" style={input} required value={draft.name} onChange={e => field('name',e.target.value)} /></label>
        <label style={label}>Recipe Code<input aria-label="Recipe Code" style={input} required readOnly={!!id} value={draft.recipe_code} onChange={e => field('recipe_code',e.target.value)} placeholder="e.g. PREP-CAESAR-01" /><small style={{ fontWeight: 400 }}>The code identifies this recipe and stays fixed after creation.</small></label>
        <label style={label}>Output Inventory Item<SearchableSelect aria-label="Output Inventory Item" style={input} required value={draft.output_item_id} onValueChange={value => { const item = items.find(i => i.id === value); setDraft(prev => ({...prev,output_item_id:value,yield_unit:item?.base_unit || item?.unit || ''})); setSuccess(''); }}><option value="">Select prepared stock item…</option>{items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.base_unit || i.unit})</option>)}</SearchableSelect></label>
        <label style={label}>Batch Yield Quantity<input aria-label="Batch Yield Quantity" style={input} type="number" step="any" min="0" required value={draft.target_yield_quantity} onChange={e => field('target_yield_quantity',e.target.value)} /></label>
        <label style={label}>Yield Unit<input aria-label="Yield Unit" style={input} list="production-units" required value={draft.yield_unit} onChange={e => field('yield_unit',e.target.value)} /></label>
        <label style={label}>Default Output Location<select style={input} value={draft.default_location_id} onChange={e => field('default_location_id',e.target.value)}><option value="">Choose when producing a batch</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label style={label}>Shelf Life (days)<input style={input} type="number" min="1" step="1" value={draft.shelf_life_days} onChange={e => field('shelf_life_days',e.target.value)} placeholder="Optional" /></label>
        <label style={label}>Preparation Time (minutes)<input style={input} type="number" min="0" step="1" value={draft.prep_time_minutes} onChange={e => field('prep_time_minutes',e.target.value)} placeholder="Optional" /></label>
      </div>
      <div style={{
        marginTop: 18,
        padding: 16,
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
              Total Batch Cost
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>
              ${batchCostSummary.totalBatchCost.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
              Cost Per Yield Unit
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f766e' }}>
              ${batchCostSummary.costPerYieldUnit.toFixed(4)}{' '}
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
                / {draft.yield_unit || 'unit'}
              </span>
            </div>
          </div>
        </div>
        {batchCostSummary.unpricedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', fontSize: 13, background: '#fef2f2', padding: '6px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
            <AlertTriangle size={16} />
            <span>{batchCostSummary.unpricedCount} ingredient{batchCostSummary.unpricedCount > 1 ? 's' : ''} unpriced ($0.00).</span>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>Use a prepared inventory item such as Caesar Sauce Prep as the output. No sellable menu product is required.</p>
      </section>
      <section style={card}><div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap' }}><div><h2 style={{ margin:0 }}>Ingredients for This Batch</h2><p>Enter the quantity of each inventory item needed for the batch yield above.</p></div><button style={button} type="button" onClick={() => {setSuccess('');setIngredients(rows => [...rows,{item_id:'',quantity:'',unit:'',waste_percentage:0,source_location_id:'',notes:''}]);}}><Plus size={18} /> Add Ingredient</button></div>
        {!ingredients.length && <p>No ingredients yet. Add the items used to make this recipe.</p>}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>{ingredients.map((row,index) => {
          const cost = ingredientCosts[index] || { unitCost: 0, baseUnit: '', factor: 1, wasteFactor: 1, netBaseQty: 0, grossBaseQty: 0, lineCost: 0, isSubRecipe: false, recipeName: '', hasError: false, unpriced: false };
          return (
            <div key={index} style={{border:'1px solid var(--border)',borderRadius:8,padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong>Ingredient {index+1}</strong>
                  {row.item_id && (
                    cost.hasError ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 600, border: '1px solid #fecaca' }}>
                        Conversion error
                      </span>
                    ) : cost.unpriced ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fffbeb', color: '#b45309', fontSize: 12, fontWeight: 600, border: '1px solid #fde68a' }}>
                        Unpriced ($0.00)
                      </span>
                    ) : null
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {row.item_id && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Amount</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: cost.lineCost > 0 ? '#0f766e' : '#64748b' }}>
                        ${cost.lineCost.toFixed(4)}
                      </div>
                    </div>
                  )}
                  <button type="button" aria-label={`Remove ingredient ${index+1}`} style={button} onClick={() => {setIngredients(rows => rows.filter((_,i)=>i!==index));setSuccess('');}}><Trash2 size={16} /></button>
                </div>
              </div>
              <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 2.5fr) minmax(75px, 0.8fr) minmax(80px, 0.9fr) minmax(75px, 0.8fr) minmax(95px, 1fr) minmax(130px, 1.4fr) minmax(140px, 1.6fr)',
                  gap: 10,
                  alignItems: 'start',
                  minWidth: 840
                }}>
                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Inventory Item
                    <SearchableSelect
                      aria-label={`Ingredient ${index+1} item`}
                      style={{ ...input, padding: '8px 10px', fontSize: 13 }}
                      required
                      value={row.item_id}
                      onValueChange={value => updateIngredient(index, 'item_id', value)}
                    >
                      <option value="">Select ingredient…</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id} disabled={i.id === draft.output_item_id}>
                          {i.name} ({i.base_unit || i.unit})
                        </option>
                      ))}
                    </SearchableSelect>
                  </label>

                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Quantity
                    <input
                      aria-label={`Ingredient ${index+1} quantity`}
                      style={{ ...input, padding: '8px 10px', fontSize: 13 }}
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={row.quantity}
                      onChange={e => updateIngredient(index, 'quantity', e.target.value)}
                    />
                  </label>

                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Unit
                    {(() => {
                      const itemMatch = items.find(i => i.id === row.item_id);
                      const convertible = itemMatch ? getConvertibleUnits(itemMatch, conversions, packagingOptions) : ['g', 'kg', 'ml', 'l', 'pcs'];
                      const baseUnit = itemMatch?.base_unit || itemMatch?.unit || row.unit;
                      const factor = itemMatch ? conversionFactor(itemMatch.id, row.unit, baseUnit, conversions, packagingOptions) : 1;
                      const preview = formatConversionPreview(Number(row.quantity), row.unit, baseUnit, factor);
                      return (
                        <div>
                          <select
                            aria-label={`Ingredient ${index+1} unit`}
                            style={{ ...input, padding: '8px 10px', fontSize: 13 }}
                            required
                            value={row.unit}
                            onChange={e => updateIngredient(index, 'unit', e.target.value)}
                          >
                            {convertible.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          {preview && (
                            <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {preview}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </label>

                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Waste (%)
                    <input
                      style={{ ...input, padding: '8px 10px', fontSize: 13 }}
                      type="number"
                      min="0"
                      max="99.999"
                      step="any"
                      value={row.waste_percentage}
                      onChange={e => updateIngredient(index, 'waste_percentage', e.target.value)}
                    />
                  </label>

                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Amount ($)
                    <div style={{
                      ...input,
                      padding: '8px 10px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      fontWeight: 700,
                      color: cost.lineCost > 0 ? '#0f766e' : 'var(--text-muted)',
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      minHeight: 37
                    }}>
                      ${cost.lineCost.toFixed(4)}
                    </div>
                  </label>

                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Source Location
                    <select
                      style={{ ...input, padding: '8px 10px', fontSize: 13 }}
                      value={row.source_location_id}
                      onChange={e => updateIngredient(index, 'source_location_id', e.target.value)}
                    >
                      <option value="">Default location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </label>

                  <label style={{ ...label, fontSize: 13, whiteSpace: 'nowrap' }}>
                    Ingredient Notes
                    <input
                      style={{ ...input, padding: '8px 10px', fontSize: 13 }}
                      placeholder="Optional notes"
                      value={row.notes}
                      onChange={e => updateIngredient(index, 'notes', e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {row.item_id && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: cost.unpriced ? '#fffbeb' : '#f8fafc',
                  borderRadius: 8,
                  border: `1px solid ${cost.unpriced ? '#fde68a' : '#e2e8f0'}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 13
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Cost Rate: </span>
                      <strong>${cost.unitCost.toFixed(4)} / {cost.baseUnit}</strong>
                      {cost.isSubRecipe && (
                        <span style={{ marginLeft: 6, fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                          Sub-Recipe ({cost.recipeName})
                        </span>
                      )}
                    </div>
                    {Number(row.quantity) > 0 && cost.factor !== null && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Net Base Qty: </span>
                        <span>{cost.netBaseQty >= 1 ? Number(cost.netBaseQty.toFixed(4)) : Number(cost.netBaseQty.toPrecision(3))} {cost.baseUnit}</span>
                      </div>
                    )}
                    {Number(row.waste_percentage) > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Gross Qty (+{row.waste_percentage}% waste): </span>
                        <span style={{ color: '#d97706', fontWeight: 600 }}>{((Number(row.quantity) || 0) * cost.wasteFactor).toFixed(3)} {row.unit}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Extended Cost:</span>
                    <strong style={{ fontSize: 15, color: cost.lineCost > 0 ? '#0f766e' : '#b91c1c' }}>
                      ${cost.lineCost.toFixed(4)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}</div>

        {ingredients.length > 0 && (
          <div style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>Batch Ingredients Summary</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {ingredients.filter(r => r.item_id).length} ingredient{ingredients.filter(r => r.item_id).length !== 1 ? 's' : ''} in recipe
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Cost for {draft.target_yield_quantity || '0'} {draft.yield_unit}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', textAlign: 'right' }}>
                  ${batchCostSummary.totalBatchCost.toFixed(2)}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cost Per {draft.yield_unit || 'Unit'}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f766e', textAlign: 'right' }}>
                  ${batchCostSummary.costPerYieldUnit.toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      <section style={card}><label style={label}>Preparation Instructions<textarea aria-label="Preparation Instructions" style={{...input,minHeight:160}} value={draft.instructions} onChange={e=>field('instructions',e.target.value)} placeholder="Describe how to prepare this batch…" /></label></section>
    </fieldset>
    <div style={{...card,background:'#f8fafc'}}><strong>{error ? 'Recipe needs attention' : dirty ? 'Unsaved changes' : 'Saved recipe'}</strong><p>{error || `Batch yield: ${draft.target_yield_quantity} ${draft.yield_unit} · Ingredients: ${ingredients.length}`}</p><p>Saving changes the production recipe only. A dish’s sauce portion, such as 80 g per salad, stays in that dish’s BOM.</p></div>
    <datalist id="production-units">{units.map(unit=><option key={unit} value={unit} />)}</datalist>
  </form>;
}
