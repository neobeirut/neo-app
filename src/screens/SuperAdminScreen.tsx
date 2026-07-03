import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, X, Shield, Calendar, Compass, AlertCircle, FileSpreadsheet, Download, Upload, CheckCircle2 } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  created_at: string;
}

export default function SuperAdminScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Tab: 'restaurants' or 'importer'
  const [activeTab, setActiveTab] = useState<'restaurants' | 'importer'>('restaurants');

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'importer') {
      setActiveTab('importer');
    } else {
      setActiveTab('restaurants');
    }
  }, [location.search]);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Creation Fields
  const [rName, setRName] = useState('');
  const [rLogo, setRLogo] = useState('');
  const [rColor, setRColor] = useState('#1e5c4f');
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uPin, setUPin] = useState('');

  // Importer States
  const [selectedRestoId, setSelectedRestoId] = useState('');
  const [selectedTable, setSelectedTable] = useState('items');
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await api.getRestaurantsList();
    if (res.success && res.data) {
      setRestaurants(res.data);
      if (res.data.length > 0 && !selectedRestoId) {
        setSelectedRestoId(res.data[0].id);
      }
    } else {
      setErrorMsg(res.error || 'Failed to fetch restaurants.');
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName.trim()) { setFormErr('Restaurant name is required.'); return; }
    if (!uName.trim()) { setFormErr('Admin name is required.'); return; }
    if (!uEmail.trim()) { setFormErr('Admin email is required.'); return; }
    if (uPassword.length < 6) { setFormErr('Password must be at least 6 characters.'); return; }
    if (!uPin.trim()) { setFormErr('Admin PIN is required for Mobile App login.'); return; }

    setSaving(true);
    setFormErr('');

    const res = await api.createTenantAdmin({
      r_name: rName.trim(),
      r_logo: rLogo.trim() || 'https://app.neobeirut.com/logo-512x512.png',
      r_color: rColor,
      u_name: uName.trim(),
      u_email: uEmail.trim().toLowerCase(),
      u_password: uPassword,
      u_pin: uPin.trim(),
    });

    setSaving(false);
    if (res.success) {
      setRName('');
      setRLogo('');
      setRColor('#1e5c4f');
      setUName('');
      setUEmail('');
      setUPassword('');
      setUPin('');
      setShowModal(false);
      loadRestaurants();
    } else {
      setFormErr(res.error || 'Failed to create restaurant and admin.');
    }
  };

  // --- CSV Template Download Helper ---
  const handleDownloadSample = () => {
    const templates: Record<string, string> = {
      items: `name,department,sub_department,unit,par_level,price_usd\n"Tomato Paste","Kitchen","Dry Goods","can",10,5.50\n"Fresh Chicken Breast","Kitchen","Meat","kg",30,12.00`,
      suppliers: `name,contact_name,phone,delivery_days,time_to_deliver\n"Fruit Supply Co.","John Doe","555-0199","Monday,Wednesday","2 days"\n"Global Seafoods","Alice Smith","555-0124","Tuesday","1 day"`,
      clients: `name,phone,company_name,email,address,location,notes\n"Jane Smith","555-0123","ABC Corp","jane@abc.com","123 Street","London","Regular customer"`,
      menu_recipes: `item_name,recipe_text,plating_instructions,prep_time,allergens,food_cost,selling_price\n"Pizza Margherita","1. Roll dough\n2. Add sauce\n3. Bake","Serve hot on wooden board","15 mins","Gluten,Dairy",2.50,12.00`,
      checklists: `name,branch,department,tasks\n"Morning Clean","All","Kitchen","Clean stoves,Check fridge temp,Empty trash"`,
      employees: `first_name,last_name,position,branch,department,salary,transportation,phone,emergency_contact\n"David","Miller","Chef","All","Kitchen",3000,200,"555-0188","555-0189"`
    };

    const csvContent = templates[selectedTable] || '';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sample_${selectedTable}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CSV Parse Logic ---
  const handleCSVParse = (text: string) => {
    setCsvText(text);
    setImportSuccess('');
    setImportError('');

    if (!text.trim()) {
      setParsedData(null);
      return;
    }

    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      setParsedData(null);
      return;
    }

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    setParsedData({ headers, rows });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleCSVParse(text);
    };
    reader.readAsText(file);
  };

  // --- CSV Import Commit Logic ---
  const handleImportSubmit = async () => {
    if (!selectedRestoId) {
      setImportError('Please select a restaurant.');
      return;
    }
    if (!parsedData || parsedData.rows.length === 0) {
      setImportError('Please paste or upload some CSV data first.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const { headers, rows } = parsedData;

      // Transform array rows to database objects matching the schemas
      const dbRows = rows.map((row) => {
        const obj: Record<string, any> = { restaurant_id: selectedRestoId };

        headers.forEach((header, index) => {
          const val = row[index];
          if (val === undefined || val === '') return;

          const key = header.trim().toLowerCase();

          // Type conversions
          if (['par_level', 'price_usd', 'food_cost', 'selling_price', 'salary', 'transportation', 'section_id'].includes(key)) {
            obj[key] = Number(val);
          } else if (key === 'is_active') {
            obj[key] = val.toLowerCase() === 'true';
          } else if (key === 'tasks') {
            // Checklists tasks as JSONB array of strings
            obj[key] = val.split(',').map((t) => t.trim()).filter(Boolean);
          } else {
            obj[key] = val;
          }
        });

        // Additional business requirements
        if (selectedTable === 'menu_recipes') {
          if (!obj.section_id) obj.section_id = 1; // default fallback section
          if (!obj.recipe_text) obj.recipe_text = 'Check manual recipe steps.';
        }

        return obj;
      });

      const res = await api.importTableData(selectedTable, dbRows);

      if (res.success) {
        setImportSuccess(`Import completed successfully! Loaded ${dbRows.length} records into the "${selectedTable}" table.`);
        setCsvText('');
        setParsedData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setImportError(res.error || 'Failed to import records.');
      }
    } catch (err: any) {
      setImportError(err.message || 'An error occurred during data mapping.');
    } finally {
      setImporting(false);
    }
  };

  const filtered = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={28} color="var(--primary)" /> Super Admin Panel
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Provision and manage client restaurants, branding, and initialize operational database catalogs.
          </p>
        </div>
        
        {activeTab === 'restaurants' && (
          <button
            onClick={() => { setShowModal(true); setFormErr(''); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: 'var(--shadow)' }}
          >
            <Plus size={16} /> Create Restaurant
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('restaurants')}
          style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'restaurants' ? '2px solid var(--primary)' : 'none', color: activeTab === 'restaurants' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
        >
          🏨 Restaurants List
        </button>
        <button
          onClick={() => setActiveTab('importer')}
          style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'importer' ? '2px solid var(--primary)' : 'none', color: activeTab === 'importer' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
        >
          📥 CSV Data Importer
        </button>
      </div>

      {/* TAB A: RESTAURANTS LIST */}
      {activeTab === 'restaurants' && (
        <>
          {/* Search & Stats */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="gray" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="search-input"
                placeholder="Search restaurants by name or database UUID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 16px 12px 40px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>
              Total Restaurants: {restaurants.length}
            </div>
          </div>

          {errorMsg && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'gray' }}>
              <p>Loading active restaurants...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              <Compass size={40} style={{ marginBottom: '12px', color: 'var(--primary)' }} />
              <p style={{ fontWeight: 600 }}>No restaurants found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '16px 20px' }}>Logo</th>
                    <th style={{ padding: '16px 20px' }}>Restaurant Name</th>
                    <th style={{ padding: '16px 20px' }}>Database UUID</th>
                    <th style={{ padding: '16px 20px' }}>Primary Theme</th>
                    <th style={{ padding: '16px 20px' }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <img 
                          src={r.logo_url || 'https://app.neobeirut.com/logo-512x512.png'} 
                          alt="Logo" 
                          style={{ width: '36px', height: '36px', borderRadius: '6px', border: '1px solid var(--border)', objectFit: 'contain', background: '#f8fafc' }} 
                        />
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{r.name}</td>
                      <td style={{ padding: '16px 20px', color: 'gray', fontFamily: 'monospace', fontSize: '13px' }}>{r.id}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: r.primary_color || '#1e5c4f' }} />
                          {r.primary_color || '#1e5c4f'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                          <Calendar size={14} />
                          {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB B: CSV DATA IMPORTER */}
      {activeTab === 'importer' && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} color="var(--primary)" /> Tenant Catalog Initialize Tool
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
            Choose a target tenant restaurant and standard table schema, download our template, and upload or paste your CSV logs.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>1. Target Restaurant</label>
              <select
                value={selectedRestoId}
                onChange={(e) => setSelectedRestoId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff' }}
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.id.substring(0, 8)}...)</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>2. Destination Table</label>
              <select
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setParsedData(null);
                  setCsvText('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff' }}
              >
                <option value="items">Item Catalog (items)</option>
                <option value="suppliers">Suppliers List (suppliers)</option>
                <option value="clients">Clients List (clients)</option>
                <option value="menu_recipes">Menu Manual (menu_recipes)</option>
                <option value="checklists">Checklists Templates (checklists)</option>
                <option value="employees">Employees Registry (employees)</option>
              </select>
            </div>
          </div>

          {/* Template Actions */}
          <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Need to check CSV formatting requirements?</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Download a sample CSV file containing the expected header columns and correct format guide.</p>
            </div>
            <button
              onClick={handleDownloadSample}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <Download size={14} /> Download Sample CSV
            </button>
          </div>

          {/* Import Errors & Success alerts */}
          {importError && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <AlertCircle size={16} /> {importError}
            </div>
          )}
          {importSuccess && (
            <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <CheckCircle2 size={16} color="#059669" /> {importSuccess}
            </div>
          )}

          {/* Input Panel */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>3. CSV Input Source</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
              >
                <Upload size={14} /> Select CSV File
              </button>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: '13px', color: 'gray' }}>or paste raw CSV text directly in the box below:</span>
            </div>

            <textarea
              placeholder="name,department,sub_department,unit,par_level,price_usd&#10;&#34;Tomato Paste&#34;,&#34;Kitchen&#34;,&#34;Dry Goods&#34;,&#34;can&#34;,10,5.50"
              value={csvText}
              onChange={(e) => handleCSVParse(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', outline: 'none', resize: 'vertical' }}
            />
          </div>

          {/* Preview Panel */}
          {parsedData && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Previewing CSV Data Rows ({parsedData.rows.length} total rows)</h3>
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'auto', maxHeight: '240px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                    <tr>
                      {parsedData.headers.map((h, i) => (
                        <th key={i} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} style={{ borderBottom: '1px solid var(--border)' }}>
                        {row.map((val, cellIndex) => (
                          <td key={cellIndex} style={{ padding: '10px 12px', color: 'var(--text-main)' }}>{val}</td>
                        ))}
                      </tr>
                    ))}
                    {parsedData.rows.length > 5 && (
                      <tr>
                        <td colSpan={parsedData.headers.length} style={{ padding: '10px 12px', textAlign: 'center', color: 'gray', fontStyle: 'italic', background: '#f8fafc' }}>
                          ... and {parsedData.rows.length - 5} more rows.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <button
              onClick={handleImportSubmit}
              disabled={importing || !parsedData || parsedData.rows.length === 0}
              style={{ background: importing || !parsedData || parsedData.rows.length === 0 ? '#cbd5e1' : 'var(--primary)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '8px', cursor: importing || !parsedData || parsedData.rows.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {importing ? 'Importing...' : 'Confirm Data Import'}
            </button>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="var(--primary)" /> Provision New Restaurant
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'gray' }}><X size={20} /></button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formErr && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}

              {/* SECTION A: Restaurant Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>1. Restaurant Branding</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Restaurant Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rossi Pizzeria"
                      value={rName}
                      onChange={e => setRName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Theme Primary Color</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="color"
                        value={rColor}
                        onChange={e => setRColor(e.target.value)}
                        style={{ width: '42px', height: '42px', padding: 0, border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={rColor}
                        onChange={e => setRColor(e.target.value)}
                        placeholder="#1e5c4f"
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Logo Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={rLogo}
                    onChange={e => setRLogo(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* SECTION B: Admin User Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>2. Main Administrator Account</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Admin Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Rossi"
                      value={uName}
                      onChange={e => setUName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Email Address (Username)</label>
                    <input
                      type="email"
                      placeholder="e.g. john@rossipizzeria.com"
                      value={uEmail}
                      onChange={e => setUEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Portal Password</label>
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={uPassword}
                      onChange={e => setUPassword(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' }}>Mobile App PIN Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 5566 (Numeric)"
                      value={uPin}
                      onChange={e => setUPin(e.target.value)}
                      maxLength={8}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer / Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {saving ? 'Provisioning...' : 'Provision Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
