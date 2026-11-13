import { type ReplenishmentRecommendationItem, replenishmentApi } from '../api/replenishmentApi';

export interface ReplenishmentAiSummary {
  generated_at: string;
  engine_mode: 'GEMINI_2_5_FLASH_ASSISTED' | 'DETERMINISTIC_STATISTICAL_ENGINE';
  horizon_days: number;
  lookback_days: number;
  headline: string;
  metrics: {
    total_analyzed: number;
    critical_stockouts: number;
    demand_surges: number;
    demand_drops: number;
    weekend_patterns: number;
    slow_moving: number;
    dead_stock: number;
    par_fallbacks: number;
    high_waste_alerts: number;
  };
  highlights: string[];
  ai_fallback_note?: string;
}

export interface ReplenishmentAiItemInsight {
  item_rec_id: string;
  item_id: string;
  ai_explanation: string;
  ai_flags: string[];
}

export interface ReplenishmentIntelligenceResult {
  summary: ReplenishmentAiSummary;
  item_insights: ReplenishmentAiItemInsight[];
}

/**
 * Reproducible client-side statistical fallback (used if the backend route is unreachable).
 * Never accesses or exposes any Gemini API key in the frontend.
 */
export function computeDeterministicStatisticalIntelligence(
  items: ReplenishmentRecommendationItem[],
  horizonDays: number = 14,
  lookbackDays: number = 30
): ReplenishmentIntelligenceResult {
  const safeItems = Array.isArray(items) ? items : [];
  const surgeItems: string[] = [];
  const dropItems: string[] = [];
  const weekendPatternItems: string[] = [];
  const slowMovingItems: string[] = [];
  const deadStockItems: string[] = [];
  const parFallbackItems: string[] = [];
  const highWasteItems: string[] = [];
  const criticalStockoutItems: string[] = [];

  const itemInsights: ReplenishmentAiItemInsight[] = safeItems.map((item) => {
    const flags = new Set<string>(Array.isArray(item.ai_flags) ? item.ai_flags : []);
    const exceptions = Array.isArray(item.exceptions) ? item.exceptions : [];
    const usable = Number(item.usable_stock || 0);
    const par = Number(item.par_level || 0);
    const dailyDemand = Number(item.daily_demand || 0);
    const directDemand = Number(item.direct_menu_daily_demand || 0);
    const depBomDemand = Number(item.dependent_bom_horizon_demand || 0);
    const doh = item.days_on_hand !== null && item.days_on_hand !== undefined ? Number(item.days_on_hand) : null;
    const freqPct = Number(item.consumption_frequency_pct || 0);
    const activeDays = Number(item.active_consumption_days || 0);
    const recQty = Number(item.override_quantity ?? item.recommended_order_quantity ?? 0);

    if (usable <= 0 || item.risk_level === 'CRITICAL_STOCKOUT_IMMINENT' || item.risk_level === 'ALREADY_NEGATIVE') {
      flags.add('STOCKOUT_RISK');
      criticalStockoutItems.push(item.item_name);
    }

    if (dailyDemand <= 0 && depBomDemand <= 0) {
      if (usable < par && par > 0) {
        flags.add('PAR_FALLBACK_NO_HISTORY');
        parFallbackItems.push(item.item_name);
      } else if (usable > 0) {
        flags.add('DEAD_STOCK');
        deadStockItems.push(item.item_name);
      }
    } else if (doh !== null && doh > 30 && usable > par) {
      flags.add('SLOW_MOVING');
      slowMovingItems.push(item.item_name);
    }

    if (flags.has('DEMAND_SURGE')) surgeItems.push(item.item_name);
    if (flags.has('DEMAND_DROP')) dropItems.push(item.item_name);
    if (flags.has('WEEKEND_SURGE') || flags.has('WEEKDAY_PEAK')) weekendPatternItems.push(item.item_name);
    if (flags.has('HIGH_WASTE_OVERPRODUCTION')) highWasteItems.push(item.item_name);

    const parts: string[] = [];
    if (flags.has('PAR_FALLBACK_NO_HISTORY')) {
      parts.push(
        `Insufficient consumption history (${activeDays} active days in ${lookbackDays}d window); falling back deterministically to configured Par Level (${par} ${item.base_unit}).`
      );
    } else {
      parts.push(
        `Observed on ${activeDays} days (${freqPct.toFixed(0)}% frequency over ${lookbackDays}d) at ${dailyDemand.toFixed(2)} ${item.base_unit}/day.`
      );
    }

    if (directDemand > 0 && depBomDemand > 0) {
      parts.push(
        `Dual-use raw material: combines ${directDemand.toFixed(2)} ${item.base_unit}/day direct POS menu demand plus ${depBomDemand.toFixed(2)} ${item.base_unit} dependent BOM demand from planned preparations (without double-counting historical prep batches).`
      );
    } else if (depBomDemand > 0) {
      parts.push(
        `Includes ${depBomDemand.toFixed(2)} ${item.base_unit} dependent BOM requirement from planned preparations.`
      );
    }

    if (flags.has('DEMAND_SURGE')) {
      parts.push('7-day consumption velocity is ≥35% above the historical baseline (accelerating demand).');
    } else if (flags.has('DEMAND_DROP')) {
      parts.push('7-day consumption velocity is ≤65% of the historical baseline (decelerating demand).');
    }

    if (flags.has('WEEKEND_SURGE')) {
      parts.push('Strong Fri–Sun weekend demand surge detected (≥1.25x weekday average).');
    } else if (flags.has('WEEKDAY_PEAK')) {
      parts.push('Weekday-concentrated consumption pattern detected.');
    }

    if (flags.has('HIGH_WASTE_OVERPRODUCTION')) {
      parts.push('Elevated waste/spoilage ratio (≥15%) in lookback window — review batch sizing and FEFO rotation.');
    }

    if (item.shelf_life_capped || exceptions.includes('SHELF_LIFE_CAPPED')) {
      parts.push(`Recommended batch capped by ${item.shelf_life_days}-day shelf life to prevent expiry waste.`);
    }

    if (Number(item.tentative_draft_production_qty || 0) > 0) {
      parts.push(
        `Note: ${Number(item.tentative_draft_production_qty).toFixed(2)} ${item.base_unit} in unapproved DRAFT production batches were excluded from confirmed incoming supply to prevent under-ordering.`
      );
    }

    if (recQty > 0) {
      parts.push(
        `Net recommendation: ${recQty.toFixed(2)} ${item.base_unit} (${item.sourcing_type === 'PRODUCTION' ? 'Production' : 'Purchase'}).`
      );
    }

    return {
      item_rec_id: item.item_rec_id,
      item_id: item.item_id,
      ai_explanation: parts.join(' '),
      ai_flags: Array.from(flags),
    };
  });

  const summary: ReplenishmentAiSummary = {
    generated_at: new Date().toISOString(),
    engine_mode: 'DETERMINISTIC_STATISTICAL_ENGINE',
    horizon_days: horizonDays,
    lookback_days: lookbackDays,
    headline:
      criticalStockoutItems.length > 0
        ? `${criticalStockoutItems.length} critical stockout risk(s) and ${surgeItems.length} demand surge(s) identified across ${safeItems.length} items.`
        : `Evaluated ${safeItems.length} items over a ${horizonDays}-day planning horizon using ${lookbackDays} days of movement history.`,
    metrics: {
      total_analyzed: safeItems.length,
      critical_stockouts: criticalStockoutItems.length,
      demand_surges: surgeItems.length,
      demand_drops: dropItems.length,
      weekend_patterns: weekendPatternItems.length,
      slow_moving: slowMovingItems.length,
      dead_stock: deadStockItems.length,
      par_fallbacks: parFallbackItems.length,
      high_waste_alerts: highWasteItems.length,
    },
    highlights: [
      criticalStockoutItems.length > 0
        ? `Immediate stockout risk on: ${criticalStockoutItems.slice(0, 5).join(', ')}.`
        : 'No immediate lead-time stockout breaches detected.',
      surgeItems.length > 0
        ? `Accelerating 7-day demand velocity on: ${surgeItems.slice(0, 5).join(', ')}.`
        : 'Short-term 7-day velocity is stable relative to the lookback window.',
      parFallbackItems.length > 0
        ? `Deterministic Par-Level fallback applied to ${parFallbackItems.length} item(s) with insufficient movement history (${parFallbackItems.slice(0, 4).join(', ')}).`
        : 'All recommended items have active historical movement telemetry.',
      deadStockItems.length > 0 || slowMovingItems.length > 0
        ? `${deadStockItems.length} zero-movement item(s) and ${slowMovingItems.length} slow-moving item(s) (>30 DOH) suppressed from reordering.`
        : 'Inventory turnover is balanced with no excess dead-stock accumulation.',
    ],
  };

  return { summary, item_insights: itemInsights };
}

