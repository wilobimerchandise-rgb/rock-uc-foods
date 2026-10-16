export type Kobo = bigint;

export const MAX_KOBO = 100000000000n; // 1 Billion Naira cap

export function formatNaira(kobo: Kobo): string {
  const naira = Number(kobo) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira).replace('NGN', '₦').trim();
}

export function parseNairaToKobo(input: string): { ok: true; kobo: Kobo } | { ok: false; error: string } {
  if (!input || typeof input !== 'string') {
    return { ok: false, error: 'Invalid input: must be a non-empty string' };
  }

  const cleaned = input.replace(/,/g, '').replace(/\s/g, '');
  const match = cleaned.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return { ok: false, error: `Invalid currency format: "${input}". Use digits with up to 2 decimal places.` };
  }

  const isNegative = match[1] === '-';
  const wholePartStr = match[2] ?? '0';
  const decimalPartStr = match[3] ? match[3].padEnd(2, '0') : '00';
  
  if (isNegative) {
    return { ok: false, error: 'Negative amounts are not allowed' };
  }

  const wholePart = BigInt(wholePartStr);
  const decimalPart = BigInt(decimalPartStr);
  const totalKobo = (wholePart * 100n) + decimalPart;

  if (totalKobo > MAX_KOBO) {
    return { ok: false, error: 'Amount exceeds maximum allowed value' };
  }

  return { ok: true, kobo: totalKobo };
}

export function applyPercentRoundHalfUp(kobo: Kobo, basisPoints: number): Kobo {
  if (basisPoints < 0) throw new Error('Basis points cannot be negative');
  return (kobo * BigInt(basisPoints) + 5000n) / 10000n;
}

export function percentOfBps(kobo: Kobo, bps: number): Kobo {
  return applyPercentRoundHalfUp(kobo, bps);
}
