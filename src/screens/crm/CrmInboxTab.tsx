import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Filter, Send, MessageSquare, Phone, User, Tag, 
  Clock, Check, CheckCheck, AlertCircle, RefreshCw, ExternalLink,
  ChevronRight, Sparkles, FileText, X, Plus, ShieldCheck, MapPin
} from 'lucide-react';
import { crmService } from '../../api/crmService';
import type { 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppContact,
  WhatsAppTemplate 
} from '../../api/crmService';

interface CrmInboxTabProps {
  initialPhone?: string | null;
  onNavigateToContacts?: () => void;
}

export default function CrmInboxTab({ initialPhone, onNavigateToContacts }: CrmInboxTabProps) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'active'>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [contactNotes, setContactNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversations
  const loadConversations = async (silent = false) => {
    if (!silent) setLoadingConvs(true);
    try {
      const data = await crmService.getConversations(filter, search);
      setConversations(data);
      if (!selectedConv && data.length > 0) {
        const target = initialPhone 
          ? (data.find(c => c.phone === initialPhone || c.contact?.phone_e164 === initialPhone) || data[0])
          : data[0];
        setSelectedConv(target);
        loadMessages(target.id, silent);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      if (!silent) setLoadingConvs(false);
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (convId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const msgs = await crmService.getMessages(convId);
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Load templates
  const loadTemplates = async () => {
    try {
      const list = await crmService.getTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  useEffect(() => {
    loadConversations();
    loadTemplates();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadConversations(true);
      if (selectedConv?.id) {
        loadMessages(selectedConv.id, true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [filter, search]);

  useEffect(() => {
    if (selectedConv?.id) {
      loadMessages(selectedConv.id);
      crmService.markConversationRead(selectedConv.id);
      setContactNotes(selectedConv.contact?.notes || '');
    }
  }, [selectedConv?.id]);

  const handleSendMessage = async () => {
    if (!selectedConv || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const text = replyText.trim();
      setReplyText('');
      await crmService.sendMessage({
        conversationId: selectedConv.id,
        text,
        contactId: selectedConv.contact_id,
      });

      // Human Takeover: When staff replies manually, suppress automated AI replies
      if (selectedConv.ai_mode === 'ACTIVE') {
        await crmService.toggleAiMode(selectedConv.id, 'HUMAN_TAKEOVER').catch(() => {});
        setSelectedConv(prev => prev ? { ...prev, ai_mode: 'HUMAN_TAKEOVER' } : null);
      }

      await loadMessages(selectedConv.id, true);
      await loadConversations(true);
    } catch (err: any) {
      alert('Failed to send message: ' + (err.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!selectedConv || !selectedTemplate) return;
    setSending(true);
    try {
      let populatedBody = selectedTemplate.body;
      Object.keys(templateParams).forEach(k => {
        populatedBody = populatedBody.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), templateParams[k]);
      });

      await crmService.sendMessage({
        conversationId: selectedConv.id,
        text: populatedBody,
        contactId: selectedConv.contact_id,
        templateName: selectedTemplate.name,
        templateParams,
      });

      setShowTemplateModal(false);
      setSelectedTemplate(null);
      setTemplateParams({});
      await loadMessages(selectedConv.id, true);
      await loadConversations(true);
    } catch (err: any) {
      alert('Failed to send template: ' + (err.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedConv?.contact?.id) return;
    setSavingNotes(true);
    try {
      const updated = await crmService.updateContact(selectedConv.contact.id, {
        notes: contactNotes,
      });
      setSelectedConv(prev => prev ? { ...prev, contact: updated } : null);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddTag = async () => {
    if (!selectedConv?.contact?.id || !newTag.trim()) return;
    const currentTags = selectedConv.contact.tags || [];
    if (currentTags.includes(newTag.trim())) return;
    const updatedTags = [...currentTags, newTag.trim()];
    try {
      const updated = await crmService.updateContact(selectedConv.contact.id, {
        tags: updatedTags,
      });
      setSelectedConv(prev => prev ? { ...prev, contact: updated } : null);
      setNewTag('');
      setShowAddTag(false);
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedConv?.contact?.id) return;
    const currentTags = selectedConv.contact.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    try {
      const updated = await crmService.updateContact(selectedConv.contact.id, {
        tags: updatedTags,
      });
      setSelectedConv(prev => prev ? { ...prev, contact: updated } : null);
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 260px', height: 'calc(100vh - 165px)', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)', width: '100%' }}>
      {/* ----------------- LEFT PANE: CONVERSATION LIST ----------------- */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', backgroundColor: '#fcfcfd', minWidth: 0, overflow: 'hidden' }}>
        {/* Search & Filters */}
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search phone or message..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'unread', 'active'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: filter === f ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: filter === f ? '#eff6ff' : '#ffffff',
                  color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer'
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs && conversations.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <RefreshCw size={16} className="animate-spin" style={{ marginRight: '6px' }} /> Loading chats...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No conversations found.
            </div>
          ) : (
            conversations.map(c => {
              const isSelected = selectedConv?.id === c.id;
              const displayName = c.contact?.name || c.phone;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedConv(c)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    transition: 'background-color 0.15s'
                  }}
                >
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'var(--primary)' : '#e2e8f0',
                    color: isSelected ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatTimestamp(c.last_message_at)}
                      </span>
                    </div>

                    <p style={{
                      fontSize: '12px',
                      color: isSelected ? '#1e40af' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      margin: 0
                    }}>
                      {c.last_message || c.last_message_preview || 'No messages yet'}
                    </p>

                    <div style={{ display: 'flex', gap: '5px', marginTop: '4px', alignItems: 'center' }}>
                      {c.unread_count > 0 && (
                        <span style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                          {c.unread_count}
                        </span>
                      )}
                      {c.session_active && (
                        <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px' }}>
                          Active 24h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------- MIDDLE PANE: CHAT THREAD ----------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', minWidth: 0, overflow: 'hidden' }}>
        {selectedConv ? (
          <>
            {/* Thread Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {(selectedConv.contact?.name || selectedConv.phone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedConv.contact?.name || selectedConv.phone}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>{selectedConv.phone}</span>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '1px 6px', 
                      borderRadius: '4px', 
                      fontWeight: 700, 
                      backgroundColor: selectedConv.provider === 'meta' || !selectedConv.concept_id || selectedConv.concept_id.endsWith('1') ? '#e0f2fe' : '#fce7f3', 
                      color: selectedConv.provider === 'meta' || !selectedConv.concept_id || selectedConv.concept_id.endsWith('1') ? '#0369a1' : '#be185d' 
                    }}>
                      {selectedConv.provider === 'meta' || !selectedConv.concept_id || selectedConv.concept_id.endsWith('1') ? 'NÉO • Meta Cloud API (Badaro)' : 'OVRLOAD • Infobip'}
                    </span>
                    {selectedConv.session_active ? (
                      <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ● 24h Window Active
                      </span>
                    ) : (
                      <span style={{ color: '#ca8a04', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ⚠️ Window expired
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* AI Mode & Human Takeover Controls */}
                {selectedConv.ai_mode === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await crmService.toggleAiMode(selectedConv.id, 'HUMAN_TAKEOVER').catch(() => {});
                      setSelectedConv(prev => prev ? { ...prev, ai_mode: 'HUMAN_TAKEOVER' } : null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Click to take over conversation from AI"
                  >
                    🤖 AI Active • Click to Take Over
                  </button>
                ) : selectedConv.ai_mode === 'HUMAN_TAKEOVER' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await crmService.toggleAiMode(selectedConv.id, 'ACTIVE').catch(() => {});
                      setSelectedConv(prev => prev ? { ...prev, ai_mode: 'ACTIVE' } : null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Click to hand conversation back to AI Assistant"
                  >
                    👤 Staff Engaged • Return to AI
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                    AI Off (Human Only)
                  </span>
                )}

                <a
                  href={`https://wa.me/${selectedConv.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={14} /> Open WA
                </a>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading chat history...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No messages in this conversation yet. Send a message or template below!
                </div>
              ) : (
                messages.map(m => {
                  const isOutbound = m.direction === 'outbound';
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isOutbound ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        alignSelf: isOutbound ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: isOutbound ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          backgroundColor: isOutbound ? 'var(--primary)' : '#ffffff',
                          color: isOutbound ? '#ffffff' : 'var(--text-main)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          fontSize: '13px',
                          lineHeight: '1.4',
                          border: isOutbound ? 'none' : '1px solid var(--border)'
                        }}
                      >
                        {m.template_name && (
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            marginBottom: '4px',
                            color: isOutbound ? '#bfdbfe' : 'var(--primary)'
                          }}>
                            Template: {m.template_name}
                          </div>
                        )}
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text_content}</p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>{formatTimestamp(m.created_at)}</span>
                        {isOutbound && (
                          <span>
                            {m.status === 'read' ? (
                              <CheckCheck size={12} color="#3b82f6" />
                            ) : m.status === 'delivered' ? (
                              <CheckCheck size={12} />
                            ) : m.status === 'sent' ? (
                              <Check size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Box */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title="Send HSM Template"
                >
                  <Sparkles size={14} color="var(--primary)" /> Templates
                </button>

                <input
                  type="text"
                  placeholder="Type WhatsApp reply..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!replyText.trim() || sending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: (!replyText.trim() || sending) ? 'not-allowed' : 'pointer',
                    opacity: (!replyText.trim() || sending) ? 0.6 : 1
                  }}
                >
                  <Send size={14} /> Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Select a conversation from the left to start messaging.
          </div>
        )}
      </div>

      {/* ----------------- RIGHT PANE: CUSTOMER INFO DRAWER ----------------- */}
      <div style={{ borderLeft: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#ffffff', overflowY: 'auto', minWidth: 0 }}>
        {selectedConv ? (
          <>
            <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 700,
                margin: '0 auto 10px'
              }}>
                {(selectedConv.contact?.name || selectedConv.phone).charAt(0).toUpperCase()}
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                {selectedConv.contact?.name || 'Unregistered Guest'}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedConv.phone}
              </p>

              <div style={{ marginTop: '8px' }}>
                {selectedConv.contact?.whatsapp_opt_in !== false ? (
                  <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} /> WhatsApp Opted-In
                  </span>
                ) : (
                  <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px' }}>
                    Opted-Out
                  </span>
                )}
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Tags</span>
                <button
                  type="button"
                  onClick={() => setShowAddTag(!showAddTag)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <Plus size={12} /> Add Tag
                </button>
              </div>

              {showAddTag && (
                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="New tag..."
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    style={{ padding: '4px 8px', backgroundColor: 'var(--primary)', color: '#fff', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {(selectedConv.contact?.tags || ['VIP', 'Active Customer']).map((t, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Tag size={10} /> {t}
                    {selectedConv.contact?.id && (
                      <X size={10} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(t)} />
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>CRM Notes</span>
                {selectedConv.contact?.id && (
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={contactNotes}
                onChange={e => setContactNotes(e.target.value)}
                placeholder="Add private customer preferences or notes here..."
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>

            {/* Latest Location if available */}
            {selectedConv.latest_location_address && (
              <div style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  <MapPin size={14} color="var(--primary)" /> Pinned Delivery Location
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  {selectedConv.latest_location_address}
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px' }}>
            No contact selected
          </div>
        )}
      </div>

      {/* ----------------- MODAL: SEND HSM TEMPLATE ----------------- */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '540px',
            padding: '20px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Select WhatsApp HSM Template</h3>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Template</label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={e => {
                  const t = templates.find(item => item.id === Number(e.target.value));
                  setSelectedTemplate(t || null);
                  setTemplateParams({});
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              >
                <option value="">-- Choose an approved template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category} • {t.language})</option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Template Preview
                  </div>
                  {selectedTemplate.header && (
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>{selectedTemplate.header}</div>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                    {selectedTemplate.body}
                  </div>
                  {selectedTemplate.footer && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{selectedTemplate.footer}</div>
                  )}
                </div>

                {/* Variable inputs if any placeholders like {{1}}, {{2}} exist */}
                {Array.from(selectedTemplate.body.matchAll(/\{\{(\d+)\}\}/g)).map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).map(varIndex => (
                  <div key={varIndex} style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Parameter {`{{${varIndex}}}`}
                    </label>
                    <input
                      type="text"
                      placeholder={`Value for {{${varIndex}}}`}
                      value={templateParams[varIndex] || ''}
                      onChange={e => setTemplateParams(prev => ({ ...prev, [varIndex]: e.target.value }))}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                    />
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTemplate}
                    disabled={sending}
                    style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {sending ? 'Sending...' : 'Send to Customer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
