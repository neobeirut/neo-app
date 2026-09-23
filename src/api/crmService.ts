import { supabase } from './supabase';
import { getRestaurantId } from './client';

export const DEFAULT_OVRLOAD_RESTAURANT_ID = '79256f11-a9f8-4fec-901d-69baf929762d';

export function getActiveRestaurantId(): string {
  return getRestaurantId() || DEFAULT_OVRLOAD_RESTAURANT_ID;
}

export interface WhatsAppConversation {
  id: string;
  phone: string;
  customer_id?: number | null;
  last_message?: string | null;
  last_message_at?: string | null;
  order_id?: number | null;
  branch_id?: number | null;
  unread_count: number;
  session_active: boolean;
  status?: string | null;
  contact_id?: number | null;
  last_message_preview?: string | null;
  service_window_active?: boolean;
  latest_location_address?: string | null;
  latest_location_lat?: number | null;
  latest_location_lng?: number | null;
  latest_location_url?: string | null;
  restaurant_id: string;
  created_at?: string;
  updated_at?: string;
  contact?: WhatsAppContact | null;
}

export interface WhatsAppContact {
  id: number;
  name: string;
  phone_e164: string;
  email?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  customer_id?: number | null;
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at?: string | null;
  whatsapp_opt_in_source?: string | null;
  category?: string | null;
  restaurant_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppMessage {
  id: number;
  conversation_id: string;
  contact_id?: number | null;
  infobip_message_id?: string | null;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'template' | 'document' | 'location' | 'interactive';
  text_content?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_filename?: string | null;
  template_name?: string | null;
  template_parameters?: any;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  error_code?: string | null;
  error_message?: string | null;
  sent_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
  delivered_at?: string | null;
  read_at?: string | null;
  restaurant_id: string;
}

export interface WhatsAppTemplate {
  id: number;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  buttons?: any;
  variables?: any;
  infobip_template_id?: string | null;
  last_synced_at?: string | null;
  created_at?: string;
  restaurant_id: string;
}

export interface WhatsAppCampaign {
  id: number;
  name: string;
  template_id?: number | null;
  template_name: string;
  template_language: string;
  template_variables?: any;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  filter_criteria?: any;
  created_at?: string;
  restaurant_id: string;
}

export interface CustomizationItem {
  id: number;
  name: string;
  customization_type: 'addon' | 'option' | 'removal';
  default_price: number;
  is_active: boolean;
  is_default: boolean;
  option_group_name: string;
  is_required: boolean;
  is_multi_select: boolean;
  display_order: number;
  restaurant_id: string;
  created_at?: string;
}

export interface ProductCustomization {
  id: number;
  product_id: number;
  ingredient: string;
  customization_type: string;
  price: number;
  is_active: boolean;
  customization_item_id?: number | null;
  restaurant_id: string;
  option_group_name?: string | null;
  is_required?: boolean;
  is_multi_select?: boolean;
  created_at?: string;
}

export interface DeliveryPricingRule {
  id: number;
  branch_id?: number | null;
  min_distance_km: number;
  max_distance_km: number;
  delivery_cost: number;
  is_active: boolean;
  display_order: number;
  restaurant_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_subtotal?: string | null;
  max_discount?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  is_active: boolean;
  usage_limit_total?: string | null;
  usage_limit_per_user?: string | null;
  first_order_only?: boolean;
  allowed_branches?: string | null;
  allowed_product_ids?: string | null;
  excluded_product_ids?: string | null;
  stackable?: boolean;
  created_by?: string | null;
  created_at?: string;
  restaurant_id: string;
}

export interface RewardsCatalogItem {
  id: number;
  code: string;
  title: string;
  description: string;
  tier_required: string;
  frequency: string;
  expires_days: number;
  is_active: boolean;
  created_at?: string;
  restaurant_id: string;
}

export interface Category {
  id: number;
  name: string;
  image_url?: string | null;
  display_order: number;
  is_active: boolean;
  section?: string | null;
  restaurant_id: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  original_price?: string | null;
  image_url?: string | null;
  category_id?: number | null;
  prep_time?: string | null;
  rating?: number | null;
  ingredients?: string | null;
  nutritional_info?: string | null;
  is_featured: boolean;
  is_special: boolean;
  status: string;
  sort_order: number;
  inventory_applies: boolean;
  restaurant_id: string;
  created_at?: string;
  category?: Category | null;
  customization_count?: number;
}

// ============================================================================
// crmService implementation
// ============================================================================

export const crmService = {
  // --------------------------------------------------------------------------
  // Conversations
  // --------------------------------------------------------------------------
  async getConversations(filter: string = 'all', searchQuery: string = ''): Promise<WhatsAppConversation[]> {
    const restaurantId = getActiveRestaurantId();
    let query = supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (filter === 'unread') {
      query = query.gt('unread_count', 0);
    } else if (filter === 'active') {
      query = query.eq('session_active', true);
    } else if (filter === 'open') {
      query = query.neq('status', 'closed');
    }

    if (searchQuery.trim()) {
      const term = searchQuery.trim();
      query = query.or(`phone.ilike.%${term}%,last_message.ilike.%${term}%,last_message_preview.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to get conversations:', error);
      throw error;
    }

    const conversations = (data || []) as WhatsAppConversation[];
    if (conversations.length > 0) {
      const contactIds = Array.from(new Set(conversations.map(c => c.contact_id).filter(Boolean))) as number[];
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('whatsapp_contacts')
          .select('*')
          .in('id', contactIds);
        
        const contactMap = new Map<number, WhatsAppContact>();
        (contacts || []).forEach(c => contactMap.set(c.id, c));
        conversations.forEach(c => {
          if (c.contact_id) {
            c.contact = contactMap.get(c.contact_id) || null;
          }
        });
      }
    }

    return conversations;
  },

  async markConversationRead(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    if (error) console.error('Failed to mark conversation read:', error);
  },

  async updateConversationStatus(conversationId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Messages
  // --------------------------------------------------------------------------
  async getMessages(conversationId: string, limit: number = 100): Promise<WhatsAppMessage[]> {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
    return (data || []) as WhatsAppMessage[];
  },

  async sendMessage(params: {
    conversationId: string;
    text: string;
    contactId?: number | null;
    templateName?: string;
    templateParams?: any;
    userId?: number;
  }): Promise<WhatsAppMessage> {
    const restaurantId = getActiveRestaurantId();
    const now = new Date().toISOString();

    const newMsg: Partial<WhatsAppMessage> = {
      conversation_id: params.conversationId,
      contact_id: params.contactId || null,
      direction: 'outbound',
      message_type: params.templateName ? 'template' : 'text',
      text_content: params.text,
      template_name: params.templateName || null,
      template_parameters: params.templateParams || null,
      status: 'sent',
      sent_by_user_id: params.userId || null,
      restaurant_id: restaurantId,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert(newMsg)
      .select()
      .single();

    if (error) {
      console.error('Failed to insert message:', error);
      throw error;
    }

    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message: params.text,
        last_message_preview: params.text.slice(0, 100),
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', params.conversationId);

    return data as WhatsAppMessage;
  },

  // --------------------------------------------------------------------------
  // Contacts
  // --------------------------------------------------------------------------
  async getContacts(searchQuery: string = '', optInFilter: string = 'all'): Promise<WhatsAppContact[]> {
    const restaurantId = getActiveRestaurantId();
    let query = supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true, nullsFirst: false });

    if (optInFilter === 'opted_in') {
      query = query.eq('whatsapp_opt_in', true);
    } else if (optInFilter === 'opted_out') {
      query = query.eq('whatsapp_opt_in', false);
    }

    if (searchQuery.trim()) {
      const term = searchQuery.trim();
      query = query.or(`name.ilike.%${term}%,phone_e164.ilike.%${term}%,notes.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to get contacts:', error);
      throw error;
    }
    return (data || []) as WhatsAppContact[];
  },

  async updateContact(contactId: number, updates: Partial<WhatsAppContact>): Promise<WhatsAppContact> {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;
    return data as WhatsAppContact;
  },

  async createContact(contact: Partial<WhatsAppContact>): Promise<WhatsAppContact> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .insert({
        ...contact,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as WhatsAppContact;
  },

  // --------------------------------------------------------------------------
  // Templates
  // --------------------------------------------------------------------------
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to get templates:', error);
      throw error;
    }
    return (data || []) as WhatsAppTemplate[];
  },

  // --------------------------------------------------------------------------
  // Campaigns
  // --------------------------------------------------------------------------
  async getCampaigns(): Promise<WhatsAppCampaign[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get campaigns:', error);
      throw error;
    }
    return (data || []) as WhatsAppCampaign[];
  },

