# WhatsApp templateData.body Fix Summary

## Error Diagnosed
```
messages.null.content.templateData.body must not be null
```

This error occurs when Infobip receives a template payload where `templateData.body` is missing or null.

---

## Root Cause

**Location**: `/apps/web/src/app/api/utils/whatsappTemplateRegistry.js` (lines 321-342)

The registry builder was **OMITTING** the `body` field entirely for static templates (templates with no placeholders):

```javascript
// ❌ OLD LOGIC (WRONG)
if (structure.hasBody && structure.bodyPlaceholderCount > 0) {
  // Only include body if there are placeholders
  templateData.body = { placeholders: [...] };
} else if (structure.hasBody && structure.bodyPlaceholderCount === 0) {
  // Static template - OMIT body field entirely
  console.log('Omitting body field for static template');
}
```

**Problem**: Infobip REQUIRES `body.placeholders` field to ALWAYS be present for all templates (even static ones).

---

## Fix Applied

**File**: `/apps/web/src/app/api/utils/whatsappTemplateRegistry.js`

### Change 1: Always Include body.placeholders

```javascript
// ✅ NEW LOGIC (FIXED)
if (structure.hasBody) {
  if (structure.bodyPlaceholderCount > 0) {
    // Template has placeholders - include with actual values
    templateData.body = {
      placeholders: placeholders.slice(0, structure.bodyPlaceholderCount),
    };
  } else {
    // ✅ CRITICAL FIX: Static templates REQUIRE empty placeholders array
    // Infobip error if omitted: "templateData.body must not be null"
    templateData.body = {
      placeholders: [],
    };
  }
}
```

**Result**:
- Static templates (e.g., `ready_pickup`, `out_for_delivery`, `completed`): 
  ```json
  {
    "templateData": {
      "body": {
        "placeholders": []
      }
    }
  }
  ```
- Variable templates (e.g., `preparing`):
  ```json
  {
    "templateData": {
      "body": {
        "placeholders": ["123"]
      }
    }
  }
  ```

---

## Additional Safeguards Added

### 1. Runtime Validation (Pre-Send)

**File**: `/apps/web/src/app/api/utils/infobipWhatsApp.js` (lines 171-235)

Added validation BEFORE calling `fetch()` to catch malformed payloads:

```javascript
if (body && path.includes("/template")) {
  const msg = body?.messages?.[0];
  const templateData = msg?.content?.templateData;

  // Validate templateData exists
  if (!templateData) {
    throw new Error("templateData is missing in template payload");
  }

  // Validate body field exists
  if (!templateData.body) {
    throw new Error(
      "templateData.body is missing. " +
      "Infobip requires body.placeholders field for ALL templates (even if empty array)"
    );
  }

  // Validate placeholders is an array
  if (!Array.isArray(templateData.body.placeholders)) {
    throw new Error("templateData.body.placeholders must be an array");
  }

  console.log("✅ PAYLOAD VALIDATION PASSED");
}
```

**Result**: If payload is malformed, error is thrown BEFORE sending to Infobip (with clear diagnostic message).

---

### 2. Enhanced Error Messages

**File**: `/apps/web/src/app/api/utils/infobipWhatsApp.js` (lines 456-517)

All Infobip API errors now include debug context:

```javascript
const debugInfo = `[DEBUG] status=${response.status} templateName=${templateName} language=${language} requestBodyLength=${requestBodyString?.length || 0}`;

throw new Error(
  `Infobip bad request (400). ${details} | ${debugInfo} | RAW_RESPONSE=${JSON.stringify(json)}`
);
```

**Result**: Every failed WhatsApp send includes:
- HTTP status code
- Template name
- Language
- Request body length
- Full raw Infobip response

---

## Verification Checklist

### ✅ Production Flow Uses Registry Builder

**Confirmed**: Order status notifications use the registry builder.

**Call chain**:
1. Admin changes order status → `whatsappNotification.js::sendWhatsAppNotification()`
2. Calls → `whatsappTemplateRegistry.js::buildTemplatePayloadFromStatus()`
3. Calls → `whatsappTemplateRegistry.js::buildWhatsAppTemplatePayload()` ✅ (FIXED)
4. Sends → `infobipWhatsApp.js::infobipFetch()` with validation ✅

**Old builder**: `infobipWhatsApp.js::buildTemplatePayload()` is NOT used by production flow.

---

### ✅ All Static Templates Fixed

Templates with `bodyPlaceholderCount: 0`:
- ✅ `pending`
- ✅ `ready_pickup`
- ✅ `ready_delivery`
- ✅ `out_for_delivery`
- ✅ `completed`
- ✅ `cancelled`

All now send:
```json
{
  "templateData": {
    "body": {
      "placeholders": []
    }
  }
}
```

---

### ✅ Variable Templates Still Work

Templates with `bodyPlaceholderCount > 0`:
- ✅ `preparing` (1 placeholder: orderId)
- ✅ `otp` (1 placeholder: OTP code)

Both send:
```json
{
  "templateData": {
    "body": {
      "placeholders": ["actual-value"]
    }
  }
}
```

---

## Testing Instructions

### Test 1: Static Template (e.g., Ready for Pickup)

1. Go to **Admin → Orders**
2. Change an order status to **"Ready"** (pickup type)
3. **Expected**: WhatsApp notification sends successfully
4. **Check logs** for:
   ```
   ✅ PAYLOAD VALIDATION PASSED
   Template has static body text with NO placeholders - including body.placeholders: [] (REQUIRED by Infobip)
   ```

### Test 2: Variable Template (e.g., Preparing)

1. Go to **Admin → Orders**
2. Change an order status to **"Preparing"**
3. **Expected**: WhatsApp notification sends successfully with order ID
4. **Check logs** for:
   ```
   ✅ PAYLOAD VALIDATION PASSED
   Including body.placeholders: ["123"]
   ```

### Test 3: Error Detection

1. Manually break the payload (in code) by removing `body` field
2. **Expected**: Error thrown BEFORE sending to Infobip:
   ```
   ❌ VALIDATION FAILED: templateData.body is missing.
   Infobip requires body.placeholders field for ALL templates (even if empty array).
   ```

---

## Files Changed

1. ✅ `/apps/web/src/app/api/utils/whatsappTemplateRegistry.js`
   - Fixed `buildWhatsAppTemplatePayload()` to always include `body.placeholders: []` for static templates

2. ✅ `/apps/web/src/app/api/utils/infobipWhatsApp.js`
   - Added runtime validation before `fetch()`
   - Enhanced error messages with debug info

---

## Success Criteria

✅ All WhatsApp template sends include `templateData.body.placeholders` (never null/undefined)
✅ Static templates send `placeholders: []`
✅ Variable templates send `placeholders: ["value1", "value2"]`
✅ Runtime validation catches malformed payloads BEFORE sending
✅ Error messages include full diagnostic context
✅ Production order-status flow uses registry builder (not old builder)

---

## Next Steps

1. **Test in production** with real order status changes
2. **Monitor logs** for successful sends (look for "✅ PAYLOAD VALIDATION PASSED")
3. **Check for errors** - should see clear validation failures if payload is ever malformed
4. **Confirm** no more "templateData.body must not be null" errors from Infobip

---

**Status**: ✅ **FIXED AND READY FOR TESTING**
