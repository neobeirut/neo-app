import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Users, FileText, Megaphone, 
  Sliders, Gift, Truck, Store, ExternalLink, ShoppingBag
} from 'lucide-react';
import CrmInboxTab from './crm/CrmInboxTab';
import CrmContactsTab from './crm/CrmContactsTab';
import CrmProductsTab from './crm/CrmProductsTab';
import CrmTemplatesTab from './crm/CrmTemplatesTab';
import CrmCampaignsTab from './crm/CrmCampaignsTab';
import CrmModifiersTab from './crm/CrmModifiersTab';
import CrmLoyaltyTab from './crm/CrmLoyaltyTab';
import CrmDeliveryPricingTab from './crm/CrmDeliveryPricingTab';
import { crmService } from '../api/crmService';

interface CrmHubScreenProps {
  user?: any;
  defaultTab?: CrmTab;
}

type CrmTab = 'inbox' | 'contacts' | 'products' | 'templates' | 'campaigns' | 'modifiers' | 'loyalty' | 'delivery';

const VALID_CRM_TABS: CrmTab[] = ['inbox', 'contacts', 'products', 'templates', 'campaigns', 'modifiers', 'loyalty', 'delivery'];

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
      </div>
    </div>
  );
}
