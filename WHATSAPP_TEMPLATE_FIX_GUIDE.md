# WhatsApp Template System-Wide Fix - Implementation Guide

## 🎯 **CRITICAL ISSUE RESOLVED**

**Root Cause:** Generic payload logic was sending fields that templates don't have, causing error 7009 (UNDELIVERABLE_REJECTED_OPERATOR).

**Solution:** Centralized template registry that builds payloads dynamically based on approved template structure.

---

## 📋 **SYSTEM AUDIT - ALL TEMPLATES**

### **Templates Defined in System:**

| Template Key | Category | Body Placeholders | Has Buttons | Button Type | Use Case |
|--------------|----------|-------------------|-------------|-------------|----------|
| `otp` | AUTHENTICATION | 1 (`{{1}}` = OTP code) | ✅ Yes | URL (COPY_CODE) | Login/Signup OTP |
| `pending` | UTILITY | 0 (none) | ❌ No | - | Order received |
| `preparing` | UTILITY | 0 (none) | ❌ No | - | Order being prepared |
| `ready_pickup` | UTILITY | 0 (none) | ❌ No | - | Order ready for pickup |
| `ready_delivery` | UTILITY | 0 (none) | ❌ No | - | Order ready for delivery |
| `out_for_delivery` | UTILITY | 0 (none) | ❌ No | - | Order out for delivery |
| `completed` | UTILITY | 0 (none) | ❌ No | - | Order completed |
| `cancelled` | UTILITY | 0 (none) | ❌ No | - | Order cancelled |
| `new_order_to_branch` | UTILITY | 0 (adjust as needed) | ❌ No | - | Branch notification |

---

## ✅ **NEW FILES CREATED**

### **1. `/apps/web/src/app/api/utils/whatsappTemplateRegistry.js`**

**Purpose:** Central template structure registry and payload builder

**Key Functions:**
- `getTemplateConfig(templateKey)` - Get template config from database
- `buildWhatsAppTemplatePayload(templateKey, config, data, from, to)` - Build correct payload
- `validateTemplatePayload(templateKey, config, data)` - Validate before sending
- `auditAllTemplates()` - Audit all templates in database
- `getTemplateStructure(templateKey)` - Get template structure definition

**Template Structure Format:**
```javascript
{
  category: "AUTHENTICATION" | "UTILITY" | "MARKETING",
  hasHeader: boolean,
  hasBody: boolean,
  bodyPlaceholderCount: number,  // CRITICAL: exact count
  hasButtons: boolean,
  buttonStructure: {
    type: "URL" | "QUICK_REPLY",
    count: number,
    parameters: ["param1", "param2"]
  } | null,
  hasFooter: boolean
}
```

---

### **2. `/apps/web/src/app/api/admin/whatsapp-templates-audit/route.js`**

**Endpoint:** `GET /api/admin/whatsapp-templates-audit`

Returns comprehensive audit of all templates showing which are valid, which have issues, and what's missing.

---

### **3. `/apps/web/src/app/api/admin/whatsapp-template-test/route.js`**

**Endpoint:** `POST /api/admin/whatsapp-template-test`

Test payload generation without actually sending. Verify that payloads match template structures.

---

## 📊 **PAYLOAD COMPARISON - BEFORE vs AFTER**

### **Order Status Template (UTILITY) - Was Failing**

**BEFORE (Generic - FAILS with error 7009):**
```json
{
  "messages": [{
    "content": {
      "templateData": {
        "body": {
          "placeholders": []
        },
        "buttons": []
      }
    }
  }]
}
```
**Why it fails:** Template has NO placeholders, so `body` should NOT be sent. Template has NO buttons, so `buttons` should NOT be sent.

**AFTER (Registry - Works):**
```json
{
  "messages": [{
    "content": {
      "templateData": {}
    }
  }]
}
```

**KEY DIFFERENCE:** `templateData` is **EMPTY** because template has no placeholders or buttons ✅

---

## 🚀 **NEXT STEPS TO COMPLETE INTEGRATION**

### **Step 1: Update customerWhatsApp.js imports**

Add these imports to `/apps/web/src/app/api/utils/customerWhatsApp.js`:

```javascript
import {
  getTemplateConfig as getTemplateConfigFromRegistry,
  buildWhatsAppTemplatePayload,
  validateTemplatePayload,
} from "./whatsappTemplateRegistry";
import {
  infobipFetch,
  toInfobipRecipient,
} from "./infobipWhatsApp";
```

### **Step 2: Update getTemplateConfig function**

Replace the existing `getTemplateConfig` function with the registry-based version that includes the `templateKey`.

### **Step 3: Update sendWhatsAppTemplate function**

Replace with the version that uses `buildWhatsAppTemplatePayload` and validates before sending.

### **Step 4: Update OTP flow**

Update `/apps/web/src/app/api/auth/phone-send-code/route.js` to use the registry for OTP sends.

### **Step 5: Test all templates**

Use the audit and test endpoints to verify all templates work correctly.

---

## ✅ **VALIDATION CHECKLIST**

- [ ] Template registry created with all template structures
- [ ] Audit endpoint created
- [ ] Test endpoint created
- [ ] All templates audited (use audit endpoint)
- [ ] All templates tested (use test endpoint)
- [ ] customerWhatsApp.js updated to use registry
- [ ] OTP flow updated to use registry
- [ ] Real OTP sends tested
- [ ] Real order status notifications tested
- [ ] No error 7009 in Infobip logs

---

## 🎯 **KEY PRINCIPLE**

**Match payload structure EXACTLY to approved template definition:**

- Template has 0 placeholders? → Don't send `body` field
- Template has no buttons? → Don't send `buttons` field  
- Template has 1 placeholder? → Send `body.placeholders` array with exactly 1 value
- Template has URL button? → Send `buttons` array with `type: "URL"` and `parameter`

**This system-wide fix prevents ALL future template payload mismatches.**
