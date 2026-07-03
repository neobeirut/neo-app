import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ChevronLeft, Save, FileText, Image as ImageIcon, Newspaper } from 'lucide-react';

// Custom Rich Text Editor Component
function RichTextEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  // Load the initial value into contentEditable exactly once
  useEffect(() => {
    if (editorRef.current && !isInitialized.current && value) {
      editorRef.current.innerHTML = value;
      isInitialized.current = true;
    }
  }, [value]);

  const execCommand = (command: string, arg: string = '') => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div style={editorContainerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button type="button" onClick={() => execCommand('bold')} style={toolbarBtnStyle} title="Bold">
          <b>B</b>
        </button>
        <button type="button" onClick={() => execCommand('italic')} style={toolbarBtnStyle} title="Italic">
          <i>I</i>
        </button>
        <button type="button" onClick={() => execCommand('underline')} style={toolbarBtnStyle} title="Underline">
          <u>U</u>
        </button>
        <span style={dividerStyle}>|</span>
        <button type="button" onClick={() => execCommand('insertUnorderedList')} style={toolbarBtnStyle} title="Bullet List">
          • Bullet List
        </button>
        <button type="button" onClick={() => execCommand('insertOrderedList')} style={toolbarBtnStyle} title="Numbered List">
          1. Numbered List
        </button>
        <span style={dividerStyle}>|</span>
        <button type="button" onClick={() => execCommand('removeFormat')} style={toolbarBtnStyle} title="Clear Formatting">
          Clear Format
        </button>
      </div>
      {/* Editing Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="news-content"
        style={editingAreaStyle}
      />
    </div>
  );
}

export default function NewsFormScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | undefined>(undefined);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      (async () => {
        const res = await api.getNews();
        if (res.success && res.data) {
          const item = res.data.find((n) => n.id === id);
          if (item) {
            setTitle(item.title);
            setDescription(item.description);
          }
        } else {
          setError(res.error || 'Failed to load news item');
        }
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!description.trim() || description === '<br>' || description === '<div><br></div>') {
      setError('Description content is required');
      return;
    }

    setSaving(true);
    try {
      const res = isEdit 
        ? await api.updateNewsItem(id!, { title, description, imageFile }) 
        : await api.addNewsItem({ title, description, imageFile });
      
      if (!res.success) {
        setError(res.error || 'Failed to save news');
        setSaving(false);
        return;
      }
      navigate('/news');
    } catch (e: any) {
      setError(e.message || 'Submission failed');
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading news form...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/news')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Newspaper size={28} style={{ color: 'var(--primary)' }} /> {isEdit ? 'Edit News Item' : 'Create News Item'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              {isEdit ? 'Modify the news announcement, title, content, or cover image.' : 'Publish a new announcement or update to the mobile application.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div style={formCardStyle}>
        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Title Field */}
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              <FileText size={16} style={{ marginRight: '6px' }} />
              News Title
            </label>
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g., Summer Menu Launch!"
              required 
              style={inputStyle}
            />
          </div>

          {/* Rich Text Description Field */}
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              News Content & Details (Rich Text)
            </label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>

          {/* Image Upload Field */}
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              <ImageIcon size={16} style={{ marginRight: '6px' }} />
              Cover Image (Optional)
            </label>
            <div style={uploadContainerStyle}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setImageFile(e.target.files?.[0])} 
                style={{ cursor: 'pointer' }}
              />
              {imageFile && (
                <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600 }}>
                  Selected: {imageFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={saving}
            style={submitBtnStyle}
          >
            <Save size={18} />
            {saving ? 'Saving...' : isEdit ? 'Update News' : 'Publish News'}
          </button>

        </form>
      </div>
    </div>
  );
}

// Styling definitions
const formCardStyle = {
  backgroundColor: '#ffffff',
  padding: '30px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
};



const formGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
};

const labelStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#475569',
  display: 'flex',
  alignItems: 'center',
};

const inputStyle = {
  padding: '10px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  fontSize: '15px',
  outline: 'none',
  width: '100%',
  color: '#334155',
  transition: 'border-color 0.2s',
};

const errorStyle = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fee2e2',
  color: '#b91c1c',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  marginBottom: '10px',
};

const uploadContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius)',
  backgroundColor: '#f8fafc',
};

const submitBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 20px',
  backgroundColor: '#1e5c4f', // Matches green brand theme
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  marginTop: '10px',
};

const editorContainerStyle = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  overflow: 'hidden',
  marginTop: '4px',
};

const toolbarStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '6px',
  padding: '8px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: '#f8fafc',
  alignItems: 'center',
};

const toolbarBtnStyle = {
  padding: '6px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  color: '#334155',
  transition: 'background-color 0.15s, border-color 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '32px',
};

const dividerStyle = {
  color: '#cbd5e1',
  margin: '0 4px',
  userSelect: 'none' as const,
};

const editingAreaStyle = {
  padding: '14px 16px',
  minHeight: '200px',
  outline: 'none',
  backgroundColor: '#fff',
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#334155',
};
