// Fixed choices for the team admin forms. Shared by the server (validation)
// and the page (dropdowns), so the two can't drift apart.

export const CURRENCIES = ["CAD", "USD"] as const;

export const ITEM_CATEGORIES = [
  "Electrical",
  "Control system",
  "Motors & motor controllers",
  "Pneumatics",
  "Mechanical",
  "Raw stock (tube, plate, shaft)",
  "Fasteners & hardware",
  "Bumpers",
  "Tools",
  "Game pieces & field elements",
  "Safety",
  "Outreach & merch",
  "Shop supplies",
  "Other",
] as const;

export const ITEM_SOURCES = ["retail", "team"] as const;
export const ITEM_SOURCE_LABELS: Record<(typeof ITEM_SOURCES)[number], string> = {
  retail: "Retail / vendor",
  team: "Another team",
};

export const CONDITIONS = ["New", "Like new", "Used", "Needs repair"] as const;

export const PAYMENT_METHODS = [
  "Team card",
  "Personal card (reimburse)",
  "E-transfer",
  "Cash",
  "Cheque",
  "Online (PayPal / Stripe)",
  "Other",
] as const;

export const EXPENSE_CATEGORIES = [
  "Rent / workspace",
  "Competition & event fees",
  "FIRST registration",
  "Travel & transportation",
  "Accommodation",
  "Food",
  "Software & subscriptions",
  "Shipping & duties",
  "Printing & signage",
  "Outreach & events",
  "Insurance",
  "Bank & payment fees",
  "Other",
] as const;

export const RECURRENCE = ["One-time", "Monthly", "Yearly", "Per event"] as const;

export const INCOME_TYPES = ["Grant", "Sponsorship", "Donation", "Fundraiser", "Other"] as const;

export const INCOME_STATUSES = ["Applied", "Pledged", "Received", "Declined"] as const;

export const MEMBER_ROLES = ["Student", "Mentor", "Alumni", "Parent volunteer", "Other"] as const;

export const FEE_METHODS = ["E-transfer", "Cash", "Cheque", "Card", "Other"] as const;
