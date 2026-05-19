import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Loader2, Upload, FileText, Video } from 'lucide-react';

const DEPARTMENTS = ['Kitchen', 'Bar', 'Pastry', 'Floor', 'Management', 'All'];

export default function SOPFormScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('Floor');
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [status, setStatus] = useState('Active');
  
  const [pdfUrl, setPdfUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  
  const [uploadingPdf, setUploadingPdf] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [catsRes, subsRes] = await Promise.all([
      api.getTrainingCategories(),
      api.getSubcategories()
    ]);
    
    if (catsRes.success && catsRes.data) {
      setCategories(catsRes.data);
      if (!id && catsRes.data.length > 0) setCategoryId(catsRes.data[0].id);
    }
    if (subsRes.success && subsRes.data) {
      setSubcategories(subsRes.data);
    }

    if (id) {
      const res = await api.getTrainingDocuments();
      if (res.success && res.data) {
        const doc = res.data.find((d: any) => d.id === id);
        if (doc) {
          setTitle(doc.title || '');
          setDescription(doc.description || '');
          setDepartment(doc.department || 'Floor');
          setCategoryId(doc.category_id || '');
          setSubcategory(doc.subcategory || '');
          setStatus(doc.status || 'Active');
          setPdfUrl(doc.pdf_url || '');
          setVideoUrl(doc.video_url || '');
        }
      }
      setInitialLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPdf(true);
    const res = await api.uploadTrainingMedia(file);
    setUploadingPdf(false);
    
    if (res.success && res.url) {
      setPdfUrl(res.url);
    } else {
      alert(res.error || 'Failed to upload document.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('Title is required');
    if (!categoryId) return alert('Category is required');

    setLoading(true);
    
    const doc = {
      ...(id ? { id } : {}),
      title,
      description,
      department,
      category_id: categoryId,
      subcategory,
      status,
      pdf_url: pdfUrl,
      video_url: videoUrl
    };

    const res = await api.saveTrainingDocument(doc);
    setLoading(false);
    
    if (res.success) {
      navigate('/sops');
    } else {
      alert(res.error || 'Failed to save document');
    }
  };

  if (initialLoading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;

  const availableSubcategories = subcategories.filter(s => s.department === department);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/sops')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>
          {id ? 'Edit Training Record' : 'New Training Record'}
        </h1>
      </div>

      <form onSubmit={handleSave} style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div>
          <label style={labelStyle}>Document Title *</label>
          <input type="text" style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Opening Procedure Checklist" />
        </div>

        <div>
          <label style={labelStyle}>Category *</label>
          <select style={inputStyle} value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
            <option value="" disabled>Select a category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Subcategory</label>
            <select style={inputStyle} value={subcategory} onChange={e => setSubcategory(e.target.value)}>
              <option value="">None</option>
              {availableSubcategories.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Description / Notes</label>
          <textarea style={{...inputStyle, height: '80px'}} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief overview of this SOP..." />
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>Attached Media</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '6px'}}><FileText size={16} /> PDF Document URL</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" style={{...inputStyle, flex: 1}} value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} placeholder="https://..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '4px', cursor: 'pointer' }}>
                {uploadingPdf ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf} />
              </label>
            </div>
            {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--primary)', display: 'block', marginTop: '4px' }}>View Current PDF</a>}
          </div>

          <div>
            <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '6px'}}><Video size={16} /> Training Video URL (YouTube, Vimeo, MP4)</label>
            <input type="text" style={inputStyle} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." />
            {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--primary)', display: 'block', marginTop: '4px' }}>Test Video Link</a>}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <button 
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '12px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          {loading ? <Loader2 className="spin" size={20} /> : 'Save Training Record'}
        </button>

      </form>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'inherit' };
