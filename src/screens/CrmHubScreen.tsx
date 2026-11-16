import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Users, FileText, Megaphone, 
  Sliders, Gift, Truck, Store, ExternalLink, ShoppingBag, Bot
} from 'lucide-react';
import CrmInboxTab from './crm/CrmInboxTab';
import CrmContactsTab from './crm/CrmContactsTab';
import CrmProductsTab from './crm/CrmProductsTab';
import CrmTemplatesTab from './crm/CrmTemplatesTab';
import CrmCampaignsTab from './crm/CrmCampaignsTab';
import CrmModifiersTab from './crm/CrmModifiersTab';
import CrmLoyaltyTab from './crm/CrmLoyaltyTab';
import CrmDeliveryPricingTab from './crm/CrmDeliveryPricingTab';
import CrmAiAssistantTab from './crm/CrmAiAssistantTab';
import { crmService } from '../api/crmService';

interface CrmHubScreenProps {
  user?: any;
  defaultTab?: CrmTab;
}

type CrmTab = 'inbox' | 'contacts' | 'products' | 'templates' | 'campaigns' | 'modifiers' | 'loyalty' | 'delivery' | 'ai_assistant';

const VALID_CRM_TABS: CrmTab[] = ['inbox', 'contacts', 'products', 'templates', 'campaigns', 'modifiers', 'loyalty', 'delivery', 'ai_assistant'];

export default function CrmHubScreen({ user, defaultTab }: CrmHubScreenProps) {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const getInitialTab = (): CrmTab => {
    if (defaultTab && VALID_CRM_TABS.includes(defaultTab)) return defaultTab;
    if (tab && VALID_CRM_TABS.includes(tab as CrmTab)) return tab as CrmTab;
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/#\/crm\/([a-z_]+)/);
      if (match && VALID_CRM_TABS.includes(match[1] as CrmTab)) {
        return match[1] as CrmTab;
      }
    }
    return 'inbox';
  };

  const [activeTab, setActiveTab] = useState<CrmTab>(getInitialTab);
  const [inboxTargetPhone, setInboxTargetPhone] = useState<string | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);

  useEffect(() => {
    crmService.getProducts().then(prods => setProductsCount(prods.length)).catch(() => {});
  }, [user?.restaurant_id]);

  useEffect(() => {
    const target = defaultTab || (tab as CrmTab);
    if (target && VALID_CRM_TABS.includes(target)) {
      setActiveTab(target);
    }
  }, [tab, defaultTab]);

  const handleTabChange = (newTab: CrmTab) => {
    setActiveTab(newTab);
    navigate(`/crm/${newTab}`);
  };

  const handleStartChatFromContacts = (phone: string) => {
    setInboxTargetPhone(phone);
    setActiveTab('inbox');
    navigate('/crm/inbox');
  };

  const tabs: { key: CrmTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: 'inbox', label: 'Live WhatsApp Inbox', icon: <MessageSquare size={16} /> },
    { key: 'contacts', label: 'Customer Contacts', icon: <Users size={16} /> },
    { key: 'products', label: 'Menu Products', icon: <ShoppingBag size={16} />, badge: productsCount !== null ? `${productsCount}` : undefined },
    { key: 'modifiers', label: 'Item Modifiers', icon: <Sliders size={16} /> },
    { key: 'templates', label: 'Message Templates', icon: <FileText size={16} /> },
    { key: 'campaigns', label: 'Broadcast Campaigns', icon: <Megaphone size={16} /> },
    { key: 'loyalty', label: 'Loyalty & Promos', icon: <Gift size={16} /> },
    { key: 'delivery', label: 'Delivery Pricing', icon: <Truck size={16} /> },
    { key: 'ai_assistant', label: 'NÉO AI Assistant', icon: <Bot size={16} /> },
  ];

  const pageTitle: Record<CrmTab, string> = {
    inbox: 'WhatsApp Live Inbox',
    contacts: 'Customer Contacts',
    products: 'Menu Products',
    modifiers: 'Modifiers & Options',
    templates: 'Message Templates',
    campaigns: 'Broadcast Campaigns',
    loyalty: 'Loyalty & Promos',
    delivery: 'Delivery Pricing',
    ai_assistant: 'NÉO AI Customer Assistant Configuration',
  };

  const pageSubtitle: Record<CrmTab, string> = {
    inbox: 'Two-way WhatsApp live conversations with customers.',
    contacts: 'Manage your customer contact list and WhatsApp opt-ins.',
    products: 'Manage your menu items, prices, categories and modifier links.',
    modifiers: 'Create and manage modifier groups, options and per-product rules.',
    templates: 'Pre-approved Meta HSM message templates for broadcasts.',
    campaigns: 'Send broadcast campaigns to your opted-in customers.',
    loyalty: 'Configure loyalty tiers, promo codes and reward catalog.',
    delivery: 'Set delivery pricing rules by distance and branch.',
    ai_assistant: 'Configure NÉO Badaro knowledge base, AI provider, operational tools, and test simulator.',
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            {pageTitle[activeTab]}
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {pageSubtitle[activeTab]}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600 }}>
            <Store size={14} color="var(--primary)" />
            <span>{user?.restaurants?.name || 'Ovrload (Neo Beirut)'}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', overflowX: 'auto' }}>
        {tabs.map(t => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isActive ? 'var(--primary)' : '#ffffff',
                color: isActive ? '#ffffff' : 'var(--text-main)',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)'
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'inbox' && (
          <CrmInboxTab
            initialPhone={inboxTargetPhone}
            onNavigateToContacts={() => handleTabChange('contacts')}
          />
        )}
        {activeTab === 'contacts' && (
          <CrmContactsTab onStartChat={handleStartChatFromContacts} />
        )}
        {activeTab === 'products' && (
          <CrmProductsTab 
            onNavigateToModifiers={() => handleTabChange('modifiers')} 
            onProductsCountChange={setProductsCount}
          />
        )}
        {activeTab === 'modifiers' && <CrmModifiersTab />}
        {activeTab === 'templates' && <CrmTemplatesTab />}
        {activeTab === 'campaigns' && <CrmCampaignsTab />}
        {activeTab === 'loyalty' && <CrmLoyaltyTab />}
        {activeTab === 'delivery' && <CrmDeliveryPricingTab />}
        {activeTab === 'ai_assistant' && <CrmAiAssistantTab />}
      </div>
    </div>
  );
}
