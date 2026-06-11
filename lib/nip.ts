export function cleanNip(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** Walidacja sumy kontrolnej NIP */
export function isValidNip(raw: string): boolean {
  const nip = cleanNip(raw);
  if (nip.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  return sum % 11 === Number(nip[9]);
}

/** Zaokrąglenie przychodu do pełnego tysiąca PLN */
export function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}
