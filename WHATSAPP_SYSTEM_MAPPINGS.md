# WhatsApp System Flow Mappings & Reference

## Complete Flow: Order Status Change → WhatsApp Notification

```
Admin Changes Order Status
         ↓
whatsappNotification.js::sendWhatsAppNotification()
         ↓
whatsappTemplateRegistry.js::buildTemplatePayloadFromStatus()
         ↓
whatsappTemplateRegistry.js::buildWhatsAppTemplatePayload()
         ↓
infobipWhatsApp.js::sendInfobipWhatsAppTemplate()
         ↓
infobipWhatsApp.js::infobipFetch() [with validation]
         ↓
HTTP POST → Infobip API
```

---

## Status → Template Key Mapping

Located in: `whatsappTemplateRegistry.js::getTemplateKeyForStatus()`

```javascript
{
  pending: "pending",
  accepted: "pending",
  preparing: "preparing",
  ready: {
    pickup: "ready_pickup",
    delivery: "ready_delivery"
  },
  out_for_delivery: "out_for_delivery",
  delivered: "completed",
  completed: "completed",
  cancelled: "cancelled"
}
```

---

## Template Key → DB Setting Key Mapping

Format: `whatsapp_template_{templateKey}`

Examples:
- `preparing` → `whatsapp_template_preparing`
- `ready_pickup` → `whatsapp_template_ready_pickup`
- `completed` → `whatsapp_template_completed`
- `otp` → `whatsapp_template_otp`

---

## DB Template Settings Schema

**Table**: `app_settings`

**Columns**:
- `setting_key` (varchar) - Primary key, e.g., `whatsapp_template_preparing`
- `setting_value` (text) - JSON string with format:
  ```json
  {
    "template_name": "preparing",
    "language": "en"
  }
  ```
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Query to view all templates**:
```sql
SELECT setting_key, setting_value, updated_at
FROM app_settings
WHERE setting_key LIKE 'whatsapp_template_%'
ORDER BY setting_key;
```

---

## Template Structure Definitions

Located in: `whatsappTemplateRegistry.js::TEMPLATE_STRUCTURES`

### Static Templates (bodyPlaceholderCount: 0)

These templates have NO variable placeholders in the body text.

```javascript
{
  pending: {
    category: "UTILITY",
    hasHeader: false,
    hasBody: true,
    bodyPlaceholderCount: 0,
    hasButtons: false,
    hasFooter: false
  },
  ready_pickup: { /* same structure */ },
  ready_delivery: { /* same structure */ },
  out_for_delivery: { /* same structure */ },
  completed: { /* same structure */ },
  cancelled: { /* same structure */ }
}
```

**Expected Payload**:
```json
{
  "content": {
    "templateName": "completed",
    "language": "en",
    "templateData": {
      "body": {
        "placeholders": []
      }
    }
  }
}
```

---

### Variable Templates (bodyPlaceholderCount > 0)

These templates have variable placeholders (e.g., `{{1}}`, `{{2}}`).

```javascript
{
  preparing: {
    category: "UTILITY",
    hasHeader: false,
    hasBody: true,
    bodyPlaceholderCount: 1,  // {{1}} = orderId
    hasButtons: false,
    hasFooter: false
  },
  otp: {
    category: "AUTHENTICATION",
    hasHeader: false,
    hasBody: true,
    bodyPlaceholderCount: 1,  // {{1}} = OTP code
    hasButtons: true,
    buttonStructure: {
      type: "URL",
      count: 1,
      parameters: ["otp"]
    },
    hasFooter: false
  }
}
```

**Expected Payload (preparing)**:
```json
{
  "content": {
    "templateName": "preparing",
    "language": "en",
    "templateData": {
      "body": {
        "placeholders": ["123"]
      }
    }
  }
}
```

---

## Placeholder Mapping

Located in: `whatsappTemplateRegistry.js::getPlaceholderMapping()`

Defines which fields from `dynamicData` map to which placeholders.

```javascript
{
  preparing: ["orderId"],
  otp: ["otpCode"]
}
```

Example:
- Template: `"Your order {{1}} is being prepared."`
- Mapping: `["orderId"]`
- dynamicData: `{ orderId: "123" }`
- Result: `placeholders: ["123"]`

---

## Function Reference

### 1. `getTemplateConfig(templateKey)`

**Location**: `whatsappTemplateRegistry.js`

**Purpose**: Fetch template configuration from database

**Input**:
```javascript
templateKey = "preparing"
```

**DB Query**:
```sql
SELECT setting_value
FROM app_settings
WHERE setting_key = 'whatsapp_template_preparing'
```

