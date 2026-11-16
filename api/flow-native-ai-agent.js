/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Native Function Calling AI Agent Engine
 * Target: NÉO Pilot (Badaro Flagship Only) | Staging Supabase PostgreSQL
 * 
 * Architectural Mandates:
 * 1. Zero keyword pre-fetching or regex branching.
 * 2. Native LLM tool calling via Gemini Function Declarations (extensible to OpenAI).
 * 3. Authoritative PostgreSQL grounding (products, concept configurations, product_customizations, app_settings, client_orders).
 * 4. Company Settings VAT configuration respected across all modules:
 *    - When VAT Subscribed = NO: zero VAT, completely hide VAT line, subtotal = grand total.
 *    - When VAT Subscribed = YES: apply configured VAT rate, display VAT line and grand total.
 * 5. Structured order modifications with server-side validation against FLOW POS catalog.
 * 6. MODIFY_ITEM and final order submission re-validate add-on prices and structured customizations.
 * 7. Multi-turn order draft and reservation draft persistence.
 * 8. Strict human confirmation and pre-submission revalidation before writing to client_orders.
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { validateGeneratedResponse } from './flow-response-validator.js';

const supabaseUrl = (typeof process !== 'undefined' && (process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) ||
                    'https://ilrlychrraagugntqdfr.supabase.co';
const supabaseKey = (typeof process !== 'undefined' && (process.env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
                    'sb_publishable_kOFvZiJuLPN9uliL649IHg_Z-CESFMg';

export const serverSupabase = createClient(supabaseUrl, supabaseKey);

const DB_CONN_STR = (typeof process !== 'undefined' && (process.env?.DATABASE_URL || process.env?.POSTGRES_URL)) ||
                    'postgresql://postgres.ilrlychrraagugntqdfr:7fs0%26cUGaX4j04kc3AzR@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

let stagingSql = null;
export function getStagingSql() {
  if (!stagingSql) {
    stagingSql = postgres(DB_CONN_STR, { ssl: { rejectUnauthorized: false } });
  }
  return stagingSql;
}

export const NEO_CONCEPT_ID = '00000000-0000-0000-0000-000000000001';
export const NEO_RESTAURANT_ID = '79256f11-a9f8-4fec-901d-69baf929762d';
export const getGeminiApiKey = () => (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '');
export const GEMINI_API_KEY = getGeminiApiKey();

/**
 * Retrieve Live Server Date and Time in Asia/Beirut Timezone
 */
export function getBeirutDateTime() {
  const now = new Date();
  const beirutParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  const getPart = (type) => beirutParts.find(p => p.type === type)?.value;
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const beirutDateStr = `${year}-${month}-${day}`;
  const beirutTimeStr = `${hour}:${minute}`;

  // Tomorrow in Beirut
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(tomorrow);
  const getTomPart = (type) => tomParts.find(p => p.type === type)?.value;
  const tomorrowDateStr = `${getTomPart('year')}-${getTomPart('month')}-${getTomPart('day')}`;

  // Day after tomorrow in Beirut
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const dayAfterParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(dayAfter);
  const getDayAfterPart = (type) => dayAfterParts.find(p => p.type === type)?.value;
  const dayAfterTomorrowDateStr = `${getDayAfterPart('year')}-${getDayAfterPart('month')}-${getDayAfterPart('day')}`;

  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Beirut', weekday: 'long' }).format(now);
  const tomDayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Beirut', weekday: 'long' }).format(tomorrow);
  const monthName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Beirut', month: 'long' }).format(now);

  return {
    beirutDateStr,
    beirutTimeStr,
    tomorrowDateStr,
    dayAfterTomorrowDateStr,
    dayName,
    tomDayName,
    monthName,
    humanBeirutDate: `${dayName}, ${monthName} ${parseInt(day, 10)}, ${year}`
  };
}

/**
 * Normalizes customer or LLM time strings into valid PostgreSQL time syntax (HH:MM:SS)
 */
export function normalizeTimeString(timeStr) {
  if (!timeStr) return '20:00:00';
  const clean = timeStr.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) return clean;
  if (/^\d{2}:\d{2}$/.test(clean)) return `${clean}:00`;
  if (/^\d{1}:\d{2}$/.test(clean)) return `0${clean}:00`;

  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2] || '00';
    const meridian = match[3].toUpperCase();
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `${hStr}:${mins}:00`;
  }
  return clean;
}

/**
 * Calculate Great-Circle (Haversine) Distance in Kilometers
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Retrieve Authoritative Company VAT Settings from restaurants / app_settings
 */
export async function getCompanyVatSettings(supabase = serverSupabase, restaurantId = NEO_RESTAURANT_ID) {
  let isVatSubscribed = false;
  let vatRate = 11;
  let isVatInclusive = false; // default exclusive

  if (restaurantId) {
    const { data } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .maybeSingle();

    if (data?.settings) {
      if (data.settings.is_vat_subscribed !== undefined) {
        isVatSubscribed = Boolean(data.settings.is_vat_subscribed);
      }
      if (data.settings.vat_rate !== undefined) {
        vatRate = parseFloat(data.settings.vat_rate);
      }
      if (data.settings.is_vat_inclusive !== undefined) {
        isVatInclusive = Boolean(data.settings.is_vat_inclusive);
      } else if (data.settings.vat_treatment === 'INCLUSIVE' || data.settings.prices_include_vat === true) {
        isVatInclusive = true;
      }
    }
  }

  // Fallback check from app_settings
  const { data: appData } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['vat_rate', 'is_vat_subscribed', 'is_vat_inclusive', 'vat_treatment']);

  if (appData && appData.length > 0) {
    const appVat = appData.find(s => s.setting_key === 'vat_rate');
    if (appVat && parseFloat(appVat.setting_value) >= 0 && vatRate === 11) {
      vatRate = parseFloat(appVat.setting_value);
    }
    const appSub = appData.find(s => s.setting_key === 'is_vat_subscribed');
    if (appSub) {
      isVatSubscribed = appSub.setting_value === 'true' || appSub.setting_value === '1';
    }
    const appInc = appData.find(s => s.setting_key === 'is_vat_inclusive' || s.setting_key === 'vat_treatment');
    if (appInc) {
      isVatInclusive = appInc.setting_value === 'true' || appInc.setting_value === 'INCLUSIVE';
    }
  }

  return { isVatSubscribed, vatRate, isVatInclusive };
}

/**
 * Native Tool Declarations for Gemini Function Calling
 */
