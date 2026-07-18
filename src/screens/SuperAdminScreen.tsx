import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, X, Shield, Calendar, Compass, AlertCircle, FileSpreadsheet, Download, Upload, CheckCircle2, Trash2, Mail, AlertTriangle, Check, Edit } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  created_at: string;
  settings?: {
    enabled_sections: string[];
    is_vat_subscribed?: boolean;
    decryption_key?: string;
  };
}

const SECTIONS = [
  { key: 'orders', label: 'Branch Orders', desc: 'Branch supply orders and order workflows' },
  { key: 'client_orders', label: 'Client Orders', desc: 'B2B client orders, delivery reporting, and client database' },
  { key: 'reservations', label: 'Table Reservations', desc: 'Track table bookings and reservations log' },
  { key: 'checklists', label: 'Daily Checklists', desc: 'Complete daily checklist forms and review logs' },
  { key: 'tasks', label: 'Task Manager', desc: 'Assign and track completion of operational tasks' },
  { key: 'catalog', label: 'Item Catalog', desc: 'Primary database catalog of items and recipes' },
  { key: 'purchasing', label: 'Purchasing & Procurement', desc: 'Supplier order logs and invoice uploads' },
  { key: 'suppliers', label: 'Supplier Management', desc: 'Directories, delivery schedules, and contracts' },
  { key: 'price_intelligence', label: 'Supplier Price Intelligence', desc: 'Analyze supplier pricing, compare quotations, monitor price trends, evaluate performance, and get AI-powered recommendations' },
  { key: 'waste', label: 'Waste Management', desc: 'Log ingredient/dish waste and track loss metrics' },
  { key: 'missing_items', label: '86 Missing Items', desc: 'Realtime view and toggle of out-of-stock items' },
  { key: 'voids', label: 'Void Receipts', desc: 'Audit cashier voids and manager authorizations' },
  { key: 'employees', label: 'Employees', desc: 'Employee registry database, payroll details, and branches' },
  { key: 'attendance', label: 'Attendance (Punch Clock)', desc: 'Punch in/out tracking, shift logs, and timesheets' },
  { key: 'tips', label: 'Tips Config', desc: 'Define tips pools, share distribution rates, and collections' },
  { key: 'permissions', label: 'Security Matrix', desc: 'Configure role-based department and screen privileges' },
  { key: 'signin_logs', label: 'Sign-In Logs', desc: 'Audit user logins, timestamps, and locations' },
  { key: 'complaints', label: 'Client Complaints', desc: 'Log and track resolution of customer complaints' },
  { key: 'specials', label: 'Specials & Upsell', desc: 'Manage chef specials and promotional upsell items' },
  { key: 'finance', label: 'Financial Analytics', desc: 'Financial dashboard reports, payments, and credit transactions' },
  { key: 'branch_management', label: 'Branch Management', desc: 'Create, edit, and configure physical branch settings' },
  { key: 'news', label: 'News Management', desc: 'Publish internal announcement feeds and notification banners' },
  { key: 'sops', label: 'SOPs & Training', desc: 'Store standard operating procedures and kitchen training manuals' },
  { key: 'menu', label: 'Menu Manual', desc: 'Cook recipes, dish ingredients, and plating step guides' }
];

