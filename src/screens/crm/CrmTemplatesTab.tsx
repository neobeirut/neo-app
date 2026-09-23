import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Tag, Globe, CheckCircle2, 
  Send, Sparkles, RefreshCw, X, MessageSquare
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { WhatsAppTemplate } from '../../api/crmService';

export default function CrmTemplatesTab() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Test modal
  const [testModalTemplate, setTestModalTemplate] = useState<WhatsAppTemplate | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>({});
  const [sendingTest, setSendingTest] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const list = await crmService.getTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category.toLowerCase())))];
  const languages = ['all', ...Array.from(new Set(templates.map(t => t.language.toLowerCase())))];

  const filtered = templates.filter(t => {
    if (categoryFilter !== 'all' && t.category.toLowerCase() !== categoryFilter) return false;
    if (languageFilter !== 'all' && t.language.toLowerCase() !== languageFilter) return false;
    if (search.trim() && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleTestSend = async () => {
    if (!testPhone.trim() || !testModalTemplate) return;
    setSendingTest(true);
    try {
      let populated = testModalTemplate.body;
      Object.keys(variableInputs).forEach(k => {
        populated = populated.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), variableInputs[k]);
      });

      // Find or create conversation for test phone
      const convs = await crmService.getConversations('all', testPhone.trim());
      let convId = convs.find(c => c.phone === testPhone.trim())?.id;
      if (!convId) {
        // Create conversation
        convId = (await crmService.sendMessage({
          conversationId: 'temp',
          text: populated,
          templateName: testModalTemplate.name,
        })).conversation_id;
      } else {
        await crmService.sendMessage({
          conversationId: convId,
          text: populated,
          templateName: testModalTemplate.name,
        });
      }

      alert('Template successfully sent to ' + testPhone);
      setTestModalTemplate(null);
      setTestPhone('');
      setVariableInputs({});
    } catch (err: any) {
      alert('Error sending template: ' + (err.message || 'Unknown error'));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search template name or body..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
            />
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: categoryFilter === c ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: categoryFilter === c ? '#eff6ff' : '#ffffff',
                  color: categoryFilter === c ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {filtered.length} Meta HSM Templates
          </span>
          <button
            onClick={loadTemplates}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
          Loading approved Meta templates...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          No templates found matching your filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filtered.map(t => {
            const hasVariables = /\{\{\d+\}\}/.test(t.body);
            return (
              <div
                key={t.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  padding: '16px',
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {t.name}
                      </h4>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {t.category}
                        </span>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {t.language}
                        </span>
                      </div>
                    </div>

                    <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> Approved
                    </span>
                  </div>

                  {/* Body preview bubble */}
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', padding: '12px', marginTop: '10px', fontSize: '12px', lineHeight: '1.5', color: 'var(--text-main)' }}>
                    {t.header && (
                      <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                        {t.header}
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {t.body.split(/(\{\{\d+\}\})/).map((part, i) => (
                        part.startsWith('{{') && part.endsWith('}}') ? (
                          <span key={i} style={{ backgroundColor: '#fef08a', color: '#854d0e', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      ))}
                    </div>
                    {t.footer && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        {t.footer}
                      </div>
                    )}

                    {t.buttons && Array.isArray(t.buttons) && t.buttons.length > 0 && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {t.buttons.map((b: any, bi: number) => (
                          <div key={bi} style={{ textAlign: 'center', padding: '4px', backgroundColor: '#ffffff', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600, fontSize: '11px' }}>
                            {b.text || b.label || 'Quick Action'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setTestModalTemplate(t);
                      setVariableInputs({});
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Send size={12} /> Test Send
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Test Send Modal */}
      {testModalTemplate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Test Send: {testModalTemplate.name}</h3>
              <button onClick={() => setTestModalTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Recipient Phone (+961...)</label>
              <input
                type="text"
                placeholder="+961..."
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              />
            </div>

            {Array.from(testModalTemplate.body.matchAll(/\{\{(\d+)\}\}/g)).map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).map(varIndex => (
              <div key={varIndex} style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Placeholder {`{{${varIndex}}}`}
                </label>
                <input
                  type="text"
                  placeholder={`Value for {{${varIndex}}}`}
                  value={variableInputs[varIndex] || ''}
                  onChange={e => setVariableInputs({ ...variableInputs, [varIndex]: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setTestModalTemplate(null)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTestSend}
                disabled={!testPhone.trim() || sendingTest}
                style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {sendingTest ? 'Sending...' : 'Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
