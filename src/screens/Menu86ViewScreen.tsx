import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Loader2, Calendar, MapPin, AlertCircle, ChefHat, Layers, CheckCircle, Plus, Trash2, X, Edit } from 'lucide-react';

interface Menu86Item {
  name: string;
  type: 'menu' | 'ingredient';
  department?: string;
}

interface Menu86Record {
  id: string;
  branch: string;
  date: string;
  items: Menu86Item[];
  created_at: string;
  updated_at: string;
}

export default function Menu86ViewScreen() {
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getTodayString());
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [branches, setBranches] = useState<any[]>([]);
  const [menuRecipes, setMenuRecipes] = useState<any[]>([]);
  const [logs, setLogs] = useState<Menu86Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formBranch, setFormBranch] = useState('');
  const [formDate, setFormDate] = useState(getTodayString());
  const [formItems, setFormItems] = useState<Menu86Item[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'menu' | 'ingredient'>('menu');
  const [newItemDept, setNewItemDept] = useState('Kitchen');
  const [saving, setSaving] = useState(false);

  const handleOpenCreateModal = (existingLog?: Menu86Record) => {
    if (existingLog) {
      setFormBranch(existingLog.branch);
      setFormDate(existingLog.date);
      setFormItems(existingLog.items || []);
    } else {
      setFormBranch(branches[0]?.name || '');
      setFormDate(date);
      setFormItems([]);
    }
    
    // Set default menu item selection if available
    const firstRecipe = menuRecipes[0];
    setNewItemName(firstRecipe ? firstRecipe.item_name : '');
    setNewItemType('menu');
    setNewItemDept(firstRecipe?.menu_sections?.department || 'Kitchen');
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      alert('Please enter an item name.');
      return;
    }
    const item: Menu86Item = {
      name: newItemName.trim(),
      type: newItemType,
      department: newItemDept
    };
    setFormItems([...formItems, item]);
    setNewItemName('');
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  const handleSaveRecord = async () => {
    if (!formBranch) {
      alert('Please select a branch.');
      return;
    }
    if (formItems.length === 0) {
      alert('Please add at least one missing item.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.save86(formBranch, formItems, formDate);
      if (res.success) {
        setIsModalOpen(false);
        // Refresh logs
        const logsRes = await api.get86Logs(date, selectedBranch);
        if (logsRes.success) {
          setLogs(logsRes.data || []);
        }
      } else {
        alert(res.error || 'Failed to save record.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred while saving the record.');
    } finally {
      setSaving(false);
    }
  };

  // Fetch branches and menu recipes on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchRes, recipesRes] = await Promise.all([
          api.getBranchesList(),
          api.getMenuRecipes()
        ]);
        if (branchRes.success && branchRes.data) {
          setBranches(branchRes.data);
        }
        if (recipesRes.success && recipesRes.data) {
          setMenuRecipes(recipesRes.data);
        }
      } catch (err: any) {
        console.error('Error fetching initial data for 86 screen:', err);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch 86 logs when date or branch selection changes
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get86Logs(date, selectedBranch);
        if (res.success) {
          setLogs(res.data || []);
        } else {
          setError(res.error || 'Failed to fetch logs');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching 86 logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [date, selectedBranch]);

  // Helper to render department badges
  const renderDepartmentBadge = (dept?: string) => {
    const departmentName = dept || 'Kitchen';
    let bg = '#e2e8f0';
    let color = '#475569';

    switch (departmentName.toLowerCase()) {
      case 'kitchen':
        bg = '#e8f5e9';
        color = '#2e7d32';
        break;
      case 'bar':
        bg = '#f3e5f5';
        color = '#6a1b9a';
        break;
      case 'bakery':
      case 'pastry':
        bg = '#fff3e0';
        color = '#e65100';
        break;
      case 'service':
        bg = '#e3f2fd';
        color = '#1565c0';
        break;
    }

    return (
      <span
        style={{
          marginLeft: '8px',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: bg,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {departmentName}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px' }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={28} style={{ color: 'var(--primary)' }} /> Daily "86" Missing Items
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitor unavailable dishes, beverages, and ingredients across all branches.
          </p>
        </div>
        <button
          onClick={() => handleOpenCreateModal()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 4px 6px -1px rgba(30, 92, 79, 0.2)',
            transition: 'all 0.15s ease'
          }}
        >
          <Plus size={16} /> Log 86 Record
        </button>
      </div>

      {/* Filter Panel with Glassmorphism / Subtle Shadow */}
      <div style={filterPanelStyle}>
        <div style={filterGroupStyle}>
          <label style={labelStyle}>
            <Calendar size={16} style={{ marginRight: '6px' }} />
            Select Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={filterGroupStyle}>
          <label style={labelStyle}>
            <MapPin size={16} style={{ marginRight: '6px' }} />
            Branch Location
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={selectStyle}
          >
            <option value="All">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div style={errorStyle}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading ? (
          <div style={loadingContainerStyle}>
            <Loader2 size={40} className="spin" style={{ color: 'var(--primary)' }} />
            <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Loading daily logs...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div style={emptyCardStyle}>
            <CheckCircle size={56} style={{ color: '#10b981', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              All Clear
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', maxWidth: '360px', textAlign: 'center' }}>
              No missing menu items or ingredients have been logged for this date.
            </p>
          </div>
        ) : (
          <div style={gridStyle}>
            {logs.map((log) => {
              const menuItems = (log.items || []).filter((i) => i.type === 'menu');
              const ingredients = (log.items || []).filter((i) => i.type === 'ingredient');

              return (
                <div
                  key={log.id}
                  style={cardStyle}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={cardHeaderStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={18} style={{ color: 'var(--primary)' }} />
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        {log.branch}
                      </h2>
                      <button
                        onClick={() => handleOpenCreateModal(log)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginLeft: '4px',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s'
                        }}
                        title="Edit Record"
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e6f4f1'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                    <span style={timestampStyle}>
                      Updated {new Date(log.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={cardContentStyle}>
                    {/* Menu Items Section */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={subSectionHeaderStyle}>
                        <ChefHat size={16} style={{ color: '#0ea5e9' }} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                          Menu Items ({menuItems.length})
                        </h4>
                      </div>
                      {menuItems.length === 0 ? (
                        <p style={noItemsTextStyle}>None</p>
                      ) : (
                        <ul style={listStyle}>
                          {menuItems.map((item, index) => (
                            <li key={index} style={listItemStyle}>
                              <span style={{ fontWeight: 500, color: '#334155' }}>{item.name}</span>
                              {renderDepartmentBadge(item.department)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Ingredients Section */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={subSectionHeaderStyle}>
                        <Layers size={16} style={{ color: '#f59e0b' }} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                          Ingredients ({ingredients.length})
                        </h4>
                      </div>
                      {ingredients.length === 0 ? (
                        <p style={noItemsTextStyle}>None</p>
                      ) : (
                        <ul style={listStyle}>
                          {ingredients.map((item, index) => (
                            <li key={index} style={listItemStyle}>
                              <span style={{ fontWeight: 500, color: '#334155' }}>{item.name}</span>
                              {renderDepartmentBadge(item.department)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log 86 Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={22} style={{ color: 'var(--primary)' }} />
                Log "86" Missing Items
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={closeButtonStyle}>
                <X size={20} />
              </button>
            </div>
            
            <div style={modalBodyStyle}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={labelStyle}>Branch Location</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    style={{ ...selectStyle, width: '100%' }}
                  >
                    <option value="" disabled>Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={labelStyle}>Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
              </div>
              
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
              
              {/* Add Item Form */}
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#475569' }}>Add Missing Item / Ingredient</h4>
                
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Type</label>
                    <select
                      value={newItemType}
                      onChange={(e) => {
                        const typeVal = e.target.value as 'menu' | 'ingredient';
                        setNewItemType(typeVal);
                        if (typeVal === 'menu') {
                          const firstRecipe = menuRecipes[0];
                          setNewItemName(firstRecipe ? firstRecipe.item_name : '');
                          setNewItemDept(firstRecipe?.menu_sections?.department || 'Kitchen');
                        } else {
                          setNewItemName('');
                          setNewItemDept('Kitchen');
                        }
                      }}
                      style={{ ...selectStyle, width: '100%' }}
                    >
                      <option value="menu">Menu Item</option>
                      <option value="ingredient">Ingredient</option>
                    </select>
                  </div>

                  {newItemType === 'menu' ? (
                    <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Select Menu Item</label>
                      <select
                        value={newItemName}
                        onChange={(e) => {
                          const nameVal = e.target.value;
                          setNewItemName(nameVal);
                          const recipe = menuRecipes.find(r => r.item_name === nameVal);
                          if (recipe?.menu_sections?.department) {
                            setNewItemDept(recipe.menu_sections.department);
                          }
                        }}
                        style={{ ...selectStyle, width: '100%' }}
                      >
                        {menuRecipes.map((r) => (
                          <option key={r.id} value={r.item_name}>{r.item_name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Item Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Avocado Toast, Fresh Mint"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </div>
                  )}
                  
                  <div style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Department</label>
                    <select
                      value={newItemDept}
                      onChange={(e) => setNewItemDept(e.target.value)}
                      style={{ ...selectStyle, width: '100%' }}
                    >
                      <option value="Kitchen">Kitchen</option>
                      <option value="Bar">Bar</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Pastry">Pastry</option>
                      <option value="Service">Service</option>
                    </select>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px',
                      height: '40px'
                    }}
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
              
              {/* Items List */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Items List ({formItems.length})</h4>
                {formItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                    No items added yet. Use the form above to add missing items.
                  </div>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto' as const, border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    {formItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: idx === formItems.length - 1 ? 'none' : '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.type === 'menu' ? <ChefHat size={16} style={{ color: '#0ea5e9' }} /> : <Layers size={16} style={{ color: '#f59e0b' }} />}
                          <span style={{ fontWeight: 500, color: '#1e293b' }}>{item.name}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>({item.type})</span>
                          {renderDepartmentBadge(item.department)}
                        </div>
                        <button onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div style={modalFooterStyle}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecord}
                disabled={saving || !formBranch || formItems.length === 0}
                style={{
                  backgroundColor: saving || !formBranch || formItems.length === 0 ? '#cbd5e1' : 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: saving || !formBranch || formItems.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="spin" /> Saving...
                  </>
                ) : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



const modalOverlayStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '600px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column' as const,
  maxHeight: '90vh'
};

const modalHeaderStyle = {
  padding: '18px 24px',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const modalBodyStyle = {
  padding: '24px',
  overflowY: 'auto' as const,
  flex: 1
};

const modalFooterStyle = {
  padding: '16px 24px',
  borderTop: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  backgroundColor: '#f8fafc',
  borderBottomLeftRadius: '12px',
  borderBottomRightRadius: '12px'
};

const filterPanelStyle = {
  backgroundColor: '#ffffff',
  padding: '16px 24px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '24px',
  alignItems: 'center',
};

const filterGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
};

const labelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
};

const inputStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  outline: 'none',
  width: '180px',
  color: '#334155',
  transition: 'border-color 0.2s',
};

const selectStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  outline: 'none',
  width: '200px',
  color: '#334155',
  backgroundColor: 'white',
  transition: 'border-color 0.2s',
  cursor: 'pointer',
};

const errorStyle = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fee2e2',
  color: '#b91c1c',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
};

const loadingContainerStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  height: '240px',
};

const emptyCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius)',
  padding: '48px 24px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'var(--shadow)',
  marginTop: '16px',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
  gap: '24px',
};

const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
};

const cardHeaderStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#fafafb',
};

const timestampStyle = {
  fontSize: '12px',
  color: '#64748b',
};

const cardContentStyle = {
  padding: '20px',
  display: 'flex',
  gap: '20px',
  flexWrap: 'wrap' as const,
  flex: 1,
};

const subSectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '12px',
  paddingBottom: '6px',
  borderBottom: '1px solid #f1f5f9',
};

const noItemsTextStyle = {
  color: '#94a3b8',
  fontSize: '13px',
  fontStyle: 'italic',
  margin: '8px 0',
};

const listStyle = {
  listStyleType: 'none',
  paddingLeft: 0,
  margin: 0,
};

const listItemStyle = {
  fontSize: '13.5px',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px dashed #f1f5f9',
};