**Output**:
```javascript
{
  templateName: "preparing",
  language: "en"
}
```

---

### 2. `buildTemplatePayloadFromStatus(status, orderType, dynamicData, from, to)`

**Location**: `whatsappTemplateRegistry.js`

**Purpose**: High-level orchestrator - converts order status to complete Infobip payload

**Input**:
```javascript
status = "preparing"
orderType = "delivery"
dynamicData = { orderId: "123" }
from = "+1234567890"
to = "+0987654321"
```

**Flow**:
1. Map status → `templateKey` ("preparing")
2. Fetch DB config → `{ templateName: "preparing", language: "en" }`
3. Get structure → `TEMPLATE_STRUCTURES["preparing"]`
4. Extract placeholders → `["123"]`
5. Validate count → `1 === 1` ✅
6. Build payload → `buildWhatsAppTemplatePayload()`
7. Return `{ payload, debug, templateConfig, structure }`

**Output**:
```javascript
{
  payload: {
    messages: [{
      from: "+1234567890",
      to: "+0987654321",
      messageId: "template-preparing-1234567890",
      content: {
        templateName: "preparing",
        language: "en",
        templateData: {
          body: {
            placeholders: ["123"]
          }
        }
      }
    }]
  },
  debug: { ... },
  templateConfig: { templateName: "preparing", language: "en" },
  structure: { ... }
}
```

---

### 3. `buildWhatsAppTemplatePayload(templateKey, config, data, from, to)`

**Location**: `whatsappTemplateRegistry.js`

**Purpose**: Low-level builder - constructs exact Infobip payload based on template structure

**Input**:
```javascript
templateKey = "preparing"
config = { templateName: "preparing", language: "en" }
data = { placeholders: ["123"] }
from = "+1234567890"
to = "+0987654321"
```

**Logic**:
```javascript
const structure = TEMPLATE_STRUCTURES[templateKey];
const templateData = {};

if (structure.hasBody) {
  if (structure.bodyPlaceholderCount > 0) {
    templateData.body = { placeholders: data.placeholders };
  } else {
    templateData.body = { placeholders: [] };  // ✅ REQUIRED for static templates
  }
}

// Only include header/buttons/footer if structure says they exist
```

**Output**: Same as `buildTemplatePayloadFromStatus` payload field

---

### 4. `sendInfobipWhatsAppTemplate(phone, templateName, language, placeholders, options)`

**Location**: `infobipWhatsApp.js`

**Purpose**: Send template message to Infobip (with validation)

**Input**:
```javascript
phone = "+0987654321"
templateName = "preparing"
language = "en"
placeholders = ["123"]
options = {}
```

**Request Body (Serialized)**:
```json
{
  "messages": [{
    "from": "+1234567890",
    "to": "+0987654321",
    "content": {
      "templateName": "preparing",
      "language": "en",
      "templateData": {
        "body": {
          "placeholders": ["123"]
        }
      }
    }
  }]
}
```

**Validation** (before sending):
```javascript
if (!templateData.body) {
  throw new Error("templateData.body is missing");
}

if (!Array.isArray(templateData.body.placeholders)) {
  throw new Error("templateData.body.placeholders must be an array");
}
```

**HTTP Request**:
```
POST https://api.infobip.com/whatsapp/1/message/template
Authorization: App {INFOBIP_API_KEY}
Content-Type: application/json

{body}
```

**Response (Success)**:
```json
{
  "messages": [{
    "to": "+0987654321",
    "messageId": "abc123",
    "status": {
      "groupId": 1,
      "groupName": "PENDING",
      "id": 26,
      "name": "PENDING_ACCEPTED"
    }
  }]
}
```

**Response (Error)**:
```json
{
  "requestError": {
    "serviceException": {
      "messageId": "BAD_REQUEST",
      "text": "messages.null.content.templateData.body must not be null"
    }
  }
}
```

---

## Error Messages & Diagnostics

### Pre-Send Validation Errors

**Location**: `infobipWhatsApp.js::infobipFetch()`

**Error 1: Missing templateData**
```
❌ VALIDATION FAILED: templateData is missing in template payload.
Path: /whatsapp/1/message/template
Message: {"from":"+123","to":"+456","content":{}}
```

**Error 2: Missing body field**
```
❌ VALIDATION FAILED: templateData.body is missing.
Infobip requires body.placeholders field for ALL templates (even if empty array).
Template: preparing
templateData keys: []
Fix: Ensure buildWhatsAppTemplatePayload always includes body.placeholders
```

**Error 3: Invalid placeholders type**
```
❌ VALIDATION FAILED: templateData.body.placeholders must be an array.
Got: object
Value: {"0":"123"}
Template: preparing
```

