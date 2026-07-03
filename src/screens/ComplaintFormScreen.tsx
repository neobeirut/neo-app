import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Save, Loader2, ShieldAlert, AlertTriangle, Image as ImageIcon, MessageSquare } from 'lucide-react';

const CATEGORY_MAP: Record<string, string[]> = {
  'Food Quality': ['Cold Food', 'Overcooked', 'Undercooked', 'Bad Taste', 'Portion Size', 'Foreign Object'],
  'Beverage Quality': ['Cold Drink', 'Hot Drink', 'Bad Taste', 'Wrong Size', 'Foreign Object', 'Wrong Milk'],
  'Service': ['Rude Staff', 'Ignored', 'Slow Service', 'Table Not Clean'],
  'Delay': ['Food Delay', 'Bill Delay', 'Order Taking Delay'],
  'Wrong Order': ['Missing Item', 'Extra Item', 'Wrong Customization', 'Completely Wrong Dish'],
  'Cleanliness': ['Dirty Cutlery', 'Dirty Glass', 'Floor Dirty', 'Bathroom Dirty', 'Table Dirty'],
  'Staff Behavior': ['Unprofessional', 'Inattentive', 'Impolite', 'Arguing'],
  'Delivery Issue': ['Cold Delivery', 'Late Delivery', 'Spilled Food', 'Missing Item', 'Driver Behavior'],
  'Billing Issue': ['Overcharged', 'Wrong Items', 'Split Bill Issue', 'Discount Not Applied'],
  'App Issue': ['Crash', 'Slow', 'Promo Code Issue', 'Payment Issue'],
  'Atmosphere': ['Loud Music', 'Too Hot', 'Too Cold', 'Bad Lighting', 'Uncomfortable Seating'],
  'Parking / Valet': ['Valet Delay', 'Scratched Car', 'Lost Key', 'No Parking Space'],
  'Other': ['General', 'Booking Issue', 'Voucher Issue']
};

