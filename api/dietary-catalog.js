/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Authoritative NÉO Product & Dietary Knowledge Engine
 * Target: NÉO Pilot (Badaro Flagship Only) | Multi-Concept Support
 * 
 * Enforces:
 * 1. Authoritative FLOW Product Catalog and recipe data.
 * 2. Strict 3-state dietary attributes: VERIFIED_YES, VERIFIED_NO, UNKNOWN.
 * 3. Rule: UNKNOWN must NEVER be interpreted as a positive claim.
 * 4. Rule: Never infer dietary attributes or medical suitability from product name.
 * 5. Rule: Never guarantee allergy safety without kitchen cross-contamination escalation.
 */

export const NEO_CONCEPT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Authoritative NÉO Product Catalog with Verified 3-State Dietary Profiles
 */
export const NEO_AUTHORITATIVE_PRODUCTS = [
  // --- VIENNOISERIES ---
  {
    product_id: 642,
    product_name: 'Croissant nature',
    category: 'Viennoiseries',
    price_usd: 2.60,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Traditional French butter croissant, contains wheat flour and butter.'
  },
  {
    product_id: 640,
    product_name: 'Croissant aux amandes',
    category: 'Viennoiseries',
    price_usd: 3.30,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Almonds)', 'Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Butter croissant filled with almond frangipane cream and topped with sliced almonds.'
  },
  {
    product_id: 646,
    product_name: 'Croissant Chocolat Amande',
    category: 'Viennoiseries',
    price_usd: 3.60,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Almonds)', 'Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Filled with dark chocolate and almond cream.'
  },
  {
    product_id: 647,
    product_name: 'Pain au chocolat',
    category: 'Viennoiseries',
    price_usd: 3.30,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Flaky pastry with two batons of chocolate.'
  },
  {
    product_id: 638,
    product_name: 'Brioche tressée sucre',
    category: 'Viennoiseries',
    price_usd: 2.60,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Buttery brioche topped with pearl sugar crust.'
  },
  {
    product_id: 644,
    product_name: 'Brioche Suisse',
    category: 'Viennoiseries',
    price_usd: 3.30,
    is_available: false, // 86 status
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Currently 86 (Unavailable Today).'
  },

  // --- CAKES & DESSERTS ---
  {
    product_id: 663,
    product_name: 'Cake pralin 13cm',
    category: 'Cakes',
    price_usd: 10.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Hazelnuts)', 'Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Artisanal loaf cake layered with caramelized hazelnut praline.'
  },
  {
    product_id: 1628,
    product_name: 'Cake Pralin 24cm',
    category: 'Cakes',
    price_usd: 20.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Hazelnuts)', 'Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Large 24cm loaf cake generously folded with caramelized hazelnut praline.'
  },
  {
    product_id: 718,
    product_name: 'Tarte Pralinoi',
    category: 'Pastry',
    price_usd: 6.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Hazelnuts)', 'Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Crispy sweet shortcrust tart with velvety roasted hazelnut praline filling.'
  },
  {
    product_id: 901,
    product_name: 'Gâteau Chocolat Praliné',
    category: 'Cakes',
    price_usd: 38.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Hazelnuts)', 'Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Whole celebration cake layered with Valrhona dark chocolate ganache and hazelnut praline.'
  },
  {
    product_id: 720,
    product_name: 'Newyork cheesecake',
    category: 'Pastry',
    price_usd: 6.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Classic creamy baked New York style cheesecake with standard sugar, full-fat cream cheese, and butter graham crust. NOT suitable for diabetics.'
  },
  {
    product_id: 721,
    product_name: 'Oreo cheesecake',
    category: 'Pastry',
    price_usd: 6.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Creamy cheesecake blended with Oreo cookies and chocolate crust. NOT suitable for diabetics.'
  },
  {
    product_id: 726,
    product_name: 'Tarte chocolat',
    category: 'Pastry',
    price_usd: 6.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Dark chocolate ganache in butter shortcrust.'
  },
  {
    product_id: 727,
    product_name: 'Tarte citron Meringue',
    category: 'Pastry',
    price_usd: 5.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Fresh lemon curd topped with sweet italian meringue.'
  },
  {
    product_id: 728,
    product_name: 'Tarte fraises',
    category: 'Pastry',
    price_usd: 5.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Fresh strawberries on vanilla crème pâtissière.'
  },
  {
    product_id: 729,
    product_name: 'Tarte mangue',
    category: 'Pastry',
    price_usd: 6.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Fresh mango on pastry cream.'
  },
  {
    product_id: 1422,
    product_name: 'Pain Perdu',
    category: 'Pastry',
    price_usd: 9.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'French toast soaked in vanilla custard, served warm with salted caramel.'
  },
  {
    product_id: 654,
    product_name: 'Cake Citron 13cm',
    category: 'Cakes',
    price_usd: 9.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Moist lemon loaf cake glazed with citrus syrup.'
  },
  {
    product_id: 658,
    product_name: 'Cake Marbre Neo 13cm',
    category: 'Cakes',
    price_usd: 11.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Dairy', 'Gluten', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Buttery marbled cake with chocolate chunks.'
  },

  // --- ARTISANAL BREADS ---
  {
    product_id: 755,
    product_name: 'Pain de campagne 1',
    category: 'Bread',
    price_usd: 6.00,
    is_available: true,
    sugar_free: 'VERIFIED_YES',
    no_added_sugar: 'VERIFIED_YES',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_YES',
    dairy_free: 'VERIFIED_YES',
    lactose_free: 'VERIFIED_YES',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_NO',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_NO',
    declared_allergens: ['Gluten (Wheat, Rye)'],
    diabetic_suitable: 'UNKNOWN',
    cross_contamination_risk: true,
    dietary_notes: 'Traditional French sourdough loaf made with wheat and rye flour, water, salt, and wild levain. Contains gluten. NOT gluten-free.'
  },
  {
    product_id: 802,
    product_name: 'Baguette Tradition',
    category: 'Bread',
    price_usd: 1.80,
    is_available: true,
    sugar_free: 'VERIFIED_YES',
    no_added_sugar: 'VERIFIED_YES',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_YES',
    dairy_free: 'VERIFIED_YES',
    lactose_free: 'VERIFIED_YES',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_NO',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_NO',
    declared_allergens: ['Gluten (Wheat)'],
    diabetic_suitable: 'UNKNOWN',
    cross_contamination_risk: true,
    dietary_notes: 'French tradition baguette. Contains wheat gluten. NOT gluten-free.'
  },
  {
    product_id: 742,
    product_name: 'Ciabatta',
    category: 'Bread',
    price_usd: 1.67,
    is_available: true,
    sugar_free: 'VERIFIED_YES',
    no_added_sugar: 'VERIFIED_YES',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_YES',
    dairy_free: 'VERIFIED_YES',
    lactose_free: 'VERIFIED_YES',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_NO',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_NO',
    declared_allergens: ['Gluten (Wheat)'],
    diabetic_suitable: 'UNKNOWN',
    cross_contamination_risk: true,
    dietary_notes: 'Italian-style airy rustic loaf. Contains wheat gluten. NOT gluten-free.'
  },
  {
    product_id: 756,
    product_name: 'Pain de mie 1/2 16pcs',
    category: 'Bread',
    price_usd: 4.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_NO',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Gluten (Wheat)', 'Dairy'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Soft sandwich loaf enriched with milk and butter. Contains gluten and dairy. NOT gluten-free.'
  },
  {
    product_id: 747,
    product_name: 'Pain au lait 6 Pcs',
    category: 'Bread',
    price_usd: 3.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_YES',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Gluten', 'Dairy', 'Eggs'],
    diabetic_suitable: 'VERIFIED_NO',
    cross_contamination_risk: true,
    dietary_notes: 'Soft sweet milk rolls. Contains wheat gluten and dairy. NOT gluten-free.'
  },

  // --- SALADS & SAVORY ---
  {
    product_id: 950,
    product_name: 'Salade Chèvre Chaud',
    category: 'Salads',
    price_usd: 11.00,
    is_available: true,
    sugar_free: 'VERIFIED_NO',
    no_added_sugar: 'VERIFIED_NO',
    gluten_free: 'VERIFIED_NO', // toast contains wheat
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_NO',
    dairy_free: 'VERIFIED_NO',
    lactose_free: 'VERIFIED_NO',
    contains_nuts: 'VERIFIED_YES', // Walnuts
    contains_eggs: 'VERIFIED_NO',
    contains_gluten: 'VERIFIED_YES',
    contains_dairy: 'VERIFIED_YES',
    declared_allergens: ['Tree Nuts (Walnuts)', 'Dairy', 'Gluten'],
    diabetic_suitable: 'UNKNOWN',
    cross_contamination_risk: true,
    dietary_notes: 'Warm goat cheese on artisanal toast with walnuts and honey.'
  },

  // --- CRACKERS / SNACKS (Savory) ---
  {
    product_id: 888,
    product_name: 'Oat Zaatar Crackers',
    category: 'Savory Snacks',
    price_usd: 4.00,
    is_available: true,
    sugar_free: 'VERIFIED_YES',
    no_added_sugar: 'VERIFIED_YES',
    gluten_free: 'VERIFIED_YES',
    vegetarian: 'VERIFIED_YES',
    vegan: 'VERIFIED_YES',
    dairy_free: 'VERIFIED_YES',
    lactose_free: 'VERIFIED_YES',
    contains_nuts: 'VERIFIED_NO',
    contains_eggs: 'VERIFIED_NO',
    contains_gluten: 'VERIFIED_NO',
    contains_dairy: 'VERIFIED_NO',
    declared_allergens: ['Sesame (Zaatar)'],
    diabetic_suitable: 'UNKNOWN',
    cross_contamination_risk: true,
    dietary_notes: 'Savory crispy oat crackers with zaatar. (Savory snack, NOT a dessert).'
  }
];