---

### Infobip API Errors

**Location**: `infobipWhatsApp.js::infobipFetch()` (response handling)

**Enhanced Error Format** (includes debug context):
```
Infobip bad request (400). Bad Request |
[DEBUG] status=400 templateName=preparing language=en requestBodyLength=234 |
RAW_RESPONSE={"requestError":{"serviceException":{"messageId":"BAD_REQUEST","text":"..."}}}
```

**Breakdown**:
- `status=400` - HTTP status code
- `templateName=preparing` - Template that failed
- `language=en` - Language code
- `requestBodyLength=234` - Size of request body (bytes)
- `RAW_RESPONSE=...` - Full Infobip response (for forensics)

---

## Logging Checkpoints

### Success Flow Logs

**1. Status Mapping**
```
✅ Step 1: Mapped status "preparing" → template key "preparing"
```

**2. DB Config Fetch**
```
✅ Step 2: Fetched template config from DB: {"templateName":"preparing","language":"en"}
```

**3. Structure Resolution**
```
✅ Step 3: Resolved template structure: {"category":"UTILITY","hasBody":true,"bodyPlaceholderCount":1,...}
```

**4. Placeholder Extraction**
```
📋 Template requires 1 placeholder(s)
📋 Placeholder mapping: ["orderId"]
  ✅ Placeholder {{1}}: orderId = "123"
```

**5. Validation**
```
✅ Step 5: Validation passed (count matches)
```

**6. Payload Build**
```
✅ Step 6: Built final payload
```

**7. Pre-Send Validation**
```
╔════════════════════════════════════════════════════════════════╗
║ ✅ PAYLOAD VALIDATION PASSED                                   ║
╠════════════════════════════════════════════════════════════════╣
║ Template:              preparing                               ║
║ templateData exists:   YES                                     ║
║ body exists:           YES                                     ║
║ placeholders exists:   YES (array with 1 items)                ║
╚════════════════════════════════════════════════════════════════╝
```

**8. Request Sent**
```
🔍 FORENSIC DEBUG - STEP 3: EXACT SERIALIZED REQUEST BODY
{"messages":[{"from":"+123","to":"+456","content":{...}}]}
```

**9. Response Received**
```
📥 Infobip Response (200)
{"messages":[{"to":"+456","messageId":"abc123","status":{...}}]}
```

---

### Failure Flow Logs

**Missing Template in DB**
```
❌ Template not configured in database for key "preparing".
Please configure in Admin → Settings → WhatsApp Templates.
DB key: whatsapp_template_preparing
```

**Missing Placeholder Value**
```
❌ Missing required placeholder value for template "preparing":
field "orderId" (placeholder {{1}}) is empty or missing.
Available data: ["branchName","customerName"]
```

**Placeholder Count Mismatch**
```
╔════════════════════════════════════════════════════════════════╗
║ ⚠️  PLACEHOLDER COUNT MISMATCH                                 ║
╠════════════════════════════════════════════════════════════════╣
║ Expected:              1                                       ║
║ Received:              2                                       ║
║ This may cause delivery failure!                               ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Testing Endpoints

### 1. Forensic Comparison Tool (NEW)

**URL**: `/admin/whatsapp-forensic-comparison`

**Purpose**: Side-by-side comparison of success vs failure scenarios

**Usage**:
1. Open `/admin/whatsapp-forensic-comparison`
2. Enter phone number
3. Select success status (e.g., `completed`)
4. Select failure status (e.g., `ready_pickup`)
5. Click "Run Forensic Comparison"

**Output**:
- Key differences table
- Side-by-side request/response bodies
- X-Request-ID for each send
- Template data comparison
- DB template settings

**What It Shows**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 KEY DIFFERENCES                                          │
├─────────────────────────────────────────────────────────────┤
│ Field          │ Success       │ Failure       │ Different? │
├─────────────────────────────────────────────────────────────┤
│ templateName   │ "completed"   │ "ready_pickup"│ ⚠️ YES     │
│ bodyPlaceholders│ []           │ []            │ ✅ No      │
│ httpStatus     │ 200           │ 400           │ ⚠️ YES     │
└─────────────────────────────────────────────────────────────┘

🟢 Success: completed
  📋 Summary
    Template Name: completed
    Language: en
    Body Placeholders: []
    HTTP Status: 200
    X-Request-ID: abc-123-def
    
  📤 Request Body
    {"messages":[...]}
    
  📥 Response Body
    {"messages":[{"messageId":"..."}]}

🔴 Failure: ready_pickup
  📋 Summary
    Template Name: ready_pickup
    Language: en
    Body Placeholders: []
    HTTP Status: 400
    X-Request-ID: xyz-789-ghi
    
  📤 Request Body
    {"messages":[...]}
    
  📥 Response Body
    {"requestError":{"serviceException":{...}}}
```

