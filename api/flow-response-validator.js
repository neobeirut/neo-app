/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Response Validator & Evidence Grounding Verification Layer
 * Target: NÉO Pilot (Badaro Flagship Only) | Multi-Concept Support
 * 
 * Verifies that AI-generated responses strictly conform to authoritative
 * database evidence before customer presentation.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid
 * @property {string[]} violations
 * @property {string[]} warnings
 * @property {'VERIFIED' | 'VERIFIED_NEGATIVE' | 'NO_MATCHING_RECORDS' | 'UNKNOWN_INCOMPLETE' | 'SYSTEM_UNAVAILABLE'} informationStatus
 * @property {string} validatedAt
 */

/**
 * Extract all numeric prices from text (e.g. $10, $20.00, 6.00 $, 38 USD)
 * @param {string} text 
 * @returns {number[]}
 */
export function extractPricesFromText(text) {
  if (!text) return [];
  const prices = [];
  
  // Match $10 or $10.50
  const dollarRegex = /\$\s*(\d+(?:\.\d{1,2})?)/g;
  let match;
  while ((match = dollarRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && !prices.includes(val)) prices.push(val);
  }

  // Match 10$ or 10.50$
  const trailingDollarRegex = /(\d+(?:\.\d{1,2})?)\s*\$/g;
  while ((match = trailingDollarRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && !prices.includes(val)) prices.push(val);
  }

  // Match 10 USD or 10.50 USD
  const usdRegex = /\b(\d+(?:\.\d{1,2})?)\s*USD\b/gi;
  while ((match = usdRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && !prices.includes(val)) prices.push(val);
  }

  return prices;
}

/**
 * Extract all authorized prices from evidence items
 * @param {any[]} evidenceItems 
 * @returns {number[]}
 */
export function extractAuthorizedPrices(evidenceItems = []) {
  const authorized = new Set();

  function scanObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    // Check known price keys
    const priceKeys = ['selling_price', 'price_usd', 'price', 'fee_usd', 'valetFee', 'baseDeliveryFeeUsd', 'sellingPrice'];
    for (const k of priceKeys) {
      if (typeof obj[k] === 'number') {
        authorized.add(obj[k]);
      } else if (typeof obj[k] === 'string' && /^\d+(\.\d+)?$/.test(obj[k])) {
        authorized.add(parseFloat(obj[k]));
      }
    }

    // Check arrays
    if (Array.isArray(obj.records)) {
      for (const r of obj.records) scanObject(r);
    }
    if (Array.isArray(obj.matches)) {
      for (const m of obj.matches) scanObject(m);
    }
    if (Array.isArray(obj.products)) {
      for (const p of obj.products) scanObject(p);
    }
    if (Array.isArray(obj.dishes)) {
      for (const d of obj.dishes) scanObject(d);
    }
  }

  for (const ev of evidenceItems) {
    scanObject(ev);
  }

  return Array.from(authorized);
}