/**
 * Authoritative Grounding Rules & Business Facts
 */
export const NEO_BUSINESS_FACTS = {
  SUGAR_FREE_DESSERTS: {
    available: false,
    arabicResponse: 'مرحبا! 💚 حالياً ما عنا حلويات خالية من السكر، بس فينا نساعدك تختار من تشكيلة الحلويات الموجودة عنا.',
    englishExplanation: 'NÉO Badaro currently does not offer sugar-free desserts. All our artisanal pastries, cakes, and tarts contain standard sugar.',
    frenchExplanation: 'NÉO Badaro ne propose actuellement pas de desserts sans sucre. Toutes nos pâtisseries et gâteaux artisanaux contiennent du sucre standard.'
  },
  GLUTEN_FREE_BREAD: {
    available: false,
    explanation: 'NÉO Badaro currently does not offer gluten-free bread. All our artisanal breads (Pain de campagne, Baguette Tradition, Ciabatta, Pain de mie) are baked with traditional wheat and sourdough containing gluten.'
  },
  VEGAN_DESSERTS: {
    available: false,
    explanation: 'NÉO Badaro currently does not offer vegan desserts. All our French pastries, cakes, and viennoiseries are prepared with traditional French dairy (butter, milk, cream) and fresh eggs.'
  },
  CHEESECAKE_DIABETIC: {
    suitable: false,
    explanation: 'Our cheesecakes (New York Cheesecake, Oreo Cheesecake) are prepared according to traditional rich recipes with standard sugar, high carbohydrates, full-fat cream cheese, and biscuit crust. They are strictly NOT sugar-free and NOT suitable for diabetics.'
  },
  ALLERGEN_SAFETY_POLICY: {
    policy: 'Never guarantee allergy safety based solely on ingredient information. The kitchen and open bakery handle tree nuts (hazelnuts, almonds, walnuts), dairy, gluten, and eggs daily. Serious allergy inquiries must be escalated to the duty manager or head chef at Badaro to evaluate cross-contamination risk.'
  }
};

