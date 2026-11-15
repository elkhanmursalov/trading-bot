const priceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const volumeFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

export function formatPrice(value: number): string {
  return priceFormat.format(value);
}

export function formatVolume(value: number): string {
  return volumeFormat.format(value);
}

/** "2026-11-15 14:00" in UTC, from seconds since epoch. */
export function formatTimeUtc(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ");
}

/** Change from open to close in percent, with sign: "+0.42%". */
export function formatChange(open: number, close: number): string {
  const change = ((close - open) / open) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}
