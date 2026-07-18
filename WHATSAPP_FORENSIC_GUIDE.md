# WhatsApp Forensic Comparison Tool - Usage Guide

## 🎯 Purpose

The forensic comparison tool lets you **side-by-side compare** a successful WhatsApp send vs a failed one, showing you **exactly** what's different between them.

This is the fastest way to identify:
- ✅ Which templates work
- ❌ Which templates fail
- 🔍 What's different in the payloads

---

## 🚀 Quick Start

### 1. Open the Tool

Navigate to: **`/admin/whatsapp-forensic-comparison`**

### 2. Fill Out the Form

**Fields**:
- **Phone Number** (required): Your WhatsApp number with country code (e.g., `+1234567890`)
- **Success Status**: A status you know works (e.g., `completed`)
- **Failure Status**: A status that's failing (e.g., `ready_pickup`)
- **Order ID** (optional): Any order ID (e.g., `123`)

### 3. Run the Comparison

Click **"Run Forensic Comparison"**

The tool will:
1. Send **both** templates to your phone
2. Capture full request/response data
3. Display side-by-side comparison

---

## 📊 What You'll See

### 1. Key Differences Table

Shows which fields are different between success and failure:

```
┌─────────────────────────────────────────────────────────────┐
│ Field          │ Success       │ Failure       │ Different? │
├─────────────────────────────────────────────────────────────┤
│ templateName   │ "completed"   │ "ready_pickup"│ ⚠️ YES     │
│ bodyPlaceholders│ []           │ []            │ ✅ No      │
│ httpStatus     │ 200           │ 400           │ ⚠️ YES     │
│ payloadSize    │ 234           │ 234           │ ✅ No      │
└─────────────────────────────────────────────────────────────┘
```

**Look for** ⚠️ **YES** - These are the differences causing the failure!

---

### 2. Side-by-Side Detailed View

**Left Column (🟢 Success)**:
- Template name
- Language
- Body placeholders
- HTTP status (200)
- X-Request-ID
- Full request body
- Full response body
- Template data structure

**Right Column (🔴 Failure)**:
- Same fields as success
- HTTP status (400/500)
- **Error response from Infobip**

---

### 3. Database Template Settings

Shows current DB configuration for all templates:

```json
[
  {
    "key": "whatsapp_template_completed",
    "value": "{\"template_name\":\"completed\",\"language\":\"en\"}"
  },
  {
    "key": "whatsapp_template_ready_pickup",
    "value": "{\"template_name\":\"ready_pickup\",\"language\":\"en\"}"
  }
]
```

---

## 🔍 How to Analyze Results

### Step 1: Check HTTP Status

**Success**: `httpStatus: 200`
**Failure**: `httpStatus: 400` or `500`

If failure shows `400`, it's a **payload validation error** (most common).

---

### Step 2: Compare Request Bodies

Look at the **📤 Request Body** section for both.

**What to compare**:
```json
{
  "content": {
    "templateName": "...",
    "language": "...",
    "templateData": {
      "body": {
        "placeholders": [...]  // ← CHECK THIS!
      }
    }
  }
}
```

**Common Issues**:
- ❌ Failure has `"placeholders": null` → **BUG: Missing body field**
- ❌ Failure has different placeholder count than success
- ❌ Failure missing `templateData` entirely

---

### Step 3: Check Infobip Error Response

In the failure column, look at **📥 Response Body**:

**Error Format**:
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

**Common Errors**:

| Error Text | Cause | Fix |
|-----------|-------|-----|
| `templateData.body must not be null` | Missing `body.placeholders` field | Ensure registry always includes `body: { placeholders: [] }` |
| `placeholder count mismatch` | Wrong number of placeholders | Check template structure definition |
| `template not found` | Template name doesn't exist in Infobip | Verify template name in DB matches Infobip |
| `Invalid phone number` | Phone format wrong | Use E.164 format: `+1234567890` |

---

### Step 4: Compare Template Data

Look at the **🔧 Template Data** section for both.

**What to check**:
```json
{
  "body": {
    "placeholders": []  // ← Should ALWAYS exist (even if empty)
  },
  "header": { ... },   // ← Only if template has header
  "buttons": [ ... ]   // ← Only if template has buttons
}
```

**Rules**:
- ✅ `body.placeholders` must ALWAYS be present (array)
- ✅ `header` only if template has header (IMAGE/VIDEO/DOCUMENT)
- ✅ `buttons` only if template has buttons
- ❌ Don't send empty arrays for fields that don't exist

---

## 🧪 Test Scenarios

### Scenario 1: Test Static Template

**Goal**: Verify templates with no placeholders work

**Settings**:
- Success Status: `completed`
- Failure Status: `ready_pickup`

