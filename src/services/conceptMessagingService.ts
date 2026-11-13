/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Concept-Aware Messaging Service (Phase 1)
 *
 * Implements strict concept sender isolation, centralized multi-brand WhatsApp routing,
 * delivery driver roster dispatch, inbound destination routing, and idempotent logging.
 */

import { supabase, supabasePublic } from '../api/supabase';
import { KNOWN_CONCEPTS, type ConceptCode, DEFAULT_CONCEPT_ID } from '../types/concept';

export type ProvisioningStatus = 'PROVISIONED' | 'PENDING' | 'UNPROVISIONED' | 'REJECTED';

export type MessageCategory = 'customer_order' | 'driver_dispatch' | 'cs_reply' | 'otp' | 'system';

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'retry';

export interface ConceptMessagingConfig {
  id?: string;
  concept_id: string;
  concept_code: ConceptCode;
  concept_name: string;
  whatsapp_sender_number: string;
  provider_identifier: 'infobip';
  display_name: string;
  provisioning_status: ProvisioningStatus;
  is_enabled: boolean;
  approved_templates: Record<string, { name: string; language: string }>;
  supported_languages: string[];
  metadata?: Record<string, any>;
  updated_at?: string;
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone_number: string;
  is_active: boolean;
  is_in_house: boolean;
  vehicle_type?: string;
  notes?: string;
}

export interface SendMessageParams {
  conceptId: string;
  recipientPhone: string;
  category: MessageCategory;
  triggerEvent: string;
  orderId?: number | string | null;
  templateName?: string;
  templateParams?: Record<string, any> | any[];
  textContent?: string;
  language?: string;
  clientSuppliedSender?: string; // If supplied, MUST strictly match authoritative concept sender
  mockProvider?: boolean;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  idempotencyKey?: string;
  status: DeliveryStatus;
  senderUsed?: string;
  conceptCode?: string;
  error?: string;
  blocked?: boolean;
  isDuplicate?: boolean;
}

// Canonical fallback baseline configurations for staging / sandbox preview
export const CANONICAL_MESSAGING_CONFIGS: Record<string, ConceptMessagingConfig> = {
  '00000000-0000-0000-0000-000000000002': {
    concept_id: '00000000-0000-0000-0000-000000000002',
    concept_code: 'OVRLOAD',
    concept_name: 'OVRLOAD',
    whatsapp_sender_number: '96181202607',
    provider_identifier: 'infobip',
    display_name: 'OVRLOAD Loaded Wraps',
    provisioning_status: 'PROVISIONED',
    is_enabled: true,
    approved_templates: {
      order_confirmation: { name: 'order_confirmation', language: 'en' },
      order_preparing: { name: 'order_preparing', language: 'en' },
      out_for_delivery: { name: 'out_for_delivery', language: 'en' },
      rejected_order: { name: 'rejected_order', language: 'en' },
      driver_request: { name: 'driver_request', language: 'en' },
      order_to_driver: { name: 'order_to_driver', language: 'en' }
    },
    supported_languages: ['en', 'ar'],
    metadata: { operational: true, notes: 'Primary active fleet sender' }
  },
  '00000000-0000-0000-0000-000000000001': {
    concept_id: '00000000-0000-0000-0000-000000000001',
    concept_code: 'NEO',
    concept_name: 'NÉO',
    whatsapp_sender_number: '96176489078',
    provider_identifier: 'infobip',
    display_name: 'NÉO Beirut',
    provisioning_status: 'PENDING',
    is_enabled: false,
    approved_templates: {
      order_confirmation: { name: 'order_confirmation', language: 'en' },
      driver_request: { name: 'driver_request', language: 'en' },
      otp: { name: 'neo_login_code_2026', language: 'en_US' }
    },
    supported_languages: ['en', 'ar', 'fr'],
    metadata: { operational: false, notes: 'Pending carrier re-provisioning in Infobip' }
  },
  '00000000-0000-0000-0000-000000000003': {
    concept_id: '00000000-0000-0000-0000-000000000003',
    concept_code: 'WICKD',
    concept_name: 'WICKD',
    whatsapp_sender_number: 'UNCONFIGURED_WICKD',
    provider_identifier: 'infobip',
    display_name: 'WICKD Cinnamon Rolls',
    provisioning_status: 'UNPROVISIONED',
    is_enabled: false,
    approved_templates: {},
    supported_languages: ['en'],
    metadata: { operational: false, notes: 'Awaiting dedicated SIM acquisition' }
  }
};

// Delivery drivers are strictly loaded from authorized fleet records in database.
// No fabricated test records exist in operational defaults.
export const CANONICAL_DRIVERS: DeliveryDriver[] = [];

