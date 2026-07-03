import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, Loader2, FileText, BookOpen, FolderTree, Trash2 } from 'lucide-react';

export default function SOPsScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'library' | 'categories'>('library');
  const [loading, setLoading] = useState(false);

  // Library State
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Category State
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSection, setNewCatSection] = useState('Knowledge Base Library');
  const [newSubName, setNewSubName] = useState('');
  const [newSubDept, setNewSubDept] = useState('Floor');

  const DEPARTMENTS = ['All', 'Kitchen', 'Bar', 'Pastry', 'Floor', 'Management'];

  useEffect(() => {
    fetchData();
  }, [activeTab, departmentFilter, categoryFilter]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'library') {
      const catId = categoryFilter === 'All' ? undefined : categoryFilter;
      const [docsRes, catsRes] = await Promise.all([
        api.getTrainingDocuments(catId, departmentFilter),
        api.getTrainingCategories()
      ]);
      if (docsRes.success && docsRes.data) setDocuments(docsRes.data);
      if (catsRes.success && catsRes.data) setCategories(catsRes.data);
    } else {
      const [catsRes, subsRes] = await Promise.all([
        api.getTrainingCategories(),
        api.getSubcategories()
      ]);
      if (catsRes.success && catsRes.data) setCategories(catsRes.data);
      if (subsRes.success && subsRes.data) setSubcategories(subsRes.data);
    }
    setLoading(false);
  };

  const handleAddCategory = async () => {
    if (!newCatName) return;
    setLoading(true);
    await api.addTrainingCategory(newCatName, undefined, undefined, newCatSection);
    setNewCatName('');
    fetchData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete this category?')) return;
    setLoading(true);
    await api.deleteTrainingCategory(id);
    fetchData();
  };

  const handleAddSubcategory = async () => {
    if (!newSubName) return;
    setLoading(true);
    await api.addSubcategory(newSubName, newSubDept);
    setNewSubName('');
    fetchData();
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!window.confirm('Delete this subcategory?')) return;
    setLoading(true);
    await api.deleteSubcategory(id);
    fetchData();
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(search.toLowerCase()) || 
    (doc.training_categories?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (doc.subcategory || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={28} style={{ color: 'var(--primary)' }} /> Training & Procedures
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage SOPs, Knowledge Base, and Training Modules.
          </p>
        </div>
        {activeTab === 'library' && (
          <button 
            onClick={() => navigate('/sops/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={20} /> Add SOP Record
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('library')}
          style={{ ...tabStyle, borderBottom: activeTab === 'library' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'library' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'library' ? 600 : 500 }}
        >
          <BookOpen size={18} /> Knowledge Base
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          style={{ ...tabStyle, borderBottom: activeTab === 'categories' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'categories' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'categories' ? 600 : 500 }}
        >
          <FolderTree size={18} /> Manage Categories
        </button>
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            
            {activeTab === 'library' && (
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search knowledge base..." 
                      value={search} 
                      onChange={e => setSearch(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: '38px' }} 
                    />
                  </div>
                  <select style={{ ...inputStyle, width: '200px' }} value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select style={{ ...inputStyle, width: '200px' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="All">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {filteredDocs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No documents found.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {filteredDocs.map(doc => (
                      <div 
                        key={doc.id} 
                        onClick={() => navigate(`/sops/edit/${doc.id}`)}
                        style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', cursor: 'pointer', transition: 'border-color 0.2s', backgroundColor: '#fff' }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'} 
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <FileText size={24} color="var(--primary)" />
                          <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>{doc.title}</h3>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Department:</span> {doc.department} {doc.subcategory ? `> ${doc.subcategory}` : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Category:</span> {doc.training_categories?.name || 'Uncategorized'}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {doc.video_url && <span style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Video</span>}
                          {doc.pdf_url && <span style={{ fontSize: '10px', backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>PDF Manual</span>}
                          <span style={{ fontSize: '10px', backgroundColor: '#f3f4f6', color: '#4b5563', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>{doc.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'categories' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
                
                {/* Categories */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', backgroundColor: '#f8f9fa' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Main Categories</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="text" placeholder="New Category Name" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={inputStyle} />
                      <select value={newCatSection} onChange={e => setNewCatSection(e.target.value)} style={{ ...inputStyle, width: '220px' }}>
                        <option value="Knowledge Base Library">Knowledge Base Library</option>
                        <option value="Employee Development">Employee Development</option>
                      </select>
                    </div>
                    <button onClick={handleAddCategory} style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>Add Category</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Knowledge Base Library</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {categories.filter(c => !c.section || c.section === 'Knowledge Base Library').map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <button onClick={() => handleDeleteCategory(c.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          </div>
                        ))}
                        {categories.filter(c => !c.section || c.section === 'Knowledge Base Library').length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No categories created.</div>}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee Development</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {categories.filter(c => c.section === 'Employee Development').map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <button onClick={() => handleDeleteCategory(c.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          </div>
                        ))}
                        {categories.filter(c => c.section === 'Employee Development').length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No categories created.</div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subcategories */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', backgroundColor: '#f8f9fa' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Department Subcategories</h3>
                  
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <select style={{...inputStyle, width: '120px'}} value={newSubDept} onChange={e => setNewSubDept(e.target.value)}>
                      {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="text" placeholder="Subcategory" value={newSubName} onChange={e => setNewSubName(e.target.value)} style={inputStyle} />
                    <button onClick={handleAddSubcategory} style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {subcategories.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{s.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({s.department})</span>
                        </div>
                        <button onClick={() => handleDeleteSubcategory(s.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                    {subcategories.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No subcategories created.</div>}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

const tabStyle = { padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' };
const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit' };
