/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly PUBLIC_API_URL?: string;
  readonly PUBLIC_META_PIXEL_ID?: string;
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_GOOGLE_ADS_ID?: string;
  readonly PUBLIC_GOOGLE_ADS_LEAD_LABEL?: string;
  readonly PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL?: string;
  readonly PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?: string;
  readonly PUBLIC_CLARITY_PROJECT_ID?: string;
  readonly PUBLIC_GOOGLE_MAPS_API_KEY?: string;
}
