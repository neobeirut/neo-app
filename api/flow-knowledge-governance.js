/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Authoritative Knowledge Base & Business Governance Registry
 * Target: NÉO Pilot (Badaro Flagship) & Multi-Concept
 * 
 * Enforces:
 * 1. Concept and branch scoping (NÉO Badaro).
 * 2. Strict governance metadata: source, approved_by, verification_status, last_reviewed_at.
 * 3. Five-state knowledge status:
 *    - VERIFIED: Explicitly approved factual policy.
 *    - VERIFIED_NEGATIVE: Explicitly confirmed that product/service is NOT offered.
 *    - UNVERIFIED / UNKNOWN: Exists in discussion or draft, but unverified -> NEVER presented as fact.
 * 4. Distinct handling of missing information vs verified negative information.
 */

export const NEO_CONCEPT_ID = '00000000-0000-0000-0000-000000000001';
export const BADARO_BRANCH_ID = '9c214659-9cc7-4f33-b115-cbbb8a823a94';

/**
 * @typedef {Object} AuthoritativeKnowledgeRecord
 * @property {string} id
 * @property {string} concept_id
 * @property {string} branch_id
 * @property {string} category
 * @property {string} title
 * @property {string} approved_content
 * @property {Record<string, any>} [structured_data]
 * @property {'VERIFIED' | 'VERIFIED_NEGATIVE' | 'UNKNOWN' | 'UNVERIFIED'} verification_status
 * @property {string} source
 * @property {string} approved_by
 * @property {string} last_reviewed_at
 * @property {string} effective_from
 * @property {string | null} [effective_until]
 * @property {boolean} is_active
 */

/**
 * Governed Knowledge Registry for NÉO Badaro
 * Only management-approved records may be served as authoritative facts.
 */