const CATEGORIES = Object.keys(CATEGORY_MAP);
const ORDER_TYPES = ['Dine-In', 'Delivery', 'Takeaway', 'Catering', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const STATUS_OPTIONS = ['New', 'Under Review', 'Waiting Customer Reply', 'Escalated', 'Resolved', 'Closed'];
const IMMEDIATE_ACTIONS = [
  'Manager Intervention',
  'Comped Item',
  'Table Discount',
  'Free Drink',
  'Apology Only',
  'Re-fired Dish',
  'Gift Voucher',
  'Other'
];
const DEPARTMENTS = ['Kitchen', 'Service', 'Bar', 'Delivery', 'Valet', 'Administration', 'Other'];
const ROOT_CAUSES = [
  'Staff Error',
  'Ingredient Quality',
  'Equipment Failure',
  'System Glitch',
  'Understaffed',
  'Supplier Issue',
  'Communication Breakdown',
  'Other'
];
const SATISFACTION_OPTIONS = ['Yes', 'No', 'Unreachable'];

interface ComplaintFormScreenProps {
  permissions?: any;
  user?: any;
}

export default function ComplaintFormScreen({ permissions, user: propUser }: ComplaintFormScreenProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const user = propUser || (localStorage.getItem('neo_admin_user') ? JSON.parse(localStorage.getItem('neo_admin_user')!) : null);
  const canView = permissions?.can_view_complaints || user?.role === 'Admin' || user?.role === 'Manager';
  const canManage = permissions?.can_manage_complaints || user?.role === 'Admin' || user?.role === 'Manager';
  const isAdmin = user?.role === 'Admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State
  const [complaintId, setComplaintId] = useState('');
  const [dateCreated, setDateCreated] = useState('');
  const [branch, setBranch] = useState('');
  const [loggedBy, setLoggedBy] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [orderType, setOrderType] = useState('Dine-In');
  const [tableNumber, setTableNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Low');
  const [description, setDescription] = useState('');
  
  const [itemInvolved, setItemInvolved] = useState('');
  const [staffInvolved, setStaffInvolved] = useState('');
  const [department, setDepartment] = useState('');

  const [immediateAction, setImmediateAction] = useState('');
  const [compensationAmount, setCompensationAmount] = useState('0');
  const [status, setStatus] = useState('New');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);

  // Gated sections (Admin only)
  const [rootCause, setRootCause] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [trainingRequired, setTrainingRequired] = useState(false);
  const [supplierIssue, setSupplierIssue] = useState(false);
  const [recurringProblem, setRecurringProblem] = useState(false);

  const [resolutionDetails, setResolutionDetails] = useState('');
  const [customerSatisfied, setCustomerSatisfied] = useState('');

  // Dropdown Catalogs
  const [branches, setBranches] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<string[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);

  // Original item for critical checks
  const [originalComplaint, setOriginalComplaint] = useState<any>(null);

  useEffect(() => {
    if (!canView) {
      alert('Access Denied. You do not have permission to view Client Complaints.');
      navigate('/');
      return;
    }
    loadDropdownsAndData();
  }, [id, canView]);

  const loadDropdownsAndData = async () => {
    setLoading(true);
    try {
      // 1. Fetch catalogs
      const [branchRes, itemRes, empRes] = await Promise.all([
        api.getBranchesList(),
        api.getMenuRecipes(),
        api.getEmployees()
      ]);

      if (branchRes.success && branchRes.data) {
        setBranches(branchRes.data.map((b: any) => b.name));
      }
      if (itemRes.success && itemRes.data) {
        setMenuItems(itemRes.data.map((i: any) => i.item_name));
      }
      if (empRes.success && empRes.data) {
        setEmployees(empRes.data.map((e: any) => `${e.first_name} ${e.last_name}`));
      }

      // 2. Fetch complaint if editing
      if (isEditing && id) {
        const res = await api.getComplaintById(id);
        if (res.success && res.data) {
          const c = res.data;
          setOriginalComplaint(c);

          setComplaintId(c.ComplaintID || '');
          setDateCreated(c.DateCreated ? new Date(c.DateCreated).toLocaleString() : '');
          setBranch(c.Branch || '');
          setLoggedBy(c.LoggedBy || '');
          setClientName(c.ClientName || '');
          setClientPhone(c.ClientPhone || '');
          setClientEmail(c.ClientEmail || '');
          setOrderType(c.OrderType || 'Dine-In');
          setTableNumber(c.TableNumber || '');
          setOrderNumber(c.OrderNumber || '');
          setCategory(c.Category || '');
          setSubCategory(c.SubCategory || '');
          setSeverity(c.Severity || 'Low');
          setDescription(c.Description || '');
          setItemInvolved(c.ItemInvolved || '');
          setStaffInvolved(c.StaffInvolved || '');
          setDepartment(c.Department || '');
          setImmediateAction(c.ImmediateAction || '');
          setCompensationAmount(c.CompensationAmount?.toString() || '0');
          setStatus(c.Status || 'New');
          setAttachmentUrls(c.AttachmentURLs || []);

          // Admin fields
          setRootCause(c.RootCause || '');
          setInternalNotes(c.InternalNotes || c.RootCauseNotes || ''); 
          setTrainingRequired(c.TrainingRequired === true || c.TrainingRequired === 'Yes');
          setSupplierIssue(c.SupplierIssue === true || c.SupplierIssue === 'Yes');
          setRecurringProblem(c.RecurringProblem === true || c.RecurringProblem === 'Yes');
          setResolutionDetails(c.Resolution || '');
          setCustomerSatisfied(c.CustomerSatisfied || '');
        } else {
          alert('Complaint details not found.');
          navigate('/complaints');
        }
      } else {
        // Create mode
        const rand = Math.floor(100000 + Math.random() * 900000);
        setComplaintId(`CMP-${rand}`);
        setDateCreated(new Date().toLocaleString());
        setBranch(user?.branch || '');
        setLoggedBy(user?.name || '');
        setStatus('New');
      }
    } catch (e) {
      console.error('Error loading dropdown lists:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setSubCategory('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setUploadingImage(true);
    const res = await api.uploadComplaintAttachment(file);
    setUploadingImage(false);

    if (res.success && res.url) {
      setAttachmentUrls(prev => [...prev, res.url!]);
    } else {
      alert(res.error || 'Failed to upload photo attachment.');
    }
  };

  const handleRemoveAttachment = (url: string) => {
    setAttachmentUrls(prev => prev.filter(item => item !== url));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branch) {
      alert('Please select a Branch.');
      return;
    }
    if (!clientName.trim()) {
      alert('Please enter the Customer Name.');
      return;
    }
    if (!category) {
      alert('Please select a Category.');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description of the complaint.');
      return;
    }

    setSaving(true);

    const payload: any = {
      ComplaintID: complaintId,
      Branch: branch,
      LoggedBy: loggedBy,
      ClientName: clientName,
      ClientPhone: clientPhone || null,
      ClientEmail: clientEmail || null,
      OrderType: orderType,
      TableNumber: tableNumber || null,
      OrderNumber: orderNumber || null,
      Category: category,
      SubCategory: subCategory || null,
      Severity: severity,
      Description: description,
      ItemInvolved: itemInvolved || null,
      StaffInvolved: staffInvolved || null,
      Department: department || null,
      ImmediateAction: immediateAction || null,
      CompensationAmount: parseFloat(compensationAmount) || 0,
      Status: status,
      AttachmentURLs: attachmentUrls,
      updated_at: new Date().toISOString()
    };

    if (isEditing && originalComplaint) {
      payload.id = originalComplaint.id;
    } else {
      payload.DateCreated = new Date().toISOString();
      payload.created_at = new Date().toISOString();
    }

    // Include Admin-only fields
    if (canManage) {
      payload.RootCause = rootCause || null;
      payload.InternalNotes = internalNotes || null;
      payload.TrainingRequired = trainingRequired;
      payload.SupplierIssue = supplierIssue;
      payload.RecurringProblem = recurringProblem;
      payload.Resolution = resolutionDetails || null;
      payload.CustomerSatisfied = customerSatisfied || null;
      payload.ResolvedBy = resolutionDetails ? user?.name : null;
      payload.ResolutionDate = resolutionDetails ? new Date().toISOString() : null;
    } else if (originalComplaint) {
      // Retain existing admin fields if saved by Manager
      payload.RootCause = originalComplaint.RootCause || null;
      payload.InternalNotes = originalComplaint.InternalNotes || null;
      payload.TrainingRequired = originalComplaint.TrainingRequired || false;
      payload.SupplierIssue = originalComplaint.SupplierIssue || false;
      payload.RecurringProblem = originalComplaint.RecurringProblem || false;
      payload.Resolution = originalComplaint.Resolution || null;
      payload.CustomerSatisfied = originalComplaint.CustomerSatisfied || null;
      payload.ResolvedBy = originalComplaint.ResolvedBy || null;
      payload.ResolutionDate = originalComplaint.ResolutionDate || null;
    }

    const res = await api.saveComplaint(payload);

    if (res.success) {
      // Activity logging for critical alerts
      if (severity === 'Critical' && (!isEditing || originalComplaint?.Severity !== 'Critical')) {
        await api.logActivity(
          user?.name || 'System',
          'CRITICAL_COMPLAINT_LOGGED',
          `Critical Complaint ${complaintId} logged for branch ${branch}. Customer: ${clientName}. Category: ${category}`
        );
      }
      setSaving(false);
      navigate('/complaints');
    } else {
      setSaving(false);
      alert(res.error || 'Failed to save complaint.');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      
      {/* Top action header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/complaints')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={28} style={{ color: 'var(--primary)' }} /> {isEditing ? 'Edit Complaint details' : 'Log client complaint'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              {isEditing ? 'Update client feedback, root cause analysis, and resolution tracking.' : 'Record a new customer complaint or service feedback.'}
            </p>
          </div>
        </div>
        {canManage && (
          <button 
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
          >
            {saving ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
            Save Complaint
          </button>
        )}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <fieldset disabled={!canManage} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Section 1: Basic Info */}
        <div style={cardStyle}>
          <h3 style={sectionHeaderStyle}>📋 Section 1: Basic Information</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
            <div>
              <span style={metaLabelStyle}>Complaint ID</span>
              <span style={metaValueStyle}>{complaintId}</span>
            </div>
            <div>
              <span style={metaLabelStyle}>Date Logged</span>
              <span style={metaValueStyle}>{dateCreated || new Date().toLocaleString()}</span>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={metaLabelStyle}>Logged By</span>
              <span style={metaValueStyle}>{loggedBy}</span>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={metaLabelStyle}>User Role</span>
              <span style={{ ...metaValueStyle, color: isAdmin ? '#2e7d32' : 'var(--text-main)', fontWeight: 700 }}>{user?.role}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Branch *</label>
              <select style={inputStyle} value={branch} onChange={e => setBranch(e.target.value)} required>
                <option value="">Select Branch...</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Client Name *</label>
              <input style={inputStyle} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full name of client" required />
            </div>
            <div>
              <label style={labelStyle}>Client Phone</label>
              <input style={inputStyle} value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="e.g. +961 70 ..." />
            </div>
            <div>
              <label style={labelStyle}>Client Email</label>
              <input type="email" style={inputStyle} value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@address.com" />
            </div>
            <div>
              <label style={labelStyle}>Order Type</label>
              <select style={inputStyle} value={orderType} onChange={e => setOrderType(e.target.value)}>
                {ORDER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Table #</label>
                <input style={inputStyle} value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. 12" />
              </div>
              <div>
                <label style={labelStyle}>Order #</label>
                <input style={inputStyle} value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="e.g. #2491" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Category */}
        <div style={cardStyle}>
          <h3 style={sectionHeaderStyle}>📂 Section 2: Category & Subcategory</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Category *</label>
              <select style={inputStyle} value={category} onChange={e => handleCategoryChange(e.target.value)} required>
                <option value="">Select Category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Subcategory</label>
              <select 
                style={inputStyle} 
                value={subCategory} 
                onChange={e => setSubCategory(e.target.value)} 
                disabled={!category}
              >
                <option value="">Select Subcategory...</option>
                {category && CATEGORY_MAP[category]?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Severity */}
        <div style={cardStyle}>
          <h3 style={sectionHeaderStyle}>⚠️ Section 3: Severity Level</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            {SEVERITIES.map(sev => {
              const isSelected = severity === sev;
              let activeColor = '#e2e3e5';
              let activeTextColor = '#333';
              let activeBorderColor = '#ccc';
              
              if (isSelected) {
                if (sev === 'Low') { activeColor = '#e6fffa'; activeTextColor = '#319795'; activeBorderColor = '#319795'; }
                if (sev === 'Medium') { activeColor = '#feebc8'; activeTextColor = '#dd6b20'; activeBorderColor = '#dd6b20'; }
                if (sev === 'High') { activeColor = '#fffaf0'; activeTextColor = '#dd6b20'; activeBorderColor = '#dd6b20'; }
                if (sev === 'Critical') { activeColor = '#fff5f5'; activeTextColor = '#e53e3e'; activeBorderColor = '#e53e3e'; }
              }

              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  style={{
                    flex: 1, minWidth: '100px', padding: '10px 14px', borderRadius: '6px',
                    border: '2px solid', borderColor: isSelected ? activeBorderColor : '#e2e8f0',
                    backgroundColor: isSelected ? activeColor : '#fff',
                    color: isSelected ? activeTextColor : 'var(--text-main)',
                    fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {sev === 'Critical' ? '🚨 Critical' : sev}
                </button>
              );
            })}
          </div>

          {severity === 'Critical' && (
            <div style={{ display: 'flex', gap: '10px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', color: '#e53e3e', padding: '14px', borderRadius: '6px', marginTop: '14px', fontSize: '13px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>CRITICAL ALERT:</strong> Logging a complaint with Critical severity will trigger automatic dashboard alerts and create a critical audit trail event. Immediate resolution action is highly recommended.
              </span>
            </div>
          )}
        </div>

        {/* Section 4: Details & Photos */}
        <div style={cardStyle}>
          <h3 style={sectionHeaderStyle}>📝 Section 4: Description & Photos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Complaint Description *</label>
              <textarea 
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Describe what occurred in detail..."
                required 
              />
            </div>
            
            <div>
              <label style={labelStyle}>Attachment / Photo Evidence</label>
              
              {/* Photo grid preview */}
              {attachmentUrls.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {attachmentUrls.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                      <img src={url} alt={`attached evidence ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAttachment(url)}
                        style={{
                          position: 'absolute', top: '4px', right: '4px', border: 'none', borderRadius: '50%',
                          backgroundColor: 'rgba(229, 62, 98, 0.9)', color: 'white', cursor: 'pointer',
                          width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 'bold'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload field */}
              <div style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#fafafa', position: 'relative' }}>
                <ImageIcon size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Select a photo or screenshot to attach (JPG/PNG)
                </span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  disabled={uploadingImage}
                  style={{ display: 'block', width: '100%', opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer' }} 
                />
                {uploadingImage && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                    <Loader2 size={16} className="spin" /> Uploading image to storage...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Involved Catalog Details */}
        <div style={cardStyle}>
          <h3 style={sectionHeaderStyle}>🔗 Section 5: Involved Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Menu Item Involved</label>
              <select style={inputStyle} value={itemInvolved} onChange={e => setItemInvolved(e.target.value)}>
                <option value="">Search/select menu item...</option>
                {menuItems.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Staff Member Involved</label>
              <select style={inputStyle} value={staffInvolved} onChange={e => setStaffInvolved(e.target.value)}>
                <option value="">Search/select employee...</option>
                {employees.map(emp => <option key={emp} value={emp}>{emp}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Department Responsible</label>
              <select style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">Select Department...</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 6: Actions & Status */}
        <div style={cardStyle}>
          <h3 style={sectionHeaderStyle}>⚡ Section 6: Immediate Actions & Status</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Immediate Action Taken</label>
              <select style={inputStyle} value={immediateAction} onChange={e => setImmediateAction(e.target.value)}>
                <option value="">Select action taken...</option>
                {IMMEDIATE_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Compensation Amount ($)</label>
              <input type="number" style={inputStyle} value={compensationAmount} onChange={e => setCompensationAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Complaint Status</label>
              <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 7: Investigation (Admin Gated) */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #dd6b20', backgroundColor: '#fffaf0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ ...sectionHeaderStyle, color: '#dd6b20', marginBottom: 0 }}>🔍 Section 7: Internal Investigation & Cause</h3>
            {!canManage && <span style={adminBadgeStyle}><ShieldAlert size={14} /> View Only</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Assigned Root Cause</label>
              <select 
                style={inputStyle} 
                value={rootCause} 
                onChange={e => setRootCause(e.target.value)}
                disabled={!isAdmin}
              >
                <option value="">Select Root Cause...</option>
                {ROOT_CAUSES.map(rc => <option key={rc} value={rc}>{rc}</option>)}
              </select>
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Investigation & Internal Notes</label>
              <textarea 
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} 
                value={internalNotes} 
                onChange={e => setInternalNotes(e.target.value)} 
                placeholder="Internal notes, disciplinary counseling, training outcomes..."
                disabled={!isAdmin}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isAdmin ? 'pointer' : 'default', fontSize: '14px', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={trainingRequired} 
                  onChange={e => setTrainingRequired(e.target.checked)} 
                  disabled={!isAdmin}
                  style={{ width: '18px', height: '18px' }} 
                />
                Staff Retraining Required
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isAdmin ? 'pointer' : 'default', fontSize: '14px', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={supplierIssue} 
                  onChange={e => setSupplierIssue(e.target.checked)} 
                  disabled={!isAdmin}
                  style={{ width: '18px', height: '18px' }} 
                />
                Supplier Quality/Delivery Issue
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isAdmin ? 'pointer' : 'default', fontSize: '14px', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={recurringProblem} 
                  onChange={e => setRecurringProblem(e.target.checked)} 
                  disabled={!isAdmin}
                  style={{ width: '18px', height: '18px' }} 
                />
                Is a Recurring Problem
              </label>
            </div>
          </div>
        </div>

        {/* Section 8: Resolution (Admin Gated) */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #38a169', backgroundColor: '#f0fff4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ ...sectionHeaderStyle, color: '#276749', marginBottom: 0 }}>🏁 Section 8: Resolution Details</h3>
            {!canManage && <span style={adminBadgeStyle}><ShieldAlert size={14} /> View Only</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Final Resolution Actions</label>
              <textarea 
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} 
                value={resolutionDetails} 
                onChange={e => setResolutionDetails(e.target.value)} 
                placeholder="Details of client correspondence, compensation checks, or operations adjustment..."
                disabled={!isAdmin}
              />
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Customer Satisfied after Resolution?</label>
              <select 
                style={inputStyle} 
                value={customerSatisfied} 
                onChange={e => setCustomerSatisfied(e.target.value)}
                disabled={!isAdmin}
              >
                <option value="">Select response...</option>
                {SATISFACTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        </fieldset>

      </form>
    </div>
  );
}

// Styling Helper Constants
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  padding: '24px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)'
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--text-main)',
  marginBottom: '16px'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.3px'
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '15px',
  fontFamily: 'inherit',
  outline: 'none',
  backgroundColor: '#fff'
};

const metaLabelStyle = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
};

const metaValueStyle = {
  display: 'block',
  fontSize: '14px',
  color: 'var(--text-main)',
  marginTop: '2px'
};

const adminBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '11px',
  fontWeight: 700,
  backgroundColor: '#fff',
  border: '1px solid #ecc94b',
  color: '#b7791f',
  padding: '4px 8px',
  borderRadius: '12px'
};
