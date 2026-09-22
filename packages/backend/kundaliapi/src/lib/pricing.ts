import type { ReportType } from "./store.js";

export interface ReportPricing {
  /** Amount actually charged at checkout, in INR. */
  amount: number;
  /** Display (list) price, in INR. */
  listPrice: number;
  /** Display discounted price, in INR. */
  discountPrice: number;
}

/**
 * Single source of truth for report pricing. Keep in sync with the frontend
 * by serving these values through /api/config/:reportType.
 */
export const REPORT_PRICING: Record<ReportType, ReportPricing> = {
  financial_kundali: { amount: 199, listPrice: 199, discountPrice: 199 },
  match_kundali: { amount: 299, listPrice: 299, discountPrice: 299 },
};

/**
 * Amount to charge for a report. Per-type env override wins:
 *   REPORT_PRICE_FINANCIAL_KUNDALI / REPORT_PRICE_MATCH_KUNDALI
 */
export function getReportAmount(reportType: ReportType): number {
  const override = Number(process.env[`REPORT_PRICE_${reportType.toUpperCase()}`]);
  if (Number.isFinite(override) && override > 0) return override;
  return (REPORT_PRICING[reportType] ?? REPORT_PRICING.financial_kundali).amount;
}
