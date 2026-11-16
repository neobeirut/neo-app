import React, { useState, useEffect } from 'react';
import { 
  Bot, Sparkles, Shield, AlertTriangle, CheckCircle, 
  Settings, Play, RefreshCw, BookOpen, Sliders, Database,
  MessageSquare, User, Send, ChevronRight, Lock, DollarSign, Clock, Layers, Calendar
} from 'lucide-react';
import { aiOrchestrator } from '../../services/aiOrchestratorService';
import type { AiModelId, OrchestrationResult } from '../../services/aiOrchestratorService';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}

interface ChatTurn {
  id: string;
  role: 'customer' | 'assistant';
  text: string;
  timestamp: string;
  language?: string;
  latencyMs?: number;
  tokens?: { input: number; output: number; total: number };
  estimatedCostUsd?: number;
  toolCalls?: Array<{ tool: string; params: any; result: any }>;
  evidenceProvenance?: any[];
  informationStatus?: string;
  validationOutcome?: { isValid: boolean; violations: string[]; warnings: string[] };
  escalationRequired?: boolean;
  escalationReason?: string;
  executionMode?: 'AI_INFERENCE' | 'DETERMINISTIC_RULE' | 'CACHED';
  provider?: string;
}

export default function CrmAiAssistantTab() {
  // Global Settings State
  const [aiEnabled, setAiEnabled] = useState(false);
  const [humanTakeoverActive, setHumanTakeoverActive] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AiModelId>('gemini-2.5-flash');
  const [savingSettings, setSavingSettings] = useState(false);

  // Cumulative telemetry metrics
  const [cumulativeTokens, setCumulativeTokens] = useState({ input: 0, output: 0, total: 0 });
  const [cumulativeCostUsd, setCumulativeCostUsd] = useState(0);

  // Evidence & Provenance State
  const [lastEvidenceProvenance, setLastEvidenceProvenance] = useState<any[]>([]);
  const [lastInformationStatus, setLastInformationStatus] = useState<string>('VERIFIED');
  const [lastValidationOutcome, setLastValidationOutcome] = useState<any>(null);

  // Knowledge Base State
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([
    {
      id: 'kb-1',
      category: 'BUSINESS_INFO',
      title: 'Active Branch Location & Operating Hours',
      content: 'NÉO operates exclusively at our Badaro flagship branch on Badaro Main Street, Beirut (+961 3 501 444). Opening hours: 07:30 AM to 11:00 PM (23:00) daily. Delivery hours: 08:00 AM to 09:30 PM (21:30) daily within a 5 km radius. Naccache (Zero4) and BDD branches are permanently closed.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-2',
      category: 'PLAT_DU_JOUR',
      title: 'Approved Weekly Plat du Jour (Nov 16–20, 2026)',
      content: 'Mon: Bœuf Bourguignon ($25) | Tue: Escalope Cordon Bleu au Comté ($25) | Wed: Paella aux fruits de mer ($27) | Thu: Lasagne à la Bolognaise ($22) | Fri: Dorade ($28). Served daily from 12:00 PM.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-3',
      category: 'RESERVATIONS',
      title: 'Table Reservation Guidelines',
      content: 'Table reservations are registered in Pending status and require final staff confirmation. Indoor and terrace seating available. Pending status is never communicated as confirmed.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-4',
      category: 'PREORDERS',
      title: 'Plat du Jour & Custom Cake Preorders',
      content: 'Plat du Jour preorders registered as Inquiry in client_orders. Custom cakes require 72 hours notice and head pastry chef review before price commitment.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-5',
      category: 'POLICIES',
      title: 'Laptop & Dining Policy',
      content: 'At NÉO Badaro, laptops are permitted indoors and strictly prohibited outdoors on the terrace, unless management explicitly updates the policy.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-6',
      category: 'DIETARY_DESSERTS',
      title: 'Sugar-Free Desserts Policy (Authoritative)',
      content: 'NÉO currently does not offer sugar-free desserts. All pastries, cakes, and tarts contain standard sugar. For Lebanese Arabic inquiries ("عندكن شي حلو بلا سكر؟"), response is strictly: "مرحبا! 💚 حالياً ما عنا حلويات خالية من السكر، بس فينا نساعدك تختار من تشكيلة الحلويات الموجودة عنا."',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-7',
      category: 'DIETARY_BREAD',
      title: 'Gluten-Free Bread Policy (Authoritative)',
      content: 'NÉO currently does not offer gluten-free bread. All artisanal loaves (Pain de Campagne, Baguette Tradition, Ciabatta, Pain de mie) are baked with traditional wheat and sourdough containing gluten.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-8',
      category: 'DIETARY_VEGAN',
      title: 'Vegan Desserts Policy (Authoritative)',
      content: 'NÉO currently does not offer verified vegan desserts. All French pastries, cakes, and viennoiseries contain traditional dairy (butter, milk, cream) and fresh eggs.',
      is_active: true,
      updated_at: '2026-11-15'
    },
    {
      id: 'kb-9',
      category: 'ALLERGEN_SAFETY',
      title: 'Allergen Management & Cross-Contamination Safety',
      content: 'Never guarantee allergy safety based solely on ingredient information. Tree nuts (hazelnuts, almonds, walnuts), dairy, gluten, and eggs are handled daily in our open bakery and kitchen with risk of cross-contamination. Severe allergy inquiries must be escalated to the duty manager or head chef at Badaro.',
      is_active: true,
      updated_at: '2026-11-15'
    }
  ]);

  // Persistent Session & Simulator State
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem('flow_neo_sim_session_id');
      if (stored) return stored;
      const created = `sim_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('flow_neo_sim_session_id', created);
      return created;
    } catch {
      return `sim_session_${Date.now()}`;
    }
  });

  const [testInput, setTestInput] = useState('Hi, can I reserve a table at 9 PM?');
  const [simulating, setSimulating] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatTurn[]>(() => {
    try {
      const saved = sessionStorage.getItem('flow_neo_sim_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastToolTrace, setLastToolTrace] = useState<any[]>([]);
  const [authenticatedCustomer, setAuthenticatedCustomer] = useState<'jad' | 'freddy' | 'new'>('jad');
  const [activeReservationDraft, setActiveReservationDraft] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('flow_neo_sim_draft');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeOrderDraft, setActiveOrderDraft] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('flow_neo_sim_order_draft');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const customerProfiles = {
    jad: { name: 'Jad Khoury', phone: '+96171889900', label: 'Jad Khoury (+961 71 889 900 - Saved Badaro Address)' },
    freddy: { name: 'Freddy', phone: '+9613361515', label: 'Freddy (+961 3 361 515)' },
    new: { name: '', phone: '', label: 'New / Unsaved Customer' }
  };

  // Save history and drafts to sessionStorage whenever updated
  useEffect(() => {
    try {
      sessionStorage.setItem('flow_neo_sim_history', JSON.stringify(conversationHistory));
    } catch {}
  }, [conversationHistory]);

  useEffect(() => {
    try {
      if (activeReservationDraft) {
        sessionStorage.setItem('flow_neo_sim_draft', JSON.stringify(activeReservationDraft));
      } else {
        sessionStorage.removeItem('flow_neo_sim_draft');
      }
    } catch {}
  }, [activeReservationDraft]);

  useEffect(() => {
    try {
      if (activeOrderDraft) {
        sessionStorage.setItem('flow_neo_sim_order_draft', JSON.stringify(activeOrderDraft));
      } else {
        sessionStorage.removeItem('flow_neo_sim_order_draft');
      }
    } catch {}
  }, [activeOrderDraft]);

  const handleSimulate = async () => {
    if (!testInput.trim() || simulating) return;
    const inputText = testInput.trim();
    setTestInput('');
    setSimulating(true);

    const userTurn: ChatTurn = {
      id: `turn-user-${Date.now()}`,
      role: 'customer',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...conversationHistory, userTurn];
    setConversationHistory(updatedHistory);

    try {
      let resultData: any = null;
      const currentCustomer = customerProfiles[authenticatedCustomer];

      // Send to server-side AI orchestrator with persistent conversationId and full history
      try {
        const resp = await fetch('/api/ai/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: inputText,
            phone: currentCustomer.phone,
            name: currentCustomer.name,
            model: selectedModel,
            aiMode: humanTakeoverActive ? 'HUMAN_TAKEOVER' : 'ACTIVE',
            conceptId: '00000000-0000-0000-0000-000000000001',
            conversationId: sessionId,
            history: conversationHistory.map(t => ({
              role: t.role === 'customer' ? 'user' : 'model',
              text: t.text
            }))
          })
        });

        if (resp.ok) {
          const json = await resp.json();
          if (json.success && json.data) {
            resultData = json.data;
          } else {
            resultData = {
              replyText: `⚠️ SERVER ERROR: ${json.error || 'Unknown server error'}`,
              executionMode: 'PROVIDER_ERROR',
              provider: 'Server',
              latencyMs: 0,
              tokensUsed: { input: 0, output: 0, total: 0 },
              estimatedCostUsd: 0
            };
          }
        } else {
          resultData = {
            replyText: `⚠️ HTTP ${resp.status} ERROR: Failed to contact AI Orchestrator at /api/ai/orchestrate`,
            executionMode: 'PROVIDER_ERROR',
            provider: 'Server',
            latencyMs: 0,
            tokensUsed: { input: 0, output: 0, total: 0 },
            estimatedCostUsd: 0
          };
        }
      } catch (err: any) {
        resultData = {
          replyText: `⚠️ NETWORK ERROR: ${err.message || 'Unable to connect to /api/ai/orchestrate'}`,
          executionMode: 'PROVIDER_ERROR',
          provider: 'Network',
          latencyMs: 0,
          tokensUsed: { input: 0, output: 0, total: 0 },
          estimatedCostUsd: 0
        };
      }

      const inputTok = resultData.tokensUsed?.input || 220;
      const outputTok = resultData.tokensUsed?.output || 85;
      const totalTok = resultData.tokensUsed?.total || (inputTok + outputTok);
      const costUsd = resultData.estimatedCostUsd || (totalTok * 0.00000015);

      setCumulativeTokens(prev => ({
        input: prev.input + inputTok,
        output: prev.output + outputTok,
        total: prev.total + totalTok
      }));
      setCumulativeCostUsd(prev => prev + costUsd);

      if (resultData.reservationDraft) {
        setActiveReservationDraft(resultData.reservationDraft);
      }
      if (resultData.orderDraft) {
        setActiveOrderDraft(resultData.orderDraft);
      }

      const assistantTurn: ChatTurn = {
        id: `turn-asst-${Date.now()}`,
        role: 'assistant',
        text: resultData.suppressed ? '*(AI automated reply suppressed due to active Human Takeover mode)*' : resultData.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: resultData.detectedLanguage,
        latencyMs: resultData.latencyMs,
        tokens: { input: inputTok, output: outputTok, total: totalTok },
        estimatedCostUsd: costUsd,
        toolCalls: resultData.toolCallsExecuted || [],
        evidenceProvenance: resultData.evidenceProvenance || [],
        informationStatus: resultData.informationStatus || 'VERIFIED',
        validationOutcome: resultData.validationOutcome || { isValid: true, violations: [], warnings: [] },
        escalationRequired: resultData.escalationRequired,
        escalationReason: resultData.escalationReason,
        executionMode: resultData.executionMode || 'AI_INFERENCE',
        provider: resultData.provider || 'Google (gemini-2.5-flash)'
      };

      setConversationHistory(prev => [...prev, assistantTurn]);
      if (resultData.toolCallsExecuted && resultData.toolCallsExecuted.length > 0) {
        setLastToolTrace(resultData.toolCallsExecuted);
      }
      if (resultData.evidenceProvenance && resultData.evidenceProvenance.length > 0) {
        setLastEvidenceProvenance(resultData.evidenceProvenance);
      }
      if (resultData.informationStatus) {
        setLastInformationStatus(resultData.informationStatus);
      }
      if (resultData.validationOutcome) {
        setLastValidationOutcome(resultData.validationOutcome);
      }
    } catch (e: any) {
      alert('Simulation error: ' + e.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleToggleKillSwitch = () => {
    const newState = !aiEnabled;
    setAiEnabled(newState);
    aiOrchestrator.setGlobalEnable(newState);
  };

  const handleToggleHumanTakeover = () => {
    setHumanTakeoverActive(!humanTakeoverActive);
  };

  const clearHistory = async () => {
    const oldSessionId = sessionId;
    setConversationHistory([]);
    setLastToolTrace([]);
    setLastEvidenceProvenance([]);
    setLastValidationOutcome(null);
    setActiveReservationDraft(null);
    setActiveOrderDraft(null);
    try {
      sessionStorage.removeItem('flow_neo_sim_history');
      sessionStorage.removeItem('flow_neo_sim_draft');
      sessionStorage.removeItem('flow_neo_sim_order_draft');
      const freshId = `sim_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('flow_neo_sim_session_id', freshId);
      setSessionId(freshId);

      // Call backend to clear server-side session drafts and in-memory states
      await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET', conversationId: oldSessionId })
      }).catch(() => {});
    } catch {}
  };

  const samplePrompts = [
    // Ordering & Acceptance Suite Prompts
    { label: 'Order Gourmande + Chicken', text: 'Hi, I would like to order a Gourmande Croquante with chicken and a Diet Pepsi.' },
    { label: 'Without Chicken is Fine', text: 'Without chicken is fine, please add it plain.' },
    { label: 'Check Saved Info', text: 'Do you have my name and address on file?' },
    { label: 'Deliver to Saved Address', text: 'Yes, please deliver to my saved address on file.' },
    { label: 'Add Cake (Clarification)', text: 'Can I also add an additional cake?' },
    { label: 'Cake Pralin (Slice)', text: 'A slice of Cake Pralin please.' },
    { label: 'Confirm Order', text: 'Looks great, please confirm and place my order.' },
    // 16 Universal Acceptance Test Questions
    { label: 'Decaf Coffee', text: 'Do you have decaf coffee?' },
    { label: 'Breakfast <$10', text: 'Can I have breakfast for under $10?' },
    { label: 'Gluten in Sourdough', text: 'Is there gluten in your sourdough bread?' },
    { label: 'Vegetarian Sandwiches', text: 'What vegetarian sandwiches do you have?' },
    { label: 'Whole Cakes Today', text: 'Can I buy a whole cake today without pre-ordering?' },
    { label: '15-Pax Birthday Cake', text: 'I need a birthday cake for 15 people tomorrow' },
    { label: 'Pistachio (Today)', text: 'What pistachio desserts do you have today?' },
    { label: 'Pistachio (Soon)', text: 'Are you going to have a pistachio dessert soon?' },
    { label: 'Are Dogs Allowed?', text: 'Are dogs allowed?' },
    { label: 'Parking & Valet', text: 'Is there parking available?' },
    { label: 'Private Event (25 Pax)', text: 'Can I host a private event for 25 people?' },
    { label: '10 PM Delivery', text: 'Can you deliver to me at 10 PM?' },
    { label: 'Achrafieh Delivery', text: 'Do you deliver to Achrafieh / Mar Mikhael?' },
    { label: 'Card on Delivery', text: 'Can I pay by card on delivery?' },
    { label: 'Student Discounts', text: 'Do you offer student discounts?' },
    { label: 'Caesar Salad Ingredients', text: 'What are the ingredients in your Caesar salad?' },
    { label: '12-Pax Reservation', text: 'Can I reserve a table for 12 people this Saturday?' },
    // Dietary & Operational Prompts
    { label: 'Sugar-Free (Arabic)', text: 'مرحبا، عندكن شي حلو بلا سكر؟' },
    { label: 'Sugar-Free Desserts', text: 'Do you have sugar-free desserts?' },
    { label: 'Nut Allergy (French)', text: "Je suis allergique aux noix, qu'est-ce que je peux manger ?" },
    { label: 'Plat du Jour Tomorrow', text: 'Bonjour, quel est le plat du jour pour demain à Badaro ?' },
    { label: 'Weekly Menu (Nov 16-20)', text: 'Can I see the full Plat du Jour menu for this week?' },
    { label: '86 Item Check (Muffin)', text: 'Do you have the blueberry muffin available today?' },
    { label: 'Laptop Policy', text: 'Can I work on my laptop on the terrace or inside?' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner: Master Controls & Staging Guardrails */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: aiEnabled ? '#ecfdf5' : '#fef2f2',
            color: aiEnabled ? '#059669' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                NÉO Virtual Customer Assistant
              </h3>
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 800,
                letterSpacing: '0.4px'
              }}>
                FLOW ENGINE v4.0-DATABASE-GROUNDED (BUILD #20261115-2100 | EVIDENCE-BASED)
              </span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: aiEnabled ? '#dcfce7' : '#fee2e2',
                color: aiEnabled ? '#15803d' : '#991b1b',
                fontWeight: 700
              }}>
                {aiEnabled ? 'AI LIVE IN STAGING' : 'AI MASTER KILL SWITCH ENGAGED'}
              </span>
              {humanTakeoverActive && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#fef3c7',
                  color: '#b45309',
                  fontWeight: 700
                }}>
                  HUMAN TAKEOVER ACTIVE
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Concept: <strong>NÉO Beirut</strong> • Flagship: <strong>Badaro (07:30–23:00)</strong> • Delivery: <strong>08:00–21:30</strong> • Staging Target: <code>flow_hotfix_test</code>
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleToggleHumanTakeover}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #f59e0b',
              backgroundColor: humanTakeoverActive ? '#fef3c7' : '#ffffff',
              color: '#b45309',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {humanTakeoverActive ? 'Release Takeover (Resume AI)' : 'Force Human Takeover'}
          </button>

          <button
            onClick={handleToggleKillSwitch}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: aiEnabled ? '#dc2626' : '#16a34a',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            {aiEnabled ? 'Disable AI (Kill Switch)' : 'Enable AI in Staging'}
          </button>
        </div>
      </div>

      {/* Real-time Telemetry & Model Config Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={{ padding: '14px 16px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active AI Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => {
              const m = e.target.value as AiModelId;
              setSelectedModel(m);
              aiOrchestrator.setModel(m);
            }}
            style={{ marginTop: '6px', width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Sub-sec, Arabizi)</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (High Vol)</option>
            <option value="gpt-4o-mini">GPT-4o-mini (Provider Neutral)</option>
          </select>
        </div>

        <div style={{ padding: '14px 16px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Cumulative Tokens (Session)
          </label>
          <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={18} color="var(--primary)" />
            <span>{cumulativeTokens.total.toLocaleString()}</span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
              ({cumulativeTokens.input} in / {cumulativeTokens.output} out)
            </span>
          </div>
        </div>

        <div style={{ padding: '14px 16px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Estimated AI Inference Cost
          </label>
          <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <DollarSign size={18} />
            <span>${cumulativeCostUsd.toFixed(5)}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>USD</span>
          </div>
        </div>

        <div style={{ padding: '14px 16px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Branch Enforcement
          </label>
          <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={16} /> NÉO Badaro (Only Active Branch)
          </div>
          <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
            Naccache Zero4 & BDD Permanently Closed
          </div>
        </div>
      </div>

      {/* Main Grid: Knowledge Base & Interactive Conversation Simulator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px' }}>
        {/* Left: Editable Knowledge Base */}
        <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={16} color="var(--primary)" /> NÉO Badaro Authoritative Knowledge Base
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
              {knowledgeList.length} verified rules
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '540px', overflowY: 'auto' }}>
            {knowledgeList.map(item => (
              <div key={item.id} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{item.title}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {item.category}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Interactive Test Conversation Simulator */}
        <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--primary)" /> Interactive Management Test Simulator
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={clearHistory}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                title="Wipe conversation history and reset drafts to start fresh"
              >
                <RefreshCw size={12} /> Reset Chat (Start Fresh)
              </button>
              <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                STAGING SIMULATOR
              </span>
            </div>
          </div>

          {/* Authenticated Customer Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <User size={14} color="var(--primary)" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              Authenticated Caller:
            </span>
            <select
              value={authenticatedCustomer}
              onChange={e => setAuthenticatedCustomer(e.target.value as any)}
              style={{
                flex: 1,
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b'
              }}
            >
              <option value="jad">Jad Khoury (+961 71 889 900 — Verified Address in Badaro: Street 73, Bldg Rose)</option>
              <option value="freddy">Freddy (+961 3 361 515 — Profile on file)</option>
              <option value="new">New / Unsaved Customer (No saved profile on file)</option>
            </select>
          </div>

          {/* Quick Scenario Prompt Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {samplePrompts.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setTestInput(p.text)}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Active Reservation Draft Live Inspector Card */}
          {activeReservationDraft && (activeReservationDraft.time || activeReservationDraft.date || activeReservationDraft.guestCount) && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#1d4ed8' }}>
                  <Calendar size={13} />
                  <span>ACTIVE RESERVATION DRAFT (PERSISTENT WORKFLOW STATE)</span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: activeReservationDraft.isConfirmed ? '#dcfce7' : '#fef3c7',
                  color: activeReservationDraft.isConfirmed ? '#15803d' : '#b45309'
                }}>
                  {activeReservationDraft.isConfirmed ? '✓ CONFIRMED (PENDING STAFF)' : '✍ COLLECTING DETAILS'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px', color: '#1e3a8a' }}>
                <div><span style={{ color: '#64748b' }}>Branch:</span> <strong>{activeReservationDraft.branch || 'Badaro'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Date:</span> <strong>{activeReservationDraft.date || '⏳ Missing'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Time:</span> <strong>{activeReservationDraft.time || '⏳ Missing'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Guests:</span> <strong>{activeReservationDraft.guestCount ? `${activeReservationDraft.guestCount} guests${activeReservationDraft.adults ? ` (${activeReservationDraft.adults}A, ${activeReservationDraft.children || 0}C)` : ''}` : '⏳ Missing'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Seating:</span> <strong>{activeReservationDraft.seatingPreference || 'Pending'} {activeReservationDraft.seatingContingency ? `(${activeReservationDraft.seatingContingency})` : ''}</strong></div>
                <div><span style={{ color: '#64748b' }}>Special Requests:</span> <strong>{activeReservationDraft.specialRequests?.length ? activeReservationDraft.specialRequests.join(', ') : 'None'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Guest Name:</span> <strong>{activeReservationDraft.customerName || '⏳ Missing'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Phone:</span> <strong>{activeReservationDraft.customerPhone || '⏳ Missing'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Status:</span> <strong>{activeReservationDraft.isConfirmed ? 'Pending Staff Action' : 'Drafting'}</strong></div>
              </div>
            </div>
          )}

          {/* Active Order Draft Live Inspector Card */}
          {activeOrderDraft && (activeOrderDraft.items?.length > 0 || (activeOrderDraft.fulfillmentType && activeOrderDraft.fulfillmentType !== 'NOT_SPECIFIED')) && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#15803d' }}>
                  <Layers size={13} />
                  <span>ACTIVE ORDER DRAFT (FLOW CATALOG GROUNDED)</span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: activeOrderDraft.isConfirmed ? '#dcfce7' : '#fef3c7',
                  color: activeOrderDraft.isConfirmed ? '#15803d' : '#b45309'
                }}>
                  {activeOrderDraft.isConfirmed ? `✓ ORDER #${activeOrderDraft.createdOrderId || 'PENDING'} PLACED` : '✍ IN PROGRESS'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#166534' }}>
                <strong>Items:</strong> {activeOrderDraft.items?.length > 0 ? activeOrderDraft.items.map((i: any) => `${i.qty}x ${i.name} ($${i.totalPrice.toFixed(2)})`).join(', ') : 'None'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px', color: '#166534' }}>
                <div><span style={{ color: '#64748b' }}>Fulfillment:</span> <strong>{activeOrderDraft.fulfillmentType || 'Pending'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Distance:</span> <strong>{activeOrderDraft.deliveryDistanceKm !== null && activeOrderDraft.deliveryDistanceKm !== undefined ? `${activeOrderDraft.deliveryDistanceKm} km` : 'N/A'}</strong></div>
                <div><span style={{ color: '#64748b' }}>Delivery Fee:</span> <strong>${(activeOrderDraft.deliveryFee || 0).toFixed(2)}</strong></div>
                <div><span style={{ color: '#64748b' }}>Grand Total:</span> <strong>${(activeOrderDraft.grandTotal || 0).toFixed(2)}</strong></div>
              </div>
              {activeOrderDraft.deliveryAddress && (
                <div style={{ fontSize: '10px', color: '#475569' }}>
                  <strong>Address:</strong> {activeOrderDraft.deliveryAddress}
                </div>
              )}
            </div>
          )}

          {/* Chat Conversation History Pane */}
          <div style={{
            height: '340px',
            overflowY: 'auto',
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {conversationHistory.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                <Bot size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ margin: 0 }}>Select a quick scenario pill above or type any question below to test the assistant.</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>Zero real customer messages will be sent.</p>
              </div>
            ) : (
              conversationHistory.map(turn => (
                <div
                  key={turn.id}
                  style={{
                    alignSelf: turn.role === 'customer' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: turn.role === 'customer' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    backgroundColor: turn.role === 'customer' ? 'var(--primary)' : '#ffffff',
                    color: turn.role === 'customer' ? '#ffffff' : 'var(--text-main)',
                    border: turn.role === 'customer' ? 'none' : '1px solid #e2e8f0',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-line',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {turn.text}
                  </div>

                  {turn.role === 'assistant' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: turn.executionMode === 'DETERMINISTIC_RULE' ? '#e2e8f0' : '#dcfce7',
                        color: turn.executionMode === 'DETERMINISTIC_RULE' ? '#334155' : '#15803d'
                      }}>
                        {turn.executionMode === 'DETERMINISTIC_RULE' ? '⚡ DETERMINISTIC_RULE' : `✨ ${turn.executionMode || 'AI_INFERENCE'}`}
                      </span>
                      <span>• 🏛️ {turn.provider || 'Google'}</span>
                      <span>• 🕒 {turn.latencyMs}ms</span>
                      <span>• 🔤 {turn.tokens?.total || 0} tok</span>
                      <span>• 💵 ${turn.estimatedCostUsd?.toFixed(6) || '0.000000'}</span>
                      {turn.language && (
                        <span style={{ textTransform: 'uppercase', fontWeight: 700, color: 'var(--primary)' }}>
                          • {turn.language}
                        </span>
                      )}
                    </div>
                  )}

                  {turn.escalationRequired && (
                    <div style={{ fontSize: '10px', color: '#b91c1c', background: '#fee2e2', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      ⚠️ {turn.escalationReason}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Operational Tool Execution Live Trace */}
          {lastToolTrace.length > 0 && (
            <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '11px', color: '#166534' }}>
              <strong>Operational Tool Executed:</strong>
              {lastToolTrace.map((tc, idx) => (
                <span key={idx} style={{ marginLeft: '8px', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  ✓ {tc.tool}
                </span>
              ))}
            </div>
          )}

          {/* Evidence Inspector & Database Provenance View */}
          {lastEvidenceProvenance.length > 0 && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                  <Database size={13} color="var(--primary)" />
                  <span>AUTHORITATIVE DATABASE EVIDENCE & PROVENANCE INSPECTOR</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor:
                      lastInformationStatus === 'VERIFIED' ? '#dcfce7' :
                      lastInformationStatus === 'VERIFIED_NEGATIVE' ? '#e0f2fe' :
                      lastInformationStatus === 'NO_MATCHING_RECORDS' ? '#fef3c7' :
                      lastInformationStatus === 'UNKNOWN_INCOMPLETE' ? '#f3e8ff' : '#fee2e2',
                    color:
                      lastInformationStatus === 'VERIFIED' ? '#15803d' :
                      lastInformationStatus === 'VERIFIED_NEGATIVE' ? '#0369a1' :
                      lastInformationStatus === 'NO_MATCHING_RECORDS' ? '#b45309' :
                      lastInformationStatus === 'UNKNOWN_INCOMPLETE' ? '#6b21a8' : '#b91c1c'
                  }}>
                    STATUS: {lastInformationStatus}
                  </span>
                  {lastValidationOutcome && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: lastValidationOutcome.isValid ? '#ecfdf5' : '#fef2f2',
                      color: lastValidationOutcome.isValid ? '#047857' : '#b91c1c'
                    }}>
                      {lastValidationOutcome.isValid ? '✓ EVIDENCE VALIDATED (0 VIOLATIONS)' : `⚠️ ${lastValidationOutcome.violations?.length} VIOLATIONS`}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#334155' }}>
                {lastEvidenceProvenance.map((ev, idx) => (
                  <div key={idx} style={{ padding: '6px 10px', backgroundColor: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>
                        Source Entity: <code>{ev.sourceEntity || ev.source_entity || ev.tool || 'flow_database'}</code>
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                        Concept: NÉO ({ev.conceptId || '00000000-0000-0000-0000-000000000001'}) • Branch: {ev.branch || 'Badaro'}
                      </span>
                    </div>
                    <div style={{ color: '#475569', fontSize: '10px', lineHeight: 1.4 }}>
                      {ev.evidenceText || (ev.records ? `Retrieved ${ev.records.length} record(s): ${JSON.stringify(ev.records.slice(0, 3))}` : JSON.stringify(ev))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input & Dispatch Bar */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSimulate()}
              placeholder="Ask about Plat du Jour, menu prices, table reservation, cake pre-orders..."
              style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            />
            <button
              type="button"
              onClick={handleSimulate}
              disabled={simulating}
              style={{
                padding: '9px 18px',
                borderRadius: '6px',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {simulating ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{simulating ? 'Processing...' : 'Send'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
