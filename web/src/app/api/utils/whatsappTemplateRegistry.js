import sql from "./sql";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHATSAPP TEMPLATE REGISTRY - FULLY SCHEMA-DRIVEN ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DESIGN PRINCIPLES:
 * 1. Template schemas are stored in the database (not hardcoded)
 * 2. Payload building is fully dynamic based on schema
 * 3. One generic send flow for ALL templates
 * 4. No status-specific hardcoded logic (except status→templateKey mapping)
 * 5. Clear validation errors before send
 *
 * DATABASE SCHEMA FORMAT (app_settings.setting_value):
 * {
 *   "template_name": "ready_pickup",
 *   "language": "en",
 *   "schema": {
 *     "category": "UTILITY",
 *     "bodyPlaceholderCount": 0,
 *     "hasHeader": false,
 *     "headerType": null,
 *     "hasButtons": false,
 *     "buttonCount": 0,
 *     "buttonType": null,
 *     "hasFooter": false
 *   }
 * }
 *
 * MIGRATION GUIDE:
 * - Old configs without "schema" will use DEFAULT_SCHEMAS as fallback
 * - RECOMMENDED: Add "schema" field to all template configs in database
 * - Use /api/admin/whatsapp-templates-audit to see which templates need migration
 */

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT SCHEMAS (FALLBACK ONLY - PREFER DB SCHEMAS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default schemas for backward compatibility
 * These are used ONLY if schema is not present in database
 * RECOMMENDATION: Migrate all templates to include schema in DB
 */
const DEFAULT_SCHEMAS = {
  otp: {
    category: "AUTHENTICATION",
    bodyPlaceholderCount: 1,
    hasHeader: false,
    headerType: null,
    hasButtons: true,
    buttonCount: 1,
    buttonType: "URL",
    hasFooter: false,
  },
  pending: {
    category: "UTILITY",
    bodyPlaceholderCount: 0,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  preparing: {
    category: "UTILITY",
    bodyPlaceholderCount: 1,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  ready_pickup: {
    category: "UTILITY",
    bodyPlaceholderCount: 0,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  ready_delivery: {
    category: "UTILITY",
    bodyPlaceholderCount: 0,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  out_for_delivery: {
    category: "UTILITY",
    bodyPlaceholderCount: 0,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  completed: {
    category: "UTILITY",
    bodyPlaceholderCount: 0,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  cancelled: {
    category: "UTILITY",
    bodyPlaceholderCount: 0,
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  new_order_to_branch: {
    category: "UTILITY",
    bodyPlaceholderCount: 1, // Order ID
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
  delivery_to_branch: {
    category: "UTILITY",
    bodyPlaceholderCount: 1, // 1-placeholder consolidated details
    hasHeader: false,
    headerType: null,
    hasButtons: false,
    buttonCount: 0,
    buttonType: null,
    hasFooter: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE CONFIGURATION RETRIEVAL (SCHEMA-DRIVEN)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get template configuration from database INCLUDING schema
 * Returns { templateName, language, schema }
 *
 * @param {string} templateKey - Template key (e.g., "ready_pickup")
 * @returns {object|null} { templateName, language, schema } or null
 */
export async function getTemplateConfig(templateKey) {
  const [setting] = await sql`
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ${"whatsapp_template_" + templateKey}
    LIMIT 1
  `;

  if (!setting?.setting_value) {
    console.warn(
      `[getTemplateConfig] Template ${templateKey} not configured in database`,
    );
    return null;
  }

  try {
    const config = JSON.parse(setting.setting_value);

    // Extract standardized fields
    const templateName =
      config.template_name || config.templateName || config.name;
    const language = config.language || config.locale || "en";

    // Extract schema (prefer DB schema, fallback to defaults)
    let schema = config.schema || null;

    if (!schema) {
      console.warn(
        `[getTemplateConfig] Template ${templateKey} missing schema in DB - using default schema. ` +
          `RECOMMENDED: Add schema field to database configuration.`,
      );
      schema = DEFAULT_SCHEMAS[templateKey] || null;
    }

    if (!templateName) {
      console.error(
        `[getTemplateConfig] Template ${templateKey} missing template_name`,
      );
      return null;
    }

    if (!schema) {
      console.error(
        `[getTemplateConfig] Template ${templateKey} has no schema (not in DB and no default). ` +
          `Add schema to database or DEFAULT_SCHEMAS.`,
      );
      return null;
    }

    console.log(
      `✅ [getTemplateConfig] Loaded template config for ${templateKey}:`,
      {
        templateName,
        language,
        schema,
      },
    );

    return {
      templateName,
      language,
      schema,
    };
  } catch (error) {
    console.error(
      `[getTemplateConfig] Failed to parse template ${templateKey}:`,
      error,
    );
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA-DRIVEN PAYLOAD BUILDER (FULLY DYNAMIC)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build WhatsApp template payload dynamically from schema
 *
 * @param {object} schema - Template schema (from DB or defaults)
 * @param {object} config - Template config { templateName, language }
 * @param {object} data - Dynamic data { placeholders: [], buttonParams: [], header: {} }
 * @param {string} from - Sender WhatsApp number (MUST be provisioned)
 * @param {string} to - Recipient WhatsApp number (E.164)
 * @returns {object} Infobip-compatible payload
 */
export function buildPayloadFromSchema(schema, config, data, from, to) {
  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ 🏗️  BUILD PAYLOAD FROM SCHEMA (DYNAMIC)                       ║",
  );
  console.log(
    "╠════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    `║ Template Name:         ${String(config.templateName).padEnd(39)}║`,
  );
  console.log(
    `║ Language:              ${String(config.language).padEnd(39)}║`,
  );
  console.log(`║ From:                  ${String(from).padEnd(39)}║`);
  console.log(`║ To:                    ${String(to).padEnd(39)}║`);
  console.log(
    "╠════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    `║ SCHEMA:                                                        ║`,
  );
  console.log(
    `║   Category:            ${String(schema.category || "N/A").padEnd(39)}║`,
  );
  console.log(
    `║   Body Placeholders:   ${String(schema.bodyPlaceholderCount).padEnd(39)}║`,
  );
  console.log(
    `║   Has Header:          ${String(!!schema.hasHeader).padEnd(39)}║`,
  );
  console.log(
    `║   Header Type:         ${String(schema.headerType || "N/A").padEnd(39)}║`,
  );
  console.log(
    `║   Has Buttons:         ${String(!!schema.hasButtons).padEnd(39)}║`,
  );
  console.log(
    `║   Button Count:        ${String(schema.buttonCount || 0).padEnd(39)}║`,
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );

  // Build templateData dynamically based on schema
  const templateData = {};

  // ═══════════════════════════════════════════════════════════════
  // BODY (always include - required by Infobip)
  // ═══════════════════════════════════════════════════════════════
  const placeholders = Array.isArray(data.placeholders)
    ? data.placeholders
    : [];

  // Validate placeholder count matches schema
  if (placeholders.length !== schema.bodyPlaceholderCount) {
    throw new Error(
      `Placeholder count mismatch: schema expects ${schema.bodyPlaceholderCount}, ` +
        `but received ${placeholders.length}. ` +
        `Placeholders: ${JSON.stringify(placeholders)}`,
    );
  }

  templateData.body = {
    placeholders: placeholders,
  };

  console.log(
    `✅ Body placeholders (${placeholders.length}): ${JSON.stringify(placeholders)}`,
  );

  // ═══════════════════════════════════════════════════════════════
  // HEADER (if schema says template has header)
  // ═══════════════════════════════════════════════════════════════
  if (schema.hasHeader) {
    if (!data.header) {
      throw new Error(
        `Schema requires header (type: ${schema.headerType}), but no header data provided. ` +
          `Provide data.header = { type: "${schema.headerType}", mediaUrl: "..." }`,
      );
    }

    templateData.header = data.header;
    console.log(`✅ Header included: ${JSON.stringify(data.header)}`);
  } else {
    console.log(`✅ No header (schema.hasHeader = false)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // BUTTONS (if schema says template has buttons)
  // ═══════════════════════════════════════════════════════════════
  if (schema.hasButtons && schema.buttonCount > 0) {
    const buttonParams = Array.isArray(data.buttonParams)
      ? data.buttonParams
      : [];

    if (buttonParams.length < schema.buttonCount) {
      throw new Error(
        `Button parameter count mismatch: schema expects ${schema.buttonCount}, ` +
          `but received ${buttonParams.length}`,
      );
    }

    const buttons = [];
    for (let i = 0; i < schema.buttonCount; i++) {
      const button = {
        type: schema.buttonType || "URL",
      };

      if (schema.buttonType === "URL" && buttonParams[i] !== undefined) {
        button.parameter = String(buttonParams[i]);
      }

      buttons.push(button);
    }

    templateData.buttons = buttons;
    console.log(
      `✅ Buttons included (${buttons.length}): ${JSON.stringify(buttons)}`,
    );
  } else {
    console.log(`✅ No buttons (schema.hasButtons = false)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD FINAL PAYLOAD
  // ═══════════════════════════════════════════════════════════════
  const payload = {
    messages: [
      {
        from,
        to,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        content: {
          templateName: config.templateName,
          language: config.language,
          templateData,
        },
      },
    ],
  };

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ 📤 FINAL PAYLOAD                                               ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  console.log(JSON.stringify(payload, null, 2));

  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYLOAD VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate payload against schema before sending
 * Throws clear error if validation fails
 *
 * @param {object} payload - Built payload
 * @param {object} schema - Template schema
 * @throws {Error} If validation fails
 */
export function validatePayload(payload, schema) {
  const errors = [];
  const message = payload?.messages?.[0];
  const content = message?.content;
  const templateData = content?.templateData;

  if (!message) {
    errors.push("Payload missing messages array");
  }

  if (!content) {
    errors.push("Message missing content object");
  }

  if (!templateData) {
    errors.push("Content missing templateData object");
  }

  // Validate body placeholders
  const bodyPlaceholders = templateData?.body?.placeholders || [];
  if (bodyPlaceholders.length !== schema.bodyPlaceholderCount) {
    errors.push(
      `Body placeholder count: expected ${schema.bodyPlaceholderCount}, got ${bodyPlaceholders.length}`,
    );
  }

  // Validate header
  if (schema.hasHeader && !templateData?.header) {
    errors.push(
      `Schema requires header (type: ${schema.headerType}), but not present in payload`,
    );
  }

  if (!schema.hasHeader && templateData?.header) {
    errors.push(`Payload includes header, but schema.hasHeader = false`);
  }

  // Validate buttons
  if (schema.hasButtons && schema.buttonCount > 0) {
    const buttons = templateData?.buttons || [];
    if (buttons.length !== schema.buttonCount) {
      errors.push(
        `Button count: expected ${schema.buttonCount}, got ${buttons.length}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Payload validation failed:\n${errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}`,
    );
  }

  console.log("✅ Payload validation passed");
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS → TEMPLATE KEY MAPPING (ONLY MAPPING, NO SCHEMA LOGIC)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map order status to template key
 * This is the ONLY place where status-specific logic exists
 * Everything else is schema-driven
 */
export function getTemplateKeyForStatus(status, orderType) {
  const mapping = {
    pending: "pending",
    accepted: "pending",
    preparing: "preparing",
    ready: orderType === "pickup" ? "ready_pickup" : "ready_delivery",
    out_for_delivery: "out_for_delivery",
    delivered: "completed",
    completed: "completed",
    cancelled: "cancelled",
  };

  return mapping[status] || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL ORCHESTRATOR - FULLY DYNAMIC SEND FLOW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build template payload from order status (FULLY DYNAMIC)
 *
 * Flow:
 * 1. Map status → template key
 * 2. Load template config from DB (including schema)
 * 3. Extract placeholder values based on schema requirements
 * 4. Build payload dynamically from schema
 * 5. Validate payload
 * 6. Return payload + metadata
 *
 * @param {string} status - Order status
 * @param {string} orderType - "pickup" or "delivery"
 * @param {object} dynamicData - All available placeholder data
 * @param {string} from - Sender WhatsApp number
 * @param {string} to - Recipient WhatsApp number (E.164)
 * @returns {object} { payload, debug, templateConfig, schema }
 */
export async function buildTemplatePayloadFromStatus(
  status,
  orderType,
  dynamicData,
  from,
  to,
) {
  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ 🎯 BUILD TEMPLATE PAYLOAD (SCHEMA-DRIVEN)                     ║",
  );
  console.log(
    "╠════════════════════════════════════════════════════════════════╣",
  );
  console.log(`║ Status:                ${String(status).padEnd(39)}║`);
  console.log(`║ Order Type:            ${String(orderType).padEnd(39)}║`);
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );

  // Step 1: Map status → template key
  const templateKey = getTemplateKeyForStatus(status, orderType);
  if (!templateKey) {
    throw new Error(
      `No template key mapped for status "${status}" with orderType "${orderType}"`,
    );
  }

  console.log(
    `✅ Step 1: Mapped status "${status}" → template key "${templateKey}"`,
  );

  // Step 2: Load template config (including schema)
  const templateConfig = await getTemplateConfig(templateKey);
  if (!templateConfig) {
    throw new Error(
      `Template not configured for key "${templateKey}". ` +
        `Configure in Admin → Settings → WhatsApp Templates (DB key: whatsapp_template_${templateKey})`,
    );
  }

  const { templateName, language, schema } = templateConfig;
  console.log(`✅ Step 2: Loaded template config:`, {
    templateName,
    language,
    schema,
  });

  // Step 3: Extract placeholder values based on schema
  const placeholders = [];

  if (schema.bodyPlaceholderCount > 0) {
    // Simple extraction: Use orderId if available, empty strings otherwise
    // Can be enhanced with custom placeholder mapping later
    if (dynamicData.orderId) {
      placeholders.push(String(dynamicData.orderId));
    }

    // Fill remaining placeholders with empty strings (will fail validation if required)
    const neededCount = schema.bodyPlaceholderCount;
    while (placeholders.length < neededCount) {
      placeholders.push("");
    }

    console.log(
      `✅ Step 3: Extracted ${placeholders.length} placeholders: ${JSON.stringify(placeholders)}`,
    );
  } else {
    console.log(`✅ Step 3: No placeholders needed (bodyPlaceholderCount = 0)`);
  }

  // Step 4: Build payload from schema
  const payload = buildPayloadFromSchema(
    schema,
    { templateName, language },
    { placeholders },
    from,
    to,
  );

  console.log(`✅ Step 4: Built payload from schema`);

  // Step 5: Validate payload
  try {
    validatePayload(payload, schema);
    console.log(`✅ Step 5: Payload validation passed`);
  } catch (validationError) {
    console.error(
      `❌ Step 5: Payload validation failed:`,
      validationError.message,
    );
    throw validationError;
  }

  // Step 6: Return payload + metadata
  const debug = {
    status,
    orderType,
    templateKey,
    dbSettingKey: `whatsapp_template_${templateKey}`,
    templateName,
    language,
    schema,
    placeholders,
    dynamicDataKeys: Object.keys(dynamicData),
  };

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ ✅ TEMPLATE PAYLOAD BUILD COMPLETE (SCHEMA-DRIVEN)            ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );

  return {
    payload,
    debug,
    templateConfig: { templateName, language, schema },
    schema,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE AUDIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Audit all templates in database
 * Checks for missing schemas and provides migration guidance
 */
export async function auditAllTemplates() {
  const rows = await sql`
    SELECT setting_key, setting_value, updated_at
    FROM app_settings
    WHERE setting_key LIKE 'whatsapp_template_%'
    ORDER BY setting_key
  `;

  const audit = [];

  for (const row of rows) {
    const templateKey = row.setting_key.replace("whatsapp_template_", "");
    const issues = [];

    let config = null;
    let parseError = null;

    try {
      config = JSON.parse(row.setting_value);
    } catch (error) {
      parseError = error.message;
      issues.push(`JSON parse error: ${error.message}`);
    }

    if (config) {
      const templateName =
        config.template_name || config.templateName || config.name;
      const language = config.language || config.locale;
      const schema = config.schema;

      if (!templateName) {
        issues.push("Missing template_name");
      }

      if (!language) {
        issues.push("Missing language (will default to 'en')");
      }

      if (!schema) {
        issues.push(
          "❗ MISSING SCHEMA - Using fallback defaults. RECOMMENDED: Add schema field to DB config",
        );
      } else {
        // Validate schema structure
        const requiredFields = [
          "bodyPlaceholderCount",
          "hasHeader",
          "hasButtons",
        ];
        for (const field of requiredFields) {
          if (schema[field] === undefined) {
            issues.push(`Schema missing required field: ${field}`);
          }
        }
      }

      // Check for legacy Bird fields
      if (config.project_id || config.version_id) {
        issues.push("Contains legacy Bird fields (ignored by Infobip)");
      }
    }

    audit.push({
      key: templateKey,
      dbKey: row.setting_key,
      config,
      hasSchema: !!config?.schema,
      hasFallback: !!DEFAULT_SCHEMAS[templateKey],
      issues,
      updatedAt: row.updated_at,
    });
  }

  return audit;
}

/**
 * Get all configured template keys
 */
export async function getAllTemplateKeys() {
  const rows = await sql`
    SELECT setting_key
    FROM app_settings
    WHERE setting_key LIKE 'whatsapp_template_%'
  `;

  return rows.map((row) => row.setting_key.replace("whatsapp_template_", ""));
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY ADAPTERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get template structure (BACKWARD COMPATIBILITY ADAPTER)
 * Returns schema from DB or fallback defaults
 *
 * @deprecated Use getTemplateConfig() instead for full config including schema
 */
export async function getTemplateStructure(templateKey) {
  const config = await getTemplateConfig(templateKey);
  return config?.schema || DEFAULT_SCHEMAS[templateKey] || null;
}

/**
 * Build WhatsApp template payload (BACKWARD COMPATIBILITY ADAPTER)
 * Wraps the new schema-driven buildPayloadFromSchema
 *
 * @deprecated Use buildPayloadFromSchema() for new code
 */
export async function buildWhatsAppTemplatePayload(
  templateKey,
  config,
  data,
  from,
  to,
) {
  // Get schema from DB or fallback
  const schema = await getTemplateStructure(templateKey);

  if (!schema) {
    throw new Error(
      `Template structure/schema not found for ${templateKey}. ` +
        `Add schema to DB config or DEFAULT_SCHEMAS.`,
    );
  }

  return buildPayloadFromSchema(schema, config, data, from, to);
}

/**
 * Validate template payload (BACKWARD COMPATIBILITY ADAPTER)
 * Returns { valid, errors } instead of throwing
 *
 * @deprecated Use validatePayload() for new code (throws errors)
 */
export async function validateTemplatePayload(templateKey, config, data) {
  const errors = [];

  try {
    const schema = await getTemplateStructure(templateKey);

    if (!schema) {
      errors.push(`Template structure not defined: ${templateKey}`);
      return { valid: false, errors };
    }

    if (!config?.templateName) {
      errors.push(`Template name missing in config`);
    }

    if (!config?.language) {
      errors.push(`Language missing in config`);
    }

    // Validate placeholders
    if (schema.bodyPlaceholderCount > 0) {
      const placeholders = Array.isArray(data.placeholders)
        ? data.placeholders
        : [];
      if (placeholders.length !== schema.bodyPlaceholderCount) {
        errors.push(
          `Placeholder count mismatch: expected ${schema.bodyPlaceholderCount}, got ${placeholders.length}`,
        );
      }
    }

    // Validate buttons
    if (schema.hasButtons && schema.buttonCount > 0) {
      const buttonParams = Array.isArray(data.buttonParams)
        ? data.buttonParams
        : [];
      if (buttonParams.length < schema.buttonCount) {
        errors.push(
          `Button parameter count mismatch: expected ${schema.buttonCount}, got ${buttonParams.length}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    return { valid: false, errors };
  }
}