**What to check**:
- Both should have `"placeholders": []`
- Both should return HTTP 200
- If one fails, check the request body difference

---

### Scenario 2: Test Variable Template

**Goal**: Verify templates with placeholders work

**Settings**:
- Success Status: `completed` (no placeholders)
- Failure Status: `preparing` (has placeholder for orderId)
- Order ID: `123`

**What to check**:
- Success: `"placeholders": []`
- Failure: `"placeholders": ["123"]`
- Both should return HTTP 200
- If failure returns 400, check placeholder mapping

---

### Scenario 3: Compare Two Working Templates

**Goal**: Understand the difference between two valid payloads

**Settings**:
- Success Status: `completed`
- Failure Status: `out_for_delivery`

**What to check**:
- Both should return HTTP 200
- Compare the exact request body format
- Verify both have `body.placeholders: []`

---

## 📋 Checklist: What to Verify

After running comparison, verify:

### ✅ Request Body Checks

- [ ] `templateData` exists
- [ ] `templateData.body` exists
- [ ] `templateData.body.placeholders` is an array
- [ ] Placeholder count matches template structure
- [ ] No extra fields (header/buttons) unless template has them

### ✅ Response Checks

- [ ] HTTP status is 200 (success) or documented error
- [ ] X-Request-ID present (for Infobip support)
- [ ] Success response has `messageId`
- [ ] Failure response has clear error message

### ✅ DB Config Checks

- [ ] Template configured in DB (`whatsapp_template_{key}`)
- [ ] Template name matches Infobip approved template
- [ ] Language is valid (e.g., `en`, `es`, `fr`)

---

## 🐛 Debugging Example

### Problem: `ready_pickup` template returns 400

**Step 1: Run Forensic Comparison**
```
Success Status: completed
Failure Status: ready_pickup
```

**Step 2: Compare Request Bodies**

**Success (`completed`)**:
```json
{
  "templateData": {
    "body": {
      "placeholders": []
    }
  }
}
```

**Failure (`ready_pickup`)**:
```json
{
  "templateData": {}  // ❌ MISSING body field!
}
```

**Step 3: Check Error Response**

```json
{
  "requestError": {
    "serviceException": {
      "text": "templateData.body must not be null"
    }
  }
}
```

**Step 4: Root Cause**

The registry builder is **omitting** `body` field for `ready_pickup` template.

**Step 5: Fix**

Update `whatsappTemplateRegistry.js`:
```javascript
// ✅ ALWAYS include body.placeholders (even if empty)
if (structure.hasBody) {
  if (structure.bodyPlaceholderCount > 0) {
    templateData.body = { placeholders: [...] };
  } else {
    templateData.body = { placeholders: [] };  // ← FIX: Add this
  }
}
```

**Step 6: Verify Fix**

Run comparison again - both should now return HTTP 200!

---

## 📞 Support Info

If both templates fail, check:

1. **Infobip API Key**: Valid and active?
2. **Infobip Base URL**: Correct region (e.g., `api.infobip.com` vs `europe.api.infobip.com`)?
3. **WhatsApp Sender**: Number is active and verified?
4. **Templates**: All approved in Infobip dashboard?

**Environment Variables**:
- `INFOBIP_API_KEY`
- `INFOBIP_BASE_URL`
- `INFOBIP_WHATSAPP_SENDER`

---

## 🎓 Best Practices

1. **Start Simple**: Test `completed` vs `pending` first (both static templates)
2. **One Change at a Time**: Only change one status at a time
3. **Document Findings**: Copy/paste request bodies for comparison
4. **Use X-Request-ID**: Include in Infobip support tickets if needed
5. **Check Logs**: Server logs show detailed validation flow

---

## 🚨 Common Mistakes

❌ **Don't do this**:
- Test with invalid phone numbers (always use your real WhatsApp number)
- Compare templates from different providers (Bird vs Infobip)
- Ignore the X-Request-ID (it's needed for support)
- Skip checking DB template settings first

✅ **Do this instead**:
- Use your verified WhatsApp number
- Compare templates using same provider (Infobip only)
- Save X-Request-ID for failed requests
- Verify DB settings before testing

---

## 📚 Related Documentation

- **Flow Mappings**: `/apps/WHATSAPP_SYSTEM_MAPPINGS.md`
- **Fix Summary**: `/apps/WHATSAPP_BODY_NULL_FIX.md`
- **Template Comparison**: `/apps/WHATSAPP_TEMPLATE_COMPARISON.md`

---

**Last Updated**: 2024
**Tool Location**: `/admin/whatsapp-forensic-comparison`
**API Endpoint**: `/api/admin/whatsapp-forensic-comparison`
