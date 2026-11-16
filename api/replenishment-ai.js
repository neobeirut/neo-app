/**
 * Secured Backend Endpoint for FLOW Smart Replenishment AI Demand Intelligence (Phase 4)
 *
 * Security Guarantees (Refinement #4):
 * - Runs strictly on the Node backend (Vercel serverless function or Vite server middleware).
 * - Uses server-side process.env.GEMINI_API_KEY ONLY — never exposed via VITE_ frontend env vars.
 * - AI is advisory/explanatory only: it cannot invent stock balances, override quantities, or
 *   execute operational transactions.
 * - Always computes deterministic statistical intelligence from actual historical telemetry
 *   and falls back cleanly when server GEMINI_API_KEY is not configured or rate-limited.
 */

export function buildDeterministicDemandIntelligence(items = [], horizonDays = 14, lookbackDays = 30) {
  const safeItems = Array.isArray(items) ? items : [];

  const surgeItems = [];
  const dropItems = [];
  const weekendPatternItems = [];
  const slowMovingItems = [];
  const deadStockItems = [];
  const parFallbackItems = [];
  const highWasteItems = [];
  const criticalStockoutItems = [];

  const itemInsights = safeItems.map((item) => {
    const flags = new Set(Array.isArray(item.ai_flags) ? item.ai_flags : []);
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

    const parts = [];
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

  const summary = {
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

export async function handleReplenishmentAiRequest(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const horizonDays = Number(body?.horizon_days || 14);
  const lookbackDays = Number(body?.lookback_days || 30);

  // 1. Always compute reproducible deterministic intelligence first
  const baseResult = buildDeterministicDemandIntelligence(items, horizonDays, lookbackDays);

  // 2. Check for server-side GEMINI_API_KEY (never VITE_ exposed)
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || items.length === 0) {
    return baseResult;
  }

  try {
    const compactPayload = items.slice(0, 40).map((it) => ({
      item_rec_id: it.item_rec_id,
      name: it.item_name,
      category: it.item_category,
      dept: it.normalized_department || it.department,
      usable_stock: it.usable_stock,
      par_level: it.par_level,
      daily_demand: it.daily_demand,
      direct_menu_daily: it.direct_menu_daily_demand,
      dep_bom_horizon: it.dependent_bom_horizon_demand,
      days_on_hand: it.days_on_hand,
      freq_pct: it.consumption_frequency_pct,
      rec_qty: it.recommended_order_quantity,
      unit: it.base_unit,
      confidence: it.data_confidence,
      flags: it.ai_flags,
      exceptions: it.exceptions,
    }));

    const prompt = `You are the FLOW Inventory & Production Demand Intelligence analyst.
Analyze the following actual historical inventory telemetry for a ${horizonDays}-day planning horizon (${lookbackDays}-day lookback).
STRICT RULES:
1. Use ONLY the provided actual numbers. Never invent stock balances or fabricate statistics.
2. Where confidence is LOW or flags include PAR_FALLBACK_NO_HISTORY, explicitly state that history is insufficient and deterministic par-level planning is used.
3. Return JSON matching:
{
  "headline": "string",
  "highlights": ["string", "string", "string"],
  "item_explanations": { "<item_rec_id>": "concise 1-2 sentence explanation" }
}

Telemetry:
${JSON.stringify(compactPayload)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (response.ok) {
      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed.headline) {
          baseResult.summary.headline = parsed.headline;
        }
        if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
          baseResult.summary.highlights = parsed.highlights;
        }
        baseResult.summary.engine_mode = 'GEMINI_2_5_FLASH_ASSISTED';
        if (parsed.item_explanations && typeof parsed.item_explanations === 'object') {
          baseResult.item_insights = baseResult.item_insights.map((ins) => ({
            ...ins,
            ai_explanation: parsed.item_explanations[ins.item_rec_id] || ins.ai_explanation,
          }));
        }
      }
    }
  } catch (err) {
    // Gracefully retain deterministic statistical explanations if Gemini API is unreachable
    baseResult.summary.ai_fallback_note = 'Using deterministic statistical intelligence layer.';
  }

  return baseResult;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    let body = req.body;
    if (!body || typeof body === 'string') {
      body = body ? JSON.parse(body) : {};
    }
    const result = await handleReplenishmentAiRequest(body);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, data: result }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error' }));
  }
}
