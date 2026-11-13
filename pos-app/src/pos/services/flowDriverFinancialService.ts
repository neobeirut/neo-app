/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Authoritative Driver Financial Breakdown Engine (Frontend TypeScript)
 */

export interface DriverFinancialBreakdown {
  netFoodAmount: number;
  foodAmountAlreadyPaid: number;
  deliveryFeeCharged: number;
  deliveryFeeAlreadyPaid: number;
  deliveryFeePayableToDriver: number;
  remainingFoodDue: number;
  remainingDeliveryFeeDue: number;
  totalCustomerCollect: number;
  amountDueDriverToCashier: number;
  driverRetainsFromCash: number;
  amountOwedRestaurantToDriver: number;
  paymentInstruction: string;
}

export function calculateDriverFinancialObligations(order: any): DriverFinancialBreakdown {
  if (!order) {
    return {
      netFoodAmount: 0,
      foodAmountAlreadyPaid: 0,
      deliveryFeeCharged: 0,
      deliveryFeeAlreadyPaid: 0,
      deliveryFeePayableToDriver: 0,
      remainingFoodDue: 0,
      remainingDeliveryFeeDue: 0,
      totalCustomerCollect: 0,
      amountDueDriverToCashier: 0,
      driverRetainsFromCash: 0,
      amountOwedRestaurantToDriver: 0,
      paymentInstruction: 'No order details available'
    };
  }

  // 1. Authoritative Revenue & Discount Components
  const grossSubtotal = Number(order.subtotalAmount ?? order.subtotal_amount ?? order.subtotal ?? 0);
  const discountAmount = Number(order.discountAmount ?? order.discount_amount ?? order.discount ?? 0);
  const netFoodAmount = Math.max(0, grossSubtotal - discountAmount);

  const deliveryFeeCharged = Number(order.deliveryFee ?? order.delivery_fee ?? 0);
  const driverRate = Number(order.driverCompensationFee ?? order.driver_fee ?? deliveryFeeCharged);

  const amountPaidTotal = Number(order.amountPaid ?? order.amount_paid ?? 0);
  const paymentStatus = String(order.paymentStatus ?? order.payment_status ?? 'unpaid').toLowerCase();

  // If order marked fully paid legacy or paid
  const isFullyPrepaid = paymentStatus === 'paid' || 
                         paymentStatus === 'paid_legacy' || 
                         amountPaidTotal >= (netFoodAmount + deliveryFeeCharged);

  let foodPaid = 0;
  let deliveryFeePaid = 0;

  if (isFullyPrepaid) {
    foodPaid = netFoodAmount;
    deliveryFeePaid = deliveryFeeCharged;
  } else if (amountPaidTotal > 0) {
    foodPaid = Math.min(amountPaidTotal, netFoodAmount);
    deliveryFeePaid = Math.min(Math.max(0, amountPaidTotal - foodPaid), deliveryFeeCharged);
  }

  // 2. Remaining Dues from Customer
  const remainingFoodDue = Math.max(0, netFoodAmount - foodPaid);
  const remainingDeliveryFeeDue = Math.max(0, deliveryFeeCharged - deliveryFeePaid);
  const totalCustomerCollect = remainingFoodDue + remainingDeliveryFeeDue;

  // 3. Obligations at Pickup Counter (Driver to Cashier)
  const amountDueDriverToCashier = remainingFoodDue;

  // 4. Delivery Compensation Settlement (Restaurant to Driver)
  let amountOwedRestaurantToDriver = 0;
  let driverRetainsFromCash = 0;

  if (remainingDeliveryFeeDue >= driverRate) {
    driverRetainsFromCash = driverRate;
    amountOwedRestaurantToDriver = 0;
  } else {
    driverRetainsFromCash = remainingDeliveryFeeDue;
    amountOwedRestaurantToDriver = Math.max(0, driverRate - driverRetainsFromCash);
  }

  // 5. Payment Instruction Directives
  let paymentInstruction = '';
  if (totalCustomerCollect === 0) {
    paymentInstruction = 'DO NOT COLLECT CASH (Order fully prepaid online)';
  } else if (remainingFoodDue === 0 && remainingDeliveryFeeDue > 0) {
    paymentInstruction = `COLLECT DELIVERY FEE ONLY ($${remainingDeliveryFeeDue.toFixed(2)} in cash)`;
  } else if (foodPaid > 0 && remainingFoodDue > 0) {
    paymentInstruction = `COLLECT REMAINING BALANCE ($${totalCustomerCollect.toFixed(2)} in cash; $${amountPaidTotal.toFixed(2)} deposit was paid online)`;
  } else {
    paymentInstruction = `COLLECT CASH ON DELIVERY ($${totalCustomerCollect.toFixed(2)} in cash)`;
  }

  return {
    netFoodAmount,
    foodAmountAlreadyPaid: foodPaid,
    deliveryFeeCharged,
    deliveryFeeAlreadyPaid: deliveryFeePaid,
    deliveryFeePayableToDriver: driverRate,
    remainingFoodDue,
    remainingDeliveryFeeDue,
    totalCustomerCollect,
    amountDueDriverToCashier,
    driverRetainsFromCash,
    amountOwedRestaurantToDriver,
    paymentInstruction
  };
}
