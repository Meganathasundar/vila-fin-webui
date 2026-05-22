/**
 * Reducing balance EMI calculation.
 * Returns monthly EMI amount, or 0 if inputs are invalid.
 */
export function calculateEMI(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): number {
  if (principal <= 0 || annualRatePercent <= 0 || tenureMonths <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  const n = tenureMonths;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi * 100) / 100;
}

export function calculateTotalPayable(emi: number, tenureMonths: number): number {
  return Math.round(emi * tenureMonths * 100) / 100;
}

export function calculateTotalInterest(
  principal: number,
  emi: number,
  tenureMonths: number
): number {
  return Math.round((calculateTotalPayable(emi, tenureMonths) - principal) * 100) / 100;
}
