export const MAX_KOBO = 100000000000n; // 1 Billion Naira cap

export function formatNaira(kobo: bigint): string {
  const naira = Number(kobo) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira).replace('NGN', '₦').trim();
}

export function parseNairaToKobo(input: string): bigint {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: must be a non-empty string');
  }

  // Remove commas and spaces
  const cleaned = input.replace(/,/g, '').replace(/\s/g, '');
  
  // Validate format: optional minus (rejected later), digits, optional decimal with 1-2 digits
  const match = cleaned.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new Error(`Invalid currency format: "${input}". Use digits with up to 2 decimal places.`);
  }

  const isNegative = match[1] === '-';
  const wholePart = BigInt(match[2]);
  const decimalPart = match[3] ? BigInt(match[3].padEnd(2, '0')) : 0n;

  if (isNegative) {
    throw new Error('Negative amounts are not allowed');
  }

  const totalKobo = (wholePart * 100n) + decimalPart;

  if (totalKobo > MAX_KOBO) {
    throw new Error(`Amount exceeds maximum allowed value`);
  }

  return totalKobo;
}

export function applyPercentRoundHalfUp(kobo: bigint, basisPoints: number): bigint {
  if (basisPoints < 0) throw new Error('Basis points cannot be negative');
  // Formula: (kobo * bps + 5000) / 10000
  // 5000 is half of 10000, achieving "round half up"
  return (kobo * BigInt(basisPoints) + 5000n) / 10000n;
}