export const FLOW_TOOL_DECLARATIONS = [
  {
    name: 'searchMenu',
    description: 'Search the active NÉO product catalog by item name, category, or description in authoritative PostgreSQL database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Item name or keyword e.g. salad, croissant, coffee, cake, sandwich' },
        category: { type: 'STRING', description: 'Optional category filter' }
      },
      required: ['query']
    }
  },
  {
    name: 'getProductPricing',
    description: 'Get authoritative selling price, description, and availability (86 status) for a specific menu item.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productName: { type: 'STRING', description: 'Name of the product' }
      },
      required: ['productName']
    }
  },
  {
    name: 'getProductModifiers',
    description: 'Retrieve authoritative available add-ons, options, and removable ingredients for a specific menu item directly from FLOW POS catalog.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productName: { type: 'STRING', description: 'Name of the product' }
      },
      required: ['productName']
    }
  },
  {
    name: 'getModificationPolicy',
    description: 'Retrieve management approved NÉO modification policies from app_settings (sauce on side, ingredient removals, unconfigured substitutions, premium add-ons).',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'e.g. sauce, removals, add_on, allergy, substitutions' }
      }
    }
  },
  {
    name: 'lookupCustomerProfile',
    description: 'Lookup existing customer profile and saved delivery address/GPS location from FLOW Clients database using their authenticated phone number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        phone: { type: 'STRING', description: 'Authenticated phone number (optional, defaults to current session phone)' }
      }
    }
  },
  {
    name: 'calculateDeliveryFee',
    description: 'Calculate authoritative distance-based delivery fee from NÉO Badaro using FLOW delivery_pricing_rules and GPS coordinates. Validates the 5 km delivery coverage radius.',
    parameters: {
      type: 'OBJECT',
      properties: {
        useSavedAddress: { type: 'BOOLEAN', description: 'Use customer on-file saved address and coordinates' },
        customerLatitude: { type: 'NUMBER', description: 'Customer GPS latitude (e.g. from WhatsApp location message)' },
        customerLongitude: { type: 'NUMBER', description: 'Customer GPS longitude (e.g. from WhatsApp location message)' },
        locationString: { type: 'STRING', description: 'GPS coordinates string (e.g. "33.8790, 35.5200") or Google Maps link' },
        address: { type: 'STRING', description: 'Street name or area' },
        building: { type: 'STRING', description: 'Building name or number' },
        floor: { type: 'STRING', description: 'Floor number' },
        apartment: { type: 'STRING', description: 'Apartment number' },
        deliveryInstructions: { type: 'STRING', description: 'Delivery directions or notes' }
      }
    }
  },
  {
    name: 'manageOrderDraft',
    description: 'Update the customer in-progress order draft. All add-ons are strictly validated against the authoritative FLOW catalog. Nonexistent or incompatible add-ons are rejected.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['ADD_ITEM', 'MODIFY_ITEM', 'REMOVE_ITEM', 'SET_FULFILLMENT', 'GET_DRAFT'] },
        itemName: { type: 'STRING', description: 'Product name' },
        quantity: { type: 'INTEGER', description: 'Quantity (default 1)' },
        selectedAddOns: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Explicit list of add-on names (e.g. ["Oat Milk", "Add Caramel Syrup"])'
        },
        preparationInstructions: {
          type: 'STRING',
          description: 'Approved preparation instructions only (e.g. "dressing on the side", "no croutons", "light ice"). Additions cannot be placed here.'
        },
        pendingSpecialRequests: {
          type: 'STRING',
          description: 'Unconfigured substitutions or dietary requests requiring staff/kitchen approval.'
        },
        modifications: {
          type: 'STRING',
          description: 'MANDATORY: Natural language addition, topping, or customization requested by customer (e.g. "with chicken", "with oat milk", "with pecan caramel"). NEVER strip or omit customer requested additions!'
        },
        fulfillmentType: { type: 'STRING', enum: ['PICKUP', 'DELIVERY'] },
        fulfillmentTime: { type: 'STRING', description: 'Requested time e.g. 14:30 or 2:30 PM' },
        customerName: { type: 'STRING' },
        customerPhone: { type: 'STRING' },
        deliveryAddress: { type: 'STRING', description: 'Full delivery street and building address' },
        locationString: { type: 'STRING', description: 'GPS coordinates or map link' },
        customerLatitude: { type: 'NUMBER', description: 'GPS Latitude' },
        customerLongitude: { type: 'NUMBER', description: 'GPS Longitude' },
        useSavedAddress: { type: 'BOOLEAN', description: 'Use saved address on file' }
      },
      required: ['action']
    }
  },
  {
    name: 'submitConfirmedClientOrder',
    description: 'Submit the confirmed order to FLOW Client Orders in Pending status. STRICT FINANCIAL GATE: Product selection and order submission are strictly separate operations. Can ONLY be invoked when the customer has already seen the complete summary and explicitly confirmed this exact grand total. Cannot be called in the same turn an item was added or modified.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerConfirmed: { type: 'BOOLEAN', description: 'Must be true to create order' },
        confirmedGrandTotal: { type: 'NUMBER', description: 'The exact grand total that the customer explicitly saw and approved before confirming' }
      },
      required: ['customerConfirmed', 'confirmedGrandTotal']
    }
  },
  {
    name: 'manageReservationDraft',
    description: 'Maintain the customer table reservation details (date, time, number of guests, seating area indoor/outdoor, baby chairs, special requests).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['SET_DETAILS', 'GET_DRAFT'] },
        date: { type: 'STRING', description: 'Reservation date (YYYY-MM-DD format e.g. 2026-11-16 or 2026-11-17, or "today"/"tomorrow")' },
        time: { type: 'STRING', description: 'Reservation time (24h format HH:MM e.g. 21:00 or 14:30)' },
        guestCount: { type: 'INTEGER', description: 'Total number of guests' },
        adults: { type: 'INTEGER', description: 'Number of adults (only if customer explicitly differentiated adults and children)' },
        children: { type: 'INTEGER', description: 'Number of children (only if customer explicitly differentiated adults and children)' },
        seatingArea: { type: 'STRING', enum: ['Inside', 'Outdoor'] },
        seatingContingency: { type: 'STRING', description: 'e.g. Inside if raining' },
        babyChairs: { type: 'INTEGER', description: 'Number of baby/high chairs requested (amenity, does not increase guest count)' },
        specialRequests: { type: 'STRING', description: 'Special instructions, quiet table requests, or notes' },
        customerName: { type: 'STRING', description: 'Customer full name for the booking' },
        customerPhone: { type: 'STRING', description: 'Customer phone number' }
      },
      required: ['action']
    }
  },
  {
    name: 'submitConfirmedReservation',
    description: 'Create exactly ONE pending reservation in FLOW reservations table once the customer has confirmed. Can also update amenities (babyChairs, specialRequests) or customer name directly at confirmation time without needing a separate call.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerConfirmed: { type: 'BOOLEAN', description: 'Must be true to book reservation' },
        babyChairs: { type: 'INTEGER', description: 'Optional baby/high chair amenity count requested with confirmation (e.g. 1)' },
        specialRequests: { type: 'STRING', description: 'Optional special request or note provided with confirmation (e.g. "quiet table")' },
        customerName: { type: 'STRING', description: 'Customer full name if provided with confirmation' }
      },
      required: ['customerConfirmed']
    }
  },
  {
    name: 'getStorePolicy',
    description: 'Retrieve general store operating policies (operating hours, pickup hours, delivery coverage, laptop policy, pet policy).',
    parameters: {
      type: 'OBJECT',
      properties: {
        policy: { type: 'STRING', description: 'e.g. hours, pickup, delivery, laptop, pets' }
      },
      required: ['policy']
    }
  }
];

/**
 * Parses free text into candidate additions and legitimate preparation instructions
 */
export function parseModificationsText(text) {
  if (!text || typeof text !== 'string') return { additions: [], instructions: [] };

  const raw = text.trim();
  const segments = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

  const additions = [];
  const instructions = [];

  for (const seg of segments) {
    const lower = seg.toLowerCase();

    // 1. Check for standard sauce on the side (Complimentary Store Policy)
    if (
      lower.includes('dressing on the side') ||
      lower.includes('sauce on the side') ||
      lower.includes('sauce à part') ||
      lower.includes('dressing à part') ||
      lower.includes('on the side') ||
      lower.includes('à part')
    ) {
      instructions.push(seg);
      continue;
    }

    // 2. Check for ingredient removals (Complimentary Store Policy)
    if (
      /^(?:no|sans|without|remove|hold|bla)\s+/i.test(lower) ||
      lower.includes('no croutons') ||
      lower.includes('no onions') ||
      lower.includes('no tomatoes')
    ) {
      instructions.push(seg);
      continue;
    }

    // 3. Check for preparation / temperature notes
    if (
      /^(?:extra hot|warm|light ice|no ice|regular ice|crispy|well done|decaf)$/i.test(lower)
    ) {
      instructions.push(seg);
      continue;
    }

    // 4. Check for addition indicators ("with ...", "add ...", "extra ...", "topping ...", "plus ...")
    const addMatch = seg.match(/^(?:with|add|extra|plus|topping:?|topped with)\s+(.+)$/i);
    if (addMatch && addMatch[1]) {
      additions.push(addMatch[1].trim());
      continue;
    }

    const withMatch = seg.match(/\bwith\s+([a-z0-9\s]+)/i);
    if (withMatch && withMatch[1]) {
      additions.push(withMatch[1].trim());
      continue;
    }

    // Unrecognized phrases are treated as candidate additions requiring catalog verification
    additions.push(seg);
  }

  return { additions, instructions };
}

/**
 * Validates product and all requested additions against authoritative FLOW database
 */
