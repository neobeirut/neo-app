import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Layers, Plus, Edit2, Trash2, Search, Users, AlertCircle, CheckCircle2,
  X, ChevronRight, Hash, Eye, RefreshCw, FolderPlus
} from 'lucide-react';

interface StaffDepartment {
  id: string;
  restaurant_id: string;
  name: string;
  color?: string;
  display_order?: number;
  created_at?: string;
}

interface StaffSection {
  id: string;
  restaurant_id: string;
  department_id?: string;
  department_name: string;
  name: string;
  display_order?: number;
  created_at?: string;
}

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Slate', hex: '#64748b' }
];

export default function StaffDepartmentsScreen({ user }: { user?: any; permissions?: any }) {
  const [departments, setDepartments] = useState<StaffDepartment[]>([]);
  const [sections, setSections] = useState<StaffSection[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Department Modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<StaffDepartment | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptColor, setDeptColor] = useState('#3b82f6');
  const [deptOrder, setDeptOrder] = useState(0);

  // Section Modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<StaffSection | null>(null);
  const [sectionDeptName, setSectionDeptName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionOrder, setSectionOrder] = useState(0);

  // View Employees Modal
  const [viewingStaff, setViewingStaff] = useState<{ title: string; list: any[] } | null>(null);

  // Feedback states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, secRes, empRes] = await Promise.all([
        api.getStaffDepartments(),
        api.getStaffSections(),
        api.getEmployees()
      ]);

      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data);
      }
      if (secRes.success && secRes.data) {
        setSections(secRes.data);
      }
      if (empRes.success && empRes.data) {
        setEmployees(empRes.data);
      }
    } catch (e: any) {
      showNotification(e.message || 'Failed to load staff organization data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Calculations & groupings
  const getDeptEmployees = (deptNameStr: string) => {
    return employees.filter(e => (e.department || '').trim().toLowerCase() === deptNameStr.trim().toLowerCase());
  };

  const getSectionEmployees = (deptNameStr: string, secNameStr: string) => {
    return employees.filter(e => 
      (e.department || '').trim().toLowerCase() === deptNameStr.trim().toLowerCase() &&
      (e.sub_department || '').trim().toLowerCase() === secNameStr.trim().toLowerCase()
    );
  };

  // Open modals
  const handleOpenDeptModal = (dept?: StaffDepartment) => {
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.name);
      setDeptColor(dept.color || '#3b82f6');
      setDeptOrder(dept.display_order ?? 0);
    } else {
      setEditingDept(null);
      setDeptName('');
      setDeptColor('#3b82f6');
      setDeptOrder(departments.length + 1);
    }
    setShowDeptModal(true);
  };

  const handleOpenSectionModal = (defaultDeptName?: string, sec?: StaffSection) => {
    if (sec) {
      setEditingSection(sec);
      setSectionDeptName(sec.department_name);
      setSectionName(sec.name);
      setSectionOrder(sec.display_order ?? 0);
    } else {
      setEditingSection(null);
      setSectionDeptName(defaultDeptName || (departments[0]?.name ?? ''));
      setSectionName('');
      const countInDept = sections.filter(s => s.department_name === (defaultDeptName || departments[0]?.name)).length;
      setSectionOrder(countInDept + 1);
    }
    setShowSectionModal(true);
  };

  // Save Department
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = deptName.trim();
    if (!cleanName) {
      showNotification('Department name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: cleanName,
        color: deptColor,
        display_order: Number(deptOrder) || 0
      };
      if (editingDept) {
        payload.id = editingDept.id;
      }

      const res = await api.saveStaffDepartment(payload);
      if (res.success) {
        showNotification(editingDept ? 'Department updated successfully' : 'Department created successfully');
        setShowDeptModal(false);
        loadData();
      } else {
        showNotification(res.error || 'Failed to save department', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error saving department', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Department
  const handleDeleteDepartment = async (dept: StaffDepartment) => {
    const assigned = getDeptEmployees(dept.name);
    const linkedSecs = sections.filter(s => s.department_name.toLowerCase() === dept.name.toLowerCase());
    
    let confirmMsg = `Are you sure you want to delete the department "${dept.name}"?`;
    if (linkedSecs.length > 0) {
      confirmMsg += `\nThis will also delete its ${linkedSecs.length} linked sections.`;
    }
    if (assigned.length > 0) {
      confirmMsg += `\nWARNING: There are ${assigned.length} employees currently assigned to this department.`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.deleteStaffDepartment(dept.id);
      if (res.success) {
        showNotification(`Department "${dept.name}" deleted successfully`);
        loadData();
      } else {
        showNotification(res.error || 'Failed to delete department', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error deleting department', 'error');
    }
  };

  // Save Section
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sectionName.trim();
    if (!cleanName) {
      showNotification('Section name is required', 'error');
      return;
    }
    if (!sectionDeptName) {
      showNotification('Parent department is required', 'error');
      return;
    }

    const parentDept = departments.find(d => d.name.toLowerCase() === sectionDeptName.toLowerCase());

    setSaving(true);
    try {
      const payload: any = {
        department_name: sectionDeptName,
        department_id: parentDept?.id,
        name: cleanName,
        display_order: Number(sectionOrder) || 0
      };
      if (editingSection) {
        payload.id = editingSection.id;
      }

      const res = await api.saveStaffSection(payload);
      if (res.success) {
        showNotification(editingSection ? 'Section updated successfully' : 'Section created successfully');
        setShowSectionModal(false);
        loadData();
      } else {
        showNotification(res.error || 'Failed to save section', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error saving section', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Section
  const handleDeleteSection = async (sec: StaffSection) => {
    const assigned = getSectionEmployees(sec.department_name, sec.name);
    let confirmMsg = `Are you sure you want to delete the section "${sec.name}" from "${sec.department_name}"?`;
    if (assigned.length > 0) {
      confirmMsg += `\nWARNING: There are ${assigned.length} employees currently assigned to this section.`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.deleteStaffSection(sec.id);
      if (res.success) {
        showNotification(`Section "${sec.name}" deleted successfully`);
        loadData();
      } else {
        showNotification(res.error || 'Failed to delete section', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error deleting section', 'error');
    }
  };

  // Filtered departments
  const filteredDepartments = departments.filter(d => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const deptMatch = d.name.toLowerCase().includes(term);
    const secMatch = sections.some(s => s.department_name.toLowerCase() === d.name.toLowerCase() && s.name.toLowerCase().includes(term));
    return deptMatch || secMatch;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
                Staff Departments & Sections
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                Organize staff structure (e.g. Floor/Bar, Floor/Retail, Kitchen/Pastry). Distinct from item catalog.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => loadData()}
            title="Refresh"
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, #e2e8f0)',
              backgroundColor: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569'
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={() => handleOpenSectionModal()}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #c7d2fe',
              backgroundColor: '#e0e7ff',
              color: '#4338ca',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700
            }}
          >
            <Plus size={16} />
            New Section
          </button>
          <button
            onClick={() => handleOpenDeptModal()}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
            }}
          >
            <FolderPlus size={16} />
            New Department
          </button>
        </div>
      </div>

      {/* Stats row & Search */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Departments</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{departments.length}</div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Hash size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Sub-Dept Sections</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{sections.length}</div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Assigned Staff</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
              {employees.filter(e => !!e.department).length}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: '10px',
        border: '1px solid var(--border, #e2e8f0)',
        padding: '8px 14px',
        maxWidth: '450px'
      }}>
        <Search size={18} color="#94a3b8" style={{ marginRight: '10px' }} />
        <input
          type="text"
          placeholder="Filter departments or sections..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: '14px',
            color: '#1e293b'
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 12px auto', color: '#4f46e5' }} />
          <div>Loading staff departments & sections...</div>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px dashed var(--border, #cbd5e1)'
        }}>
          <Layers size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#334155' }}>No Departments Found</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>
            {searchTerm ? 'No results matched your search term.' : 'Get started by creating your first staff department.'}
          </p>
          <button
            onClick={() => handleOpenDeptModal()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Add Department
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px'
        }}>
          {filteredDepartments.map(dept => {
            const deptStaff = getDeptEmployees(dept.name);
            const deptSections = sections.filter(
              s => s.department_name.toLowerCase() === dept.name.toLowerCase()
            );

            return (
              <div
                key={dept.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '14px',
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Department Header Accent */}
                <div style={{ height: '5px', backgroundColor: dept.color || '#3b82f6' }} />

                <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Department Title & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: dept.color || '#3b82f6',
                          display: 'inline-block'
                        }}
                      />
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
                        {dept.name}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleOpenDeptModal(dept)}
                        title="Edit Department"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#64748b'
                        }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(dept)}
                        title="Delete Department"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#ef4444'
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Badges / Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <button
                      onClick={() => setViewingStaff({ title: `Department: ${dept.name}`, list: deptStaff })}
                      style={{
                        background: '#f1f5f9',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Users size={13} color="#64748b" />
                      {deptStaff.length} {deptStaff.length === 1 ? 'employee' : 'employees'}
                      <Eye size={12} color="#64748b" />
                    </button>

                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Order: {dept.display_order ?? 0}
                    </span>
                  </div>

                  {/* Sections Section Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '8px',
                    marginBottom: '10px'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Linked Sections ({deptSections.length})
                    </span>
                    <button
                      onClick={() => handleOpenSectionModal(dept.name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#4f46e5',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 6px'
                      }}
                    >
                      <Plus size={13} />
                      Add Section
                    </button>
                  </div>

                  {/* Sections List */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {deptSections.length === 0 ? (
                      <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px dashed #e2e8f0',
                        fontSize: '13px',
                        color: '#94a3b8'
                      }}>
                        No sub-department sections configured.
                        <div style={{ marginTop: '4px' }}>
                          <button
                            onClick={() => handleOpenSectionModal(dept.name)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#4f46e5',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textDecoration: 'underline'
                            }}
                          >
                            + Add first section
                          </button>
                        </div>
                      </div>
                    ) : (
                      deptSections.map(sec => {
                        const secStaff = getSectionEmployees(dept.name, sec.name);
                        return (
                          <div
                            key={sec.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #f1f5f9'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>•</span>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                                {sec.name}
                              </span>
                              <button
                                onClick={() => setViewingStaff({ title: `${dept.name} / ${sec.name}`, list: secStaff })}
                                title="View assigned employees"
                                style={{
                                  background: secStaff.length > 0 ? '#e0e7ff' : '#f1f5f9',
                                  border: 'none',
                                  cursor: secStaff.length > 0 ? 'pointer' : 'default',
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: secStaff.length > 0 ? '#4338ca' : '#94a3b8',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {secStaff.length} staff
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <button
                                onClick={() => handleOpenSectionModal(dept.name, sec)}
                                title="Edit Section"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  color: '#94a3b8'
                                }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteSection(sec)}
                                title="Delete Section"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  color: '#ef4444'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT DEPARTMENT ================= */}
      {showDeptModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {editingDept ? 'Edit Department' : 'New Staff Department'}
              </h3>
              <button
                onClick={() => setShowDeptModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Floor, Kitchen, Management..."
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Badge Color
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setDeptColor(c.hex)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: c.hex,
                        border: deptColor === c.hex ? '3px solid #0f172a' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none'
                      }}
                      title={c.name}
                    >
                      {deptColor === c.hex && <CheckCircle2 size={16} color="#fff" />}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={deptColor}
                    onChange={e => setDeptColor(e.target.value)}
                    style={{ width: '40px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Custom hex: {deptColor}</span>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Display Order
                </label>
                <input
                  type="number"
                  value={deptOrder}
                  onChange={e => setDeptOrder(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT SECTION ================= */}
      {showSectionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {editingSection ? 'Edit Section' : 'New Sub-Department Section'}
              </h3>
              <button
                onClick={() => setShowSectionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSection} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Parent Department *
                </label>
                <select
                  required
                  value={sectionDeptName}
                  onChange={e => setSectionDeptName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Section Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bar, Retail, Pastry, Service..."
                  value={sectionName}
                  onChange={e => setSectionName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Display Order
                </label>
                <input
                  type="number"
                  value={sectionOrder}
                  onChange={e => setSectionOrder(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : editingSection ? 'Update Section' : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW ASSIGNED STAFF ================= */}
      {viewingStaff && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Assigned Staff
                </h3>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {viewingStaff.title} • {viewingStaff.list.length} {viewingStaff.list.length === 1 ? 'employee' : 'employees'}
                </div>
              </div>
              <button
                onClick={() => setViewingStaff(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {viewingStaff.list.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  No employees currently assigned to this unit.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                      <th style={{ padding: '8px 12px' }}>Name</th>
                      <th style={{ padding: '8px 12px' }}>Branch</th>
                      <th style={{ padding: '8px 12px' }}>Position</th>
                      <th style={{ padding: '8px 12px' }}>Sub-Department</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingStaff.list.map((emp: any) => (
                      <tr key={emp.employee_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>
                          {emp.first_name} {emp.last_name}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {emp.branch || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {emp.position || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {emp.sub_department || <span style={{ color: '#94a3b8' }}>None</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: emp.is_active !== false ? '#dcfce7' : '#fee2e2',
                            color: emp.is_active !== false ? '#15803d' : '#b91c1c'
                          }}>
                            {emp.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setViewingStaff(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