export const replenishmentIntelligenceService = {
  /**
   * Calls the secured backend endpoint (/api/replenishment-ai) to run AI Demand Intelligence
   * and persists the resulting insights into the replenishment batch via Supabase RPC.
   */
  analyzeAndPersistBatchInsights: async (params: {
    batchId: string;
    items: ReplenishmentRecommendationItem[];
    horizonDays?: number;
    lookbackDays?: number;
  }): Promise<ReplenishmentIntelligenceResult> => {
    const horizonDays = params.horizonDays || 14;
    const lookbackDays = params.lookbackDays || 30;
    let result: ReplenishmentIntelligenceResult;

    try {
      const response = await fetch('/api/replenishment-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: params.batchId,
          horizon_days: horizonDays,
          lookback_days: lookbackDays,
          items: params.items,
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.success && payload?.data) {
          result = payload.data;
        } else {
          result = computeDeterministicStatisticalIntelligence(params.items, horizonDays, lookbackDays);
        }
      } else {
        result = computeDeterministicStatisticalIntelligence(params.items, horizonDays, lookbackDays);
      }
    } catch {
      result = computeDeterministicStatisticalIntelligence(params.items, horizonDays, lookbackDays);
    }

    // Persist insights to database batch & items
    await replenishmentApi.saveAiInsights({
      batchId: params.batchId,
      summary: result.summary,
      itemInsights: result.item_insights,
    });

    return result;
  },
};
