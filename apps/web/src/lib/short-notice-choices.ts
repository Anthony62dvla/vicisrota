/** Notice periods a business can choose for short-notice pay, in hours. Kept apart from the server code so forms can use them. */
export const NOTICE_HOUR_CHOICES = [24, 48, 72, 96, 168] as const;
/** Shares of lost pay a business can choose to pay, 100 = full pay. */
export const PAY_PERCENT_CHOICES = [100, 75, 50] as const;
