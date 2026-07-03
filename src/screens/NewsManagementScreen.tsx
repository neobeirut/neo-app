import { useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import { useNavigate } from 'react-router-dom';
import { Plus, Newspaper, Loader2, AlertCircle, Edit2, Trash2 } from 'lucide-react';

export default function NewsManagementScreen() {
  const navigate = useNavigate();
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase.from('RestaurantNews').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setNews(data as any[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Newspaper size={28} style={{ color: 'var(--primary)' }} /> News Management
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Create and publish restaurant news updates to the mobile app.
          </p>
        </div>
        <button 
          onClick={() => navigate('/news/new')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '10px 16px', 
            backgroundColor: 'var(--primary)', 
            color: 'white', 
            border: 'none', 
            borderRadius: 'var(--radius)', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <Plus size={20} /> Add News Item
        </button>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '24px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : error ? (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : news.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            <Newspaper size={48} style={{ marginBottom: '16px', color: '#9ca3af' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>No News Items</h3>
            <p style={{ fontSize: '14px', marginTop: '4px' }}>Click the button above to publish your first update.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {news.map((item) => (
              <div 
                key={item.id} 
                style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border)', 
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.title} 
                    style={{ width: '100%', height: '180px', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ width: '100%', height: '180px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <Newspaper size={40} />
                  </div>
                )}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{item.title}</h3>
                  <div 
                    className="news-content"
                    style={{ fontSize: '13.5px', color: 'var(--text-muted)', flex: 1, lineHeight: '1.5' }} 
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '10px' }}>
                    <button
                      onClick={() => navigate(`/news/edit/${item.id}`)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '6px 12px', 
                        border: '1px solid var(--border)', 
                        backgroundColor: '#fff', 
                        borderRadius: '6px', 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        color: 'var(--text-main)', 
                        cursor: 'pointer' 
                      }}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete the news item "${item.title}"?`)) {
                          await supabase.from('RestaurantNews').delete().eq('id', item.id);
                          fetchNews();
                        }
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '6px 12px', 
                        backgroundColor: 'var(--danger)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        cursor: 'pointer' 
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