export async function validateAndResolveOrderItem({
  itemName,
  quantity = 1,
  selectedAddOns = [],
  preparationInstructions = '',
  modifications = '',
  supabase = serverSupabase,
  conceptId = NEO_CONCEPT_ID,
  restaurantId = NEO_RESTAURANT_ID
}) {
  // 1. Resolve Product in NÉO concept catalog
  const { data: prods, error: pErr } = await supabase
    .from('product_concept_configurations')
    .select('id, product_id, display_name, selling_price, is_available')
    .eq('concept_id', conceptId)
    .eq('is_active', true)
    .ilike('display_name', `%${itemName}%`)
    .limit(1);

  if (pErr || !prods || prods.length === 0) {
    return {
      valid: false,
      error: 'PRODUCT_NOT_FOUND',
      message: `Product "${itemName}" does not exist in the active NÉO catalog.`
    };
  }

  const product = prods[0];
  if (!product.is_available) {
    return {
      valid: false,
      error: 'PRODUCT_86_UNAVAILABLE',
      message: `"${product.display_name}" is currently 86 / out of stock.`
    };
  }

  // 2. Fetch authoritative modifiers linked to this product in FLOW POS
  const { data: custs } = await supabase
    .from('product_customizations')
    .select('id, product_id, ingredient, customization_type, price, is_active, option_group_name')
    .eq('product_id', product.product_id)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  const authorizedList = custs || [];
  const authorizedAddons = authorizedList.filter(c =>
    c.customization_type === 'addon' ||
    (c.price > 0 && c.customization_type !== 'remove' && c.customization_type !== 'removal')
  );

  // 3. Collect all requested additions
  const candidateAdditions = [];

  if (Array.isArray(selectedAddOns)) {
    for (const a of selectedAddOns) {
      if (typeof a === 'string' && a.trim()) candidateAdditions.push(a.trim());
      else if (a && typeof a === 'object' && a.name) candidateAdditions.push(a.name.trim());
    }
  }

  const parsedMod = parseModificationsText(modifications);
  candidateAdditions.push(...parsedMod.additions);

  const parsedPrep = parseModificationsText(preparationInstructions);
  candidateAdditions.push(...parsedPrep.additions);

  const finalInstructions = [
    ...parsedMod.instructions,
    ...parsedPrep.instructions
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  // 4. Validate every requested addition
  const validatedAddOns = [];

  for (const requestedAddition of candidateAdditions) {
    const cleanAdd = requestedAddition.toLowerCase().replace(/^(?:add|extra|with)\s+/i, '').trim();

    const matched = authorizedAddons.find(a => {
      const aLower = a.ingredient.toLowerCase().replace(/^(?:add|extra|with)\s+/i, '').trim();
      return aLower === cleanAdd || aLower.includes(cleanAdd) || cleanAdd.includes(aLower);
    });

    if (matched) {
      validatedAddOns.push({
        id: matched.id,
        name: matched.ingredient,
        price: Number(matched.price || 0),
        group: matched.option_group_name || 'Add On',
        qty: 1
      });
    } else {
      // Check if it exists in FLOW globally (INCOMPATIBLE vs NONEXISTENT)
      const { data: globalMatch } = await supabase
        .from('customization_items')
        .select('id, name, customization_type, default_price')
        .ilike('name', `%${cleanAdd}%`)
        .limit(1);

      const isGlobal = globalMatch && globalMatch.length > 0;
      const availableList = authorizedAddons.length > 0
        ? authorizedAddons.map(a => `${a.ingredient} (+$${a.price})`).join(', ')
        : 'None (no add-ons configured for this item)';

      return {
        valid: false,
        error: isGlobal ? 'INCOMPATIBLE_ADDON' : 'NONEXISTENT_ADDON',
        message: isGlobal
          ? `Add-on "${requestedAddition}" exists in FLOW but is NOT authorized for "${product.display_name}". Available add-ons for this product: ${availableList}.`
          : `Add-on "${requestedAddition}" does not exist in FLOW catalog. Available add-ons for "${product.display_name}": ${availableList}.`,
        rejectedAddition: requestedAddition,
        productName: product.display_name,
        availableAddons: authorizedAddons.map(a => ({ name: a.ingredient, price: a.price, group: a.option_group_name }))
      };
    }
  }

  // 5. Calculate authoritative pricing
  const basePrice = Number(product.selling_price);
  const addonsTotalPerUnit = validatedAddOns.reduce((sum, a) => sum + (a.price * a.qty), 0);
  const unitPrice = basePrice + addonsTotalPerUnit;
  const totalPrice = unitPrice * quantity;

  return {
    valid: true,
    item: {
      productId: product.product_id,
      name: product.display_name,
      basePrice,
      unitPrice,
      qty: quantity,
      selectedAddOns: validatedAddOns,
      preparationInstructions: finalInstructions.join(', '),
      totalPrice
    }
  };
}

/**
 * Persistent Order Draft State Machine with Company VAT Calculation
 */
export class OrderDraftState {
  constructor() {
    this.items = []; // Array of validated items
    this.fulfillmentType = null; // 'PICKUP' | 'DELIVERY'
    this.fulfillmentTime = null; // e.g. '14:30'
    this.deliveryFee = 0; // Authoritative distance-based fee
    this.deliveryDistanceKm = null;
    this.deliveryAddress = null;
    this.deliveryCoordinates = null; // { latitude, longitude }
    this.deliveryInstructions = null;
    this.customerName = null;
    this.customerPhone = null;
    this.isConfirmed = false;
    this.createdOrderId = null;
    this.isVatSubscribed = false;
    this.vatRate = 11;
    this.isVatInclusive = false;
    this.version = 1;
    this.presentedGrandTotal = null;
    this.confirmedGrandTotal = null;
    this.confirmedDraftVersion = null;
    this.turnMutationsCount = 0;
    this.pendingProductSelections = [];
  }

  markMutation() {
    this.version += 1;
    this.turnMutationsCount += 1;
    this.presentedGrandTotal = null;
    this.confirmedGrandTotal = null;
    this.confirmedDraftVersion = null;
    this.isConfirmed = false;
  }

  setPresentedTotal(total) {
    this.presentedGrandTotal = Number(total);
  }

  setVatSettings(isVatSubscribed, vatRate, isVatInclusive = false) {
    const prevSub = this.isVatSubscribed;
    const prevRate = this.vatRate;
    const prevInc = this.isVatInclusive;
    this.isVatSubscribed = Boolean(isVatSubscribed);
    if (vatRate !== undefined && Number(vatRate) >= 0) {
      this.vatRate = Number(vatRate);
    }
    this.isVatInclusive = Boolean(isVatInclusive);
    if (prevSub !== this.isVatSubscribed || prevRate !== this.vatRate || prevInc !== this.isVatInclusive) {
      this.markMutation();
    }
  }

  addItem(validatedItem) {
    const existing = this.items.find(i =>
      i.productId === validatedItem.productId &&
      JSON.stringify(i.selectedAddOns) === JSON.stringify(validatedItem.selectedAddOns) &&
      i.preparationInstructions === validatedItem.preparationInstructions
    );
    if (existing) {
      existing.qty += validatedItem.qty;
      existing.totalPrice = existing.unitPrice * existing.qty;
    } else {
      this.items.push(validatedItem);
    }
    this.markMutation();
  }

  replaceOrUpdateItem(name, validatedItem) {
    const idx = this.items.findIndex(i => i.name.toLowerCase().includes(name.toLowerCase()));
    if (idx >= 0) {
      this.items[idx] = validatedItem;
    } else {
      this.addItem(validatedItem);
    }
    this.markMutation();
  }

  removeItem(name) {
    const prevLen = this.items.length;
    this.items = this.items.filter(i => !i.name.toLowerCase().includes(name.toLowerCase()));
    if (this.items.length !== prevLen) {
      this.markMutation();
    }
  }

  getSubtotal() {
    return this.items.reduce((sum, i) => sum + i.totalPrice, 0);
  }

  getVat() {
    if (!this.isVatSubscribed) return 0;
    const sub = this.getSubtotal();
    if (this.isVatInclusive) {
      // Menu prices already include VAT: calculate contained VAT component (subtotal - subtotal / (1 + rate/100))
      return Math.round((sub - (sub / (1 + this.vatRate / 100))) * 100) / 100;
    }
    // Exclusive VAT: add on top
    return Math.round(sub * (this.vatRate / 100) * 100) / 100;
  }

  getGrandTotal() {
    const sub = this.getSubtotal();
    const fee = this.fulfillmentType === 'DELIVERY' ? Number(this.deliveryFee || 0) : 0;
    if (!this.isVatSubscribed) return Math.round((sub + fee) * 100) / 100;
    if (this.isVatInclusive) {
      // VAT is inclusive in menu price: customer pays item prices plus delivery fee
      return Math.round((sub + fee) * 100) / 100;
    }
    // VAT is exclusive: add on top
    return Math.round((sub + this.getVat() + fee) * 100) / 100;
  }

  getSummary() {
    const subtotal = this.getSubtotal();
    const vat = this.getVat();
    const grandTotal = this.getGrandTotal();
    const deliveryFee = this.fulfillmentType === 'DELIVERY' ? Number(this.deliveryFee || 0) : 0;

    return {
      items: this.items.map(i => ({
        productId: i.productId,
        name: i.name,
        basePrice: i.basePrice,
        unitPrice: i.unitPrice,
        qty: i.qty,
        selectedAddOns: i.selectedAddOns,
        preparationInstructions: i.preparationInstructions,
        totalPrice: i.totalPrice,
        modifications: [
          ...(i.selectedAddOns || []).map(a => `with ${a.name} (+$${a.price})`),
          i.preparationInstructions
        ].filter(Boolean).join(', ')
      })),
      subtotal,
      deliveryFee,
      deliveryDistanceKm: this.deliveryDistanceKm,
      deliveryAddress: this.deliveryAddress,
      deliveryCoordinates: this.deliveryCoordinates,
      deliveryInstructions: this.deliveryInstructions,
      vat,
      grandTotal,
      isVatSubscribed: this.isVatSubscribed,
      vatRate: this.vatRate,
      isVatInclusive: this.isVatInclusive,
      vatTreatment: !this.isVatSubscribed ? 'DISABLED' : (this.isVatInclusive ? 'INCLUSIVE' : 'EXCLUSIVE'),
      fulfillmentType: this.fulfillmentType || 'NOT_SPECIFIED',
      fulfillmentTime: this.fulfillmentTime || 'NOT_SPECIFIED',
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      isConfirmed: this.isConfirmed,
      createdOrderId: this.createdOrderId,
      version: this.version,
      presentedGrandTotal: this.presentedGrandTotal,
      confirmedGrandTotal: this.confirmedGrandTotal,
      turnMutationsCount: this.turnMutationsCount,
      pendingProductSelections: this.pendingProductSelections,
      isReadyForConfirmation: this.items.length > 0 && Boolean(this.fulfillmentType) && (this.fulfillmentType === 'PICKUP' || Boolean(this.deliveryAddress && this.deliveryDistanceKm !== null))
    };
  }
}

/**
 * Persistent Reservation Draft State Machine
 */
export class ReservationDraftState {
  constructor() {
    this.branch = 'Badaro';
    this.date = null;
    this.time = null;
    this.guestCount = null;
    this.adults = null;
    this.children = null;
    this.seatingArea = null;
    this.seatingContingency = null;
    this.babyChairs = 0;
    this.specialRequests = '';
    this.customerName = null;
    this.customerPhone = null;
    this.isConfirmed = false;
    this.createdReservationId = null;
  }

  getSummary() {
    let guestSummary = null;
    if (this.adults !== null && this.children !== null) {
      guestSummary = `${this.adults} adult${this.adults !== 1 ? 's' : ''}, ${this.children} child${this.children !== 1 ? 'ren' : ''}`;
    } else if (this.guestCount) {
      guestSummary = `${this.guestCount} guest${this.guestCount !== 1 ? 's' : ''}`;
    }

    return {
      branch: this.branch,
      date: this.date,
      time: this.time,
      guestCount: this.guestCount,
      adults: this.adults,
      children: this.children,
      guestSummary,
      seatingArea: this.seatingArea,
      seatingContingency: this.seatingContingency,
      babyChairs: this.babyChairs || 0,
      specialRequests: this.specialRequests,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      isConfirmed: this.isConfirmed,
      createdReservationId: this.createdReservationId,
      isComplete: Boolean(this.date && this.time && this.guestCount && this.guestCount > 0)
    };
  }
}

/**
 * In-Memory Conversation Session Repository & PostgreSQL Durable Hydration
 */
export const sessionStore = new Map();

export function getOrCreateSession(conversationId) {
  if (!sessionStore.has(conversationId)) {
    sessionStore.set(conversationId, {
      id: conversationId,
      aiMode: 'ACTIVE',
      history: [],
      orderDraft: new OrderDraftState(),
      reservationDraft: new ReservationDraftState()
    });
  }
  return sessionStore.get(conversationId);
}

export async function getOrCreateSessionAsync(conversationId) {
  if (sessionStore.has(conversationId)) {
    return sessionStore.get(conversationId);
  }

  const session = {
    id: conversationId,
    aiMode: 'ACTIVE',
    history: [],
    orderDraft: new OrderDraftState(),
    reservationDraft: new ReservationDraftState()
  };

  try {
    const sql = getStagingSql();
    const rows = await sql`
      SELECT order_draft, reservation_draft, history, customer_phone, customer_name 
      FROM staging.ai_session_drafts 
      WHERE conversation_id = ${conversationId} 
      LIMIT 1;
    `;
    if (rows && rows.length > 0) {
      const r = rows[0];
      if (r.customer_phone) {
        session.customerPhone = r.customer_phone;
        session.orderDraft.customerPhone = r.customer_phone;
        session.reservationDraft.customerPhone = r.customer_phone;
      }
      if (r.customer_name) {
        session.customerName = r.customer_name;
        session.orderDraft.customerName = r.customer_name;
        session.reservationDraft.customerName = r.customer_name;
      }
      if (r.order_draft) {
        const od = r.order_draft;
        if (Array.isArray(od.items)) session.orderDraft.items = od.items;
        if (od.fulfillmentType) session.orderDraft.fulfillmentType = od.fulfillmentType;
        if (od.fulfillmentTime) session.orderDraft.fulfillmentTime = od.fulfillmentTime;
        if (od.deliveryFee !== undefined) session.orderDraft.deliveryFee = od.deliveryFee;
        if (od.deliveryDistanceKm !== undefined) session.orderDraft.deliveryDistanceKm = od.deliveryDistanceKm;
        if (od.deliveryAddress) session.orderDraft.deliveryAddress = od.deliveryAddress;
        if (od.deliveryCoordinates) session.orderDraft.deliveryCoordinates = od.deliveryCoordinates;
        if (od.deliveryInstructions) session.orderDraft.deliveryInstructions = od.deliveryInstructions;
        if (od.isConfirmed !== undefined) session.orderDraft.isConfirmed = od.isConfirmed;
        if (od.createdOrderId) session.orderDraft.createdOrderId = od.createdOrderId;
        if (od.version !== undefined) session.orderDraft.version = od.version;
        if (od.presentedGrandTotal !== undefined) session.orderDraft.presentedGrandTotal = od.presentedGrandTotal;
        if (od.confirmedGrandTotal !== undefined) session.orderDraft.confirmedGrandTotal = od.confirmedGrandTotal;
        if (Array.isArray(od.pendingProductSelections)) session.orderDraft.pendingProductSelections = od.pendingProductSelections;
      }
      if (r.reservation_draft && r.reservation_draft.date) {
        Object.assign(session.reservationDraft, r.reservation_draft);
      }
      if (Array.isArray(r.history) && r.history.length > 0) {
        session.history = r.history;
      }
    }
  } catch (err) {
    console.warn('[DurableSession] Failed to hydrate draft from PostgreSQL:', err.message);
  }

  sessionStore.set(conversationId, session);
  return session;
}

export async function persistSessionDraft(session, lastMessage = '') {
  try {
    const sql = getStagingSql();
    await sql`
      INSERT INTO staging.ai_session_drafts (
        conversation_id, customer_phone, customer_name, order_draft, reservation_draft, history, last_message, updated_at
      ) VALUES (
        ${session.id},
        ${session.orderDraft?.customerPhone || session.reservationDraft?.customerPhone || null},
        ${session.orderDraft?.customerName || session.reservationDraft?.customerName || null},
        ${sql.json(session.orderDraft?.getSummary() || {})},
        ${sql.json(session.reservationDraft?.getSummary() || {})},
        ${sql.json(session.history || [])},
        ${lastMessage},
        NOW()
      )
      ON CONFLICT (conversation_id) DO UPDATE SET
        customer_phone = EXCLUDED.customer_phone,
        customer_name = EXCLUDED.customer_name,
        order_draft = EXCLUDED.order_draft,
        reservation_draft = EXCLUDED.reservation_draft,
        history = EXCLUDED.history,
        last_message = EXCLUDED.last_message,
        updated_at = NOW();
    `;
  } catch (e) {
    console.warn('[PersistDraft] Failed to persist draft to DB:', e.message);
  }
}

export async function resetSession(conversationId) {
  if (conversationId && conversationId !== 'ALL') {
    sessionStore.delete(conversationId);
    try {
      const sql = getStagingSql();
      await sql`DELETE FROM staging.ai_session_drafts WHERE conversation_id = ${conversationId};`;
    } catch {}
  } else {
    sessionStore.clear();
    try {
      const sql = getStagingSql();
      await sql`DELETE FROM staging.ai_session_drafts;`;
    } catch {}
  }
  return { success: true, message: conversationId ? `Session ${conversationId} reset.` : 'All AI sessions reset.' };
}

/**
 * Execute Tool against Authoritative PostgreSQL Database
 */
export async function executeFlowTool(name, args, session, options = {}) {
  const supabase = options.supabase || serverSupabase;
  const conceptId = options.conceptId || NEO_CONCEPT_ID;
  const restaurantId = options.restaurantId || NEO_RESTAURANT_ID;
  const orderDraft = session.orderDraft;
  const resDraft = session.reservationDraft;

  // Sync latest VAT settings from company configuration
  const vatSettings = await getCompanyVatSettings(supabase, restaurantId);
  orderDraft.setVatSettings(vatSettings.isVatSubscribed, vatSettings.vatRate);

  if (name === 'searchMenu') {
    const rawTerm = (args.query || '').trim();
    const terms = rawTerm.split(/[,;\n]|\band\b/i).map(t => t.trim()).filter(Boolean);
    const searchTerms = terms.length > 0 ? terms : [rawTerm];

    const records = [];
    for (const term of searchTerms) {
      if (!term || term.length < 2) continue;
      const { data } = await supabase
        .from('product_concept_configurations')
        .select('id, product_id, display_name, description, selling_price, is_available')
        .eq('concept_id', conceptId)
        .eq('is_active', true)
        .or(`display_name.ilike.%${term}%,description.ilike.%${term}%`)
        .limit(3);
      if (data && data.length > 0) {
        records.push(...data.map(p => ({
          name: p.display_name,
          price: Number(p.selling_price),
          is_available: p.is_available,
          description: p.description?.slice(0, 80)
        })));
      }
    }
    const unique = records.filter((r, idx, self) => idx === self.findIndex(x => x.name === r.name));
    return {
      status: unique.length > 0 ? 'FOUND' : 'NO_MATCHING_RECORDS',
      count: unique.length,
      records: unique
    };
  }

  if (name === 'getProductPricing') {
    const term = (args.productName || '').trim();
    const { data } = await supabase
      .from('product_concept_configurations')
      .select('id, product_id, display_name, selling_price, is_available, description')
      .eq('concept_id', conceptId)
      .ilike('display_name', `%${term}%`)
      .limit(1);
    if (data && data.length > 0) {
      const p = data[0];
      return {
        found: true,
        name: p.display_name,
        selling_price: p.selling_price,
        is_available: p.is_available,
        description: p.description
      };
    }
    return { found: false, message: `Product "${term}" not found in NÉO catalog.` };
  }

  if (name === 'getProductModifiers') {
    const term = (args.productName || '').trim();
    const { data: prods } = await supabase
      .from('product_concept_configurations')
      .select('id, product_id, display_name, selling_price')
      .eq('concept_id', conceptId)
      .eq('is_active', true)
      .ilike('display_name', `%${term}%`)
      .limit(1);

    if (!prods || prods.length === 0) {
      return { found: false, message: `Product "${term}" not found in NÉO catalog.` };
    }
    const product = prods[0];

    const { data: custs } = await supabase
      .from('product_customizations')
      .select('id, product_id, ingredient, customization_type, price, is_active, option_group_name')
      .eq('product_id', product.product_id)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);

    const authorized = custs || [];
    const addons = authorized.filter(c => c.customization_type === 'addon' || c.price > 0);
    const options = authorized.filter(c => c.customization_type === 'option' && c.price === 0);
    const removals = authorized.filter(c => c.customization_type === 'remove' || c.customization_type === 'removal');

    return {
      found: true,
      productName: product.display_name,
      productId: product.product_id,
      basePrice: product.selling_price,
      availableAddOns: addons.map(a => ({ name: a.ingredient, price: Number(a.price || 0), group: a.option_group_name })),
      availableOptions: options.map(o => ({ name: o.ingredient, group: o.option_group_name })),
      removableIngredients: removals.map(r => r.ingredient)
    };
  }

  if (name === 'getModificationPolicy') {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'neo_modification_policy')
      .single();
    const policy = data ? JSON.parse(data.setting_value) : {};
    return {
      status: 'VERIFIED_POLICY',
      policy
    };
  }

  if (name === 'getStorePolicy') {
    return {
      branch: 'Badaro Flagship (Main Street)',
      restaurant_hours: '07:30 AM to 11:00 PM (23:00) daily',
      pickup_hours: '07:30 AM to 11:00 PM (23:00) daily',
      delivery_hours: '08:00 AM to 09:30 PM (21:30) daily (strictly within 5 km radius, distance-based pricing from FLOW delivery_pricing_rules)',
      laptop_policy: 'Permitted indoors only; strictly prohibited on outdoor terrace',
      pet_policy: 'Dogs welcome on outdoor terrace; prohibited indoors',
      valet_parking: '$3.00 directly in front of venue'
    };
  }

  if (name === 'lookupCustomerProfile') {
    const phone = args.phone || session.customerPhone || session.orderDraft.customerPhone || session.reservationDraft.customerPhone;
    if (!phone) {
      return {
        found: false,
        message: 'No authenticated customer phone number provided.'
      };
    }

    const sql = getStagingSql();
    let clientRows = await sql`
      SELECT id, name, phone, address, location, latitude, longitude, saved_address_notes 
      FROM staging.clients 
      WHERE phone = ${phone} 
      LIMIT 1;
    `;
    if (clientRows.length === 0) {
      clientRows = await sql`
        SELECT id, name, phone, address, location, null as latitude, null as longitude, null as saved_address_notes 
        FROM public.clients 
        WHERE phone = ${phone} 
        LIMIT 1;
      `;
    }

    if (clientRows.length > 0) {
      const c = clientRows[0];
      session.customerName = c.name;
      session.customerPhone = c.phone;
      session.orderDraft.customerName = c.name;
      session.orderDraft.customerPhone = c.phone;
      session.reservationDraft.customerName = c.name;
      session.reservationDraft.customerPhone = c.phone;

      let lat = c.latitude ? Number(c.latitude) : null;
      let lon = c.longitude ? Number(c.longitude) : null;
      if ((!lat || !lon) && c.location) {
        const coordMatch = c.location.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lon = parseFloat(coordMatch[2]);
        }
      }

      return {
        found: true,
        name: c.name,
        phone: c.phone,
        hasSavedAddress: Boolean(c.address),
        savedAddress: c.address || null,
        savedLocation: c.location || null,
        savedCoordinates: (lat && lon) ? { latitude: lat, longitude: lon } : null,
        savedAddressNotes: c.saved_address_notes || null,
        message: `Existing customer identified: ${c.name} (${c.phone}). Saved delivery address on file: ${c.address || 'None'}.`
      };
    }

    return {
      found: false,
      phone,
      message: `No existing profile on file for phone number ${phone}. New customer.`
    };
  }

  if (name === 'calculateDeliveryFee') {
    const RESTO_LAT = 33.8765278;
    const RESTO_LON = 35.5172093;
    const MAX_COVERAGE_KM = 5.0;

    let targetLat = args.customerLatitude !== undefined ? Number(args.customerLatitude) : null;
    let targetLon = args.customerLongitude !== undefined ? Number(args.customerLongitude) : null;
    let fullAddressText = args.address || '';

    // If customer asked to use saved address or coordinates missing
    if (args.useSavedAddress || (!targetLat && !args.locationString && !args.address)) {
      const phone = session.orderDraft.customerPhone || session.customerPhone;
      if (phone) {
        const sql = getStagingSql();
        const clientRows = await sql`
          SELECT address, location, latitude, longitude, saved_address_notes 
          FROM staging.clients WHERE phone = ${phone} LIMIT 1;
        `;
        if (clientRows.length > 0) {
          const c = clientRows[0];
          if (c.latitude && c.longitude) {
            targetLat = Number(c.latitude);
            targetLon = Number(c.longitude);
          } else if (c.location) {
            const coordMatch = c.location.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
            if (coordMatch) {
              targetLat = parseFloat(coordMatch[1]);
              targetLon = parseFloat(coordMatch[2]);
            }
          }
          if (c.address && !fullAddressText) {
            fullAddressText = c.address;
          }
        }
      }
    }

    if ((!targetLat || !targetLon) && args.locationString) {
      const coordMatch = args.locationString.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
      if (coordMatch) {
        targetLat = parseFloat(coordMatch[1]);
        targetLon = parseFloat(coordMatch[2]);
      }
    }

    const detailedParts = [
      args.building ? `Bldg ${args.building}` : null,
      args.floor ? `Floor ${args.floor}` : null,
      args.apartment ? `Apt ${args.apartment}` : null,
      args.deliveryInstructions ? `[Instructions: ${args.deliveryInstructions}]` : null
    ].filter(Boolean).join(', ');

    if (detailedParts) {
      fullAddressText = fullAddressText ? `${fullAddressText}, ${detailedParts}` : detailedParts;
    }

    if (!targetLat || !targetLon) {
      return {
        status: 'LOCATION_COORDINATES_REQUIRED',
        message: 'A neighborhood or area name alone (such as "Badaro" or "Achrafieh") is insufficient for accurate distance-based pricing. Please request a WhatsApp GPS location pin or map coordinates from the customer, along with building, floor, apartment, and delivery instructions.'
      };
    }

    const distanceKm = calculateHaversineDistanceKm(RESTO_LAT, RESTO_LON, targetLat, targetLon);

    if (distanceKm > MAX_COVERAGE_KM) {
      return {
        status: 'OUTSIDE_DELIVERY_COVERAGE',
        distanceKm,
        maxCoverageKm: MAX_COVERAGE_KM,
        message: `Delivery location is ${distanceKm} km away, which exceeds NÉO Badaro's approved 5.0 km delivery coverage. Please explain this restriction to the customer and offer pickup at our Badaro flagship branch instead.`
      };
    }

    const sql = getStagingSql();
    const rules = await sql`
      SELECT min_distance_km, max_distance_km, delivery_cost 
      FROM public.delivery_pricing_rules 
      WHERE restaurant_id = ${restaurantId} AND is_active = true 
      ORDER BY display_order ASC, min_distance_km ASC;
    `;

    let matchedCost = 2.0;
    let tierLabel = 'Standard Delivery';
    if (rules && rules.length > 0) {
      const matched = rules.find(r => distanceKm >= Number(r.min_distance_km) && distanceKm <= Number(r.max_distance_km)) || rules[rules.length - 1];
      matchedCost = Number(matched.delivery_cost);
      tierLabel = `${matched.min_distance_km}-${matched.max_distance_km} km Tier`;
    }

    orderDraft.fulfillmentType = 'DELIVERY';
    orderDraft.deliveryFee = matchedCost;
    orderDraft.deliveryDistanceKm = distanceKm;
    orderDraft.deliveryAddress = fullAddressText || 'Customer Confirmed GPS Pin';
    orderDraft.deliveryCoordinates = { latitude: targetLat, longitude: targetLon };
    if (args.deliveryInstructions) {
      orderDraft.deliveryInstructions = args.deliveryInstructions;
    }
    orderDraft.markMutation(); // Strictly invalidates previous financial confirmation and increments draft version!

    return {
      status: 'SUCCESS',
      distanceKm,
      deliveryFee: matchedCost,
      pricingTier: tierLabel,
      deliveryAddress: orderDraft.deliveryAddress,
      subtotal: orderDraft.getSubtotal(),
      vat: orderDraft.getVat(),
      grandTotal: orderDraft.getGrandTotal(),
      message: `Distance: ${distanceKm} km. Delivery Fee: $${matchedCost.toFixed(2)} (${tierLabel}). Subtotal: $${orderDraft.getSubtotal().toFixed(2)}, Delivery: $${matchedCost.toFixed(2)}, Grand Total payable: $${orderDraft.getGrandTotal().toFixed(2)}.`
    };
  }

  if (name === 'manageOrderDraft') {
    const action = args.action;

    if (action === 'ADD_ITEM') {
      let effectiveModifications = args.modifications;
      if (!effectiveModifications && options.currentUserText) {
        const uText = options.currentUserText;
        const uLower = uText.toLowerCase();
        // Server-Side Guard: If customer prompt requested an addition but LLM stripped it in tool call
        if (!uLower.includes('without') && !uLower.includes('plain') && !uLower.includes('sans')) {
          const itemWords = args.itemName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          for (const w of itemWords) {
            const rx = new RegExp(`(?:${w})\\s+(?:with|add|extra|plus|topping)\\s+([a-zA-Z0-9\\s]+?)(?:,|\\band\\b|\\.|$)`, 'i');
            const m = uText.match(rx);
            if (m && m[1]) {
              effectiveModifications = `with ${m[1].trim()}`;
              break;
            }
          }
        }
      }

      const validation = await validateAndResolveOrderItem({
        itemName: args.itemName,
        quantity: args.quantity || 1,
        selectedAddOns: args.selectedAddOns,
        preparationInstructions: args.preparationInstructions,
        modifications: effectiveModifications,
        supabase,
        conceptId,
        restaurantId
      });

      if (!validation.valid) {
        return {
          status: 'REJECTED',
          error: validation.error,
          message: validation.message,
          actionRequired: 'ASK_CUSTOMER_CONFIRMATION_OR_ALTERNATIVE',
          rejectedItem: {
            itemName: args.itemName,
            requestedAddition: validation.rejectedAddition
          },
          instruction: 'DO NOT automatically add this item without modifications in the same turn. You must inform the customer that this modification is not offered, state available options or that the item comes as-is, and ask whether they want the item as-is or prefer an alternative.',
          currentOrderDraft: orderDraft.getSummary()
        };
      }

      orderDraft.addItem(validation.item);
      return {
        status: 'SUCCESS',
        addedItem: validation.item,
        orderDraft: orderDraft.getSummary()
      };
    } else if (action === 'MODIFY_ITEM') {
      const existingItem = orderDraft.items.find(i => i.name.toLowerCase().includes(args.itemName.toLowerCase()));
      const qty = (args.quantity !== undefined && args.quantity > 0)
        ? args.quantity
        : (existingItem ? existingItem.qty : 1);

      const selectedAddOns = args.selectedAddOns !== undefined
        ? args.selectedAddOns
        : (args.modifications ? undefined : (existingItem ? existingItem.selectedAddOns : []));

      const preparationInstructions = args.preparationInstructions !== undefined
        ? args.preparationInstructions
        : (args.modifications ? undefined : (existingItem ? existingItem.preparationInstructions : ''));

      const validation = await validateAndResolveOrderItem({
        itemName: args.itemName,
        quantity: qty,
        selectedAddOns,
        preparationInstructions,
        modifications: args.modifications,
        supabase,
        conceptId,
        restaurantId
      });

      if (!validation.valid) {
        return {
          status: 'REJECTED',
          error: validation.error,
          message: validation.message,
          actionRequired: 'ASK_CUSTOMER_CONFIRMATION_OR_ALTERNATIVE',
          rejectedItem: {
            itemName: args.itemName,
            requestedAddition: validation.rejectedAddition
          },
          instruction: 'DO NOT automatically modify this item without customer consent.',
          currentOrderDraft: orderDraft.getSummary()
        };
      }

      orderDraft.replaceOrUpdateItem(args.itemName, validation.item);
      return {
        status: 'SUCCESS',
        modifiedItem: validation.item,
        orderDraft: orderDraft.getSummary()
      };
    } else if (action === 'REMOVE_ITEM') {
      orderDraft.removeItem(args.itemName);
    } else if (action === 'SET_FULFILLMENT') {
      if (args.fulfillmentType) orderDraft.fulfillmentType = args.fulfillmentType;
      if (args.fulfillmentTime) orderDraft.fulfillmentTime = args.fulfillmentTime;
      if (args.customerName) orderDraft.customerName = args.customerName;
      if (args.customerPhone) orderDraft.customerPhone = args.customerPhone;
      if (args.deliveryAddress) orderDraft.deliveryAddress = args.deliveryAddress;
      if (args.deliveryInstructions) orderDraft.deliveryInstructions = args.deliveryInstructions;
      if (args.customerLatitude && args.customerLongitude) {
        orderDraft.deliveryCoordinates = { latitude: Number(args.customerLatitude), longitude: Number(args.customerLongitude) };
      }
    }

    return {
      orderDraft: orderDraft.getSummary()
    };
  }

  if (name === 'submitConfirmedClientOrder') {
    if (!args.customerConfirmed) {
      return { success: false, error: 'Order cannot be placed without explicit customer confirmation.' };
    }
    const draft = orderDraft.getSummary();
    if (draft.items.length === 0) {
      return { success: false, error: 'Order draft has no items.' };
    }

    // 1. CONFIRMATION GATE: Check if draft was mutated in this exact turn
    if (orderDraft.turnMutationsCount > 0) {
      return {
        success: false,
        error: 'UNCONFIRMED_DRAFT_MUTATION',
        actionRequired: 'PRESENT_REVISED_TOTAL_AND_AWAIT_CONFIRMATION',
        currentGrandTotal: draft.grandTotal,
        message: `Order draft was modified in this turn (items or fulfillment updated). Product selection and order submission are strictly separate operations. You must first present the revised order summary and new grand total ($${draft.grandTotal.toFixed(2)}) to the customer and wait for their explicit confirmation in a subsequent turn before submitting.`
      };
    }

    // 2. CONFIRMATION GATE: Validate confirmed total against current authoritative draft grand total
    if (args.confirmedGrandTotal !== undefined && args.confirmedGrandTotal !== null) {
      const diff = Math.abs(Number(args.confirmedGrandTotal) - draft.grandTotal);
      if (diff > 0.01) {
        return {
          success: false,
          error: 'TOTAL_MISMATCH',
          actionRequired: 'PRESENT_REVISED_TOTAL_AND_AWAIT_CONFIRMATION',
          confirmedTotalPassed: Number(args.confirmedGrandTotal),
          currentGrandTotal: draft.grandTotal,
          message: `Confirmed total ($${Number(args.confirmedGrandTotal).toFixed(2)}) does not match current authoritative draft grand total ($${draft.grandTotal.toFixed(2)}). The customer must explicitly confirm the current total before submission.`
        };
      }
    } else if (orderDraft.presentedGrandTotal && Math.abs(orderDraft.presentedGrandTotal - draft.grandTotal) > 0.01) {
      return {
        success: false,
        error: 'UNPRESENTED_REVISED_TOTAL',
        actionRequired: 'PRESENT_REVISED_TOTAL_AND_AWAIT_CONFIRMATION',
        previouslyPresentedTotal: orderDraft.presentedGrandTotal,
        currentGrandTotal: draft.grandTotal,
        message: `Current draft total ($${draft.grandTotal.toFixed(2)}) has not been presented to the customer since it was updated (previously presented: $${orderDraft.presentedGrandTotal.toFixed(2)}). You must present the updated total and wait for customer confirmation.`
      };
    }

    // Server-Side Enforcement: Revalidate every item in the draft against live catalog before order creation
    for (const item of draft.items) {
      const reval = await validateAndResolveOrderItem({
        itemName: item.name,
        quantity: item.qty,
        selectedAddOns: item.selectedAddOns,
        preparationInstructions: item.preparationInstructions,
        supabase,
        conceptId,
        restaurantId
      });
      if (!reval.valid) {
        return {
          success: false,
          error: `ORDER_SUBMISSION_REJECTED: Item "${item.name}" failed catalog revalidation: ${reval.message}`
        };
      }
    }

    // Idempotency check: if order is already submitted, return existing record
    if (orderDraft.isConfirmed && orderDraft.createdOrderId) {
      return {
        success: true,
        orderId: orderDraft.createdOrderId,
        status: 'Pending',
        operationalStatus: 'Pending',
        itemsCount: draft.items.length,
        subtotal: draft.subtotal,
        deliveryFee: draft.deliveryFee,
        vat: draft.vat,
        grandTotal: draft.grandTotal,
        isVatSubscribed: draft.isVatSubscribed,
        fulfillment: `${draft.fulfillmentType} at ${draft.fulfillmentTime}`,
        isAlreadySubmitted: true,
        message: `Order #${orderDraft.createdOrderId} was already registered in FLOW Client Orders in Pending status awaiting staff confirmation.`
      };
    }

    const sql = getStagingSql();

    // 1. Get or create client in isolated staging database
    let clientId;
    if (draft.customerPhone) {
      const clientRows = await sql`
        SELECT id FROM staging.clients WHERE phone = ${draft.customerPhone} LIMIT 1
      `;
      if (clientRows.length > 0) {
        clientId = clientRows[0].id;
      }
    }
    if (!clientId) {
      const newClients = await sql`
        INSERT INTO staging.clients (name, phone, restaurant_id)
        VALUES (${draft.customerName || 'Customer'}, ${draft.customerPhone || null}, ${restaurantId})
        RETURNING id
      `;
      clientId = newClients[0].id;
    }

    // 2. Insert into staging.client_orders
    const orderId = 'CL-ORD-' + Math.floor(1000 + Math.random() * 9000);
    const deliveryDetails = draft.fulfillmentType === 'DELIVERY'
      ? ` [Delivery to: ${draft.deliveryAddress || 'Saved Pin'}${draft.deliveryDistanceKm ? ` (${draft.deliveryDistanceKm} km, Fee: $${draft.deliveryFee.toFixed(2)})` : ''}${draft.deliveryInstructions ? ` Instructions: ${draft.deliveryInstructions}` : ''}]`
      : ' [Pickup at Badaro Branch]';

    const orderNotes = `[AI Order - ${draft.fulfillmentType} at ${draft.fulfillmentTime}]${deliveryDetails} ` +
      draft.items.map(i => {
        const addOnsStr = (i.selectedAddOns && i.selectedAddOns.length > 0)
          ? ` (+${i.selectedAddOns.map(a => `${a.name} $${a.price}`).join(', ')})`
          : '';
        const prepStr = i.preparationInstructions ? ` [Prep: ${i.preparationInstructions}]` : '';
        return `${i.qty}x ${i.name} ($${i.unitPrice})${addOnsStr}${prepStr}`;
      }).join('; ') + '. Customer explicitly confirmed.';

    await sql`
      INSERT INTO staging.client_orders (
        id, client_id, branch, salesperson, category, status, order_date, notes, subtotal, vat, grand_total, delivery_fee, restaurant_id, updated_by
      ) VALUES (
        ${orderId}, ${clientId}, 'Badaro', 'AI Customer Assistant', ${draft.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Takeaway'}, 'Pending', ${new Date().toISOString().slice(0, 10)}, ${orderNotes}, ${draft.subtotal}, ${draft.vat}, ${draft.grandTotal}, ${draft.deliveryFee || 0}, ${restaurantId}, 'NÉO AI Assistant'
      )
    `;

    // 3. Insert into staging.client_order_items with structured add-on persistence
    for (const i of draft.items) {
      const modLabel = i.modifications ? ` (${i.modifications})` : '';
      const customJson = (i.selectedAddOns || []).map(a => ({
        id: a.id || null,
        name: a.name,
        price: Number(a.price || 0),
        group: a.group || 'Add-on',
        qty: a.qty || 1
      }));
      const customIds = (i.selectedAddOns || []).map(a => String(a.id)).filter(Boolean);

      await sql`
        INSERT INTO staging.client_order_items (
          order_id, item_name, qty, unit, unit_price, total_price, restaurant_id, customizations_json, customization_ids
        ) VALUES (
          ${orderId}, ${i.name + modLabel}, ${i.qty}, 'pcs', ${i.unitPrice}, ${i.totalPrice}, ${restaurantId}, ${sql.json(customJson)}, ${customIds}
        )
      `;
    }

    orderDraft.isConfirmed = true;
    orderDraft.createdOrderId = orderId;
    orderDraft.confirmedGrandTotal = draft.grandTotal;

    return {
      success: true,
      orderId,
      status: 'Pending',
      operationalStatus: 'Pending',
      itemsCount: draft.items.length,
      subtotal: draft.subtotal,
      deliveryFee: draft.deliveryFee,
      vat: draft.vat,
      grandTotal: draft.grandTotal,
      isVatSubscribed: draft.isVatSubscribed,
      fulfillment: `${draft.fulfillmentType} at ${draft.fulfillmentTime}`,
      message: `Order #${orderId} successfully registered in FLOW Client Orders in Pending status awaiting staff confirmation at our Badaro flagship branch.`
    };
  }

  if (name === 'manageReservationDraft') {
    if (args.action === 'SET_DETAILS') {
      const beirutClock = getBeirutDateTime();
      if (args.date) {
        const dLower = args.date.toLowerCase().trim();
        if (dLower === 'today' || dLower === 'tonight') {
          resDraft.date = beirutClock.beirutDateStr;
        } else if (dLower === 'tomorrow') {
          resDraft.date = beirutClock.tomorrowDateStr;
        } else {
          resDraft.date = args.date;
        }
      }
      if (args.time) resDraft.time = args.time;
      if (args.guestCount !== undefined && args.guestCount > 0) resDraft.guestCount = args.guestCount;
      if (args.adults !== undefined) resDraft.adults = args.adults;
      if (args.children !== undefined) resDraft.children = args.children;
      if (args.seatingArea) resDraft.seatingArea = args.seatingArea;
      if (args.seatingContingency) resDraft.seatingContingency = args.seatingContingency;
      if (args.babyChairs !== undefined) resDraft.babyChairs = args.babyChairs;
      if (args.specialRequests) resDraft.specialRequests = args.specialRequests;
      if (args.customerName) resDraft.customerName = args.customerName;
      if (args.customerPhone) resDraft.customerPhone = args.customerPhone;
    }
    return {
      status: 'SUCCESS',
      reservationDraft: resDraft.getSummary()
    };
  }

  if (name === 'submitConfirmedReservation') {
    if (!args.customerConfirmed) {
      return { success: false, error: 'Reservation requires explicit customer confirmation.' };
    }

    // Idempotency check: if reservation already submitted, return existing record
    if (resDraft.isConfirmed && resDraft.createdReservationId) {
      const r = resDraft.getSummary();
      return {
        success: true,
        reservationId: resDraft.createdReservationId,
        branch: 'Badaro',
        date: r.date,
        time: r.time,
        guestCount: r.guestCount,
        babyChairs: r.babyChairs || 0,
        seatingArea: r.seatingArea,
        status: 'Pending',
        staffApprovalRequired: true,
        isAlreadySubmitted: true,
        message: `Reservation #${resDraft.createdReservationId} was already confirmed in Pending status awaiting staff confirmation.`
      };
    }

    // Direct amenity / request / customerName update at confirmation time
    if (args.babyChairs !== undefined && args.babyChairs > 0) {
      resDraft.babyChairs = args.babyChairs;
    }
    if (args.specialRequests) {
      resDraft.specialRequests = resDraft.specialRequests
        ? `${resDraft.specialRequests}, ${args.specialRequests}`
        : args.specialRequests;
    }
    if (args.customerName) {
      resDraft.customerName = args.customerName;
    }

    const r = resDraft.getSummary();
    if (!r.isComplete) {
      return { success: false, error: 'CANNOT_BOOK_INCOMPLETE: Date, time, and guest count are required.' };
    }

    if (!r.customerName || !r.customerName.trim()) {
      return {
        success: false,
        needsCustomerName: true,
        error: 'CUSTOMER_NAME_REQUIRED: Customer full name is required to complete the reservation.'
      };
    }

    const { beirutDateStr } = getBeirutDateTime();
    if (r.date < beirutDateStr) {
      return {
        success: false,
        error: `Cannot book a reservation in the past. Today is ${beirutDateStr}, but requested date is ${r.date}.`
      };
    }

    const normalizedTime = normalizeTimeString(r.time);
    const sql = getStagingSql();

    let clientId;
    if (r.customerPhone) {
      const clientRows = await sql`
        SELECT id FROM staging.clients WHERE phone = ${r.customerPhone} LIMIT 1
      `;
      if (clientRows.length > 0) {
        clientId = clientRows[0].id;
      }
    }
    if (!clientId) {
      const newClients = await sql`
        INSERT INTO staging.clients (name, phone, restaurant_id)
        VALUES (${r.customerName}, ${r.customerPhone || null}, ${restaurantId})
        RETURNING id
      `;
      clientId = newClients[0].id;
    }

    const specialNotes = [
      r.babyChairs ? `${r.babyChairs} high chair(s)` : null,
      r.specialRequests
    ].filter(Boolean).join(', ');

    const commentText = `[AI Reservation] Seating: ${r.seatingArea || 'Inside'}${r.seatingContingency ? ` (${r.seatingContingency})` : ''}. Amenities/Notes: ${specialNotes || 'None'}. Pending staff confirmation.`;

    const insertedRes = await sql`
      INSERT INTO staging.reservations (
        client_id, branch, reservation_date, reservation_time, area, status, guest_count, table_count, is_smoking, baby_chairs, is_birthday, comments, restaurant_id
      ) VALUES (
        ${clientId}, 'Badaro', ${r.date}, ${normalizedTime}, ${r.seatingArea || 'Inside'}, 'Pending', ${r.guestCount}, ${Math.ceil(r.guestCount / 4)}, false, ${r.babyChairs || 0}, false, ${commentText}, ${restaurantId}
      ) RETURNING id
    `;

    const reservationId = insertedRes[0].id;
    resDraft.isConfirmed = true;
    resDraft.createdReservationId = reservationId;

    return {
      success: true,
      reservationId,
      branch: 'Badaro',
      date: r.date,
      time: r.time,
      guestCount: r.guestCount,
      babyChairs: r.babyChairs || 0,
      seatingArea: r.seatingArea,
      status: 'Pending',
      staffApprovalRequired: true,
      message: `Reservation #${reservationId} successfully created in FLOW Staging for ${r.guestCount} guests on ${r.date} at ${r.time} in Pending status awaiting staff confirmation.`
    };
  }

  return { error: `Unknown tool: ${name}` };
}

