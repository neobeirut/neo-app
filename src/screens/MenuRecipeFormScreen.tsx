import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Save, Loader2, Upload, ChefHat } from 'lucide-react';

export default function MenuRecipeFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  
  // Dual Image
  const [inhouseImageUrl, setInhouseImageUrl] = useState('');
  const [deliveryImageUrl, setDeliveryImageUrl] = useState('');
  const [uploadingInhouse, setUploadingInhouse] = useState(false);
  const [uploadingDelivery, setUploadingDelivery] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [secRes, recRes, deptRes, empRes] = await Promise.all([
        api.getMenuSections(),
        api.getMenuRecipes(),
        api.getDepartmentsList(),
        api.getAllUsers()
      ]);

      if (secRes.success) setSections(secRes.data || []);
      if (recRes.success && recRes.data) setAllRecipes(recRes.data.filter((r: any) => r.id !== id));
      if (deptRes.success && deptRes.data) setAllDepartments([{name: 'All'}, ...deptRes.data]);
      if (empRes.success) setAllUsers(empRes.data || []);

      if (isEditing && id) {
        const res = await api.getMenuRecipeById(id);
        if (res.success && res.data) {
          const recipe = res.data;
          setItemName(recipe.item_name || '');
          setSectionId(recipe.section_id || '');
          setRecipeText(recipe.recipe_text || '');
          setPrepTime(recipe.prep_time || '');
          setPlateType(recipe.plate_type || '');
          setFoodCost(recipe.food_cost || '');
          setSellingPrice(recipe.selling_price || '');
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
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !sectionId || !recipeText) {
      alert('Item Name, Section, and Ingredients are required.');
      return;
    }

    setSaving(true);
    const user = JSON.parse(localStorage.getItem('neo_admin_user') || '{}');
    
    const payload = {
      id: isEditing ? id : undefined,
      section_id: sectionId,
      item_name: itemName,
      recipe_text: recipeText,
      prep_time: prepTime,
      plate_type: plateType,
      food_cost: foodCost ? Number(foodCost) : null,
      selling_price: sellingPrice ? Number(sellingPrice) : null,
      plating_instructions: platingInstructions,
      hints: hints,
      allergens: allergens,
      inhouse_image_url: inhouseImageUrl,
      image_url: inhouseImageUrl, // fallback
      delivery_image_url: deliveryImageUrl,
      is_production: isProduction,
      preparation_steps: preparationSteps,
      packaging_instructions: packagingInstructions,
      quality_standards: qualityStandards,
      access_departments: accessDepartments,
      access_employees: accessEmployees,
      reference_recipes: referenceRecipes,
      updated_by: user.name,
      ...(isEditing ? {} : { created_by: user.name })
    };

    const res = await api.saveMenuRecipe(payload);
    setSaving(false);
    if (res.success) {
      navigate('/menu');
    } else {
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
    e.target.value = ''; // reset
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
              <ChefHat size={28} style={{ color: 'var(--primary)' }} /> {isEditing ? 'Edit Recipe' : 'New Recipe'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              {isEditing ? 'Update ingredients, preparation steps, and plating images.' : 'Create a new recipe with preparation details and instructions.'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
          Save Recipe
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Item Name *</label>
              <input style={inputStyle} value={itemName} onChange={e => setItemName(e.target.value)} required placeholder="e.g., Caesar Salad" />
            </div>
            <div>
              <label style={labelStyle}>Menu Section *</label>
              <select style={inputStyle} value={sectionId} onChange={e => setSectionId(e.target.value)} required>
                <option value="">Select Section...</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: isProduction ? '#e9f5e9' : 'var(--background)', borderRadius: 'var(--radius)', border: `1px solid ${isProduction ? '#c8e6c9' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: isProduction ? '#2e7d32' : 'var(--text-main)' }}>Is Production Recipe?</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hides from main manual and protects formula.</div>
            </div>
            <input type="checkbox" checked={isProduction} onChange={e => setIsProduction(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          </div>

          {isProduction && (
            <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h4 style={{ marginBottom: '12px', color: '#495057' }}>Production Access Control</h4>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Allowed Departments</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {accessDepartments.map(d => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e2e3e5', padding: '4px 8px', borderRadius: '16px', fontSize: '14px' }}>
                      {d}
                      <button type="button" onClick={() => setAccessDepartments(accessDepartments.filter(x => x !== d))} style={{ background: 'none', border: 'none', color: 'var(--danger)', marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </div>
                  ))}
                </div>
                <select style={inputStyle} onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val === 'All') setAccessDepartments(['All']);
                  else if (!accessDepartments.includes(val)) setAccessDepartments([...accessDepartments.filter(d => d !== 'All'), val]);
                  e.target.value = '';
                }}>
                  <option value="">+ Add Department...</option>
                  {allDepartments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Allowed Employees (Exceptions)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {accessEmployees.map(emp => (
                    <div key={emp} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e2e3e5', padding: '4px 8px', borderRadius: '16px', fontSize: '14px' }}>
                      {emp}
                      <button type="button" onClick={() => setAccessEmployees(accessEmployees.filter(x => x !== emp))} style={{ background: 'none', border: 'none', color: 'var(--danger)', marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </div>
                  ))}
                </div>
                <select style={inputStyle} onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (!accessEmployees.includes(val)) setAccessEmployees([...accessEmployees, val]);
                  e.target.value = '';
                }}>
                  <option value="">+ Add Employee...</option>
                  {allUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelStyle}>Prep Time</label><input style={inputStyle} value={prepTime} onChange={e => setPrepTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Plate / Glassware</label><input style={inputStyle} value={plateType} onChange={e => setPlateType(e.target.value)} /></div>
            <div><label style={labelStyle}>Food Cost ($)</label><input type="number" step="0.01" style={inputStyle} value={foodCost} onChange={e => setFoodCost(e.target.value)} /></div>
            <div><label style={labelStyle}>Selling Price ($)</label><input type="number" step="0.01" style={inputStyle} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} /></div>
          </div>

          <div>
            <label style={labelStyle}>Ingredients & Quantities *</label>
            <textarea style={{...inputStyle, height: '120px'}} value={recipeText} onChange={e => setRecipeText(e.target.value)} required />
          </div>

          <div>
            <label style={labelStyle}>Preparation Steps</label>
            <textarea style={{...inputStyle, height: '100px'}} value={preparationSteps} onChange={e => setPreparationSteps(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Plating Instructions (Inhouse)</label>
              <textarea style={{...inputStyle, height: '100px'}} value={platingInstructions} onChange={e => setPlatingInstructions(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Packaging Instructions (Delivery)</label>
              <textarea style={{...inputStyle, height: '100px'}} value={packagingInstructions} onChange={e => setPackagingInstructions(e.target.value)} />
            </div>
          </div>

        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Images Section */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Images</h3>
            
            <label style={labelStyle}>Inhouse Image</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{...inputStyle, flex: 1}} value={inhouseImageUrl} onChange={e => setInhouseImageUrl(e.target.value)} placeholder="Image URL or upload..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                {uploadingInhouse ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInhouseImageUpload} disabled={uploadingInhouse} />
              </label>
            </div>
            {inhouseImageUrl && <img src={inhouseImageUrl} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} alt="Inhouse" />}
            
            <label style={labelStyle}>Delivery Image</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{...inputStyle, flex: 1}} value={deliveryImageUrl} onChange={e => setDeliveryImageUrl(e.target.value)} placeholder="Image URL or upload..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                {uploadingDelivery ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDeliveryImageUpload} disabled={uploadingDelivery} />
              </label>
            </div>
            {deliveryImageUrl && <img src={deliveryImageUrl} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} alt="Delivery" />}
          </div>

          {/* Linked Recipes */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Reference Recipes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {referenceRecipes.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#eef2f5', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--primary)' }}>🔗 {r.name}</span>
                  <button type="button" onClick={() => setReferenceRecipes(referenceRecipes.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              ))}
            </div>
            <select style={inputStyle} onChange={addRef} value="">
              <option value="">+ Add Reference Recipe...</option>
              {allRecipes.map(r => <option key={r.id} value={r.id}>{r.item_name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'inherit' };
