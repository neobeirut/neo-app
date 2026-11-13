export interface CatalogProduct {
  id: number | string;
  name: string;
  price: number;
  category_id?: number | string | null;
  category_name?: string;
  department?: string;
  is_active?: boolean;
}

export interface GeneratedInvoiceLine {
  product_id: string | number;
  product_name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface GeneratedInvoice {
  id: string;
  batch_id: string;
  restaurant_id: string;
  branch_id: string;
  branch_name: string;
  order_type: 'dine_in' | 'pickup';
  order_source: 'SYNTHETIC_MIGRATION';
  status: 'completed';
  payment_method: 'SYNTHETIC_MIGRATION';
  created_at: string;
  completed_at: string;
  items_count: number;
  total_amount: number;
  items: GeneratedInvoiceLine[];
}

export interface GeneratorParams {
  targetAmount: number;
  invoiceCount: number;
  startDate: string;
  endDate: string;
  restaurantId: string;
  branchId: string;
  branchName: string;
  products: CatalogProduct[];
  categoriesIncluded?: string[];
  randomSeed?: number | string;
  minItemsPerInvoice?: number;
  maxItemsPerInvoice?: number;
  salesHourStart?: number;
  salesHourEnd?: number;
}

export interface GeneratorResult {
  batchId: string;
  invoices: GeneratedInvoice[];
  targetAmount: number;
  generatedAmount: number;
  difference: number;
  targetCount: number;
  generatedCount: number;
  averageTicket: number;
  minTicket: number;
  maxTicket: number;
  totalItemsCount: number;
  isExactMatch: boolean;
  categorySummary: Record<string, { count: number; revenue: number }>;
}

// Seeded PRNG (Mulberry32)
function createPrng(seedStr?: string | number) {
  let s = 123456789;
  if (seedStr !== undefined && seedStr !== '') {
    if (typeof seedStr === 'number') {
      s = Math.floor(seedStr);
    } else {
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
      }
      s = Math.abs(hash) || 123456789;
    }
  }