export const GOVERNED_KNOWLEDGE_RECORDS = [
  // 1. Operating Hours
  {
    id: 'gov-kb-001',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'BUSINESS_HOURS',
    title: 'Restaurant & Flagship Operating Hours',
    approved_content: 'NÉO Badaro is open daily from 07:30 AM to 11:00 PM (23:00). Dine-in and counter takeaway operate throughout these hours.',
    structured_data: { opening_time: '07:30', closing_time: '23:00', days: 'Monday-Sunday' },
    verification_status: 'VERIFIED',
    source: 'OPERATIONS_MANUAL',
    approved_by: 'Owner / Management',
    last_reviewed_at: '2026-11-15T12:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 2. Delivery Hours & Coverage
  {
    id: 'gov-kb-002',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'DELIVERY_HOURS',
    title: 'Delivery Service Operating Hours & Coverage',
    approved_content: 'Delivery service operates daily from 08:00 AM to 09:30 PM (21:30) within a 5.0 km radius from Badaro. Delivery orders after 09:30 PM (such as 10:00 PM) are not accepted.',
    structured_data: { delivery_start: '08:00', delivery_end: '21:30', radius_km: 5.0, base_fee_usd: 2.0 },
    verification_status: 'VERIFIED',
    source: 'OPERATIONS_MANUAL',
    approved_by: 'Owner / Management',
    last_reviewed_at: '2026-11-15T12:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 3. Sugar-Free Desserts (VERIFIED NEGATIVE)
  {
    id: 'gov-kb-003',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'DIETARY_POLICIES',
    title: 'Sugar-Free Desserts Policy',
    approved_content: 'NÉO Badaro currently does not offer sugar-free desserts. All pastries, cakes, and tarts are made with regular sugar. For Lebanese Arabic inquiries ("عندكن شي حلو بلا سكر؟"), response is strictly: "مرحبا! 💚 حالياً ما عنا حلويات خالية من السكر، بس فينا نساعدك تختار من تشكيلة الحلويات الموجودة عنا."',
    structured_data: { has_sugar_free_desserts: false, approved_ar_response: 'مرحبا! 💚 حالياً ما عنا حلويات خالية من السكر، بس فينا نساعدك تختار من تشكيلة الحلويات الموجودة عنا.' },
    verification_status: 'VERIFIED_NEGATIVE',
    source: 'OWNER_EXECUTIVE_CONFIRMATION',
    approved_by: 'Freddy Khoury (Owner)',
    last_reviewed_at: '2026-11-15T18:00:00Z',
    effective_from: '2026-11-15',
    is_active: true
  },
  // 4. Laptop Policy
  {
    id: 'gov-kb-004',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'GUEST_POLICIES',
    title: 'Laptop & Study Policy',
    approved_content: 'Laptops and work devices are strictly permitted indoors only, and strictly prohibited outdoors on the terrace to preserve the dining ambiance.',
    structured_data: { indoor_laptops: true, outdoor_laptops: false },
    verification_status: 'VERIFIED',
    source: 'MANAGEMENT_DECISION',
    approved_by: 'Floor Management',
    last_reviewed_at: '2026-11-15T12:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 5. Closed Branches Enforcement
  {
    id: 'gov-kb-005',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'BRANCH_SCOPE',
    title: 'Permanent Closure of Naccache & BDD Branches',
    approved_content: 'The Naccache (Zero4) and BDD (Digital District) branches are permanently closed. NÉO welcomes customers exclusively at our flagship Badaro branch.',
    structured_data: { naccache_status: 'PERMANENTLY_CLOSED', bdd_status: 'PERMANENTLY_CLOSED', active_branch: 'Badaro' },
    verification_status: 'VERIFIED',
    source: 'EXECUTIVE_DIRECTION',
    approved_by: 'B.R.I.M.E. S.A.L.',
    last_reviewed_at: '2026-11-15T12:00:00Z',
    effective_from: '2026-06-01',
    is_active: true
  },
  // 6. Pet / Dog Policy
  {
    id: 'gov-kb-006',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'FACILITIES_POLICIES',
    title: 'Pet & Dog Policy',
    approved_content: 'Dogs are warmly welcome on our outdoor terrace (on a leash with fresh water provided upon request). However, pets are strictly not permitted inside the indoor dining area for food safety and hygiene regulations.',
    structured_data: { dogs_allowed_terrace: true, dogs_allowed_indoors: false },
    verification_status: 'VERIFIED',
    source: 'OPERATIONS_MANUAL',
    approved_by: 'Quality Assurance',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 7. Parking & Valet Services
  {
    id: 'gov-kb-007',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'FACILITIES_POLICIES',
    title: 'Parking & Valet Service',
    approved_content: 'Valet parking service is available directly in front of NÉO Badaro on Badaro Main Street for $3.00 (or equivalent in LBP). Public street parking is also available along the street.',
    structured_data: { valet_available: true, valet_fee_usd: 3.0, street_parking: true },
    verification_status: 'VERIFIED',
    source: 'OPERATIONS_MANUAL',
    approved_by: 'Operations Manager',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 8. Private Event Room Policy
  {
    id: 'gov-kb-008',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'FACILITIES_POLICIES',
    title: 'Private Event & Room Rental Policy',
    approved_content: 'NÉO Badaro features an open-concept dining room and terrace. We do not have an enclosed separate private room; however, our mezzanine level or full terrace can be reserved for private events and cocktail receptions with advance notice and minimum spend.',
    structured_data: { private_room_exists: false, mezzanine_buyout_available: true, advance_notice_days: 7 },
    verification_status: 'VERIFIED',
    source: 'EVENTS_COORDINATOR',
    approved_by: 'General Manager',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 9. Payment Methods & Card on Delivery
  {
    id: 'gov-kb-009',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'PAYMENT_POLICIES',
    title: 'Accepted Payment Methods & Card on Delivery',
    approved_content: 'We accept Cash (USD and LBP at current daily rate) and International/Local Credit Cards (Visa, Mastercard). For delivery orders, payment by card is available if requested when placing the order so the driver brings the mobile wireless POS terminal.',
    structured_data: { cash_usd: true, cash_lbp: true, card_in_store: true, card_on_delivery: true, mobile_pos_request_required: true },
    verification_status: 'VERIFIED',
    source: 'FINANCIAL_OPERATIONS',
    approved_by: 'Finance Director',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 10. Student Discounts (VERIFIED NEGATIVE)
  {
    id: 'gov-kb-010',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'PROMOTIONS_POLICIES',
    title: 'Student Discount Policy',
    approved_content: 'NÉO Badaro currently does not offer student discounts. All menu items and promotions are offered at our standardized authorized prices.',
    structured_data: { student_discount_active: false },
    verification_status: 'VERIFIED_NEGATIVE',
    source: 'COMMERCIAL_STRATEGY',
    approved_by: 'Marketing Director',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 11. Custom Cake & Preorder Rules (72 Hours)
  {
    id: 'gov-kb-011',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'PREORDER_POLICIES',
    title: 'Custom Cake Notice & Preorder Requirements',
    approved_content: 'Custom cakes (custom shapes, themes, birthday bakes) require a mandatory minimum 72-hour notice for our pastry team to prepare. Fresh whole artisanal cakes (e.g., Gâteau Chocolat Praliné, 24cm loaf cakes) are available daily at the counter for immediate pickup or same-day reservation.',
    structured_data: { custom_notice_hours: 72, counter_whole_cakes_available: true },
    verification_status: 'VERIFIED',
    source: 'HEAD_PASTRY_CHEF',
    approved_by: 'Executive Chef',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 12. Large Group Reservations (>10 Guests)
  {
    id: 'gov-kb-012',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'RESERVATION_POLICIES',
    title: 'Large Group Reservation Guidelines (10+ Guests)',
    approved_content: 'Table reservations for parties larger than 10 guests (such as 12 people) are welcomed in "Pending" status and require review and confirmation by the floor manager to arrange seating and table distribution.',
    structured_data: { max_instant_party: 10, large_party_requires_manager: true },
    verification_status: 'VERIFIED',
    source: 'FLOOR_MANAGEMENT',
    approved_by: 'Head of Service',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-01-01',
    is_active: true
  },
  // 13. Decaf Coffee Status (UNVERIFIED / UNKNOWN in product catalog)
  {
    id: 'gov-kb-013',
    concept_id: NEO_CONCEPT_ID,
    branch_id: BADARO_BRANCH_ID,
    category: 'PRODUCT_ATTRIBUTES',
    title: 'Decaffeinated Coffee Inquiry Status',
    approved_content: 'Decaffeinated coffee options are not explicitly registered as an active SKU in the current NÉO product catalog. Baristas may accommodate decaf requests depending on daily bean batch availability. Assistant must acknowledge that decaf is unverified in catalog and offer counter staff confirmation.',
    structured_data: { catalog_sku_exists: false, bar_accommodation_unverified: true },
    verification_status: 'UNKNOWN',
    source: 'PRODUCT_AUDIT_2026',
    approved_by: 'Pending Barista Lead Review',
    last_reviewed_at: '2026-11-15T14:00:00Z',
    effective_from: '2026-11-15',
    is_active: true
  }
];

/**
 * Controlled Query Function for Governed Knowledge Base
 */
export function queryGovernedKnowledge(query = '', category = '') {
  const lower = query.toLowerCase();
  return GOVERNED_KNOWLEDGE_RECORDS.filter(record => {
    if (!record.is_active) return false;
    if (category && record.category !== category) return false;
    if (!query.trim()) return true;

    const matchText = (record.title + ' ' + record.approved_content + ' ' + record.category).toLowerCase();
    const words = lower.split(/\s+/).filter(w => w.length > 2);
    return words.some(w => matchText.includes(w));
  });
}
