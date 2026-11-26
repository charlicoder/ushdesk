/**
 * Shared proportional discount helpers for ushdesk.
 * Mirrors ushbooknpay/app/common/discount_utils.py with exact 3-decimal (KWD) math.
 */

export interface ProportionalItem {
  originalPrice: number;
  discountAmount: number;
  discountedPrice: number;
}

export function round3(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

export function fmtKwd3(n: number): string {
  return round3(n).toFixed(3);
}

export function parseDiscountRequesters(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

export function getClientDiscountRequesters(): string[] {
  return parseDiscountRequesters(process.env.NEXT_PUBLIC_DISCOUNT_REQUESTED_BY);
}

/**
 * Validate a discount amount and requester selection.
 * Rules:
 *  - discount must be >= 0
 *  - if discount > 0, discount MUST be strictly less than subtotal
 *  - if discount > 0, a requester name MUST be selected from the .env list
 */
export function validateDiscountInput(
  subtotal: number,
  discount: number,
  requestedBy: string,
): { valid: boolean; error: string | null } {
  const sub = round3(Math.max(0, subtotal || 0));
  const disc = round3(Math.max(0, discount || 0));
  if (disc <= 0) {
    return { valid: true, error: null };
  }
  if (!requestedBy.trim()) {
    return {
      valid: false,
      error: 'Select who requested the discount before applying a discount.',
    };
  }
  if (sub <= 0 || disc >= sub) {
    return {
      valid: false,
      error: `Discount must be less than the total payment amount (${fmtKwd3(sub)} KWD).`,
    };
  }
  return { valid: true, error: null };
}

/**
 * Proportionally allocate `discount` across `amounts` with 0.001 KWD penny
 * reconciliation on the largest item so:
 *   sum(discountAmount) === discount
 *   sum(discountedPrice) === sum(amounts) - discount
 */
export function allocateProportionalDiscount(
  amounts: number[],
  discount: number,
): ProportionalItem[] {
  const orig = amounts.map((a) => round3(Math.max(0, Number(a) || 0)));
  const total = round3(orig.reduce((s, a) => s + a, 0));
  let disc = round3(Math.max(0, Number(discount) || 0));

  if (disc <= 0 || total <= 0) {
    return orig.map((p) => ({
      originalPrice: p,
      discountAmount: 0,
      discountedPrice: p,
    }));
  }

  if (disc >= total) {
    disc = round3(Math.max(0, total - 0.001));
  }

  const shares = orig.map((amt) => {
    if (amt <= 0) return 0;
    return Math.min(amt, round3((amt * disc) / total));
  });

  const shareSum = round3(shares.reduce((s, x) => s + x, 0));
  const diff = round3(disc - shareSum);
  if (diff !== 0) {
    let largestIdx = -1;
    let largestVal = -1;
    orig.forEach((amt, i) => {
      if (amt > largestVal) {
        largestVal = amt;
        largestIdx = i;
      }
    });
    if (largestIdx >= 0) {
      const adjusted = round3(shares[largestIdx] + diff);
      if (adjusted >= 0 && adjusted <= orig[largestIdx]) {
        shares[largestIdx] = adjusted;
      }
    }
  }

  return orig.map((p, i) => {
    const dAmt = shares[i];
    return {
      originalPrice: p,
      discountAmount: dAmt,
      discountedPrice: round3(Math.max(0, p - dAmt)),
    };
  });
}
