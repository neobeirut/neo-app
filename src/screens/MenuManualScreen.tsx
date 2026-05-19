import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MenuManualScreen() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    const res = await api.getMenuRecipes();
    if (res.success && res.data) {
      setRecipes(res.data);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredRecipes = recipes.filter(r => 
    r.item_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>Menu Manual</h1>
        <button 
          onClick={() => navigate('/menu/new')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--success)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={20} /> New Recipe
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search recipes by name..." 
          value={searchQuery}
          onChange={handleSearch}
          style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '16px' }}
        />
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Item Name</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Section</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map(recipe => (
                  <tr 
                    key={recipe.id} 
                    onClick={() => navigate(`/menu/edit/${recipe.id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontWeight: 600, color: 'var(--primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {recipe.inhouse_image_url || recipe.image_url ? (
                          <img src={recipe.inhouse_image_url || recipe.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#e9ecef' }} />
                        )}
                        {recipe.item_name}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ backgroundColor: '#eef2f5', color: '#007bff', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                        {recipe.menu_sections?.name}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {recipe.is_production ? (
                        <span style={{ backgroundColor: '#fdf5e6', color: '#d97706', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                          Production
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#e9f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                          Final Menu
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                      {new Date(recipe.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {filteredRecipes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No recipes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
