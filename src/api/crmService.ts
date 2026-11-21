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
  concept_id?: string | null;
  provider?: 'meta' | 'infobip' | 'manual_sim';
  ai_mode?: 'ACTIVE' | 'PAUSED' | 'HUMAN_TAKEOVER';
  brand_display_name?: string | null;
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
  customization_type: 'addon' | 'option' | 'removal' | 'remove';
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
  concept_id?: string | null;
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
  is_active?: boolean;
  show_in_mobile?: boolean;
  preparation_section?: string | null;
  prep_print_override?: 'PRINT' | 'NO_PRINT' | null;
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

  async toggleAiMode(conversationId: string, mode: 'ACTIVE' | 'HUMAN_TAKEOVER' | 'PAUSED'): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        ai_mode: mode,
        human_takeover_at: mode === 'HUMAN_TAKEOVER' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
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
      .order('name', { ascending: true });

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

    // Cascade changes to existing linked product_customizations
    const linkUpdates: any = {};
    if (updates.option_group_name !== undefined) {
      const rawG = updates.option_group_name.trim();
      const lower = rawG.toLowerCase();
      let normalized = rawG;
      if (!rawG || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons') {
        normalized = 'Add On';
      } else if (lower === 'remove' || lower === 'removal' || lower === 'removals' || lower.startsWith('remove ingredient')) {
        normalized = 'Remove';
      }
      linkUpdates.option_group_name = normalized;
    }
    if (updates.name !== undefined) {
      linkUpdates.ingredient = updates.name;
    }
    if (updates.customization_type !== undefined) {
      linkUpdates.customization_type = updates.customization_type;
    }

    if (Object.keys(linkUpdates).length > 0) {
      await supabase
        .from('product_customizations')
        .update(linkUpdates)
        .eq('customization_item_id', id);
    }

    return data as CustomizationItem;
  },

  async getCustomizationItemUsage(id: number): Promise<{
    count: number;
    products: Array<{ id: number; name: string; option_group_name?: string; price: number }>;
  }> {
    const restaurantId = getActiveRestaurantId();
    const { data: links, error } = await supabase
      .from('product_customizations')
      .select('id, product_id, ingredient, option_group_name, price')
      .eq('customization_item_id', id)
      .eq('restaurant_id', restaurantId);

    if (error) throw error;
    if (!links || links.length === 0) {
      return { count: 0, products: [] };
    }

    const prodIds = Array.from(new Set(links.map(l => l.product_id).filter(Boolean)));
    const { data: prods } = await supabase
      .from('products')
      .select('id, name')
      .in('id', prodIds);

    const prodMap = new Map((prods || []).map(p => [p.id, p.name]));
    const products = links.map(l => ({
      id: l.product_id,
      name: prodMap.get(l.product_id) || `Product #${l.product_id}`,
      option_group_name: l.option_group_name,
      price: Number(l.price) || 0
    }));

    return {
      count: products.length,
      products
    };
  },

  async deleteCustomizationItem(id: number): Promise<{ deletedItem: boolean; deletedLinksCount: number }> {
    const restaurantId = getActiveRestaurantId();

    // 1. Find all product_customizations linked to this customization_item
    const { data: links } = await supabase
      .from('product_customizations')
      .select('id')
      .eq('customization_item_id', id)
      .eq('restaurant_id', restaurantId);

    const linkIds = (links || []).map(l => l.id);

    // 2. Cascade delete modifier_inventory_effects linked to these product_customizations
    if (linkIds.length > 0) {
      await supabase
        .from('modifier_inventory_effects')
        .delete()
        .in('product_customization_id', linkIds);

      // 3. Cascade delete the product_customizations assignments
      await supabase
        .from('product_customizations')
        .delete()
        .in('id', linkIds);
    }

    // 4. Delete the customization_item itself
    const { error } = await supabase
      .from('customization_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return {
      deletedItem: true,
      deletedLinksCount: linkIds.length
    };
  },

  async cleanupOrphanedCustomizations(): Promise<{ cleanedCount: number }> {
    const restaurantId = getActiveRestaurantId();

    const { data: globalItems } = await supabase
      .from('customization_items')
      .select('id')
      .eq('restaurant_id', restaurantId);

    const validIds = new Set((globalItems || []).map(g => g.id));

    const { data: allCusts } = await supabase
      .from('product_customizations')
      .select('id, customization_item_id')
      .eq('restaurant_id', restaurantId)
      .not('customization_item_id', 'is', null);

    const orphanIds = (allCusts || [])
      .filter(c => c.customization_item_id && !validIds.has(c.customization_item_id))
      .map(c => c.id);

    if (orphanIds.length > 0) {
      await supabase
        .from('modifier_inventory_effects')
        .delete()
        .in('product_customization_id', orphanIds);

      await supabase
        .from('product_customizations')
        .delete()
        .in('id', orphanIds);
    }

    return { cleanedCount: orphanIds.length };
  },

  // --------------------------------------------------------------------------
  // Product Customizations
  // --------------------------------------------------------------------------
  async getProductCustomizations(productId?: number): Promise<ProductCustomization[]> {
    const restaurantId = getActiveRestaurantId();
    let query = supabase
      .from('product_customizations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('product_id', { ascending: true })
      .order('ingredient', { ascending: true });

    if (productId !== undefined) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ProductCustomization[];
  },

  async linkModifierToProduct(
    productId: number,
    item: CustomizationItem,
    overridePrice?: number,
    overrideGroupName?: string,
    overrideSettings?: { is_required?: boolean; is_multi_select?: boolean; is_default?: boolean }
  ): Promise<ProductCustomization> {
    const restaurantId = getActiveRestaurantId();
    // Normalize group name: blank/General/Add-ons → "Add On", Remove variations → "Remove"
    const explicitGroup = (overrideGroupName !== undefined ? overrideGroupName : (item.option_group_name || '')).trim();
    const lower = explicitGroup.toLowerCase();
    const tLower = (item.customization_type || '').toLowerCase();
    let normalizedGroup = explicitGroup;
    if (lower === 'remove' || lower === 'removal' || lower === 'removals' || lower.startsWith('remove ingredient') || tLower === 'remove' || tLower === 'removal') {
      normalizedGroup = 'Remove';
    } else if (!explicitGroup || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons' || (!overrideGroupName && tLower === 'addon')) {
      normalizedGroup = 'Add On';
    } else {
      normalizedGroup = explicitGroup;
    }

    // Check if this group already has an explicit screen order marker on this product
    let groupCreatedAt = new Date().toISOString();
    try {
      const { data: existingGroupRows } = await supabase
        .from('product_customizations')
        .select('created_at')
        .eq('restaurant_id', restaurantId)
        .eq('product_id', productId)
        .eq('option_group_name', normalizedGroup);
      const orderRow = (existingGroupRows || []).find((r: any) => /^2020-01-01T00:\d{2}:/.test(String(r?.created_at || '')));
      if (orderRow?.created_at) {
        groupCreatedAt = orderRow.created_at;
      }
    } catch {
      // ignore
    }

    const finalPrice = overridePrice !== undefined ? overridePrice : (item.default_price || 0);

    // Check if this item is already linked to this product — if so, update its group and settings instead of duplicating
    let existingQuery = supabase
      .from('product_customizations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('product_id', productId);

    if (item.id) {
      existingQuery = existingQuery.or(`customization_item_id.eq.${item.id},ingredient.ilike.${item.name}`);
    } else {
      existingQuery = existingQuery.ilike('ingredient', item.name);
    }

    const { data: existingLink } = await existingQuery.maybeSingle();

    if (existingLink) {
      const updatePayload: any = {
        option_group_name: normalizedGroup,
        price: finalPrice,
        is_active: true,
      };
      if (overrideSettings?.is_required !== undefined) {
        updatePayload.is_required = overrideSettings.is_required;
      }
      if (overrideSettings?.is_multi_select !== undefined) {
        updatePayload.is_multi_select = overrideSettings.is_multi_select;
      }
      const { data: updatedLink, error: updateErr } = await supabase
        .from('product_customizations')
        .update(updatePayload)
        .eq('id', existingLink.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return updatedLink as ProductCustomization;
    }

    const { data, error } = await supabase
      .from('product_customizations')
      .insert({
        product_id: productId,
        ingredient: item.name,
        customization_type: item.customization_type || 'option',
        price: finalPrice,
        is_active: true,
        customization_item_id: item.id,
        restaurant_id: restaurantId,
        option_group_name: normalizedGroup,
        is_required: overrideSettings?.is_required ?? false,
        is_multi_select: overrideSettings?.is_multi_select ?? false,
        created_at: groupCreatedAt,
      })
      .select()
      .single();
    if (error) throw error;

    // Automatically inherit modifier_inventory_effects if this modifier was already configured on another product
    try {
      const { data: siblingMods } = await supabase
        .from('product_customizations')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .neq('id', data.id)
        .or(item.id ? `customization_item_id.eq.${item.id},ingredient.ilike.${item.name}` : `ingredient.ilike.${item.name}`);

      if (siblingMods && siblingMods.length > 0) {
        const siblingIds = siblingMods.map(s => s.id);
        const { data: existingEffects } = await supabase
          .from('modifier_inventory_effects')
          .select('*')
          .in('product_customization_id', siblingIds);

        if (existingEffects && existingEffects.length > 0) {
          // Group by product_customization_id and pick the most complete/recent template
          const byCustId = new Map<number, any[]>();
          existingEffects.forEach(eff => {
            const list = byCustId.get(eff.product_customization_id) || [];
            list.push(eff);
            byCustId.set(eff.product_customization_id, list);
          });
          const bestTemplate = Array.from(byCustId.values()).sort((a, b) => b.length - a.length)[0];
          if (bestTemplate && bestTemplate.length > 0) {
            const toInsert = bestTemplate.map(eff => ({
              product_customization_id: data.id,
              item_id: eff.item_id,
              effect_type: eff.effect_type,
              quantity_delta: eff.quantity_delta,
              unit: eff.unit,
              location_id: eff.location_id || null
            }));
            await supabase.from('modifier_inventory_effects').insert(toInsert);
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-copy modifier inventory effects:', e);
    }

    return data as ProductCustomization;
  },

  async updateProductCustomization(id: number, updates: Partial<ProductCustomization>): Promise<ProductCustomization> {
    const restaurantId = getActiveRestaurantId();
    const { data, error } = await supabase
      .from('product_customizations')
      .update(updates)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();
    if (error) throw error;
    return data as ProductCustomization;
  },

  async unlinkModifierFromProduct(productCustomizationId: number): Promise<void> {
    // Delete any associated modifier inventory effects first
    await supabase
      .from('modifier_inventory_effects')
      .delete()
      .eq('product_customization_id', productCustomizationId);

    const { error } = await supabase
      .from('product_customizations')
      .delete()
      .eq('id', productCustomizationId);
    if (error) throw error;
  },

  async zeroOutProductCustomizationPrices(productId: number): Promise<void> {
    const restaurantId = getActiveRestaurantId();
    const { error } = await supabase
      .from('product_customizations')
      .update({ price: 0 })
      .eq('restaurant_id', restaurantId)
      .eq('product_id', productId);
    if (error) throw error;
  },

  async updateProductCustomizationPrices(productId: number, price: number, groupName?: string): Promise<void> {
    const restaurantId = getActiveRestaurantId();
    let query = supabase
      .from('product_customizations')
      .update({ price })
      .eq('restaurant_id', restaurantId)
      .eq('product_id', productId);

    if (groupName) {
      const gLower = groupName.toLowerCase().trim();
      if (gLower === 'remove' || gLower === 'removal') {
        query = query.or('option_group_name.ilike.remove,option_group_name.ilike.removal,customization_type.ilike.remove,customization_type.ilike.removal');
      } else {
        query = query.ilike('option_group_name', groupName);
      }
    }

    const { error } = await query;
    if (error) throw error;
  },

  /** Update is_required and/or is_multi_select for ALL items in a modifier group for a product */
  async updateProductModifierGroupSettings(
    productId: number,
    groupName: string,
    settings: { is_required?: boolean; is_multi_select?: boolean }
  ): Promise<void> {
    const restaurantId = getActiveRestaurantId();
    const gLower = (groupName || '').toLowerCase();
    if (gLower === 'remove' || gLower === 'removal' || gLower === 'removals' || gLower.startsWith('remove ingredient')) {
      const { error } = await supabase
        .from('product_customizations')
        .update({ ...settings, option_group_name: 'Remove' })
        .eq('product_id', productId)
        .eq('restaurant_id', restaurantId)
        .or('option_group_name.ilike.remove,option_group_name.ilike.removal,customization_type.ilike.remove,customization_type.ilike.removal');
      if (error) throw error;
      return;
    }
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

  async createCategory(name: string, section: string = 'Bistro'): Promise<Category> {
    const restaurantId = getActiveRestaurantId();
    const { data: existing } = await supabase
      .from('categories')
      .select('display_order')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = existing?.[0]?.display_order ?? 0;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        section,
        restaurant_id: restaurantId,
        display_order: maxOrder + 1,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async updateCategory(id: number, updates: { name?: string; section?: string; is_active?: boolean; display_order?: number }): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async deleteCategory(id: number): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
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

    let localConceptMap: Record<number, string> = {};
    try {
      const stored = localStorage.getItem('flow_product_concept_map');
      if (stored) localConceptMap = JSON.parse(stored);
    } catch (e) {}

    // Hydrate concept mapping from shared restaurant settings in Supabase
    let remoteConceptMap: Record<string, string> = {};
    try {
      if (restaurantId) {
        const { data: restData } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', restaurantId)
          .maybeSingle();
        if (restData?.settings?.concept_products) {
          remoteConceptMap = restData.settings.concept_products;
        }
      }
    } catch (e) {
      console.warn('Failed to load concept_products from restaurant settings:', e);
    }

    products.forEach(p => {
      let cat: Category | null = null;
      if (p.category_id) {
        cat = catMap.get(p.category_id) || null;
        p.category = cat;
      }
      p.customization_count = custCountMap.get(p.id) || 0;
      const catName = (cat?.name || '').toUpperCase();
      const isCatOvr = catName.includes('OVRLOAD') || catName.includes('OVR');
      const isCatWck = catName.includes('WICKD') || catName.includes('WCK');
      const mappedConcept = remoteConceptMap[String(p.id)] || localConceptMap[p.id];
      const isDefaultOrEmpty = !p.concept_id || p.concept_id === '00000000-0000-0000-0000-000000000001';

      p.concept_id = (isDefaultOrEmpty && mappedConcept)
        ? mappedConcept
        : (isDefaultOrEmpty && isCatOvr)
          ? '00000000-0000-0000-0000-000000000002'
          : (isDefaultOrEmpty && isCatWck)
            ? '00000000-0000-0000-0000-000000000003'
            : (p.concept_id || '00000000-0000-0000-0000-000000000001');
    });

    return products;
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const restaurantId = getActiveRestaurantId();
    const insertPayload: any = {
      show_in_mobile: product.show_in_mobile !== undefined ? product.show_in_mobile : true,
      ...product,
      restaurant_id: restaurantId,
      created_at: new Date().toISOString()
    };

    let { data, error } = await supabase
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    if (error && (error.message?.includes('concept_id') || (error as any).code === 'PGRST204')) {
      const { concept_id, ...fallbackPayload } = insertPayload;
      const res = await supabase.from('products').insert(fallbackPayload).select().single();
      if (res.error) throw res.error;
      data = res.data;
    } else if (error) {
      throw error;
    }

    if (product.concept_id && data?.id) {
      try {
        const map = JSON.parse(localStorage.getItem('flow_product_concept_map') || '{}');
        map[data.id] = product.concept_id;
        localStorage.setItem('flow_product_concept_map', JSON.stringify(map));
      } catch (e) {}

      // Persist to shared Supabase restaurant settings for real-time POS synchronization
      try {
        const restId = restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';
        const { data: restData } = await supabase.from('restaurants').select('settings').eq('id', restId).maybeSingle();
        if (restData) {
          const currentSettings = restData.settings || {};
          const conceptProducts = { ...(currentSettings.concept_products || {}) };
          conceptProducts[String(data.id)] = product.concept_id;
          await supabase.from('restaurants').update({ settings: { ...currentSettings, concept_products: conceptProducts } }).eq('id', restId);
        }
      } catch (e) {
        console.warn('Failed to sync concept to restaurant settings:', e);
      }
    }

    return { ...data, concept_id: product.concept_id || '00000000-0000-0000-0000-000000000001' } as Product;
  },

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    const restaurantId = getActiveRestaurantId();
    // Strip computed/joined fields that are not real DB columns
    const { category, customization_count, ...dbUpdates } = updates as any;
    let { data, error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error && (error.message?.includes('concept_id') || (error as any).code === 'PGRST204')) {
      const { concept_id, ...fallbackUpdates } = dbUpdates;
      const res = await supabase.from('products').update(fallbackUpdates).eq('id', id).select().single();
      if (res.error) throw res.error;
      data = res.data;
    } else if (error) {
      throw error;
    }

    if (updates.concept_id && id) {
      try {
        const map = JSON.parse(localStorage.getItem('flow_product_concept_map') || '{}');
        map[id] = updates.concept_id;
        localStorage.setItem('flow_product_concept_map', JSON.stringify(map));
      } catch (e) {}

      // Persist to shared Supabase restaurant settings for real-time POS synchronization
      try {
        const restId = restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';
        const { data: restData } = await supabase.from('restaurants').select('settings').eq('id', restId).maybeSingle();
        if (restData) {
          const currentSettings = restData.settings || {};
          const conceptProducts = { ...(currentSettings.concept_products || {}) };
          conceptProducts[String(id)] = updates.concept_id;
          await supabase.from('restaurants').update({ settings: { ...currentSettings, concept_products: conceptProducts } }).eq('id', restId);
        }
      } catch (e) {
        console.warn('Failed to sync concept to restaurant settings:', e);
      }
    }

    return { ...data, concept_id: updates.concept_id || (data as any)?.concept_id } as Product;
  },

  async deleteProduct(id: number): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
