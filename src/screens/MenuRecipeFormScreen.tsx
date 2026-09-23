import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Save, Loader2, Upload, ChefHat, Plus, Trash2, CheckCircle, AlertTriangle, Layers, Settings } from 'lucide-react';

export default function MenuRecipeFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  // Form State
  const [itemName, setItemName] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [plateType, setPlateType] = useState('');
  const [foodCost, setFoodCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [platingInstructions, setPlatingInstructions] = useState('');
  const [hints, setHints] = useState('');
  const [allergens, setAllergens] = useState('');
  
  // Phase 2 BOM / Inventory Extensions
  const [productId, setProductId] = useState<number | ''>('');
  const [yieldQuantity, setYieldQuantity] = useState<number>(1.0);
  const [yieldUnit, setYieldUnit] = useState<string>('portion');
  const [bomStatus, setBomStatus] = useState<'DRAFT' | 'ACTIVE' | 'INACTIVE'>('DRAFT');
  const [components, setComponents] = useState<any[]>([]);

  // Dual Image
  const [inhouseImageUrl, setInhouseImageUrl] = useState('');
  const [deliveryImageUrl, setDeliveryImageUrl] = useState('');
  const [uploadingInhouse, setUploadingInhouse] = useState(false);
  const [uploadingDelivery, setUploadingDelivery] = useState(false);

  // Production & New Fields
  const [isProduction, setIsProduction] = useState(false);
  const [preparationSteps, setPreparationSteps] = useState('');
  const [packagingInstructions, setPackagingInstructions] = useState('');
  const [qualityStandards, setQualityStandards] = useState('');
  
  // Access Control
  const [accessDepartments, setAccessDepartments] = useState<string[]>(['All']);
  const [accessEmployees, setAccessEmployees] = useState<string[]>([]);
  const [referenceRecipes, setReferenceRecipes] = useState<any[]>([]);

  // Reference Data
  const [sections, setSections] = useState<any[]>([]);
  const [allRecipes, setAllRecipes] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [inventoryLocations, setInventoryLocations] = useState<any[]>([]);

  // Modifiers
  const [productCustomizations, setProductCustomizations] = useState<any[]>([]);
  const [selectedCustomizationId, setSelectedCustomizationId] = useState<number | null>(null);
  const [modifierEffects, setModifierEffects] = useState<any[]>([]);
  const [showModifierModal, setShowModifierModal] = useState(false);

  const handleInhouseImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingInhouse(true);
    const res = await api.uploadTrainingMedia(file);
    setUploadingInhouse(false);
    
    if (res.success && res.url) {
      setInhouseImageUrl(res.url);
    } else {
      alert(res.error || 'Failed to upload inhouse image.');
    }
  };

  const handleDeliveryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingDelivery(true);
    const res = await api.uploadTrainingMedia(file);
    setUploadingDelivery(false);
    
    if (res.success && res.url) {
      setDeliveryImageUrl(res.url);
    } else {
      alert(res.error || 'Failed to upload delivery image.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (productId) {
      api.getProductCustomizationsList(Number(productId)).then(res => {
        if (res.success) setProductCustomizations(res.data || []);
      });
    } else {
      setProductCustomizations([]);
    }
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [secRes, recRes, deptRes, empRes, prodRes, itemRes, locRes] = await Promise.all([
        api.getMenuSections(),
        api.getMenuRecipes(),
        api.getDepartmentsList(),
        api.getAllUsers(),
        api.getProductsSimpleList(),
        api.getInventoryItemsSimpleList(),
        api.getInventoryLocationsSimpleList()
      ]);

      if (secRes.success) setSections(secRes.data || []);
      if (recRes.success && recRes.data) setAllRecipes(recRes.data.filter((r: any) => r.id !== id));
      if (deptRes.success && deptRes.data) setAllDepartments([{name: 'All'}, ...deptRes.data]);
      if (empRes.success) setAllUsers(empRes.data || []);
      if (prodRes.success) setAllProducts(prodRes.data || []);
      if (itemRes.success) setRawItems(itemRes.data || []);
      if (locRes.success) setInventoryLocations(locRes.data || []);

      if (isEditing && id) {
        const res = await api.getMenuRecipeById(id);
        if (res.success && res.data) {
          const recipe = res.data;
          setItemName(recipe.item_name || '');
          setSectionId(recipe.section_id || '');
          setRecipeText(recipe.recipe_text || '');
          setPrepTime(recipe.prep_time || '');
          setPlateType(recipe.plate_type || '');
          setFoodCost(recipe.food_cost ? String(recipe.food_cost) : '');
          setSellingPrice(recipe.selling_price ? String(recipe.selling_price) : '');
          setPlatingInstructions(recipe.plating_instructions || '');
          setHints(recipe.hints || '');
          setAllergens(recipe.allergens || '');
          setInhouseImageUrl(recipe.inhouse_image_url || recipe.image_url || '');
          setDeliveryImageUrl(recipe.delivery_image_url || '');
          setIsProduction(recipe.is_production || false);
          setPreparationSteps(recipe.preparation_steps || '');
          setPackagingInstructions(recipe.packaging_instructions || '');
          setQualityStandards(recipe.quality_standards || '');
          setAccessDepartments(recipe.access_departments || ['All']);
          setAccessEmployees(recipe.access_employees || []);
          setReferenceRecipes(recipe.reference_recipes || []);

          // Phase 2 Fields
          if (recipe.product_id) setProductId(recipe.product_id);
          if (recipe.yield_quantity) setYieldQuantity(Number(recipe.yield_quantity));
          if (recipe.yield_unit) setYieldUnit(recipe.yield_unit);
          if (recipe.bom_status) setBomStatus(recipe.bom_status);

          // Load components
          const compRes = await api.getRecipeComponents(id);
          if (compRes.success && compRes.data) {
            setComponents(compRes.data);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Helper: compute ingredient cost
  const computeCost = (itemId: string, qty: number, unit: string) => {
    const item = rawItems.find(i => i.id === itemId);
    if (!item || !item.price_usd || !qty) return 0;
    const price = Number(item.price_usd);
    const u = (unit || '').toLowerCase().trim();
    const iu = (item.unit || '').toLowerCase().trim();
    if (u === iu) return qty * price;
    if (u === 'g' && (iu === 'kg' || iu === 'kilo')) return qty * (price / 1000);
    if (u === 'kg' && iu === 'g') return qty * price * 1000;
    if (u === 'ml' && (iu === 'l' || iu === 'litre' || iu === 'liter')) return qty * (price / 1000);
    if (u === 'l' && iu === 'ml') return qty * price * 1000;
    return qty * price;
  };

  // Total Calculated Food Cost from BOM
  const totalBomCost = useMemo(() => {
    let sum = 0;
    components.forEach(c => {
      sum += computeCost(c.item_id, Number(c.base_quantity) || 0, c.unit || 'g');
    });
    return Math.round(sum * 1000) / 1000;
  }, [components, rawItems]);

  const handleAddIngredient = () => {
    if (rawItems.length === 0) return;
    const firstItem = rawItems[0];
    const defaultUnit = firstItem.base_unit || firstItem.unit || 'g';
    setComponents([
      ...components,
      {
        item_id: firstItem.id,
        base_quantity: 100,
        unit: defaultUnit,
        location_id: firstItem.default_inventory_location_id || '',
        waste_percentage: 0,
        notes: ''
      }
    ]);
  };

  const handleUpdateComponent = (index: number, field: string, val: any) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: val };
    if (field === 'item_id') {
      const match = rawItems.find(i => i.id === val);
      if (match) {
        updated[index].unit = match.base_unit || match.unit || updated[index].unit;
        if (match.default_inventory_location_id) {
          updated[index].location_id = match.default_inventory_location_id;
        }
      }
    }
    setComponents(updated);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleActivateBOM = async () => {
    if (!id) {
      alert('Please save the recipe first before activating BOM.');
      return;
    }
    if (!productId) {
      alert('Please select a linked Menu Product to activate this BOM.');
      return;
    }
    if (components.length === 0) {
      alert('BOM must have at least one ingredient component before activation.');
      return;
    }

    setActivating(true);
    // Save components first
    await api.saveRecipeComponents(id, components);
    const actRes = await api.activateMenuRecipe(id);
    setActivating(false);

    if (actRes.success) {
      setBomStatus('ACTIVE');
      alert('BOM successfully activated! Any previous active BOM for this product has been atomically set to INACTIVE.');
    } else {
      alert(actRes.error || 'Failed to activate BOM.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !sectionId) {
      alert('Item Name and Menu Section are required.');
      return;
    }

    setSaving(true);
    const user = JSON.parse(localStorage.getItem('neo_admin_user') || '{}');
    
    // Auto-populate recipeText from components if empty
    let finalRecipeText = recipeText;
    if (!finalRecipeText && components.length > 0) {
      finalRecipeText = components.map(c => {
        const item = rawItems.find(i => i.id === c.item_id);
        return `${item?.name || 'Item'}: ${c.base_quantity} ${c.unit}`;
      }).join('\n');
      setRecipeText(finalRecipeText);
    }

    const payload = {
      id: isEditing ? id : undefined,
      section_id: sectionId,
      item_name: itemName,
      recipe_text: finalRecipeText || 'Recipe details in BOM',
      prep_time: prepTime,
      plate_type: plateType,
      food_cost: foodCost ? Number(foodCost) : (totalBomCost > 0 ? totalBomCost : null),
      selling_price: sellingPrice ? Number(sellingPrice) : null,
      plating_instructions: platingInstructions,
      hints: hints,
      allergens: allergens,
      inhouse_image_url: inhouseImageUrl,
      image_url: inhouseImageUrl,
      delivery_image_url: deliveryImageUrl,
      is_production: isProduction,
      preparation_steps: preparationSteps,
      packaging_instructions: packagingInstructions,
      quality_standards: qualityStandards,
      access_departments: accessDepartments,
      access_employees: accessEmployees,
      reference_recipes: referenceRecipes,
      product_id: productId ? Number(productId) : null,
      yield_quantity: Number(yieldQuantity) || 1.0,
      yield_unit: yieldUnit || 'portion',
      bom_status: bomStatus || 'DRAFT',
      updated_by: user.name,
      ...(isEditing ? {} : { created_by: user.name })
    };

    const res = await api.saveMenuRecipe(payload);
    if (res.success) {
      const targetId = id || res.data?.id;
      if (targetId && components.length >= 0) {
        await api.saveRecipeComponents(targetId, components);
      }
      setSaving(false);
      navigate('/menu');
    } else {
      setSaving(false);
      alert(res.error || 'Failed to save recipe.');
    }
  };

  const addRef = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const match = allRecipes.find(r => r.id === val);
    if (match && !referenceRecipes.find(r => r.id === val)) {
      setReferenceRecipes([...referenceRecipes, { id: match.id, name: match.item_name }]);
    }
    e.target.value = '';
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/menu')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ChefHat size={28} style={{ color: 'var(--primary)' }} /> {isEditing ? 'Edit Recipe & BOM' : 'New Recipe & BOM'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              {isEditing ? 'Manage bill of materials, raw ingredients, costs, and atomic activation.' : 'Create a new recipe with structured components and inventory consumption.'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {bomStatus === 'ACTIVE' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#15803d', padding: '8px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '14px' }}>
              <CheckCircle size={18} /> ACTIVE BOM
            </div>
          ) : (
            <button
              type="button"
              onClick={handleActivateBOM}
              disabled={activating || !id}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: id ? 'pointer' : 'not-allowed', opacity: id ? 1 : 0.6 }}
              title={!id ? 'Save recipe first before activating' : 'Activate this BOM for sales consumption'}
            >
              {activating ? <Loader2 size={16} className="spin" /> : <Layers size={16} />} Activate BOM
            </button>
          )}

          <button 
            type="button"
            onClick={handleSave} 
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />} Save Recipe
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr)', gap: '24px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Basic Information */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Basic Information</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Item Name *</label>
                <input style={inputStyle} value={itemName} onChange={e => setItemName(e.target.value)} required placeholder="e.g. Caesar Salad" />
              </div>
              <div>
                <label style={labelStyle}>Menu Section *</label>
                <select style={inputStyle} value={sectionId} onChange={e => setSectionId(e.target.value)} required>
                  <option value="">Select Section...</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Product Link & BOM Config */}
            <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '15px' }}>Linked Menu Product (ERP / Sales Engine)</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: bomStatus === 'ACTIVE' ? '#15803d' : '#b45309' }}>
                  Status: {bomStatus}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ ...labelStyle, color: '#0284c7' }}>Select Product *</label>
                  <select 
                    style={inputStyle} 
                    value={productId} 
                    onChange={e => setProductId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">-- No Linked Product --</option>
                    {allProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (#{p.id}) - Mode: {p.inventory_mode || 'NONE'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: '#0284c7' }}>Yield Quantity</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    style={inputStyle} 
                    value={yieldQuantity} 
                    onChange={e => setYieldQuantity(Number(e.target.value) || 1)} 
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: '#0284c7' }}>Yield Unit</label>
                  <select style={inputStyle} value={yieldUnit} onChange={e => setYieldUnit(e.target.value)}>
                    <option value="portion">portion</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">L</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Structured Bill of Materials (BOM) */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Structured Recipe BOM (Raw Ingredients)</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Ingredients deducted from raw stock upon sale. Semi-finished components consume directly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddIngredient}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={16} /> Add Ingredient
              </button>
            </div>

            {components.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>No BOM ingredients added yet. Click &quot;Add Ingredient&quot; above to build the recipe.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>Raw Material</th>
                      <th style={{ padding: '8px', width: '100px' }}>Quantity</th>
                      <th style={{ padding: '8px', width: '100px' }}>Unit</th>
                      <th style={{ padding: '8px' }}>Location Override</th>
                      <th style={{ padding: '8px', width: '110px' }}>Est. Cost ($)</th>
                      <th style={{ padding: '8px', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((comp, idx) => {
                      const item = rawItems.find(i => i.id === comp.item_id);
                      const cost = computeCost(comp.item_id, Number(comp.base_quantity) || 0, comp.unit || 'g');
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px' }}>
                            <select 
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.item_id}
                              onChange={e => handleUpdateComponent(idx, 'item_id', e.target.value)}
                            >
                              {rawItems.map(it => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.unit}) {it.price_usd ? `- $${it.price_usd}/${it.unit}` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="number"
                              step="0.01"
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.base_quantity}
                              onChange={e => handleUpdateComponent(idx, 'base_quantity', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select 
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.unit}
                              onChange={e => handleUpdateComponent(idx, 'unit', e.target.value)}
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="l">L</option>
                              <option value="pcs">pcs</option>
                              <option value="portion">portion</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select 
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.location_id || ''}
                              onChange={e => handleUpdateComponent(idx, 'location_id', e.target.value)}
                            >
                              <option value="">Default Location</option>
                              {inventoryLocations.map(loc => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.department})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px', fontWeight: 600 }}>
                            ${cost.toFixed(3)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Total BOM Summary */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Total Calculated BOM Cost:</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>${totalBomCost.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setFoodCost(String(totalBomCost))}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Sync to Food Cost
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Costing & Text Instructions */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Menu & Costing Details</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div><label style={labelStyle}>Prep Time</label><input style={inputStyle} value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="e.g. 10 mins" /></div>
              <div><label style={labelStyle}>Plate / Glassware</label><input style={inputStyle} value={plateType} onChange={e => setPlateType(e.target.value)} placeholder="e.g. Deep Bowl" /></div>
              <div><label style={labelStyle}>Food Cost ($)</label><input type="number" step="0.01" style={inputStyle} value={foodCost} onChange={e => setFoodCost(e.target.value)} /></div>
              <div><label style={labelStyle}>Selling Price ($)</label><input type="number" step="0.01" style={inputStyle} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} /></div>
            </div>

            <div>
              <label style={labelStyle}>Ingredients Text (Kitchen Display / Manual)</label>
              <textarea style={{ ...inputStyle, height: '90px' }} value={recipeText} onChange={e => setRecipeText(e.target.value)} placeholder="Text summary of ingredients for kitchen manual..." />
            </div>

            <div>
              <label style={labelStyle}>Preparation Steps</label>
              <textarea style={{ ...inputStyle, height: '90px' }} value={preparationSteps} onChange={e => setPreparationSteps(e.target.value)} placeholder="Step 1: Prep lettuce. Step 2: Toss dressing..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Plating Instructions (Dine-in)</label>
                <textarea style={{ ...inputStyle, height: '80px' }} value={platingInstructions} onChange={e => setPlatingInstructions(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Packaging Instructions (Delivery)</label>
                <textarea style={{ ...inputStyle, height: '80px' }} value={packagingInstructions} onChange={e => setPackagingInstructions(e.target.value)} />
              </div>
            </div>
          </div>

        </form>

        {/* Right Sidebar: Media & Production Access */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Images Section */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>Images</h3>
            
            <label style={labelStyle}>Inhouse Image</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={inhouseImageUrl} onChange={e => setInhouseImageUrl(e.target.value)} placeholder="Image URL or upload..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                {uploadingInhouse ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInhouseImageUpload} disabled={uploadingInhouse} />
              </label>
            </div>
            {inhouseImageUrl && <img src={inhouseImageUrl} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} alt="Inhouse" />}
            
            <label style={labelStyle}>Delivery Image</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={deliveryImageUrl} onChange={e => setDeliveryImageUrl(e.target.value)} placeholder="Image URL or upload..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                {uploadingDelivery ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDeliveryImageUpload} disabled={uploadingDelivery} />
              </label>
            </div>
            {deliveryImageUrl && <img src={deliveryImageUrl} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} alt="Delivery" />}
          </div>

          {/* Reference Recipes */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>Reference Recipes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {referenceRecipes.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#eef2f5', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--primary)' }}>🔗 {r.name}</span>
                  <button type="button" onClick={() => setReferenceRecipes(referenceRecipes.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              ))}
            </div>
            <select style={inputStyle} onChange={addRef} value="">
              <option value="">+ Add Reference Recipe...</option>
              {allRecipes.map(r => <option key={r.id} value={r.id}>{r.item_name}</option>)}
            </select>
          </div>

          {/* Bottom Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={() => navigate('/menu')}
              style={{ padding: '12px 24px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSave} 
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}
            >
              {saving ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
              Save Recipe
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit', backgroundColor: '#fff' };
