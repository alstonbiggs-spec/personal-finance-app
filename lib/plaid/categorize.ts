export type Bucket = 'needs' | 'wants' | 'joint' | 'savings';

const TRANSFER_PATTERN = /\b(transfer|xfer|acct\s?to\s?acct|funds transfer|online transfer|mobile transfer|internal transfer|savings transfer)\b/i;
const TRANSFER_PLAID_CATEGORIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT']);
// Credit card statement payments — money is moving to pay off a card, not new spending.
const CARD_PAYMENT_PATTERN = /(amex|american express|discover|chase|citi(bank)?|capital one|synchrony|wells fargo|bank of america|\bboa\b)\b.*(epayment|e-payment|payment|pymt|pmt)/i;
// Brokerage/investment transfers — money moving into an investment account, not spending.
const BROKERAGE_PATTERN = /(fidelity|vanguard|charles schwab|\bschwab\b|e\s?\*?\s?trade|robinhood|td ameritrade|merrill( lynch)?|morgan stanley|wealthfront|betterment|acorns)/i;
// Institutions that represent an actual long-term savings/investment vehicle (brokerage,
// retirement, HSA, high-yield savings) — as opposed to an everyday checking or savings
// account. A deposit into one of these is what counts toward "money saved."
const SAVINGS_VEHICLE_PATTERN = /(fidelity|vanguard|charles schwab|\bschwab\b|e\s?\*?\s?trade|robinhood|td ameritrade|merrill( lynch)?|morgan stanley|wealthfront|betterment|acorns|\bally\b|\bhsa\b|\b401\s?\(?k\)?\b|\bhysa\b|empower|principal)/i;

const GROCERY_PATTERN = /(kroger|walmart|wal-mart|target|publix|safeway|whole foods|trader joe|aldi|\bheb\b|h-e-b|winn-dixie|food lion|giant eagle|wegmans|costco|sam'?s club|sprouts|grocery)/i;
const GAS_PATTERN = /(shell|chevron|exxon|\bmobil\b|\bbp\b|texaco|conoco|phillips 66|marathon|circle k|quiktrip|racetrac|wawa|sheetz|speedway|valero|sunoco|gas station|\bfuel\b)/i;
const AMAZON_PATTERN = /\bamazon\b|\bamzn\b/i;
const NETFLIX_PATTERN = /netflix/i;
const SUBSCRIPTION_PATTERN = /(spotify|hulu|disney\+|disney plus|apple\.com\/bill|hbo max|paramount\+|youtube premium|audible|proton\s?(mail|vpn|duo)?)/i;
const GYM_PATTERN = /(planet fitness|la fitness|anytime fitness|24 hour fitness|\bymca\b|lifetime fitness|equinox|orangetheory|crunch fitness|\bgym\b)/i;
const RESTAURANT_PATTERN = /(mcdonald|starbucks|chipotle|chick-fil-a|wendy|burger king|taco bell|subway|panera|dunkin|pizza|doordash|uber eats|grubhub|postmates)/i;
const TRAVEL_PATTERN = /(delta|united airlines|american airlines|southwest|expedia|airbnb|marriott|hilton|hotel|\buber\b(?!\s?eats)|\blyft\b)/i;

export function isTransfer(name: string, originalDescription: string, plaidPrimaryCategory?: string | null): boolean {
  if (plaidPrimaryCategory && TRANSFER_PLAID_CATEGORIES.has(plaidPrimaryCategory)) return true;
  const text = `${name} ${originalDescription}`;
  return TRANSFER_PATTERN.test(text) || CARD_PAYMENT_PATTERN.test(text) || BROKERAGE_PATTERN.test(text);
}

export function matchSubcategoryName(name: string, originalDescription: string, bucket: Bucket): string | null {
  const text = `${name} ${originalDescription}`;
  if (GROCERY_PATTERN.test(text)) return 'Groceries';
  if (GAS_PATTERN.test(text)) return 'Gas / Tolls';
  if (AMAZON_PATTERN.test(text)) return 'Amazon';
  if (NETFLIX_PATTERN.test(text)) return 'Netflix';
  if (SUBSCRIPTION_PATTERN.test(text)) return 'Subscribtions';
  if (GYM_PATTERN.test(text)) return 'Gym';
  if (TRAVEL_PATTERN.test(text)) return bucket === 'wants' ? 'Travel' : null;
  if (RESTAURANT_PATTERN.test(text)) return bucket === 'wants' ? 'Dining' : 'Eating Out';
  return null;
}

export function parentCategoryForBucket(bucket: string): 'needs' | 'wants' | 'savings' {
  if (bucket === 'wants') return 'wants';
  if (bucket === 'savings') return 'savings';
  return 'needs';
}

export function isSavingsVehicleInstitution(institution: string): boolean {
  return SAVINGS_VEHICLE_PATTERN.test(institution);
}

// Deposits (money in) need their own classification, separate from spend: a credit-card
// credit is a payment/refund artifact (never income), a deposit into a real savings
// vehicle is money saved, and everything else landing in the household's needs account
// is treated as income (paychecks). Deposits into a personal wants-bucket checking
// account (Venmo, Zelle, interest) are left uncategorized, same as today.
export function categorizeDeposit(account: { accountType: string; institution: string; bucket: string }): 'income' | 'savings' | null {
  if (account.accountType === 'credit') return null;
  if (isSavingsVehicleInstitution(account.institution)) return 'savings';
  if (account.bucket === 'needs') return 'income';
  return null;
}
