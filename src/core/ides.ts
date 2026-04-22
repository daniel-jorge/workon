export const AVAILABLE_IDES = ["code", "code-insiders"] as const;
export type IDE = (typeof AVAILABLE_IDES)[number];
