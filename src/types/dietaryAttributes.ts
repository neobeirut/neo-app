/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Dietary Attributes & Nutritional Grounding Types
 * Target: NÉO Pilot (Badaro Flagship) & Multi-Concept
 * 
 * Enforces a strict 3-state verification model:
 * - VERIFIED_YES: Explicitly audited and confirmed by culinary management / kitchen team.
 * - VERIFIED_NO: Explicitly audited and confirmed NOT to meet the dietary criteria.
 * - UNKNOWN: Not yet audited. MUST NEVER BE INTERPRETED AS A POSITIVE DIETARY CLAIM.
 */

export type DietaryTriState = 'VERIFIED_YES' | 'VERIFIED_NO' | 'UNKNOWN';

export interface ProductDietaryProfile {
  product_id: number;
  product_name: string;
  category: string;
  price_usd: number;
  is_available: boolean;
  
  // 12 Core Dietary & Allergen Attributes
  sugar_free: DietaryTriState;
  no_added_sugar: DietaryTriState;
  gluten_free: DietaryTriState;
  vegetarian: DietaryTriState;
  vegan: DietaryTriState;
  dairy_free: DietaryTriState;
  lactose_free: DietaryTriState;
  contains_nuts: DietaryTriState;
  contains_eggs: DietaryTriState;
  contains_gluten: DietaryTriState;
  contains_dairy: DietaryTriState;
  declared_allergens: string[];

  // Clinical & Safety Notes
  diabetic_suitable: DietaryTriState;
  cross_contamination_risk: boolean;
  dietary_notes?: string;
  
  // Audit Trail
  verification_status: 'VERIFIED' | 'UNVERIFIED';
  verified_by?: string;
  verified_at?: string;
}

export interface DietaryQueryResult {
  query: string;
  category?: string;
  requirement?: string;
  allergen?: string;
  matchingProducts: ProductDietaryProfile[];
  nonMatchingProducts: ProductDietaryProfile[];
  hasVerifiedMatches: boolean;
  clearExplanation: string;
  requiresChefEscalation: boolean;
  escalationReason?: string;
}
