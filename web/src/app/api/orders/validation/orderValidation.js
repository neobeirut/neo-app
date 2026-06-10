import { corsJson } from "@/app/api/utils/cors";

export function validateOrderBasics({
  request,
  items,
  order_type,
  scheduled_date,
  scheduled_time,
  branch_id,
  applied_reward_id,
  applied_user_reward_id,
}) {
  if (applied_reward_id && applied_user_reward_id) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Only one reward can be applied per order",
          code: "MULTIPLE_REWARDS_NOT_ALLOWED",
        },
        { status: 400 },
      ),
    };
  }

  if (!items || items.length === 0) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Order must contain at least one item" },
        { status: 400 },
      ),
    };
  }

  if (!order_type || !["delivery", "pickup"].includes(order_type)) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Order type must be delivery or pickup" },
        { status: 400 },
      ),
    };
  }

  if (!scheduled_date || !scheduled_time) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Scheduled date and time are required" },
        { status: 400 },
      ),
    };
  }

  if (!branch_id) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Branch ID is required" },
        { status: 400 },
      ),
    };
  }

  return { ok: true };
}