  async createCampaign(campaign: Partial<WhatsAppCampaign>): Promise<WhatsAppCampaign> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('whatsapp_campaigns')
      .insert({
        ...campaign,
        restaurant_id: restaurantId,
        status: campaign.status || 'DRAFT',
        total_recipients: campaign.total_recipients || 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as WhatsAppCampaign;
  },

  // --------------------------------------------------------------------------
  // Customization Items (Modifiers)
  // --------------------------------------------------------------------------
  async getCustomizationItems(): Promise<CustomizationItem[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('customization_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('option_group_name', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to get customization items:', error);
      throw error;
    }
    return (data || []) as CustomizationItem[];
  },

  async createCustomizationItem(item: Partial<CustomizationItem>): Promise<CustomizationItem> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('customization_items')
      .insert({
        ...item,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as CustomizationItem;
  },

  async updateCustomizationItem(id: number, updates: Partial<CustomizationItem>): Promise<CustomizationItem> {
    const { data, error } = await supabase
      .from('customization_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CustomizationItem;
  },

  async deleteCustomizationItem(id: number): Promise<void> {
    const { error } = await supabase
      .from('customization_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Product Customizations
  // --------------------------------------------------------------------------
  async getProductCustomizations(productId?: number): Promise<ProductCustomization[]> {
    const restaurantId = getActiveRestaurantId();
    let query = supabase
      .from('product_customizations')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (productId !== undefined) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ProductCustomization[];
  },

  async linkModifierToProduct(productId: number, item: CustomizationItem): Promise<ProductCustomization> {
    const restaurantId = getActiveRestaurantId();
    // Normalize group name: blank/General → "Add On" (must match what updateProductModifierGroupSettings queries by)
    const rawGroup = (item.option_group_name || '').trim();
    const normalizedGroup =
      !rawGroup || rawGroup.toLowerCase() === 'general' ? 'Add On' : rawGroup;

    const { data, error } = await supabase
      .from('product_customizations')
      .insert({
        product_id: productId,
        ingredient: item.name,
        customization_type: item.customization_type,
        price: item.default_price || 0,
        is_active: true,
        customization_item_id: item.id,
        restaurant_id: restaurantId,
        option_group_name: normalizedGroup,
        is_required: false,    // always defaults to false — user sets per product
        is_multi_select: false, // always defaults to false — user sets per product
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as ProductCustomization;
  },

  async unlinkModifierFromProduct(productCustomizationId: number): Promise<void> {
    const { error } = await supabase
      .from('product_customizations')
      .delete()
      .eq('id', productCustomizationId);
    if (error) throw error;
  },

  /** Update is_required and/or is_multi_select for ALL items in a modifier group for a product */
  async updateProductModifierGroupSettings(
    productId: number,
    groupName: string,
    settings: { is_required?: boolean; is_multi_select?: boolean }
  ): Promise<void> {
    const restaurantId = getActiveRestaurantId();
    const { error } = await supabase
      .from('product_customizations')
      .update(settings)
      .eq('product_id', productId)
      .eq('option_group_name', groupName)
      .eq('restaurant_id', restaurantId);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Delivery Pricing Rules
  // --------------------------------------------------------------------------
  async getDeliveryPricingRules(): Promise<DeliveryPricingRule[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('delivery_pricing_rules')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('min_distance_km', { ascending: true });

    if (error) {
      console.error('Failed to get delivery pricing rules:', error);
      throw error;
    }
    return (data || []) as DeliveryPricingRule[];
  },

  async createDeliveryPricingRule(rule: Partial<DeliveryPricingRule>): Promise<DeliveryPricingRule> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('delivery_pricing_rules')
      .insert({
        ...rule,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as DeliveryPricingRule;
  },

  async updateDeliveryPricingRule(id: number, updates: Partial<DeliveryPricingRule>): Promise<DeliveryPricingRule> {
    const { data, error } = await supabase
      .from('delivery_pricing_rules')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DeliveryPricingRule;
  },

  async deleteDeliveryPricingRule(id: number): Promise<void> {
    const { error } = await supabase
      .from('delivery_pricing_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Promo Codes & Rewards
  // --------------------------------------------------------------------------
  async getPromoCodes(): Promise<PromoCode[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get promo codes:', error);
      throw error;
    }
    return (data || []) as PromoCode[];
  },

  async createPromoCode(promo: Partial<PromoCode>): Promise<PromoCode> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        ...promo,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as PromoCode;
  },

  async updatePromoCode(id: string, updates: Partial<PromoCode>): Promise<PromoCode> {
    const { data, error } = await supabase
      .from('promo_codes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as PromoCode;
  },

  async deletePromoCode(id: string): Promise<void> {
    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getRewardsCatalog(): Promise<RewardsCatalogItem[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('rewards_catalog')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('tier_required', { ascending: true });

    if (error) {
      console.error('Failed to get rewards catalog:', error);
      throw error;
    }
    return (data || []) as RewardsCatalogItem[];
  },

  async createRewardItem(item: Partial<RewardsCatalogItem>): Promise<RewardsCatalogItem> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('rewards_catalog')
      .insert({
        ...item,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as RewardsCatalogItem;
  },

  async updateRewardItem(id: number, updates: Partial<RewardsCatalogItem>): Promise<RewardsCatalogItem> {
    const { data, error } = await supabase
      .from('rewards_catalog')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as RewardsCatalogItem;
  },

  async deleteRewardItem(id: number): Promise<void> {
    const { error } = await supabase
      .from('rewards_catalog')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Categories & Products
  // --------------------------------------------------------------------------
  async getCategories(): Promise<Category[]> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to get categories:', error);
      throw error;
    }
    return (data || []) as Category[];
  },

  async getProducts(categoryId?: number, search: string = ''): Promise<Product[]> {
    const restaurantId = getActiveRestaurantId();
    let query = supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to get products:', error);
      throw error;
    }

    const products = (data || []) as Product[];

    // Fetch categories and product customizations to enrich
    const [cats, custs] = await Promise.all([
      this.getCategories().catch(() => []),
      this.getProductCustomizations().catch(() => [])
    ]);

    const catMap = new Map<number, Category>();
    cats.forEach(c => catMap.set(c.id, c));

    const custCountMap = new Map<number, number>();
    custs.forEach(c => {
      custCountMap.set(c.product_id, (custCountMap.get(c.product_id) || 0) + 1);
    });

    products.forEach(p => {
      if (p.category_id) {
        p.category = catMap.get(p.category_id) || null;
      }
      p.customization_count = custCountMap.get(p.id) || 0;
    });

    return products;
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...product,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    // Strip computed/joined fields that are not real DB columns
    const { category, customization_count, ...dbUpdates } = updates as any;
    const { data, error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async deleteProduct(id: number): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