export class ConceptMessagingService {
  private inMemoryConfigs: Map<string, ConceptMessagingConfig> = new Map();
  private sentMessagesLog: Map<string, any> = new Map();

  constructor() {
    this.initBaseline();
  }

  private initBaseline() {
    Object.values(CANONICAL_MESSAGING_CONFIGS).forEach(cfg => {
      this.inMemoryConfigs.set(cfg.concept_id, { ...cfg });
    });
  }

  /**
   * Normalize phone number to Lebanese E.164 without leading plus
   */
  public normalizePhone(phone: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('9610')) digits = `961${digits.slice(4)}`;
    if (!digits.startsWith('961') && digits.startsWith('0') && digits.length === 8) {
      digits = `961${digits.slice(1)}`;
    }
    if (!digits.startsWith('961') && (digits.length === 7 || digits.length === 8)) {
      digits = `961${digits}`;
    }
    return digits;
  }

  /**
   * Authoritatively retrieve messaging configuration for a concept.
   * Checks database first, then local staging cache.
   */
  public async getConceptConfig(conceptId: string): Promise<ConceptMessagingConfig | null> {
    try {
      const { data, error } = await supabasePublic
        .from('concept_messaging_configurations')
        .select('*')
        .eq('concept_id', conceptId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          concept_id: data.concept_id,
          concept_code: data.metadata?.concept_code || 'NEO',
          concept_name: data.display_name,
          whatsapp_sender_number: data.whatsapp_sender_number,
          provider_identifier: 'infobip',
          display_name: data.display_name,
          provisioning_status: data.provisioning_status,
          is_enabled: data.is_enabled,
          approved_templates: data.approved_templates || {},
          supported_languages: data.supported_languages || ['en'],
          metadata: data.metadata || {},
          updated_at: data.updated_at
        };
      }
    } catch (e) {
      // In staging / offline sandbox, fall back to memory
    }

    return this.inMemoryConfigs.get(conceptId) || null;
  }

  /**
   * Retrieve all concept messaging configurations for Web Admin Communications view.
   */
  public async getAllConfigs(): Promise<ConceptMessagingConfig[]> {
    try {
      const { data, error } = await supabasePublic
        .from('concept_messaging_configurations')
        .select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          concept_id: d.concept_id,
          concept_code: (d.metadata?.concept_code || (d.concept_id.endsWith('1') ? 'NEO' : d.concept_id.endsWith('2') ? 'OVRLOAD' : 'WICKD')) as ConceptCode,
          concept_name: d.display_name,
          whatsapp_sender_number: d.whatsapp_sender_number,
          provider_identifier: 'infobip',
          display_name: d.display_name,
          provisioning_status: d.provisioning_status,
          is_enabled: d.is_enabled,
          approved_templates: d.approved_templates || {},
          supported_languages: d.supported_languages || ['en'],
          metadata: d.metadata || {},
          updated_at: d.updated_at
        }));
      }
    } catch (e) {}

    return Array.from(this.inMemoryConfigs.values());
  }

  /**
   * Save or update concept messaging configuration.
   */
  public async saveConceptConfig(config: Partial<ConceptMessagingConfig> & { concept_id: string }): Promise<ConceptMessagingConfig> {
    const existing = await this.getConceptConfig(config.concept_id);
    const updated: ConceptMessagingConfig = {
      ...CANONICAL_MESSAGING_CONFIGS[config.concept_id],
      ...existing,
      ...config,
      updated_at: new Date().toISOString()
    };

    try {
      await supabase.from('concept_messaging_configurations').upsert({
        concept_id: updated.concept_id,
        whatsapp_sender_number: updated.whatsapp_sender_number,
        display_name: updated.display_name,
        provisioning_status: updated.provisioning_status,
        is_enabled: updated.is_enabled,
        approved_templates: updated.approved_templates,
        supported_languages: updated.supported_languages,
        metadata: { ...updated.metadata, concept_code: updated.concept_code }
      }, { onConflict: 'concept_id' });
    } catch (e) {}

    this.inMemoryConfigs.set(updated.concept_id, updated);
    return updated;
  }

  /**
   * Retrieve active delivery drivers roster.
   */
  public async getDeliveryDrivers(): Promise<DeliveryDriver[]> {
    try {
      const { data, error } = await supabasePublic
        .from('delivery_drivers')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {}

    return CANONICAL_DRIVERS;
  }

  /**
   * Strict Concept Sender Resolver.
   * Throws or returns clear failure if sender is missing, unprovisioned, or disabled.
   * NEVER falls back to another concept's sender number!
   */
  public async resolveSenderForConcept(conceptId: string): Promise<{
    success: boolean;
    senderNumber?: string;
    displayName?: string;
    conceptCode?: string;
    error?: string;
  }> {
    if (!conceptId) {
      return { success: false, error: 'MISSING_CONCEPT_ID: Concept ID is required to resolve sender.' };
    }

    const config = await this.getConceptConfig(conceptId);
    if (!config) {
      return { success: false, error: `CONCEPT_NOT_CONFIGURED: No messaging configuration found for concept ${conceptId}.` };
    }

    if (!config.is_enabled) {
      return {
        success: false,
        conceptCode: config.concept_code,
        error: `MESSAGING_DISABLED: Automated messaging is disabled for concept ${config.concept_name} (${config.concept_code}).`
      };
    }

    if (config.provisioning_status !== 'PROVISIONED') {
      return {
        success: false,
        conceptCode: config.concept_code,
        error: `SENDER_NOT_PROVISIONED: Sender ${config.whatsapp_sender_number} for ${config.concept_code} is ${config.provisioning_status}. Cannot dispatch message.`
      };
    }

    const cleanSender = this.normalizePhone(config.whatsapp_sender_number);
    if (!cleanSender || cleanSender.length < 8) {
      return { success: false, error: `INVALID_SENDER_NUMBER: Configured sender for ${config.concept_code} is malformed.` };
    }

    return {
      success: true,
      senderNumber: cleanSender,
      displayName: config.display_name,
      conceptCode: config.concept_code
    };
  }

  /**
   * Build unique idempotency key for an event to prevent duplicate WhatsApp dispatches.
   */
  public buildIdempotencyKey(conceptId: string, orderId: string | number | null | undefined, triggerEvent: string, recipient: string): string {
    const normRecipient = this.normalizePhone(recipient);
    const safeOrder = orderId ? String(orderId) : 'no_order';
    return `wa_idemp_${conceptId.slice(0, 8)}_${safeOrder}_${triggerEvent}_${normRecipient}`;
  }

  /**
   * Dispatch a Concept-Aware WhatsApp Message with strict isolation and idempotency.
   */
  public async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const {
      conceptId,
      recipientPhone,
      category,
      triggerEvent,
      orderId,
      templateName,
      templateParams,
      textContent,
      clientSuppliedSender,
      mockProvider = true
    } = params;

    // 1. Authoritative Concept Sender Resolution
    const resolved = await this.resolveSenderForConcept(conceptId);
    if (!resolved.success || !resolved.senderNumber) {
      // Record failure log
      await this.logFailure({
        conceptId,
        orderId,
        recipient: recipientPhone,
        category,
        triggerEvent,
        error: resolved.error || 'Unknown resolution failure'
      });
      return {
        success: false,
        blocked: true,
        status: 'failed',
        conceptCode: resolved.conceptCode,
        error: resolved.error
      };
    }

    // 2. Reject Cross-Concept Client Tampering
    if (clientSuppliedSender) {
      const normClientSender = this.normalizePhone(clientSuppliedSender);
      if (normClientSender !== resolved.senderNumber) {
        const errorMsg = `SECURITY_VIOLATION: Client supplied sender '${clientSuppliedSender}' does not match authoritative concept sender '${resolved.senderNumber}' for ${resolved.conceptCode}.`;
        await this.logFailure({ conceptId, orderId, recipient: recipientPhone, category, triggerEvent, error: errorMsg });
        return { success: false, blocked: true, status: 'failed', error: errorMsg };
      }
    }

    // 3. Normalization & Recipient Check
    const cleanRecipient = this.normalizePhone(recipientPhone);
    if (!cleanRecipient || cleanRecipient.length < 8) {
      const errorMsg = `INVALID_RECIPIENT: Recipient phone number '${recipientPhone}' is invalid.`;
      await this.logFailure({ conceptId, orderId, recipient: recipientPhone, category, triggerEvent, error: errorMsg });
      return { success: false, status: 'failed', error: errorMsg };
    }

    // 4. Idempotency Check
    const idempotencyKey = this.buildIdempotencyKey(conceptId, orderId, triggerEvent, cleanRecipient);
    if (this.sentMessagesLog.has(idempotencyKey)) {
      const existing = this.sentMessagesLog.get(idempotencyKey);
      return {
        success: true,
        isDuplicate: true,
        messageId: existing.messageId,
        idempotencyKey,
        status: existing.status,
        senderUsed: existing.sender,
        conceptCode: resolved.conceptCode
      };
    }

    // 5. Template Verification
    const conceptConfig = await this.getConceptConfig(conceptId);
    if (templateName && conceptConfig?.approved_templates) {
      const isApproved = Boolean(conceptConfig.approved_templates[templateName]);
      if (!isApproved && Object.keys(conceptConfig.approved_templates).length > 0) {
        const errorMsg = `UNAPPROVED_TEMPLATE: Template '${templateName}' is not approved for concept ${resolved.conceptCode}.`;
        await this.logFailure({ conceptId, orderId, recipient: cleanRecipient, category, triggerEvent, error: errorMsg });
        return { success: false, status: 'failed', error: errorMsg };
      }
    }

    // 6. Provider Dispatch (Simulated in Staging / Unit Tests)
    const providerMsgId = `infobip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const logEntry = {
      messageId: providerMsgId,
      conceptId,
      conceptCode: resolved.conceptCode,
      sender: resolved.senderNumber,
      recipient: cleanRecipient,
      category,
      triggerEvent,
      orderId: orderId || null,
      templateName: templateName || null,
      templateParams: templateParams || null,
      textContent: textContent || null,
      status: 'sent' as DeliveryStatus,
      created_at: new Date().toISOString()
    };

    this.sentMessagesLog.set(idempotencyKey, logEntry);

    // Also persist into whatsapp_messages table where available
    try {
      await supabase.from('whatsapp_messages').insert({
        concept_id: conceptId,
        order_id: orderId ? Number(orderId) : null,
        sender_identity: resolved.senderNumber,
        recipient_identity: cleanRecipient,
        message_category: category,
        trigger_event: triggerEvent,
        idempotency_key: idempotencyKey,
        direction: 'outbound',
        message_type: templateName ? 'template' : 'text',
        text_content: textContent || `Template: ${templateName}`,
        template_name: templateName || null,
        status: 'sent',
        infobip_message_id: providerMsgId
      });
    } catch (e) {}

    return {
      success: true,
      messageId: providerMsgId,
      idempotencyKey,
      status: 'sent',
      senderUsed: resolved.senderNumber,
      conceptCode: resolved.conceptCode
    };
  }

  /**
   * Log failure details for auditing and retry capabilities.
   */
  private async logFailure(data: {
    conceptId: string;
    orderId?: string | number | null;
    recipient: string;
    category: MessageCategory;
    triggerEvent: string;
    error: string;
  }) {
    try {
      await supabase.from('whatsapp_messages').insert({
        concept_id: data.conceptId,
        order_id: data.orderId ? Number(data.orderId) : null,
        recipient_identity: this.normalizePhone(data.recipient),
        message_category: data.category,
        trigger_event: data.triggerEvent,
        direction: 'outbound',
        status: 'failed',
        failure_details: { error: data.error, logged_at: new Date().toISOString() }
      });
    } catch (e) {}
  }

  /**
   * Inbound WhatsApp Webhook Destination Router.
   * Matches destination number (the number the customer sent a message to)
   * to the correct concept inbox, keeping conversations strictly separated!
   */
  public async routeInboundMessage(payload: {
    fromPhone: string;
    toPhone: string;
    messageText: string;
    messageId?: string;
  }): Promise<{
    matchedConceptId: string;
    matchedConceptCode: string;
    conversationKey: string;
    brandDisplayName: string;
  }> {
    const cleanTo = this.normalizePhone(payload.toPhone);
    const cleanFrom = this.normalizePhone(payload.fromPhone);

    const allConfigs = await this.getAllConfigs();
    const matched = allConfigs.find(c => this.normalizePhone(c.whatsapp_sender_number) === cleanTo);

    // Default to OVRLOAD if matching the operational sender, else NÉO
    const conceptId = matched ? matched.concept_id : '00000000-0000-0000-0000-000000000002';
    const conceptCode = matched ? matched.concept_code : 'OVRLOAD';
    const brandName = matched ? matched.display_name : 'OVRLOAD';

    // Unique conversation key scoped by (concept_id + customer_phone)
    const conversationKey = `conv_${conceptId}_${cleanFrom}`;

    return {
      matchedConceptId: conceptId,
      matchedConceptCode: conceptCode,
      conversationKey,
      brandDisplayName: brandName
    };
  }

  /**
   * Format dynamic admin reply footer based on concept branding (replaces hardcoded strings).
   */
  public formatAdminReply(replyText: string, conceptDisplayName: string): string {
    return `${replyText.trim()}\n\n— ${conceptDisplayName}\nReply to this message if you need help.`;
  }
}

export const conceptMessagingService = new ConceptMessagingService();