  return function nextFloat(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticInvoices(params: GeneratorParams): GeneratorResult {
  const rand = createPrng(params.randomSeed);
  const now = new Date();
  const ymd = now.toISOString().split('T')[0].replace(/-/g, '');
  const randCode = Math.floor(1000 + rand() * 9000);
  const batchId = `MIG-${ymd}-${randCode}`;

  // Filter available active products
  let validProducts = params.products.filter(p => {
    if (!p.price || p.price <= 0) return false;
    if (p.is_active === false) return false;
    if (params.categoriesIncluded && params.categoriesIncluded.length > 0) {
      if (p.category_name && !params.categoriesIncluded.includes(p.category_name)) {
        return false;
      }
    }
    return true;
  });

  if (validProducts.length === 0) {
    throw new Error('No eligible products with valid selling prices found in the catalog.');
  }

  // Group products into meal archetypes for realistic combos
  const breakfastItems = validProducts.filter(p => {
    const text = `${p.name} ${p.category_name || ''} ${p.department || ''}`.toLowerCase();
    return (
      text.includes('croissant') ||
      text.includes('egg') ||
      text.includes('omelette') ||
      text.includes('brioche') ||
      text.includes('breakfast') ||
      text.includes('viennoiserie') ||
      text.includes('toast') ||
      text.includes('wellness') ||
      text.includes('bread')
    );
  });

  const coffeeItems = validProducts.filter(p => {
    const text = `${p.name} ${p.category_name || ''}`.toLowerCase();
    return (
      text.includes('coffee') ||
      text.includes('espresso') ||
      text.includes('cappuccino') ||
      text.includes('latte') ||
      text.includes('americano') ||
      text.includes('tea') ||
      text.includes('flat white')
    );
  });

  const beverageItems = validProducts.filter(p => {
    const text = `${p.name} ${p.category_name || ''}`.toLowerCase();
    return (
      text.includes('juice') ||
      text.includes('drink') ||
      text.includes('soda') ||
      text.includes('water') ||
      text.includes('lemonade') ||
      text.includes('iced') ||
      text.includes('beverage') ||
      text.includes('shake') ||
      text.includes('cocktail') ||
      text.includes('wine')
    );
  });

  const lunchDinnerItems = validProducts.filter(p => {
    const text = `${p.name} ${p.category_name || ''} ${p.department || ''}`.toLowerCase();
    return (
      text.includes('sandwich') ||
      text.includes('salad') ||
      text.includes('burger') ||
      text.includes('pizza') ||
      text.includes('pasta') ||
      text.includes('main') ||
      text.includes('platter') ||
      text.includes('baguette') ||
      text.includes('quiche') ||
      text.includes('wellness') ||
      text.includes('starter') ||
      text.includes('side')
    );
  });

  const dessertRetailItems = validProducts.filter(p => {
    const text = `${p.name} ${p.category_name || ''} ${p.department || ''}`.toLowerCase();
    return (
      text.includes('cake') ||
      text.includes('tart') ||
      text.includes('dessert') ||
      text.includes('cookie') ||
      text.includes('pastry') ||
      text.includes('choc') ||
      text.includes('sweet') ||
      text.includes('bread') ||
      p.department?.toLowerCase() === 'store'
    );
  });

  // Fallback buckets if archetype search is too narrow
  const safeBreakfast = breakfastItems.length > 0 ? breakfastItems : validProducts;
  const safeCoffee = coffeeItems.length > 0 ? coffeeItems : validProducts;
  const safeBeverages = beverageItems.length > 0 ? beverageItems : validProducts;
  const safeLunchDinner = lunchDinnerItems.length > 0 ? lunchDinnerItems : validProducts;
  const safeDesserts = dessertRetailItems.length > 0 ? dessertRetailItems : validProducts;

  const minItems = params.minItemsPerInvoice || 1;
  const maxItems = Math.max(minItems, params.maxItemsPerInvoice || 4);
  const startHour = params.salesHourStart !== undefined ? params.salesHourStart : 7;
  const endHour = params.salesHourEnd !== undefined ? params.salesHourEnd : 23;

  const startMs = new Date(params.startDate).getTime();
  const endMs = new Date(params.endDate).getTime();
  const timeSpan = Math.max(86400000, endMs - startMs);

  const targetCents = Math.round(params.targetAmount * 100);
  const N = Math.max(1, params.invoiceCount);

  // STAGE 1: Generate initial plausible invoices
  interface WorkingInvoice {
    id: string;
    created_at: string;
    order_type: 'dine_in' | 'pickup';
    items: {
      product: CatalogProduct;
      quantity: number;
    }[];
  }

  const workingInvoices: WorkingInvoice[] = [];

  for (let i = 0; i < N; i++) {
    // Generate timestamp
    const dateRandom = new Date(startMs + Math.floor(rand() * timeSpan));
    // Determine hour with realistic restaurant peak weighting
    const peakRoll = rand();
    let hour: number;
    if (peakRoll < 0.28) {
      // Breakfast peak (08:00 - 11:00)
      hour = 8 + Math.floor(rand() * 3);
    } else if (peakRoll < 0.65) {
      // Lunch peak (12:00 - 15:00)
      hour = 12 + Math.floor(rand() * 3);
    } else if (peakRoll < 0.80) {
      // Afternoon coffee (15:00 - 18:00)
      hour = 15 + Math.floor(rand() * 3);
    } else {
      // Dinner peak (19:00 - 22:00)
      hour = 19 + Math.floor(rand() * 3);
    }

    hour = Math.max(startHour, Math.min(endHour, hour));
    const minute = Math.floor(rand() * 60);
    const second = Math.floor(rand() * 60);
    dateRandom.setHours(hour, minute, second);

    // Pick basket archetype according to time of day
    const basketItems: { product: CatalogProduct; quantity: number }[] = [];
    const basketSize = minItems + Math.floor(rand() * (maxItems - minItems + 1));

    if (hour <= 11) {
      // Breakfast combo: food + hot beverage
      const f = safeBreakfast[Math.floor(rand() * safeBreakfast.length)];
      basketItems.push({ product: f, quantity: rand() < 0.12 ? 2 : 1 });
      if (basketSize >= 2) {
        const c = safeCoffee[Math.floor(rand() * safeCoffee.length)];
        basketItems.push({ product: c, quantity: rand() < 0.15 ? 2 : 1 });
      }
      if (basketSize >= 3) {
        const b = safeBeverages[Math.floor(rand() * safeBeverages.length)];
        basketItems.push({ product: b, quantity: 1 });
      }
    } else if (hour <= 15) {
      // Lunch combo: main + cold drink + optional dessert
      const m = safeLunchDinner[Math.floor(rand() * safeLunchDinner.length)];
      basketItems.push({ product: m, quantity: 1 });
      if (basketSize >= 2) {
        const d = safeBeverages[Math.floor(rand() * safeBeverages.length)];
        basketItems.push({ product: d, quantity: rand() < 0.15 ? 2 : 1 });
      }
      if (basketSize >= 3) {
        const s = safeDesserts[Math.floor(rand() * safeDesserts.length)];
        basketItems.push({ product: s, quantity: 1 });
      }
      if (basketSize >= 4) {
        const c = safeCoffee[Math.floor(rand() * safeCoffee.length)];
        basketItems.push({ product: c, quantity: 1 });
      }
    } else if (hour <= 18) {
      // Afternoon treat: coffee + sweet
      const c = safeCoffee[Math.floor(rand() * safeCoffee.length)];
      basketItems.push({ product: c, quantity: rand() < 0.20 ? 2 : 1 });
      if (basketSize >= 2) {
        const s = safeDesserts[Math.floor(rand() * safeDesserts.length)];
        basketItems.push({ product: s, quantity: 1 });
      }
      if (basketSize >= 3) {
        const b = safeBeverages[Math.floor(rand() * safeBeverages.length)];
        basketItems.push({ product: b, quantity: 1 });
      }
    } else {
      // Dinner combo: mains + drinks + sides
      const m = safeLunchDinner[Math.floor(rand() * safeLunchDinner.length)];
      basketItems.push({ product: m, quantity: rand() < 0.15 ? 2 : 1 });
      if (basketSize >= 2) {
        const b = safeBeverages[Math.floor(rand() * safeBeverages.length)];
        basketItems.push({ product: b, quantity: rand() < 0.20 ? 2 : 1 });
      }
      if (basketSize >= 3) {
        const s = safeDesserts[Math.floor(rand() * safeDesserts.length)];
        basketItems.push({ product: s, quantity: 1 });
      }
    }

    // Ensure within bounds
    while (basketItems.length < minItems) {
      const p = validProducts[Math.floor(rand() * validProducts.length)];
      basketItems.push({ product: p, quantity: 1 });
    }
    if (basketItems.length > maxItems) {
      basketItems.length = maxItems;
    }

    workingInvoices.push({
      id: `INV-${ymd}-${String(i + 1).padStart(4, '0')}`,
      created_at: dateRandom.toISOString(),
      order_type: rand() < 0.65 ? 'dine_in' : 'pickup',
      items: basketItems
    });
  }

  // Helper to compute total in cents
  function calculateTotalCents(invs: WorkingInvoice[]): number {
    let sum = 0;
    for (const inv of invs) {
      for (const it of inv.items) {
        sum += Math.round(it.product.price * 100) * it.quantity;
      }
    }
    return sum;
  }

  // STAGE 2: Coarse Bipartite Adjustment (Hill-climbing)
  let currentTotalCents = calculateTotalCents(workingInvoices);
  let deltaCents = targetCents - currentTotalCents;
  let iterations = 0;
  const maxIterations = 3500;

  while (Math.abs(deltaCents) > 300 && iterations < maxIterations) {
    iterations++;
    const invIdx = Math.floor(rand() * workingInvoices.length);
    const inv = workingInvoices[invIdx];

    if (deltaCents > 0) {
      // We need more revenue: upgrade an item or add one
      if (inv.items.length < maxItems && rand() < 0.45) {
        // Add an accessory item
        const candidate = validProducts[Math.floor(rand() * validProducts.length)];
        const priceCents = Math.round(candidate.price * 100);
        if (priceCents <= deltaCents + 200) {
          inv.items.push({ product: candidate, quantity: 1 });
          deltaCents -= priceCents;
        }
      } else if (inv.items.length > 0) {
        // Swap an item for a higher-priced one
        const itemIdx = Math.floor(rand() * inv.items.length);
        const currentItem = inv.items[itemIdx];
        const higherCandidates = validProducts.filter(
          p => Math.round(p.price * 100) > Math.round(currentItem.product.price * 100)
        );
        if (higherCandidates.length > 0) {
          const replacement = higherCandidates[Math.floor(rand() * higherCandidates.length)];
          const diff = (Math.round(replacement.price * 100) - Math.round(currentItem.product.price * 100)) * currentItem.quantity;
          if (diff <= deltaCents + 150) {
            inv.items[itemIdx].product = replacement;
            deltaCents -= diff;
          }
        }
      }
    } else {
      // We have too much revenue: downgrade an item or remove one
      if (inv.items.length > minItems && rand() < 0.45) {
        // Remove an item
        const itemIdx = Math.floor(rand() * inv.items.length);
        const itemCost = Math.round(inv.items[itemIdx].product.price * 100) * inv.items[itemIdx].quantity;
        inv.items.splice(itemIdx, 1);
        deltaCents += itemCost;
      } else if (inv.items.length > 0) {
        // Swap for a cheaper item
        const itemIdx = Math.floor(rand() * inv.items.length);
        const currentItem = inv.items[itemIdx];
        const lowerCandidates = validProducts.filter(
          p => Math.round(p.price * 100) < Math.round(currentItem.product.price * 100)
        );
        if (lowerCandidates.length > 0) {
          const replacement = lowerCandidates[Math.floor(rand() * lowerCandidates.length)];
          const diff = (Math.round(currentItem.product.price * 100) - Math.round(replacement.price * 100)) * currentItem.quantity;
          inv.items[itemIdx].product = replacement;
          deltaCents += diff;
        }
      }
    }
  }

  // STAGE 3: Exact Residual Zeroing (Fine tuning to the exact cent)
  currentTotalCents = calculateTotalCents(workingInvoices);
  deltaCents = targetCents - currentTotalCents;

  if (deltaCents !== 0) {
    // Collect all valid single-item delta moves: (invoiceIdx, itemIdx, replacementProduct, deltaCents)
    interface DeltaMove {
      invIdx: number;
      itemIdx: number;
      newProduct: CatalogProduct;
      delta: number;
    }

    const moves: DeltaMove[] = [];
    for (let i = 0; i < workingInvoices.length; i++) {
      const inv = workingInvoices[i];
      for (let j = 0; j < inv.items.length; j++) {
        const cur = inv.items[j];
        if (cur.quantity === 1) {
          const curCents = Math.round(cur.product.price * 100);
          for (const p of validProducts) {
            const pCents = Math.round(p.price * 100);
            const d = pCents - curCents;
            if (d !== 0 && Math.abs(d) <= Math.abs(deltaCents) + 200) {
              moves.push({
                invIdx: i,
                itemIdx: j,
                newProduct: p,
                delta: d
              });
            }
          }
        }
      }
    }

    // Try to find a single move matching deltaCents
    const singleMatch = moves.find(m => m.delta === deltaCents);
    if (singleMatch) {
      workingInvoices[singleMatch.invIdx].items[singleMatch.itemIdx].product = singleMatch.newProduct;
      deltaCents = 0;
    } else {
      // Try two-move combinations
      let foundPair = false;
      for (let a = 0; a < Math.min(moves.length, 300) && !foundPair; a++) {
        const m1 = moves[a];
        const needed = deltaCents - m1.delta;
        const m2 = moves.find((m, idx) => idx !== a && m.invIdx !== m1.invIdx && m.delta === needed);
        if (m2) {
          workingInvoices[m1.invIdx].items[m1.itemIdx].product = m1.newProduct;
          workingInvoices[m2.invIdx].items[m2.itemIdx].product = m2.newProduct;
          deltaCents = 0;
          foundPair = true;
        }
      }
    }
  }

  // Final validation and transformation
  const categorySummary: Record<string, { count: number; revenue: number }> = {};
  let totalItemsCount = 0;
  const finalInvoices: GeneratedInvoice[] = [];

  for (let i = 0; i < workingInvoices.length; i++) {
    const w = workingInvoices[i];
    let invTotal = 0;
    const lines: GeneratedInvoiceLine[] = [];

    for (const it of w.items) {
      const unitP = Number(it.product.price.toFixed(2));
      const lineTot = Number((unitP * it.quantity).toFixed(2));
      invTotal += lineTot;
      totalItemsCount += it.quantity;

      const catName = it.product.category_name || 'General';
      if (!categorySummary[catName]) {
        categorySummary[catName] = { count: 0, revenue: 0 };
      }
      categorySummary[catName].count += it.quantity;
      categorySummary[catName].revenue += lineTot;

      lines.push({
        product_id: it.product.id,
        product_name: it.product.name,
        category_name: catName,
        quantity: it.quantity,
        unit_price: unitP,
        total_price: lineTot
      });
    }

    invTotal = Number(invTotal.toFixed(2));

    finalInvoices.push({
      id: w.id,
      batch_id: batchId,
      restaurant_id: params.restaurantId,
      branch_id: params.branchId,
      branch_name: params.branchName,
      order_type: w.order_type,
      order_source: 'SYNTHETIC_MIGRATION',
      status: 'completed',
      payment_method: 'SYNTHETIC_MIGRATION',
      created_at: w.created_at,
      completed_at: w.created_at,
      items_count: lines.length,
      total_amount: invTotal,
      items: lines
    });
  }

  const finalGeneratedAmount = Number(
    finalInvoices.reduce((acc, inv) => acc + inv.total_amount, 0).toFixed(2)
  );
  const difference = Number((finalGeneratedAmount - params.targetAmount).toFixed(2));
  const isExactMatch = Math.abs(difference) < 0.001;

  const amounts = finalInvoices.map(inv => inv.total_amount);
  const minTicket = amounts.length > 0 ? Math.min(...amounts) : 0;
  const maxTicket = amounts.length > 0 ? Math.max(...amounts) : 0;
  const averageTicket = amounts.length > 0 ? Number((finalGeneratedAmount / amounts.length).toFixed(2)) : 0;

  return {
    batchId,
    invoices: finalInvoices,
    targetAmount: params.targetAmount,
    generatedAmount: finalGeneratedAmount,
    difference,
    targetCount: params.invoiceCount,
    generatedCount: finalInvoices.length,
    averageTicket,
    minTicket,
    maxTicket,
    totalItemsCount,
    isExactMatch,
    categorySummary
  };
}
