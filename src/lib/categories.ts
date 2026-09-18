/**
 * Stable category keys shared between the database (Category.key),
 * navigation, and translation message files (Categories.*). Keeping
 * this list centralized avoids typos between the nav, filters and seed
 * script.
 */
export const CATEGORY_KEYS = ["sweets", "cakes", "desserts", "gift-boxes"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_NAV_MESSAGE_KEY: Record<CategoryKey, "sweets" | "cakes" | "desserts" | "giftBoxes"> = {
  sweets: "sweets",
  cakes: "cakes",
  desserts: "desserts",
  "gift-boxes": "giftBoxes",
};
