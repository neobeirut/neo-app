/** Split total change between dollars returned and the remaining Lebanese pounds. */
export function splitCashChange(change: number, currency: 'USD' | 'LBP', dollars: number, rate: number) {
  if (![change, dollars, rate].every(Number.isFinite) || change < 0 || dollars < 0 || rate <= 0) {
    return { valid: false, remainingLbp: 0, error: 'Enter a valid, non-negative cash returned amount.' };
  }
  const returnedCents = Math.round(dollars * 100);
  if (Math.abs(dollars * 100 - returnedCents) > 0.000001) {
    return { valid: false, remainingLbp: 0, error: 'Use no more than two decimal places for dollars.' };
  }
  const remainder = currency === 'USD'
    ? (Math.round(change * 100) - returnedCents) * rate / 100
    : Math.round(change) - returnedCents * rate / 100;
  if (remainder < -0.000001) return { valid: false, remainingLbp: 0, error: 'Cash returned in USD exceeds the total change due.' };
  return { valid: true, remainingLbp: Math.round(Math.max(0, remainder)), error: '' };
}