---

### 2. Existing Test Endpoints

**Status Update Test**:
- `/api/admin/test-whatsapp-status`
- Tests a specific order status notification

**Template Audit**:
- `/api/admin/whatsapp-templates-audit`
- Lists all configured templates with validation

**Direct Send Test**:
- `/api/admin/test-whatsapp`
- Tests WhatsApp send with custom payload

---

## Common Issues & Solutions

### Issue 1: `templateData.body must not be null`

**Cause**: Template payload missing `body.placeholders` field

**Solution**: Ensure `buildWhatsAppTemplatePayload` ALWAYS includes:
```javascript
templateData.body = { placeholders: [] }
```
Even for static templates (bodyPlaceholderCount: 0)

**Fix Location**: `whatsappTemplateRegistry.js` lines 321-342

---

### Issue 2: Placeholder Count Mismatch

**Cause**: Number of placeholders doesn't match template structure

**Solution**:
1. Check template structure: `TEMPLATE_STRUCTURES[templateKey].bodyPlaceholderCount`
2. Verify placeholder mapping: `getPlaceholderMapping(templateKey)`
3. Ensure all required fields are in `dynamicData`

**Fix Location**: `buildTemplatePayloadFromStatus` validation step

---

### Issue 3: Template Not Found in DB

**Cause**: Missing or misconfigured DB setting

**Solution**:
1. Go to Admin → Settings → WhatsApp Templates
2. Add entry for `whatsapp_template_{key}`
3. Set value: `{"template_name":"...", "language":"en"}`

**DB Query**:
```sql
INSERT INTO app_settings (setting_key, setting_value)
VALUES (
  'whatsapp_template_preparing',
  '{"template_name":"preparing","language":"en"}'
);
```

---

### Issue 4: Wrong Template Sent

**Cause**: Status mapping issue

**Solution**: Check `getTemplateKeyForStatus(status, orderType)`

**Example**:
```javascript
status = "ready"
orderType = "pickup"
→ templateKey = "ready_pickup" ✅

status = "ready"
orderType = "delivery"
→ templateKey = "ready_delivery" ✅
```

---

## Environment Variables

**Required**:
- `INFOBIP_BASE_URL` - e.g., `https://api.infobip.com`
- `INFOBIP_API_KEY` - API key from Infobip dashboard
- `INFOBIP_WHATSAPP_SENDER` - Sender WhatsApp number (e.g., `+1234567890`)

**Optional**:
- None (all values come from DB or hardcoded structures)

---

## Database Schema

### app_settings Table

```sql
CREATE TABLE app_settings (
  setting_key VARCHAR(255) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### WhatsApp Template Settings Rows

```sql
-- Example rows
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('whatsapp_template_pending', '{"template_name":"pending","language":"en"}'),
  ('whatsapp_template_preparing', '{"template_name":"preparing","language":"en"}'),
  ('whatsapp_template_ready_pickup', '{"template_name":"ready_pickup","language":"en"}'),
  ('whatsapp_template_ready_delivery', '{"template_name":"ready_delivery","language":"en"}'),
  ('whatsapp_template_out_for_delivery', '{"template_name":"out_for_delivery","language":"en"}'),
  ('whatsapp_template_completed', '{"template_name":"completed","language":"en"}'),
  ('whatsapp_template_cancelled', '{"template_name":"cancelled","language":"en"}'),
  ('whatsapp_template_otp', '{"template_name":"otp","language":"en"}');
```

---

## Quick Reference: What Sends What

| User Action | Status | Order Type | Template Key | Template Name | Placeholders |
|------------|--------|------------|--------------|---------------|--------------|
| Place order | `pending` | any | `pending` | `pending` | `[]` |
| Admin accepts | `preparing` | any | `preparing` | `preparing` | `[orderId]` |
| Admin marks ready | `ready` | `pickup` | `ready_pickup` | `ready_pickup` | `[]` |
| Admin marks ready | `ready` | `delivery` | `ready_delivery` | `ready_delivery` | `[]` |
| Driver picks up | `out_for_delivery` | `delivery` | `out_for_delivery` | `out_for_delivery` | `[]` |
| Admin completes | `completed` | any | `completed` | `completed` | `[]` |
| Admin cancels | `cancelled` | any | `cancelled` | `cancelled` | `[]` |
| User signs up | (OTP) | N/A | `otp` | `otp` | `[code]` |

---

**Last Updated**: 2024
**File Version**: 1.0
**Maintainer**: System Documentation
