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

  financial_kundali: {
    amount: 249,
    listPrice: 999,
    discountPrice: 249,
  },

  marriage_kundali: {
    amount: 249,
    listPrice: 999,
    discountPrice: 249,
  },

  career_kundali: {
    amount: 249,
    listPrice: 999,
    discountPrice: 249,
  },

  dosha_report: {
    amount: 199,
    listPrice: 799,
    discountPrice: 199,
  },

  match_kundali: {
    amount: 299,
    listPrice: 1499,
    discountPrice: 299,
  },

  health_kundali: {
    amount: 249,
    listPrice: 999,
    discountPrice: 249,
  },

};

/**
 * Amount to charge for a report. Live values come from Mongo (`pricing`
 * collection) via `getReportAmount` in `pricing-store.ts`; this static map is
 * the seed/fallback. Per-type env override (`REPORT_PRICE_<TYPE>`) still wins.
 */

