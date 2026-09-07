-- WhatsApp Module Migration: Contacts, Conversations, Messages, Campaigns, Templates, Audit Logs

-- 1. whatsapp_contacts
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  phone_e164 VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255),
  avatar_url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  customer_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
  whatsapp_opt_in BOOLEAN DEFAULT FALSE,
  whatsapp_opt_in_at TIMESTAMP WITH TIME ZONE,
  whatsapp_opt_in_source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_e164 ON whatsapp_contacts(phone_e164);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_customer_id ON whatsapp_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_opt_in ON whatsapp_contacts(whatsapp_opt_in);

-- 2. Extend whatsapp_conversations
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS contact_id INTEGER REFERENCES whatsapp_contacts(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS service_window_active BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_contact_id ON whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_status ON whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_assigned_user ON whatsapp_conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_last_message_at ON whatsapp_conversations(last_message_at);

-- 3. whatsapp_messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  infobip_message_id VARCHAR(150) UNIQUE,
  direction VARCHAR(20) NOT NULL, -- 'incoming' or 'outgoing'
  message_type VARCHAR(50) NOT NULL DEFAULT 'text', -- 'text', 'image', 'video', 'audio', 'voice', 'document', 'location', 'contact', 'button', 'template'
  text_content TEXT,
  media_url TEXT,
  media_mime_type VARCHAR(100),
  media_filename VARCHAR(255),
  template_name VARCHAR(100),
  template_parameters JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'sent', -- 'queued', 'sending', 'sent', 'delivered', 'read', 'failed'
  error_code VARCHAR(50),
  error_message TEXT,
  sent_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  reply_to_message_id INTEGER REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  raw_infobip_payload JSONB,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv_id ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_id ON whatsapp_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_infobip_id ON whatsapp_messages(infobip_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);

-- 4. whatsapp_templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  language VARCHAR(20) NOT NULL DEFAULT 'en',
  category VARCHAR(50) DEFAULT 'UTILITY',
  status VARCHAR(30) DEFAULT 'APPROVED',
  body TEXT,
  header TEXT,
  footer TEXT,
  buttons JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  infobip_template_id VARCHAR(100),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_whatsapp_templates_name_lang UNIQUE (name, language)
);

-- 5. whatsapp_campaigns
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_id INTEGER REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  template_name VARCHAR(100),
  template_language VARCHAR(20) DEFAULT 'en',
  template_variables JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'running', 'completed', 'cancelled', 'failed'
  created_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  filter_criteria JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON whatsapp_campaigns(status);

-- 6. whatsapp_campaign_recipients
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  phone_e164 VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  infobip_message_id VARCHAR(150),
  error_code VARCHAR(50),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON whatsapp_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON whatsapp_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_infobip_id ON whatsapp_campaign_recipients(infobip_message_id);

-- 7. whatsapp_audit_logs
CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_logs_action ON whatsapp_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_logs_created_at ON whatsapp_audit_logs(created_at);