export function validateGeneratedResponse(
  replyText,
  evidenceItems = [],
  context = {}
) {
  const violations = [];
  const warnings = [];
  const lowerReply = (replyText || '').toLowerCase();
  const lowerPrompt = (context.userPrompt || '').toLowerCase();

  // Determine overall information status from evidence items
  let informationStatus = 'VERIFIED';
  
  if (evidenceItems.length === 0) {
    informationStatus = 'NO_MATCHING_RECORDS';
  } else {
    const statuses = evidenceItems.map(e => e.informationStatus || 'VERIFIED');
    if (statuses.includes('SYSTEM_UNAVAILABLE')) {
      informationStatus = 'SYSTEM_UNAVAILABLE';
    } else if (statuses.includes('VERIFIED_NEGATIVE')) {
      informationStatus = 'VERIFIED_NEGATIVE';
    } else if (statuses.includes('UNKNOWN_INCOMPLETE')) {
      informationStatus = 'UNKNOWN_INCOMPLETE';
    } else if (statuses.includes('NO_MATCHING_RECORDS')) {
      informationStatus = 'NO_MATCHING_RECORDS';
    } else {
      informationStatus = 'VERIFIED';
    }
  }

  // 1. Mandatory Price Integrity & Grounding
  // Any price cited in the response MUST exist in retrieved evidence records
  const citedPrices = extractPricesFromText(replyText);
  const authorizedPrices = extractAuthorizedPrices(evidenceItems);

  for (const price of citedPrices) {
    // Match float price within epsilon
    const isAuthorized = authorizedPrices.some(authP => Math.abs(authP - price) < 0.01);
    if (!isAuthorized) {
      violations.push(`PRICE_PROVENANCE_VIOLATION: Response cites price "$${price.toFixed(2)}" which has no supporting record in retrieved evidence.`);
    }
  }

  // 2. Mandatory Recommendation Integrity on Failed Search
  // If search returned NO_MATCHING_RECORDS, the response cannot introduce specific product recommendations or prices
  // unless an explicit secondary retrieval tool was executed with verified records
  const hasOnlyFailedSearches = evidenceItems.length > 0 && 
    evidenceItems.every(ev => ev.informationStatus === 'NO_MATCHING_RECORDS' || ev.recordCount === 0);

  if (hasOnlyFailedSearches) {
    // If the reply recommends unretrieved specific products or quotes prices
    if (citedPrices.length > 0) {
      violations.push(`UNGROUNDED_RECOMMENDATION_VIOLATION: Search returned NO_MATCHING_RECORDS, but response recommended products with specific prices (${citedPrices.map(p => '$' + p).join(', ')}) without secondary retrieval.`);
    }
    const ungroundedRecommendationMarkers = [
      'our nut-based pastry creations highlight',
      'nos créations pâtissières aux fruits à coque mettent à l\'honneur',
      'including our cake pralin',
      'notamment avec notre cake pralin',
      'tarte pralinoi',
      'gâteau chocolat praliné'
    ];
    for (const marker of ungroundedRecommendationMarkers) {
      if (lowerReply.includes(marker)) {
        violations.push(`UNGROUNDED_RECOMMENDATION_VIOLATION: Response introduced unretrieved product recommendation "${marker}" following a failed search.`);
      }
    }
  }

  // 3. Current vs Future Intent Alignment
  const isFuturePrompt = /\b(soon|upcoming|next week|next month|future|in the future|bientôt|prochainement|قريباً|قريبا)\b/i.test(lowerPrompt);
  const isPresentPrompt = /\b(today|currently|now|right now|ce soir|aujourd'hui|lyoum|hal2)\b/i.test(lowerPrompt);

  if (isFuturePrompt) {
    // Future inquiries must not assert unconfirmed launch dates or claim products are launching without roadmap records
    const hasRoadmapRecord = evidenceItems.some(ev => ev.category === 'PRODUCT_ROADMAP' || ev.tool === 'checkFutureRoadmap');
    if (!hasRoadmapRecord) {
      // Check if response falsely promised a launch or repeated identical present catalog text
      if (lowerReply.includes('will launch on') || lowerReply.includes('available next') || lowerReply.includes('sera disponible le')) {
        violations.push('FUTURE_ROADMAP_VIOLATION: Response promised unapproved future launch date without roadmap evidence.');
      }
    }
  }

  // 4. Medical Claims Guard
  const dangerousDiabeticPhrases = [
    'safe for diabetics',
    'suitable for diabetics',
    'good for diabetics',
    'ok for diabetics',
    'cure',
    'treatment'
  ];
  for (const phrase of dangerousDiabeticPhrases) {
    if (lowerReply.includes(phrase)) {
      violations.push(`MEDICAL_CLAIM_VIOLATION: Response contains unauthorized medical claim "${phrase}".`);
    }
  }

  // 5. 86 Availability Guard
  for (const ev of evidenceItems) {
    if (ev.is_available === false || ev.isAvailable === false || ev.status === 'UNAVAILABLE' || ev.status === '86') {
      const itemName = (ev.product_name || ev.item || ev.name || ev.display_name || '').toLowerCase();
      if (itemName && lowerReply.includes(itemName)) {
        if (
          lowerReply.includes(`${itemName} is available`) ||
          lowerReply.includes(`we have ${itemName}`) ||
          lowerReply.includes(`order the ${itemName}`)
        ) {
          violations.push(`AVAILABILITY_VIOLATION: Item "${itemName}" is 86/unavailable in database but offered as available.`);
        }
      }
    }
  }

  // 6. Negative Attribute Truthfulness
  if (lowerPrompt.includes('بلا سكر') || lowerPrompt.includes('sugar-free') || lowerPrompt.includes('sans sucre')) {
    if (lowerReply.includes('we have sugar-free') || lowerReply.includes('notre sélection sans sucre') || lowerReply.includes('عندنا حلويات بلا سكر')) {
      violations.push('DIETARY_TRUTHFULNESS_VIOLATION: Claimed to offer sugar-free desserts when NÉO does not offer them.');
    }
  }

  if (lowerPrompt.includes('gluten-free bread') || lowerPrompt.includes('pain sans gluten')) {
    if (lowerReply.includes('we offer gluten-free bread') || lowerReply.includes('notre pain sans gluten')) {
      violations.push('DIETARY_TRUTHFULNESS_VIOLATION: Claimed to offer gluten-free bread when NÉO does not offer it.');
    }
  }

  if (lowerPrompt.includes('student discount') || lowerPrompt.includes('rabais') || lowerPrompt.includes('réduction étudiant')) {
    if (lowerReply.includes('we offer student discount') || lowerReply.includes('10% student discount') || lowerReply.includes('15% discount')) {
      violations.push('PROMOTION_VIOLATION: Promised student discount when none is authorized.');
    }
  }

  // 7. Reservation Pending State Guard
  if (context.activeWorkflow === 'TABLE_RESERVATION') {
    if (lowerReply.includes('reservation is confirmed') && !lowerReply.includes('pending')) {
      violations.push('RESERVATION_STATE_VIOLATION: Reservation claimed to be confirmed without Pending manager status.');
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    informationStatus,
    validatedAt: new Date().toISOString()
  };
}