/**
 * Server-Side Tool: Query Verified Dietary Products
 * 
 * Strict Grounding Logic:
 * 1. Only recommends products where the requested attribute is explicitly 'VERIFIED_YES'.
 * 2. If attribute is 'VERIFIED_NO' or 'UNKNOWN', it is NEVER returned as matching.
 * 3. Never infers attributes from name or general description.
 * 4. If allergen is queried, returns items where 'contains_nuts' is 'VERIFIED_YES' or declared_allergens matches.
 */
export function queryVerifiedDietaryProducts(params = {}) {
  const {
    query = '',
    category = null,
    attribute = null,     // e.g. 'sugar_free', 'gluten_free', 'vegan', 'dairy_free'
    allergen = null,      // e.g. 'hazelnut', 'nuts', 'almonds', 'gluten', 'dairy'
    medicalCondition = null // e.g. 'diabetic'
  } = params;

  const lowerQ = (query || '').toLowerCase();
  let candidateList = [...NEO_AUTHORITATIVE_PRODUCTS];

  // Category filter
  if (category) {
    const catLower = category.toLowerCase();
    if (catLower.includes('dessert') || catLower.includes('sweet') || catLower.includes('pâtisserie') || catLower.includes('cake')) {
      candidateList = candidateList.filter(p => ['Cakes', 'Pastry', 'Viennoiseries'].includes(p.category));
    } else if (catLower.includes('bread') || catLower.includes('pain')) {
      candidateList = candidateList.filter(p => p.category === 'Bread');
    } else {
      candidateList = candidateList.filter(p => p.category.toLowerCase().includes(catLower));
    }
  }

  // 1. Dietary Attribute Filter (e.g. sugar_free, gluten_free, vegan)
  if (attribute) {
    const verifiedMatches = candidateList.filter(p => p[attribute] === 'VERIFIED_YES');
    const verifiedNonMatches = candidateList.filter(p => p[attribute] === 'VERIFIED_NO');
    const unknownMatches = candidateList.filter(p => p[attribute] === 'UNKNOWN');

    return {
      query,
      attribute,
      category,
      hasVerifiedMatches: verifiedMatches.length > 0,
      matchingProducts: verifiedMatches,
      nonMatchingProducts: verifiedNonMatches,
      unknownCount: unknownMatches.length,
      explanation: verifiedMatches.length > 0
        ? `Found ${verifiedMatches.length} verified ${attribute} item(s) in NÉO catalog.`
        : `No verified ${attribute} items currently exist in NÉO's ${category || 'catalog'}.`
    };
  }

  // 2. Allergen Filter (e.g. hazelnut, almond, tree nuts)
  if (allergen) {
    const aLower = allergen.toLowerCase();
    const containingItems = candidateList.filter(p => {
      if (aLower.includes('hazelnut') || aLower.includes('noisette')) {
        return (p.declared_allergens || []).some(a => a.toLowerCase().includes('hazelnut')) ||
               p.product_name.toLowerCase().includes('pralin');
      }
      if (aLower.includes('almond') || aLower.includes('amande')) {
        return (p.declared_allergens || []).some(a => a.toLowerCase().includes('almond'));
      }
      if (aLower.includes('nut') || aLower.includes('noix')) {
        return p.contains_nuts === 'VERIFIED_YES' ||
               (p.declared_allergens || []).some(a => a.toLowerCase().includes('nut') || a.toLowerCase().includes('almond') || a.toLowerCase().includes('hazelnut') || a.toLowerCase().includes('walnut'));
      }
      if (aLower.includes('gluten')) {
        return p.contains_gluten === 'VERIFIED_YES';
      }
      if (aLower.includes('dairy') || aLower.includes('milk') || aLower.includes('lait')) {
        return p.contains_dairy === 'VERIFIED_YES';
      }
      return false;
    });

    return {
      query,
      allergen,
      category,
      hasContainingItems: containingItems.length > 0,
      containingProducts: containingItems,
      explanation: containingItems.length > 0
        ? `Identified ${containingItems.length} product(s) in NÉO catalog containing ${allergen}.`
        : `No items with declared ${allergen} found in this category.`
    };
  }

  // 3. Medical Condition Filter (e.g. diabetic)
  if (medicalCondition === 'diabetic') {
    const isCheesecakeQuery = lowerQ.includes('cheesecake');
    const cheesecakes = candidateList.filter(p => p.product_name.toLowerCase().includes('cheesecake'));

    return {
      query,
      medicalCondition: 'diabetic',
      isSuitable: false,
      itemsChecked: cheesecakes,
      explanation: NEO_BUSINESS_FACTS.CHEESECAKE_DIABETIC.explanation
    };
  }

  return {
    query,
    totalProducts: candidateList.length,
    products: candidateList
  };
}