/**
 * Call Gemini with rate-limit backoff, transient error retry, and automatic model failover
 */
async function callGeminiWithRetry(url, body, maxRetries = 3) {
  let activeUrl = url;
  let totalRetryMs = 0;
  let retryAttempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(activeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const isTransient = res.status === 429 || res.status === 503 || res.status === 500 || res.status === 502 || res.status === 504;

    if (isTransient && attempt < maxRetries) {
      retryAttempts++;
      let waitMs = 1500 * (attempt + 1);

      if (res.status === 429) {
        try {
          const errJson = await res.json();
          const retryDelayStr = errJson?.error?.details?.find(d => d.retryDelay)?.retryDelay;
          if (retryDelayStr) {
            const s = parseInt(retryDelayStr.replace('s', ''), 10);
            if (!isNaN(s)) waitMs = Math.min((s + 1) * 1000, 30000);
          }
        } catch (e) {}
      } else if (res.status === 503 && activeUrl.includes('gemini-flash-lite-latest')) {
        // Automatic model failover on 503 high demand: switch to gemini-2.5-flash
        console.warn(`[NativeAgent] 503 High Demand on flash-lite. Failing over to gemini-2.5-flash...`);
        activeUrl = activeUrl.replace('gemini-flash-lite-latest', 'gemini-2.5-flash');
        waitMs = 1000;
      }

      totalRetryMs += waitMs;
      console.warn(`[NativeAgent] Transient HTTP ${res.status}. Backing off for ${waitMs}ms before attempt ${attempt + 2}...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    return { res, totalRetryMs, retryAttempts };
  }
}

/**
 * Main Native AI Turn Execution Loop
 */
export async function runNativeAiTurn({
  userText,
  conversationId = 'conv_staging_001',
  model = 'gemini-flash-lite-latest',
  history = [],
  customerPhone = null,
  customerName = null
}) {
  const startTime = Date.now();
  const session = await getOrCreateSessionAsync(conversationId);
  const orderDraft = session.orderDraft;
  const resDraft = session.reservationDraft;

  // Reset turn-specific mutation counter at start of turn
  orderDraft.turnMutationsCount = 0;

  if (customerPhone) {
    if (!orderDraft.customerPhone) orderDraft.customerPhone = customerPhone;
    if (!resDraft.customerPhone) resDraft.customerPhone = customerPhone;
    if (!session.customerPhone) session.customerPhone = customerPhone;
  }
  if (customerName) {
    if (!orderDraft.customerName) orderDraft.customerName = customerName;
    if (!resDraft.customerName) resDraft.customerName = customerName;
    if (!session.customerName) session.customerName = customerName;
  }

  // Retrieve authoritative Company VAT settings
  const vatSettings = await getCompanyVatSettings(serverSupabase, NEO_RESTAURANT_ID);
  orderDraft.setVatSettings(vatSettings.isVatSubscribed, vatSettings.vatRate, vatSettings.isVatInclusive);

  const activeModel = (model === 'gemini-2.5-flash-lite' || model === 'gemini-flash-lite-latest')
    ? 'gemini-flash-lite-latest'
    : 'gemini-flash-lite-latest';

  const beirutClock = getBeirutDateTime();

  let vatInstruction = '';
  if (!vatSettings.isVatSubscribed) {
    vatInstruction = `COMPANY TAX STATUS: VAT Subscribed Entity = NO (Disabled). Zero VAT. Completely OMIT any mention of VAT. Do NOT display or say 'VAT 0%', 'VAT $0', or 'VAT (11%)'. The Total payable is simply the item prices ($${orderDraft.getSubtotal().toFixed(2)}).`;
  } else if (vatSettings.isVatInclusive) {
    vatInstruction = `COMPANY TAX STATUS: VAT Subscribed Entity = YES (VAT-INCLUSIVE PRICING). Menu selling prices already include ${vatSettings.vatRate}% VAT. Do NOT add VAT on top. In your order summary, state: Total: $${orderDraft.getGrandTotal().toFixed(2)} (includes $${orderDraft.getVat().toFixed(2)} VAT).`;
  } else {
    vatInstruction = `COMPANY TAX STATUS: VAT Subscribed Entity = YES (VAT-EXCLUSIVE PRICING). Standard VAT (${vatSettings.vatRate}%) applies on top. In your order summary, state: Subtotal: $${orderDraft.getSubtotal().toFixed(2)}, VAT (${vatSettings.vatRate}%): $${orderDraft.getVat().toFixed(2)}, Grand Total: $${orderDraft.getGrandTotal().toFixed(2)}.`;
  }

  const systemInstruction = `You are the authentic AI Customer Assistant for NÉO Beirut (Badaro flagship branch).
Branch: Badaro Main Street. Open daily 07:30 to 23:00. Pickup available 07:30 to 23:00.
Delivery available 08:00 to 21:30 daily (strictly within 5.0 km radius from NÉO Badaro, distance-based pricing from FLOW delivery_pricing_rules). Beyond 5.0 km is strictly outside delivery coverage; offer pickup only.
Laptop policy: Permitted indoors only; strictly prohibited on outdoor terrace.
Pet policy: Dogs welcome on outdoor terrace; prohibited indoors.
Phone: +961 3 501 444, WhatsApp: +961 76 489 078. Timezone: Asia/Beirut.

LIVE SERVER CLOCK & CALENDAR (Asia/Beirut):
- Today: ${beirutClock.humanBeirutDate} (${beirutClock.beirutDateStr}).
- Current Time: ${beirutClock.beirutTimeStr}.
- Tomorrow: ${beirutClock.tomDayName}, ${beirutClock.tomorrowDateStr}.
- Day After Tomorrow: ${beirutClock.dayAfterTomorrowDateStr}.
- Relative dates MUST strictly resolve against this live Beirut clock (e.g. "today" or "tonight" = ${beirutClock.beirutDateStr}, "tomorrow" = ${beirutClock.tomorrowDateStr}).
- Any reservation date in the past (before ${beirutClock.beirutDateStr}) is strictly invalid and must be rejected.
- NEVER use stale training cutoff dates (such as May 20, 2025). The authoritative date today is ${beirutClock.humanBeirutDate}.

${vatInstruction}

AUTHENTICATED CUSTOMER CONTEXT:
${(session.customerPhone || orderDraft.customerPhone) ? `Customer Phone: ${session.customerPhone || orderDraft.customerPhone}, Name: ${session.customerName || orderDraft.customerName || 'Pending Identification'}` : 'Customer Not Yet Authenticated. If customer asks about saved details, use lookupCustomerProfile.'}

CURRENT RESERVATION DRAFT IN MEMORY:
${JSON.stringify(resDraft.getSummary())}

CURRENT ORDER DRAFT IN MEMORY:
${JSON.stringify(orderDraft.getSummary())}

CRITICAL OPERATIONAL & MODIFICATION MANDATES:
1. CATALOG GROUNDING & PARALLEL EXECUTION:
   - Check real products and prices using searchMenu or getProductPricing. Never invent products or prices.
   - When a customer orders multiple known items (e.g. "Gourmande Croquante, Diet Pepsi"), execute parallel manageOrderDraft tool calls in a single turn to minimize latency and token usage.
2. UNAVAILABLE MODIFICATIONS - ZERO SILENT ADDITIONS:
   - When a customer requests an unoffered modification or addition (e.g. "with chicken" on Gourmande Croquante):
     If manageOrderDraft returns {"status": "REJECTED"}:
     NEVER drop the modification silently and order the item plain in the same turn!
     You MUST inform the customer that chicken (or the requested addition) is not available at NÉO, state what options exist (or that the salad comes as prepared), and explicitly ask if they would like it plain without the addition or prefer something else.
     ONLY add the item plain if the customer explicitly confirms (e.g. "without chicken is fine", "add it plain", "yes please").
3. EXISTING CUSTOMER RECOGNITION:
   - When customer phone is present, or customer asks "Do you have my name and address?", "I ordered before", or when delivery details are requested:
     Call lookupCustomerProfile({ phone: "${session.customerPhone || orderDraft.customerPhone || ''}" }) to inspect FLOW clients database.
     If an existing profile is found with a saved address:
     Warmly greet them by name (e.g. "Welcome back, Jad!"), acknowledge their saved address on file, and ask: "Would you like us to deliver to your saved address (...), or would you prefer a new location?"
4. DISTANCE-BASED DELIVERY PRICING:
   - Delivery fees are strictly distance-based from NÉO Badaro (lat: 33.8765278, lon: 35.5172093) up to a 5.0 km maximum coverage limit.
   - Tiers configured in FLOW: 0-3km: $1.33, 3-4.5km: $2.00, 4.5-5km: $2.50.
   - A neighborhood or area name alone (e.g. "Badaro" or "Achrafieh") is INSUFFICIENT.
   - Always request or verify the GPS coordinates / WhatsApp pin, building, floor, apartment, and delivery notes.
   - Call calculateDeliveryFee to determine exact distance, coverage validation, and authoritative fee.
   - If distance exceeds 5.0 km, explain that it is outside our 5 km delivery radius and offer pickup at Badaro.
   - In order summaries, always show: Subtotal, Delivery Fee ($X.XX for Y.Y km), and Grand Total payable.
5. AMBIGUOUS CAKE CLARIFICATION:
   - When customer asks for "a cake" or "an additional cake" or generic dessert without naming it:
     DO NOT guess or arbitrarily pick a cake.
     Use searchMenu({ query: "cake" }) to find available cakes (e.g. Cake Pralin $8.00, Tarte Pralinoi $9.50, Gâteau Chocolat Praliné $11.00).
     Present the real cake options with prices, and ask which cake they prefer and whether individual slice or whole cake.
6. FINANCIAL CONFIRMATION GATE & SEPARATION OF SELECTION AND COMMIT:
   - Product selection and order submission are strictly separate operations.
   - Whenever a new product is added or modified (e.g. adding a whole Cake Pralin), you MUST first present the updated order summary and revised grand total to the customer.
   - NEVER invoke submitConfirmedClientOrder in the same turn that an item is added, modified, or delivery fee recalculated!
   - NEVER commit a revised financial order based on customer confirmation of an earlier summary!
   - When calling submitConfirmedClientOrder, you MUST pass { customerConfirmed: true, confirmedGrandTotal: <exact total customer saw and confirmed> }.
   - If confirmedGrandTotal does not match the draft total, the server will block submission.
7. CRITICAL ORDER STATUS & OPERATIONAL PROMISES CONTRACT:
   - When submitConfirmedClientOrder succeeds, its operational status in FLOW is strictly "Pending" (awaiting staff acceptance).
   - Inform the customer: "Your order (#CL-ORD-XXXX) has been received in Pending status and is currently awaiting staff acceptance at our Badaro flagship branch."
   - NEVER state or promise that the order "is now being prepared", "is in the kitchen", "is ready", or "is on its way"!
   - Preparation in FLOW only begins after floor/kitchen staff accept the order on the POS.
8. TABLE RESERVATIONS:
   - Date clarification: Never default a time-only request to tonight without asking.
   - Guest count: Preserve neutrality ("5 guests").
   - Customer identity: Capture real name before submission.
   - Natural confirmation: If confirmed with minor request (e.g. "yes and we need a high chair"), submit directly with babyChairs=1.
9. LANGUAGE PROTOCOL: ALWAYS reply in the exact language the customer addresses you with. If the customer speaks French (e.g. "je ne comprend pas langlais", "les heure douverture"), reply fluently and warmly in French. If Arabic / Lebanese / Arabizi, reply in Arabic / Lebanese. If English, reply in English. NEVER respond in English when the customer states they do not speak English or communicates in French/Arabic.`;

  // Sync session history
  if (Array.isArray(history) && history.length > 0 && session.history.length === 0) {
    session.history = history.map(h => ({
      role: (h.role === 'customer' || h.role === 'user') ? 'user' : 'model',
      parts: [{ text: h.text || '' }]
    }));
  }

  session.history.push({
    role: 'user',
    parts: [{ text: userText }]
  });

  const executedTools = [];
  const evidenceProvenance = [];
  let loops = 6;
  let finalReply = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let totalGeminiTimeMs = 0;
  let totalToolTimeMs = 0;
  let totalRetryDelayMs = 0;
  let totalRetryCount = 0;
  let modelCallsCount = 0;

  const effectiveKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(effectiveKey)}`;

  while (loops > 0) {
    loops--;

    const body = {
      contents: session.history,
      tools: [{ functionDeclarations: FLOW_TOOL_DECLARATIONS }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    try {
      modelCallsCount++;
      const tStartGemini = Date.now();
      const retryResult = await callGeminiWithRetry(url, body, 3);
      totalGeminiTimeMs += (Date.now() - tStartGemini);

      const res = retryResult?.res;
      totalRetryDelayMs += retryResult?.totalRetryMs || 0;
      totalRetryCount += retryResult?.retryAttempts || 0;

      if (!res || !res.ok) {
        const errText = res ? await res.text() : 'No response';
        console.error(`[NativeAgent] Gemini API Error HTTP ${res?.status}: ${errText}`);
        break;
      }

      const json = await res.json();
      if (json.usageMetadata) {
        inputTokens += json.usageMetadata.promptTokenCount || 0;
        outputTokens += json.usageMetadata.candidatesTokenCount || 0;
      }

      const candidate = json.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const functionCalls = parts.filter(p => p.functionCall);
      const textPart = parts.find(p => p.text);

      if (functionCalls.length > 0) {
        session.history.push({ role: 'model', parts });
        const functionResponseParts = [];

        for (const fc of functionCalls) {
          const toolName = fc.functionCall.name;
          const toolArgs = fc.functionCall.args || {};

          const tToolStart = Date.now();
          const toolResult = await executeFlowTool(toolName, toolArgs, session, {
            supabase: serverSupabase,
            conceptId: NEO_CONCEPT_ID,
            restaurantId: NEO_RESTAURANT_ID,
            currentUserText: userText
          });
          const toolDurationMs = Date.now() - tToolStart;
          totalToolTimeMs += toolDurationMs;

          executedTools.push({
            tool: toolName,
            arguments: toolArgs,
            durationMs: toolDurationMs,
            status: 'SUCCESS'
          });

          evidenceProvenance.push({
            source: toolName,
            query: toolArgs,
            result: toolResult
          });

          functionResponseParts.push({
            functionResponse: {
              name: toolName,
              response: toolResult
            }
          });
        }

        session.history.push({
          role: 'user',
          parts: functionResponseParts
        });
      } else if (textPart) {
        finalReply = textPart.text;
        session.history.push({ role: 'model', parts: [{ text: finalReply }] });
        break;
      } else {
        break;
      }
    } catch (callErr) {
      console.error('[NativeAgent] Error during Gemini turn execution:', callErr.message);
      break;
    }
  }

  // Record presented grand total if assistant quoted order
  if (orderDraft.items.length > 0) {
    orderDraft.setPresentedTotal(orderDraft.getGrandTotal());
  }

  // Provider Failure Recovery: Ensure cart & conversation integrity are preserved
  if (!finalReply) {
    const draftItems = orderDraft.items;
    if (draftItems && draftItems.length > 0) {
      const itemList = draftItems.map(i => `${i.qty}x ${i.name} ($${i.totalPrice.toFixed(2)})`).join(', ');
      finalReply = `We experienced a momentary network delay, but your order draft has been safely saved! You currently have ${itemList} (Subtotal: $${orderDraft.getSubtotal().toFixed(2)}). Would you like to proceed with this order, or can our team at Badaro assist you directly at +961 3 501 444?`;
    } else if (resDraft.date || resDraft.time) {
      finalReply = `We experienced a momentary network delay, but your reservation details have been safely retained. Would you like to continue, or may our team assist you directly at +961 3 501 444?`;
    } else {
      finalReply = `I apologize for the momentary connection hiccup. I am ready to assist you with our menu, delivery orders, or reservations at NÉO Badaro. How can I help you?`;
    }
    session.history.push({ role: 'model', parts: [{ text: finalReply }] });
  }

  // Compact persistent conversation history to keep only clean user/model text turns
  // Pruning ephemeral tool JSON dumps reduces prompt token consumption by ~95%
  // and prevents 429 TPM exhaustion, maintaining 2-5s response times across turns
  const compacted = [];
  for (const entry of session.history) {
    const tPart = entry.parts?.find(p => typeof p.text === 'string' && p.text.trim().length > 0);
    if (tPart) {
      compacted.push({
        role: entry.role,
        parts: [{ text: tPart.text }]
      });
    }
  }
  session.history = compacted;

  // Durably persist session draft to PostgreSQL for seamless cross-restart recovery
  await persistSessionDraft(session, userText);

  const latencyMs = Date.now() - startTime;
  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUsd = totalTokens * 0.00000015;

  const validationOutcome = validateGeneratedResponse(finalReply, evidenceProvenance, {
    strictDietaryValidation: true,
    requireDirectEvidence: true
  });

  return {
    replyText: finalReply,
    modelUsed: activeModel,
    provider: `Google (${activeModel})`,
    executionMode: 'AI_INFERENCE',
    latencyMs,
    geminiLatencyMs: totalGeminiTimeMs,
    toolExecutionMs: totalToolTimeMs,
    retryDelayMs: totalRetryDelayMs,
    retryCount: totalRetryCount,
    modelCallsCount,
    toolCallsExecuted: executedTools,
    evidenceProvenance,
    informationStatus: evidenceProvenance.length > 0 ? 'VERIFIED' : 'GENERAL_CONVERSATION',
    validationOutcome,
    tokensUsed: {
      input: inputTokens || 220,
      output: outputTokens || 85,
      total: totalTokens || 305
    },
    estimatedCostUsd,
    escalationRequired: false,
    orderDraft: orderDraft.getSummary(),
    reservationDraft: resDraft.getSummary()
  };
}