const allSectionKeys = SECTIONS.map(s => s.key);

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

  // Selected sections for new restaurant
  const [selectedSections, setSelectedSections] = useState<string[]>(allSectionKeys);
  const [rIsVatSubscribed, setRIsVatSubscribed] = useState(true);

  // Config modal states for existing restaurants
  const [configResto, setConfigResto] = useState<Restaurant | null>(null);
  const [configSections, setConfigSections] = useState<string[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [searchSectionQuery, setSearchSectionQuery] = useState('');

  // Delete restaurant modal states
  const [deleteModalResto, setDeleteModalResto] = useState<Restaurant | null>(null);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [deletingResto, setDeletingResto] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const [targetRecipientEmail, setTargetRecipientEmail] = useState('');

  // Edit restaurant modal states
  const [editModalResto, setEditModalResto] = useState<Restaurant | null>(null);
  const [editRName, setEditRName] = useState('');
  const [editRLogo, setEditRLogo] = useState('');
  const [editRColor, setEditRColor] = useState('#1e5c4f');
  const [editUId, setEditUId] = useState('');
  const [editUName, setEditUName] = useState('');
  const [editUEmail, setEditUEmail] = useState('');
  const [editUPin, setEditUPin] = useState('');
  const [editRIsVatSubscribed, setEditRIsVatSubscribed] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState('');

  const handleOpenDeleteModal = (r: Restaurant) => {
    setDeleteModalResto(r);
    setApprovalChecked(false);
    setEmailSent(false);
    setSendingEmail(false);
    setDeletingResto(false);
    setDeleteErr('');
    setTargetRecipientEmail('');
  };

  const handleSendApprovalEmail = async () => {
    if (!deleteModalResto) return;
    setSendingEmail(true);
    const res = await api.sendDeletionApprovalEmail(deleteModalResto.id, deleteModalResto.name);
    setSendingEmail(false);
    setEmailSent(true);

    const recipient = res.email || '';
    setTargetRecipientEmail(recipient);

    // Compose mailto link and open mail client
    const subject = encodeURIComponent(`URGENT: Approval Required for Deletion of ${deleteModalResto.name}`);
    const body = encodeURIComponent(`Hello,\n\nPlease confirm your formal approval to delete restaurant "${deleteModalResto.name}" and purge all related data from our web admin database.\n\nThank you,\nSuper Admin Team`);
    
    if (recipient) {
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
    } else {
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalResto || !approvalChecked) return;
    setDeletingResto(true);
    setDeleteErr('');
    const res = await api.deleteRestaurant(deleteModalResto.id);
    setDeletingResto(false);
    if (res.success) {
      setDeleteModalResto(null);
      loadRestaurants();
    } else {
      setDeleteErr(res.error || 'Failed to delete restaurant.');
    }
  };

  const handleOpenEditModal = async (r: Restaurant) => {
    setEditModalResto(r);
    setEditRName(r.name || '');
    setEditRLogo(r.logo_url || '');
    setEditRColor(r.primary_color || '#1e5c4f');
    setEditRIsVatSubscribed(r.settings?.is_vat_subscribed !== false);
    setEditUId('');
    setEditUName('');
    setEditUEmail('');
    setEditUPin('');
    setEditErr('');

    const res = await api.getTenantAdmin(r.id);
    if (res.success && res.data) {
      setEditUId(res.data.id || '');
      setEditUName(res.data.name || '');
      setEditUEmail(res.data.email || '');
      setEditUPin(res.data.pin || '');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalResto) return;
    if (!editRName.trim()) { setEditErr('Restaurant Name is required.'); return; }

    setSavingEdit(true);
    setEditErr('');

    const res = await api.updateRestaurantDetails(editModalResto.id, {
      name: editRName.trim(),
      logo_url: editRLogo.trim(),
      primary_color: editRColor,
      admin_id: editUId,
      admin_name: editUName.trim(),
      admin_email: editUEmail.trim().toLowerCase(),
      admin_pin: editUPin.trim()
    });

    if (res.success) {
      const newSettings = {
        ...(editModalResto.settings || {}),
        is_vat_subscribed: editRIsVatSubscribed
      };
      await api.updateRestaurantSettings(editModalResto.id, newSettings);
    }

    setSavingEdit(false);
    if (res.success) {
      setEditModalResto(null);
      loadRestaurants();
    } else {
      let errMsg = res.error || 'Failed to update restaurant details.';
      if (errMsg.includes('users_pin_resto_idx') || errMsg.includes('duplicate key') && errMsg.includes('pin')) {
        errMsg = 'This Mobile PIN is already in use by another user. Please choose a different PIN.';
      } else if (errMsg.includes('users_email_key') || errMsg.includes('duplicate key') && errMsg.includes('email')) {
        errMsg = 'This email address is already in use by another user. Please choose a different email.';
      }
      setEditErr(errMsg);
    }
  };

  const handleToggleSection = (key: string) => {
    setSelectedSections(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleToggleConfigSection = (key: string) => {
    setConfigSections(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleConfigureSections = (r: Restaurant) => {
    setConfigResto(r);
    const enabled = r.settings?.enabled_sections || allSectionKeys;
    setConfigSections(enabled);
    setSearchSectionQuery('');
  };

  const handleSaveConfig = async () => {
    if (!configResto) return;
    setSavingConfig(true);
    const newSettings = {
      ...(configResto.settings || {}),
      enabled_sections: configSections
    };
    const res = await api.updateRestaurantSettings(configResto.id, newSettings);
    setSavingConfig(false);
    if (res.success) {
      setConfigResto(null);
      loadRestaurants();
    } else {
      alert(res.error || 'Failed to update restaurant settings.');
    }
  };

  const [selectedRestoId, setSelectedRestoId] = useState('');
  const [selectedTable, setSelectedTable] = useState('items');

  const placeholderTemplates: Record<string, string> = {
    items: 'name,department,sub_department,unit,par_level,step,price_usd,vat,order,purchasing,delivery_time,inventory_location,supplier_id\n"Tomato Paste","Kitchen","Dry Goods","can",10,1,5.50,"no","yes","yes","2 days","Shelf A",""',
    suppliers: 'name,contact_name,phone,delivery_days,time_to_deliver,is_active\n"Fruit Supply Co.","John Doe","555-0199","Monday,Wednesday","2 days",true',
    clients: 'name,phone,company_name,email,address,location,notes\n"Jane Smith","555-0123","ABC Corp","jane@abc.com","123 Street","London","Regular customer"',
    menu_recipes: 'section_id,item_name,recipe_text,prep_time,plate_type,food_cost,selling_price,plating_instructions,hints,allergens,inhouse_image_url,delivery_image_url,is_production,preparation_steps,packaging_instructions,quality_standards\n1,"Pizza Margherita","Ingredients...","15 mins","Wood",2.50,12.00,"Instructions...","Hints","Gluten","","","true","Steps...","Packaging...","Standards"',
    checklists: 'name,branch,department,tasks,is_active\n"Morning Clean","All","Kitchen","Clean stoves,Check fridge temp",true',
    employees: 'first_name,last_name,position,branch,department,status,payment_method,date_started,picture_url,id_url,proof_residence_url,criminal_url,ketab_taeen_url,discharge_url,resignation_letter_url,is_app_user,production_access,salary,transportation,phone,emergency_contact,bank_account\n"David","Miller","Chef","All","Kitchen","Active","Cash","2026-01-15","","","","","","","",false,true,3000,200,"555-0188","555-0189",""'
  };
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

    if (res.success) {
      // Save settings containing the enabled sections
      const restoId = res.data;
      if (restoId) {
        const autoKey = `neo_sec_${restoId}_${Math.random().toString(36).substring(2, 10)}`;
        await api.updateRestaurantSettings(restoId, {
          enabled_sections: selectedSections,
          decryption_key: autoKey,
          is_vat_subscribed: rIsVatSubscribed
        });
      }

      setRName('');
      setRLogo('');
      setRColor('#1e5c4f');
      setUName('');
      setUEmail('');
      setUPassword('');
      setUPin('');
      setSelectedSections(allSectionKeys); // Reset to default all sections checked
      setRIsVatSubscribed(true);
      setShowModal(false);
      loadRestaurants();
    } else {
      setFormErr(res.error || 'Failed to create restaurant and admin.');
    }
    setSaving(false);
  };

  // --- CSV Template Download Helper ---
  const handleDownloadSample = () => {
    const templates: Record<string, string> = {
      items: `name,department,sub_department,unit,par_level,step,price_usd,vat,order,purchasing,delivery_time,inventory_location,supplier_id\n"Tomato Paste","Kitchen","Dry Goods","can",10,1,5.50,"no","yes","yes","2 days","Shelf A",""\n"Fresh Chicken Breast","Kitchen","Meat","kg",30,0.5,12.00,"yes","yes","yes","1 day","Cold Room",""`,
      suppliers: `name,contact_name,phone,delivery_days,time_to_deliver,is_active\n"Fruit Supply Co.","John Doe","555-0199","Monday,Wednesday","2 days",true\n"Global Seafoods","Alice Smith","555-0124","Tuesday","1 day",true`,
      clients: `name,phone,company_name,email,address,location,notes\n"Jane Smith","555-0123","ABC Corp","jane@abc.com","123 Street","London","Regular customer"`,
      menu_recipes: `section_id,item_name,recipe_text,prep_time,plate_type,food_cost,selling_price,plating_instructions,hints,allergens,inhouse_image_url,delivery_image_url,is_production,preparation_steps,packaging_instructions,quality_standards\n1,"Pizza Margherita","1. Roll dough\n2. Add sauce\n3. Bake","15 mins","Round Wood",2.50,12.00,"Serve hot on wooden board","Preheat oven","Gluten,Dairy","https://images.unsplash.com/...","https://images.unsplash.com/...",true,"Roll and stretch dough...","Box in recycled carton","Golden crust"`,
      checklists: `name,branch,department,tasks,is_active\n"Morning Clean","All","Kitchen","Clean stoves,Check fridge temp,Empty trash",true`,
      employees: `first_name,last_name,position,branch,department,status,payment_method,date_started,picture_url,id_url,proof_residence_url,criminal_url,ketab_taeen_url,discharge_url,resignation_letter_url,is_app_user,production_access,salary,transportation,phone,emergency_contact,bank_account\n"David","Miller","Chef","All","Kitchen","Active","Cash","2026-01-15","","","","","","","",false,true,3000,200,"555-0188","555-0189",""`
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
          if (['par_level', 'step', 'price_usd', 'food_cost', 'selling_price', 'salary', 'transportation', 'section_id'].includes(key)) {
            obj[key] = Number(val);
          } else if (['is_active', 'is_production', 'is_app_user', 'production_access'].includes(key)) {
            const lowerVal = val.toLowerCase().trim();
            obj[key] = (lowerVal === 'true' || lowerVal === 'yes' || lowerVal === 'y');
          } else if (key === 'vat') {
            const lowerVal = val.toLowerCase().trim();
            obj[key] = (lowerVal === 'yes' || lowerVal === 'true' || lowerVal === 'y') ? 'yes' : 'no';
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
          if (obj.inhouse_image_url && !obj.image_url) obj.image_url = obj.inhouse_image_url;
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

  const handleExportCSV = async () => {
    if (!selectedRestoId) {
      setImportError('Please select a restaurant to export data from.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const res = await api.getTableData(selectedTable, selectedRestoId);
      if (!res.success || !res.data) {
        setImportError(res.error || 'Failed to fetch table data for export.');
        setImporting(false);
        return;
      }

      const rowsData = res.data as any[];
      if (rowsData.length === 0) {
        setImportError(`No records found in table "${selectedTable}" for this restaurant.`);
        setImporting(false);
        return;
      }

      // Map of table to headers (in the exact column order matching templates)
      const tableHeaders: Record<string, string[]> = {
        items: ['name', 'department', 'sub_department', 'unit', 'par_level', 'step', 'price_usd', 'vat', 'order', 'purchasing', 'delivery_time', 'inventory_location', 'supplier_id'],
        suppliers: ['name', 'contact_name', 'phone', 'delivery_days', 'time_to_deliver', 'is_active'],
        clients: ['name', 'phone', 'company_name', 'email', 'address', 'location', 'notes'],
        menu_recipes: ['section_id', 'item_name', 'recipe_text', 'prep_time', 'plate_type', 'food_cost', 'selling_price', 'plating_instructions', 'hints', 'allergens', 'inhouse_image_url', 'delivery_image_url', 'is_production', 'preparation_steps', 'packaging_instructions', 'quality_standards'],
        checklists: ['name', 'branch', 'department', 'tasks', 'is_active'],
        employees: ['first_name', 'last_name', 'position', 'branch', 'department', 'status', 'payment_method', 'date_started', 'picture_url', 'id_url', 'proof_residence_url', 'criminal_url', 'ketab_taeen_url', 'discharge_url', 'resignation_letter_url', 'is_app_user', 'production_access', 'salary', 'transportation', 'phone', 'emergency_contact', 'bank_account']
      };

      const headers = tableHeaders[selectedTable] || Object.keys(rowsData[0]).filter(k => k !== 'id' && k !== 'restaurant_id' && k !== 'created_at' && k !== 'updated_at');

      // Generate CSV string
      const csvLines = [headers.join(',')];

      rowsData.forEach(row => {
        const lineValues = headers.map(header => {
          let val = row[header];
          if (val === undefined || val === null) return '""';

          // If tasks (in checklists), it is an array
          if (Array.isArray(val)) {
            val = val.join(', ');
          }

          // Format value: quote it if it contains double quotes, commas, or newlines
          let strVal = String(val);
          if (strVal.includes('"') || strVal.includes(',') || strVal.includes('\n') || strVal.includes('\r')) {
            strVal = strVal.replace(/"/g, '""');
            return `"${strVal}"`;
          }
          return `"${strVal}"`;
        });
        csvLines.push(lineValues.join(','));
      });

      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedTable}_export_${selectedRestoId.substring(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setImportSuccess(`Successfully exported ${rowsData.length} records from the "${selectedTable}" table.`);
    } catch (err: any) {
      setImportError(err.message || 'An error occurred during CSV export.');
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
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
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
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            style={{
                              background: '#fff',
                              border: '1px solid var(--border)',
                              color: 'var(--text-main)',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Edit size={13} /> Edit
                          </button>
                          <button
                            onClick={() => handleConfigureSections(r)}
                            style={{
                              background: 'none',
                              border: '1px solid var(--primary)',
                              color: 'var(--primary)',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ⚙️ Configure
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(r)}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fee2e2',
                              color: 'var(--danger)',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
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
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>CSV Templates & Database Actions</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Download a sample CSV template file or export existing table records to a CSV file.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDownloadSample}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <Download size={14} /> Download Sample CSV
              </button>
              <button
                onClick={handleExportCSV}
                disabled={importing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <Download size={14} /> Export Table Data (CSV)
              </button>
            </div>
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
              placeholder={placeholderTemplates[selectedTable] || ''}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="rIsVatSubscribed"
                    checked={rIsVatSubscribed}
                    onChange={e => setRIsVatSubscribed(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="rIsVatSubscribed" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                    VAT Subscribed (Default 11% VAT added to Supplier quotations in Price Intelligence)
                  </label>
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

              {/* SECTION C: Section Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>3. Enable Sections / Modules</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'gray' }}>Select modules to activate for this restaurant:</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedSections(allSectionKeys)}
                      style={{ background: '#f1f5f9', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSections([])}
                      style={{ background: '#f1f5f9', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Disable All
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {SECTIONS.map(s => (
                      <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' }}>
                        <input
                          type="checkbox"
                          checked={selectedSections.includes(s.key)}
                          onChange={() => handleToggleSection(s.key)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        {s.label}
                      </label>
                    ))}
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

      {/* Configuration Modal */}
      {configResto && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '90vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚙️ Configure Sections: {configResto.name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  Select which modules are accessible in the Web Admin and Mobile App for this tenant.
                </p>
              </div>
              <button onClick={() => setConfigResto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'gray' }}><X size={20} /></button>
            </div>

            {/* Quick Actions & Search */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConfigSections(allSectionKeys)}
                  style={{ background: '#fff', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  ✅ Enable All
                </button>
                <button
                  type="button"
                  onClick={() => setConfigSections([])}
                  style={{ background: '#fff', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  ❌ Disable All
                </button>
              </div>
              <input
                type="text"
                placeholder="Search modules..."
                value={searchSectionQuery}
                onChange={e => setSearchSectionQuery(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', outline: 'none', width: '200px' }}
              />
            </div>

            {/* Modal Body / Toggles */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {SECTIONS.filter(s => s.label.toLowerCase().includes(searchSectionQuery.toLowerCase()) || s.desc.toLowerCase().includes(searchSectionQuery.toLowerCase())).map(s => {
                  const isChecked = configSections.includes(s.key);
                  return (
                    <div
                      key={s.key}
                      onClick={() => handleToggleConfigSection(s.key)}
                      style={{
                        border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: isChecked ? '#f0fdf4' : '#fff',
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        boxShadow: isChecked ? '0 2px 4px rgba(22, 101, 52, 0.05)' : 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent div click
                        style={{ accentColor: 'var(--primary)', scale: '1.1' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>{s.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setConfigResto(null)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: savingConfig ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Restaurant & Data Modal */}
      {deleteModalResto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <AlertTriangle size={22} color="var(--danger)" /> Confirm Restaurant Deletion
              </h3>
              <button onClick={() => setDeleteModalResto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#991b1b', margin: 0, lineHeight: '18px' }}>
                <strong>WARNING:</strong> You are about to permanently delete <strong>{deleteModalResto.name}</strong> and purge ALL associated data (users, branches, catalog items, employee records, sales logs, and checklists).
              </p>
            </div>

            {deleteErr && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {deleteErr}
              </div>
            )}

            {/* Approval Verification & Request Notification Step */}
            <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Client Approval Verification</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '16px', marginBottom: '12px' }}>
                Have you received official client approval to delete all restaurant data? If not, click below to send an approval notification request email.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSendApprovalEmail}
                  disabled={sendingEmail}
                  style={{
                    padding: '8px 14px',
                    background: emailSent ? '#ecfdf5' : '#fff',
                    border: `1px solid ${emailSent ? '#10b981' : 'var(--border)'}`,
                    color: emailSent ? '#047857' : 'var(--text-main)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: sendingEmail ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {emailSent ? <Check size={14} color="#10b981" /> : <Mail size={14} />}
                  {sendingEmail ? 'Opening Email Client...' : emailSent ? 'Approval Email Composed' : 'Send Approval Email to Client'}
                </button>
                {targetRecipientEmail && (
                  <span style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                    Target: {targetRecipientEmail}
                  </span>
                )}
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '24px' }}>
              <input
                type="checkbox"
                checked={approvalChecked}
                onChange={(e) => setApprovalChecked(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: 'var(--danger)' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, lineHeight: '18px' }}>
                I confirm that written/email approval has been received from the client to delete this restaurant and purge all related data.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeleteModalResto(null)}
                style={{ padding: '10px 18px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!approvalChecked || deletingResto}
                style={{
                  padding: '10px 20px',
                  background: approvalChecked ? 'var(--danger)' : '#f87171',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: approvalChecked && !deletingResto ? 'pointer' : 'not-allowed',
                  opacity: approvalChecked ? 1 : 0.6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {deletingResto ? 'Deleting All Data...' : 'Delete All Restaurant Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Restaurant & Admin Modal */}
      {editModalResto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '540px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Edit size={20} color="var(--primary)" /> Edit Restaurant Details
              </h3>
              <button onClick={() => setEditModalResto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {editErr && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {editErr}
              </div>
            )}

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Restaurant Name *</label>
                  <input
                    type="text"
                    value={editRName}
                    onChange={e => setEditRName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Logo URL</label>
                  <input
                    type="text"
                    value={editRLogo}
                    onChange={e => setEditRLogo(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Theme Primary Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={editRColor}
                      onChange={e => setEditRColor(e.target.value)}
                      style={{ width: '40px', height: '38px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }}
                    />
                    <input
                      type="text"
                      value={editRColor}
                      onChange={e => setEditRColor(e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="editRIsVatSubscribed"
                    checked={editRIsVatSubscribed}
                    onChange={e => setEditRIsVatSubscribed(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="editRIsVatSubscribed" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                    VAT Subscribed (Default 11% VAT added to Supplier quotations in Price Intelligence)
                  </label>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={16} color="var(--primary)" /> Tenant Admin Account Credentials
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Admin Name</label>
                    <input
                      type="text"
                      value={editUName}
                      onChange={e => setEditUName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Admin Email</label>
                    <input
                      type="email"
                      value={editUEmail}
                      onChange={e => setEditUEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Mobile PIN</label>
                    <input
                      type="text"
                      value={editUPin}
                      onChange={e => setEditUPin(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalResto(null)}
                  style={{ padding: '10px 18px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{ padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: savingEdit ? 'wait' : 'pointer' }}
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Restaurant Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
