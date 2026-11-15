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

const quantityFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
});

/** Coin amount with up to 8 decimals and no trailing zeros, so small BTC amounts stay visible. */
export function formatQuantity(value: number): string {
  return quantityFormat.format(value);
}

/** "15:00" in UTC, from seconds since epoch. */
export function formatClockUtc(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(11, 16);
}

/** Decimals shown per asset; coins use 8 (the smallest BTC unit), stablecoins 2. */
const ASSET_DECIMALS: Record<string, number> = { BTC: 8, ETH: 8, BNB: 8, USDT: 2, USDC: 2, FDUSD: 2 };
const DEFAULT_ASSET_DECIMALS = 8;

/** Amount with the asset's fixed decimals and its name: "0.00000000 BTC", "0.10 USDT". */
export function formatAssetAmount(value: number, asset: string): string {
  const decimals = ASSET_DECIMALS[asset] ?? DEFAULT_ASSET_DECIMALS;
  const text = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${text} ${asset}`.trim();
}

/** "Price (USDT)"; plain "Price" when no asset name is known. */
export function withUnit(label: string, unit: string): string {
  return unit ? `${label} (${unit})` : label;
}
