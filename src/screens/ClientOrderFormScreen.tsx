import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Paperclip, 
  CheckSquare, 
  Search, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

const STANDARD_TASKS = [
  'Call Client',
  'Send Quotation',
  'Quotation Confirmed',
  'Order Delivered',
  'Collect Payment'
];

export default function ClientOrderFormScreen({ user, permissions }: { user: any; permissions: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Client autocomplete & state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  
  // Client database details to submit/save
  const [clientForm, setClientForm] = useState({
    id: '',
    name: '',
    company_name: '',
    phone: '',
    email: '',
    address: '',
    location: '',
    notes: ''
  });

  // Client History Stats
  const [clientHistory, setClientHistory] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    lastOrderDate: 'None',
    avgOrderValue: 0,
    openOpportunities: 0,
    favoriteProducts: 'None'
  });

  // Order Details
  const [orderForm, setOrderForm] = useState({
    id: '',
    order_date: new Date().toISOString().split('T')[0],
    event_date: '',
    event_time: '',
    event_name: '',
    event_location: '',
    num_guests: '',
    budget: '',
    special_requirements: '',
    branch: user.branch || 'Downtown',
    salesperson: user.name,
    category: 'Lunch',
    status: 'Inquiry',
    notes: '',
    subtotal: 0,
    discount: 0,
    discount_type: 'USD',
    discount_value: 0,
    vat: 0,
    grand_total: 0,
    updated_by: ''
  });

  // Items List
  const [items, setItems] = useState<any[]>([]);

  // Tasks List
  const [tasks, setTasks] = useState<any[]>([]);

  // Attachments List
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Static list of system users for task assignments
  const [systemUsers, setSystemUsers] = useState<string[]>([user.name]);

  // Settings & Autocomplete options
  const [branches, setBranches] = useState<string[]>([]);
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const [vatRate, setVatRate] = useState<number>(11);

  useEffect(() => {
    loadSystemUsers();
    loadBranches();
    loadItemSuggestions();
    loadVatRate();
    if (isEdit) {
      loadOrderDetails();
    } else {
      // Auto-generate Order ID
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const generatedId = `ORD-${yy}${mm}${dd}-${randomPart}`;
      setOrderForm(prev => ({ ...prev, id: generatedId }));
    }
  }, [id]);

  useEffect(() => {
    if (clientForm.id) {
      fetchClientHistory(clientForm.id);
    } else {
      setClientHistory({
        totalOrders: 0,
        totalRevenue: 0,
        lastOrderDate: 'None',
        avgOrderValue: 0,
        openOpportunities: 0,
        favoriteProducts: 'None'
      });
    }
  }, [clientForm.id]);

  const loadBranches = async () => {
    try {
      const res = await api.getBranchesList();
      if (res.success && res.data) {
        setBranches(res.data.map((b: any) => b.name));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadItemSuggestions = async () => {
    try {
      const [catRes, recRes] = await Promise.all([
        api.getAllCatalogItems(),
        api.getMenuRecipes()
      ]);
      const names = new Set<string>();
      if (catRes.success && catRes.data) {
        catRes.data.forEach((item: any) => names.add(item.name));
      }
      if (recRes.success && recRes.data) {
        recRes.data.forEach((recipe: any) => names.add(recipe.item_name));
      }
      setItemSuggestions(Array.from(names).sort());
    } catch (e) {
      console.error(e);
    }
  };

  const loadVatRate = async () => {
    try {
      const res = await api.getVatRate();
      if (res.success && res.rate !== undefined) {
        setVatRate(res.rate);
      }
    } catch (e) {
      console.error(e);
    }
  };



  const loadSystemUsers = async () => {
    try {
      const res = await api.getAllUsers();
      if (res.success && res.data) {
        const names = res.data.map((u: any) => u.name).filter(Boolean);
        setSystemUsers(names);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const res = await api.getClientOrderDetails(id!);
      if (res.success && res.data) {
        const { order, items: fetchedItems, tasks: fetchedTasks, attachments: fetchedAttachments } = res.data;
        
        // Ownership check: Staff can only edit their own orders or orders from their branch
        const isCreator = order.salesperson === user.name;
        const isSameBranch = user.branch && order.branch && user.branch.toLowerCase() === order.branch.toLowerCase();
        if (user.role === 'Staff' && !permissions?.can_manage_client_orders && !isCreator && !isSameBranch) {
          alert('You do not have permission to edit client orders created by other salespeople outside your branch.');
          navigate('/client-orders');
          return;
        }

        setOrderForm({
          id: order.id,
          order_date: order.order_date,
          event_date: order.event_date || '',
          event_time: order.event_time || '',
          event_name: order.event_name || '',
          event_location: order.event_location || '',
          num_guests: order.num_guests !== null ? String(order.num_guests) : '',
          budget: order.budget !== null ? String(order.budget) : '',
          special_requirements: order.special_requirements || '',
          branch: order.branch,
          salesperson: order.salesperson,
          category: order.category,
          status: order.status,
          notes: order.notes || '',
          subtotal: Number(order.subtotal) || 0,
          discount: Number(order.discount) || 0,
          discount_type: order.discount_type || 'USD',
          discount_value: Number(order.discount_value) || 0,
          vat: Number(order.vat) || 0,
          grand_total: Number(order.grand_total) || 0,
          updated_by: order.updated_by || ''
        });

        if (order.clients) {
          setClientForm({
            id: order.clients.id,
            name: order.clients.name,
            company_name: order.clients.company_name || '',
            phone: order.clients.phone,
            email: order.clients.email || '',
            address: order.clients.address || '',
            location: order.clients.location || '',
            notes: order.clients.notes || ''
          });
          setSelectedClient(order.clients);
        }

        setItems(fetchedItems || []);
        
        const tasksWithOtherFlag = (fetchedTasks || []).map((t: any) => ({
          ...t,
          isOther: t.task_name && !STANDARD_TASKS.includes(t.task_name)
        }));
        setTasks(tasksWithOtherFlag);

        setAttachments(fetchedAttachments || []);
      } else {
        alert('Failed to load order: ' + res.error);
        navigate('/client-orders');
      }
    } catch (e: any) {
      alert('Error loading order details: ' + e.message);
    }
    setLoading(false);
  };

  const fetchClientHistory = async (clientId: string) => {
    try {
      const res = await api.getClientHistoryStats(clientId);
      if (res.success && res.data) {
        setClientHistory({
          totalOrders: res.data.totalOrders,
          totalRevenue: res.data.totalRevenue,
          lastOrderDate: res.data.lastOrderDate,
          avgOrderValue: res.data.avgOrderValue,
          openOpportunities: res.data.openOpportunities,
          favoriteProducts: res.data.favoriteProducts
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Search clients autocomplete
  useEffect(() => {
    if (searchQuery.length > 1) {
      const delayDebounce = setTimeout(async () => {
        try {
          const res = await api.searchClients(searchQuery);
          if (res.success && res.data) {
            setSearchResults(res.data);
          }
        } catch (e) {
          console.error(e);
        }
      }, 250);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const selectClient = (client: any) => {
    setClientForm({
      id: client.id,
      name: client.name,
      company_name: client.company_name || '',
      phone: client.phone,
      email: client.email || '',
      address: client.address || '',
      location: client.location || '',
      notes: client.notes || ''
    });
    setSelectedClient(client);
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearSelectedClient = () => {
    setSelectedClient(null);
    setClientForm({
      id: '',
      name: '',
      company_name: '',
      phone: '',
      email: '',
      address: '',
      location: '',
      notes: ''
    });
  };

  // Items handlers
  const addItemRow = () => {
    setItems([
      ...items,
      { id: Math.random().toString(36).substring(2, 9), item_name: '', qty: 1, unit: 'pcs', unit_price: 0, total_price: 0 }
    ]);
  };

  const removeItemRow = (itemId: string) => {
    setItems(items.filter(it => it.id !== itemId));
  };

  const updateItemRow = (itemId: string, field: string, value: any) => {
    const updated = items.map(item => {
      if (item.id === itemId) {
        const newItem = { ...item, [field]: value };
        if (field === 'qty' || field === 'unit_price') {
          const q = Number(newItem.qty) || 0;
          const p = Number(newItem.unit_price) || 0;
          newItem.total_price = q * p;
        }
        return newItem;
      }
      return item;
    });
    setItems(updated);
  };

  // Recalculate invoice totals automatically
  useEffect(() => {
    const sub = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const discVal = Number(orderForm.discount_value) || 0;
    let discAmt = 0;
    if (orderForm.discount_type === '%') {
      discAmt = sub * (discVal / 100);
    } else {
      discAmt = discVal;
    }
    const vat = Math.max(0, (sub - discAmt) * (vatRate / 100));
    const grand = Math.max(0, sub - discAmt + vat);
    
    setOrderForm(prev => ({
      ...prev,
      subtotal: sub,
      discount: discAmt,
      vat: vat,
      grand_total: grand
    }));
  }, [items, orderForm.discount_value, orderForm.discount_type, vatRate]);

  // Tasks handlers
  const addTaskRow = () => {
    setTasks([
      ...tasks,
      { id: Math.random().toString(36).substring(2, 9), task_name: '', due_date: new Date().toISOString().split('T')[0], assigned_to: user.name, status: 'Pending', isOther: false }
    ]);
  };

  const removeTaskRow = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const updateTaskRow = (taskId: string, field: string, value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  // Attachment upload helper
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingFile(true);
    const file = files[0];
    
    // Choose file type based on file extension
    let fType = 'Other';
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      if (file.name.toLowerCase().includes('quote')) fType = 'Quotation';
      else if (file.name.toLowerCase().includes('contract')) fType = 'Contract';
      else if (file.name.toLowerCase().includes('po') || file.name.toLowerCase().includes('purchase')) fType = 'Purchase Order';
      else fType = 'Menu';
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      fType = 'Event Photo';
    }

    try {
      const res = await api.uploadClientOrderAttachment(file);
      if (res.success && res.url) {
        setAttachments([
          ...attachments,
          {
            id: Math.random().toString(36).substring(2, 9),
            file_name: res.fileName || file.name,
            file_url: res.url,
            file_type: fType,
            uploaded_by: user.name
          }
        ]);
        alert('File uploaded successfully!');
      } else {
        alert('Upload failed: ' + res.error);
      }
    } catch (err: any) {
      alert('Error uploading file: ' + err.message);
    }
    setUploadingFile(false);
  };

  const removeAttachment = (attId: string) => {
    setAttachments(attachments.filter(att => att.id !== attId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientForm.name || !clientForm.phone) {
      alert('Please fill out client Name and Phone number.');
      return;
    }

    if (items.length === 0) {
      alert('Please add at least one item to this order.');
      return;
    }

    // Validation for Catering/Corporate
    const isCateringOrCorp = orderForm.category === 'Catering' || orderForm.category === 'Corporate';
    if (isCateringOrCorp && (!orderForm.event_location || !orderForm.event_date || !orderForm.event_time)) {
      alert('Catering and Corporate orders require Event Location, Event Date, and Event Time.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save / Upsert Client first
      let clientId = clientForm.id;
      const clientPayload = {
        name: clientForm.name,
        company_name: clientForm.company_name || null,
        phone: clientForm.phone,
        email: clientForm.email || null,
        address: clientForm.address || null,
        location: clientForm.location || null,
        notes: clientForm.notes || null
      };

      if (clientId) {
        (clientPayload as any).id = clientId;
      }

      const clientRes = await api.saveClient(clientPayload);
      if (!clientRes.success || !clientRes.data) {
        alert('Failed to save client registry: ' + clientRes.error);
        setSubmitting(false);
        return;
      }

      clientId = clientRes.data.id;

      // 2. Save / Upsert Order details
      const finalOrderPayload = {
        id: orderForm.id,
        client_id: clientId,
        order_date: orderForm.order_date,
        branch: orderForm.branch,
        salesperson: orderForm.salesperson,
        category: orderForm.category,
        status: orderForm.status,
        notes: orderForm.notes || null,
        subtotal: orderForm.subtotal,
        discount: orderForm.discount,
        discount_type: orderForm.discount_type,
        discount_value: orderForm.discount_value,
        vat: orderForm.vat,
        grand_total: orderForm.grand_total,
        // Conditional fields
        event_date: isCateringOrCorp ? (orderForm.event_date || null) : null,
        event_time: isCateringOrCorp ? (orderForm.event_time || null) : null,
        event_name: isCateringOrCorp ? (orderForm.event_name || null) : null,
        event_location: isCateringOrCorp ? (orderForm.event_location || null) : null,
        num_guests: isCateringOrCorp ? (Number(orderForm.num_guests) || null) : null,
        budget: isCateringOrCorp ? (Number(orderForm.budget) || null) : null,
        special_requirements: isCateringOrCorp ? (orderForm.special_requirements || null) : null,
        updated_by: user.name
      };

      // Sanitize items list
      const sanitizedItems = items.map(item => ({
        item_name: item.item_name,
        qty: Number(item.qty) || 1,
        unit: item.unit || 'pcs',
        unit_price: Number(item.unit_price) || 0,
        total_price: Number(item.total_price) || 0
      }));

      // Sanitize tasks
      const sanitizedTasks = tasks.map(task => ({
        id: task.id,
        task_name: task.task_name,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        status: task.status
      }));

      // Sanitize attachments
      const sanitizedAttachments = attachments.map(att => ({
        file_name: att.file_name,
        file_url: att.file_url,
        file_type: att.file_type,
        uploaded_by: att.uploaded_by
      }));

      const orderRes = await api.saveClientOrder(finalOrderPayload, sanitizedItems, sanitizedTasks, sanitizedAttachments);
      if (orderRes.success) {
        alert('Client order saved successfully!');
        navigate('/client-orders');
      } else {
        alert('Failed to save order: ' + orderRes.error);
      }

    } catch (err: any) {
      alert('Error during submission: ' + err.message);
    }
    setSubmitting(false);
  };

  const handleSendWhatsApp = async () => {
    let branchPhone = '';
    try {
      const res = await api.getBranchesList();
      if (res.success && res.data) {
        const matchingBranch = res.data.find((b: any) => b.name === orderForm.branch);
        if (matchingBranch && matchingBranch.phone) {
          branchPhone = matchingBranch.phone.replace(/[^0-9]/g, '');
        }
      }
    } catch (e) {
      console.error('Failed to get branch phone number:', e);
    }

    const itemSummary = items.map((i: any) => `• ${i.item_name} (x${i.qty})`).join('\n');
    
    let locationDetails = clientForm.address || '—';
    if (orderForm.category === 'Catering' || orderForm.category === 'Corporate') {
      locationDetails = `Delivery Address: ${clientForm.address || '—'}\n*Event Location:* ${orderForm.event_location || '—'}`;
    }

    const message = `*${import.meta.env.VITE_APP_NAME || 'NÉO'} - Client Order Details*\n\n` +
      `*Order ID:* ${orderForm.id}\n` +
      `*Client Name:* ${clientForm.name || 'Walk-in Client'}\n` +
      `*Phone:* ${clientForm.phone || '—'}\n` +
      `*Address:* ${locationDetails}\n` +
      `*Location Link:* ${clientForm.location || '—'}\n\n` +
      `*Order Items:*\n${itemSummary}`;
    
    const encodedMsg = encodeURIComponent(message);
    const url = branchPhone 
      ? `https://api.whatsapp.com/send?phone=${branchPhone}&text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`;
  
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
        <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading order data...</p>
      </div>
    );
  }

  const isCateringOrCorp = orderForm.category === 'Catering' || orderForm.category === 'Corporate';

  return (
    <div className="dashboard-container">
      {/* Header Bar */}
      <div className="dashboard-title-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/client-orders" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={20} /></Link>
            <h1>{isEdit ? `Edit Order ${orderForm.id}` : 'Create Client Order'}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Input details for walk-in or phone inquires, calculate totals, specify catering requirements, upload files, and check off follow-up tasks.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* TOP LAYOUT - Client & Order Basics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* CLIENT INFORMATION CARD */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
              👤 Client Profile Registry
            </h3>

            {/* Client Lookup & Search */}
            {!selectedClient && (
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Client Database Search</label>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px' }}>
                  <Search size={16} color="var(--text-muted)" />
                  <input 
                    type="text" 
                    placeholder="Search by client name or phone..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', background: 'transparent', height: '38px', width: '100%', outline: 'none', paddingLeft: '8px' }}
                  />
                </div>
                {searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                    {searchResults.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => selectClient(c)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        className="search-row-hover"
                      >
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({c.phone})</span>
                        </div>
                        {c.company_name && <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{c.company_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedClient && (
              <div style={{ padding: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803d' }}>✓ Synced Client Database Registry</span>
                </div>
                <button 
                  type="button" 
                  onClick={clearSelectedClient}
                  style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                >
                  Disconnect Profile
                </button>
              </div>
            )}

            {/* Client Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Client Name *</label>
                <input 
                  type="text" 
                  value={clientForm.name} 
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="e.g. Freddy Rahme"
                  style={{ width: '100%', marginTop: '4px' }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Phone Number *</label>
                <input 
                  type="text" 
                  value={clientForm.phone} 
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  placeholder="e.g. +961 70 123456"
                  style={{ width: '100%', marginTop: '4px' }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Company Name</label>
                <input 
                  type="text" 
                  value={clientForm.company_name} 
                  onChange={(e) => setClientForm({ ...clientForm, company_name: e.target.value })}
                  placeholder="e.g. Neo Corp"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Email Address</label>
                <input 
                  type="email" 
                  value={clientForm.email} 
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="e.g. freddy@neo.com"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Delivery Address</label>
              <textarea 
                value={clientForm.address} 
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                placeholder="Details of delivery location..."
                style={{ width: '100%', marginTop: '4px', height: '60px', resize: 'vertical' }}
              />
              {(() => {
                const urlRegex = /(https?:\/\/[^\s]+)/gi;
                const match = clientForm.address.match(urlRegex);
                if (match) {
                  return (
                    <div style={{ marginTop: '6px' }}>
                      <a 
                        href={match[0]} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#0284c7',
                          backgroundColor: '#e0f2fe',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          border: '1px solid #bae6fd',
                          cursor: 'pointer'
                        }}
                      >
                        <ExternalLink size={12} /> Open Map Location
                      </a>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Location Link (Google Maps)</label>
              <input 
                type="text" 
                value={clientForm.location} 
                onChange={(e) => setClientForm({ ...clientForm, location: e.target.value })}
                placeholder="Google Maps link..."
                style={{ width: '100%', marginTop: '4px' }}
              />
              {(() => {
                const urlRegex = /(https?:\/\/[^\s]+)/gi;
                const match = clientForm.location.match(urlRegex);
                if (match) {
                  return (
                    <div style={{ marginTop: '6px' }}>
                      <a 
                        href={match[0]} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#0284c7',
                          backgroundColor: '#e0f2fe',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          border: '1px solid #bae6fd',
                          cursor: 'pointer'
                        }}
                      >
                        <ExternalLink size={12} /> Open Map Location
                      </a>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Client Notes</label>
              <textarea 
                value={clientForm.notes} 
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                placeholder="VIP details, allergy comments..."
                style={{ width: '100%', marginTop: '4px', height: '60px', resize: 'vertical' }}
              />
            </div>

            {/* Client CRM Statistics */}
            {clientForm.id && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>CRM Client Statistics</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Orders</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{clientHistory.totalOrders}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Revenue</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>${clientHistory.totalRevenue.toFixed(2)}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Value</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>${clientHistory.avgOrderValue.toFixed(2)}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Order</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientHistory.lastOrderDate}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Open Opp.</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{clientHistory.openOpportunities}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Favorite Prod.</div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={clientHistory.favoriteProducts}>
                      {clientHistory.favoriteProducts}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ORDER METADATA & WORKFLOW CARD */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
              📋 Order Settings & Status
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Order ID</label>
                <input 
                  type="text" 
                  value={orderForm.id} 
                  disabled
                  style={{ width: '100%', marginTop: '4px', fontWeight: 700, backgroundColor: '#f1f5f9', color: 'var(--primary)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Order Date *</label>
                <input 
                  type="date" 
                  value={orderForm.order_date} 
                  onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                  style={{ width: '100%', marginTop: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Branch *</label>
                <select 
                  value={orderForm.branch} 
                  onChange={(e) => setOrderForm({ ...orderForm, branch: e.target.value })}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Salesperson *</label>
                <input 
                  type="text" 
                  value={orderForm.salesperson} 
                  disabled
                  style={{ width: '100%', marginTop: '4px', backgroundColor: '#f1f5f9' }}
                />
              </div>

              {isEdit && orderForm.updated_by ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Last Updated By</label>
                  <input 
                    type="text" 
                    value={orderForm.updated_by} 
                    disabled
                    style={{ width: '100%', marginTop: '4px', backgroundColor: '#f1f5f9' }}
                  />
                </div>
              ) : null}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Category *</label>
                <select 
                  value={orderForm.category} 
                  onChange={(e) => setOrderForm({ ...orderForm, category: e.target.value })}
                  style={{ width: '100%', marginTop: '4px', fontWeight: 700 }}
                >
                  <option value="Pastry">Pastry</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Catering">Catering</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Workflow Status *</label>
                <select 
                  value={orderForm.status} 
                  onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                  style={{ width: '100%', marginTop: '4px', fontWeight: 800 }}
                >
                  <option value="Inquiry">Inquiry</option>
                  <option value="Quotation Sent">Quotation Sent</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="In Production">In Production</option>
                  <option value="Ready for Pickup">Ready for Pickup</option>
                  <option value="Ready for Delivery">Ready for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Internal Follow-up Notes</label>
              <textarea 
                value={orderForm.notes} 
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                placeholder="Log WhatsApp discussions, callback details..."
                style={{ width: '100%', marginTop: '4px', height: '110px', resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* CATERING & CORPORATE CONDITIONAL PANEL */}
        {isCateringOrCorp && (
          <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', borderLeft: '5px solid var(--primary)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
              🍽 Event Details (Catering / Corporate)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Event Title Name</label>
                <input 
                  type="text" 
                  value={orderForm.event_name} 
                  onChange={(e) => setOrderForm({ ...orderForm, event_name: e.target.value })}
                  placeholder="e.g. Wedding Reception, Corporate AGM"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Event Date *</label>
                <input 
                  type="date" 
                  value={orderForm.event_date} 
                  onChange={(e) => setOrderForm({ ...orderForm, event_date: e.target.value })}
                  style={{ width: '100%', marginTop: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Event Start Time *</label>
                <input 
                  type="text" 
                  value={orderForm.event_time} 
                  onChange={(e) => setOrderForm({ ...orderForm, event_time: e.target.value })}
                  placeholder="e.g. 19:30 or 8:00 PM"
                  style={{ width: '100%', marginTop: '4px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Event Location *</label>
                <input 
                  type="text" 
                  value={orderForm.event_location} 
                  onChange={(e) => setOrderForm({ ...orderForm, event_location: e.target.value })}
                  placeholder="e.g. Phoenicia Hotel, Ballroom 1"
                  style={{ width: '100%', marginTop: '4px' }}
                  required
                />
                {(() => {
                  const urlRegex = /(https?:\/\/[^\s]+)/gi;
                  const match = orderForm.event_location.match(urlRegex);
                  if (match) {
                    return (
                      <div style={{ marginTop: '6px' }}>
                        <a 
                          href={match[0]} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#0284c7',
                            backgroundColor: '#e0f2fe',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            border: '1px solid #bae6fd',
                            cursor: 'pointer'
                          }}
                        >
                          <ExternalLink size={12} /> Open Map Location
                        </a>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Guest Count Estimate</label>
                <input 
                  type="number" 
                  value={orderForm.num_guests} 
                  onChange={(e) => setOrderForm({ ...orderForm, num_guests: e.target.value })}
                  placeholder="e.g. 150"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Target Budget ($)</label>
                <input 
                  type="number" 
                  value={orderForm.budget} 
                  onChange={(e) => setOrderForm({ ...orderForm, budget: e.target.value })}
                  placeholder="e.g. 5000"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Special Requirements</label>
              <textarea 
                value={orderForm.special_requirements} 
                onChange={(e) => setOrderForm({ ...orderForm, special_requirements: e.target.value })}
                placeholder="Mention menu choices, dietary limitations, furniture, decoration arrangements..."
                style={{ width: '100%', marginTop: '4px', height: '70px', resize: 'vertical' }}
              />
            </div>
          </div>
        )}

        {/* ORDER ITEMS CALCULATION SECTION */}
        <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧁 Order Items & Menu Selection
            </h3>
            <button 
              type="button" 
              onClick={addItemRow} 
              className="auth-btn" 
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Item Name / Description *</th>
                  <th style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', width: '120px' }}>Quantity</th>
                  <th style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', width: '120px' }}>Unit</th>
                  <th style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', width: '140px' }}>Unit Price ($)</th>
                  <th style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', width: '140px' }}>Total Price</th>
                  <th style={{ padding: '8px 12px', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No items added yet. Click "Add Item" to add pastry, catering, or lunch menus.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="e.g. Birthday Chocolate Gateau (Large)" 
                          value={item.item_name}
                          onChange={(e) => updateItemRow(item.id, 'item_name', e.target.value)}
                          style={{ width: '100%' }}
                          list="item-suggestions"
                          required
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" 
                          value={item.qty}
                          onChange={(e) => updateItemRow(item.id, 'qty', e.target.value)}
                          style={{ width: '100%' }}
                          min="0"
                          step="any"
                          required
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <select 
                          value={item.unit}
                          onChange={(e) => updateItemRow(item.id, 'unit', e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="portion">portion</option>
                          <option value="box">box</option>
                          <option value="liter">liter</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" 
                          value={item.unit_price}
                          onChange={(e) => updateItemRow(item.id, 'unit_price', e.target.value)}
                          style={{ width: '100%' }}
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary)' }}>
                        ${Number(item.total_price).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeItemRow(item.id)}
                          style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Calculation Board */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Subtotal:</span>
                <span style={{ fontWeight: 600 }}>${orderForm.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Discount:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input 
                    type="number" 
                    value={orderForm.discount_value} 
                    onChange={(e) => setOrderForm({ ...orderForm, discount_value: Number(e.target.value) || 0 })}
                    style={{ width: '80px', height: '30px', padding: '4px 8px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border)' }}
                    min="0"
                    step="0.01"
                  />
                  <select
                    value={orderForm.discount_type}
                    onChange={(e) => setOrderForm({ ...orderForm, discount_type: e.target.value })}
                    style={{ width: '60px', height: '30px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                  >
                    <option value="USD">$</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </div>
              {orderForm.discount_type === '%' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Calc Discount:</span>
                  <span>-${orderForm.discount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>VAT ({vatRate}%):</span>
                <span>${orderForm.vat.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>Grand Total:</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>${orderForm.grand_total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM LAYOUT - Follow-Up Tasks & File Attachments */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* FOLLOW-UP TASKS CHECKLIST */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={18} /> Follow-Up Tasks & Reminders
              </h3>
              <button 
                type="button" 
                onClick={addTaskRow} 
                className="auth-btn" 
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px' }}
              >
                <Plus size={12} /> Add Task
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tasks.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No reminders configured. Define tasks like "Send Quotation", "Collect Payment", or "Confirm Menu".
                </div>
              ) : (
                tasks.map(t => (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: '8px', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <select 
                        value={t.isOther ? 'other' : (STANDARD_TASKS.includes(t.task_name) ? t.task_name : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'other') {
                            setTasks(tasks.map(task => task.id === t.id ? { ...task, task_name: '', isOther: true } : task));
                          } else {
                            setTasks(tasks.map(task => task.id === t.id ? { ...task, task_name: val, isOther: false } : task));
                          }
                        }}
                        required
                        style={{ width: '100%' }}
                      >
                        <option value="" disabled>Select Task...</option>
                        {STANDARD_TASKS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="other">other (enter text)</option>
                      </select>
                      {t.isOther && (
                        <input 
                          type="text" 
                          placeholder="Enter custom task description..." 
                          value={t.task_name}
                          onChange={(e) => updateTaskRow(t.id, 'task_name', e.target.value)}
                          required
                          style={{ marginTop: '4px', width: '100%' }}
                        />
                      )}
                    </div>
                    <input 
                      type="date" 
                      value={t.due_date}
                      onChange={(e) => updateTaskRow(t.id, 'due_date', e.target.value)}
                      required
                    />
                    <select 
                      value={t.assigned_to}
                      onChange={(e) => updateTaskRow(t.id, 'assigned_to', e.target.value)}
                    >
                      {systemUsers.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => removeTaskRow(t.id)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ATTACHMENTS STORAGE BUCKET */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Paperclip size={18} /> Order Documents & Attachments
            </h3>

            {/* Upload Zone */}
            <div style={{ 
              border: '2px dashed var(--border)', 
              borderRadius: '8px', 
              padding: '16px', 
              textAlign: 'center', 
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              position: 'relative'
            }}>
              {uploadingFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw className="spin" size={20} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Uploading media file...</span>
                </div>
              ) : (
                <>
                  <Paperclip size={24} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Select files to upload</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Upload contracts, quotation PDFs, or event photo menus</div>
                  <input 
                    type="file" 
                    onChange={handleFileUpload}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                  />
                </>
              )}
            </div>

            {/* Attachments List */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attachments.map(att => (
                <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '80%' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.file_name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Type: {att.file_type} • By: {att.uploaded_by}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a 
                      href={att.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button 
                      type="button" 
                      onClick={() => removeAttachment(att.id)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', paddingBottom: '30px' }}>
          {isEdit && (
            <button 
              type="button" 
              onClick={handleSendWhatsApp} 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                backgroundColor: '#25D366', 
                color: 'white', 
                border: 'none', 
                padding: '10px 24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              💬 Send via WhatsApp
            </button>
          )}

          <button 
            type="button" 
            onClick={() => navigate('/client-orders')} 
            className="auth-btn" 
            style={{ width: 'auto', backgroundColor: 'white', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '10px 24px' }}
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            disabled={submitting}
            className="auth-btn" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
          >
            {submitting ? (
              <>
                <RefreshCw className="spin" size={16} /> Saving...
              </>
            ) : (
              <>
                <Save size={16} /> Save Order Profile
              </>
            )}
          </button>
        </div>
      </form>
      <datalist id="item-suggestions">
        {itemSuggestions.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
