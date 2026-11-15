# @elkhanmursalov/crypto-trading-widget

Live crypto candlestick chart for React and Next.js. It shows a crosshair, volume, interval buttons, and the trading bot's open orders, execution history, position and status.

## Install (Next.js app)

GitHub Packages asks for a token even to install. Create a GitHub personal access token (classic) with only the `read:packages` scope. Set it as `GITHUB_TOKEN` on your machine and on the host that builds the app.

`.npmrc` in the app's root:

```
@elkhanmursalov:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```sh
pnpm add @elkhanmursalov/crypto-trading-widget lightweight-charts
```

## Use

All props are optional. The smallest setup is the bare chart:

```tsx
import { TradingWidget } from "@elkhanmursalov/crypto-trading-widget";
import "@elkhanmursalov/crypto-trading-widget/style.css";

export default function Page() {
  return <TradingWidget />;
}
```

With the bot's orders, history and status:

```tsx
<TradingWidget apiBaseUrl={process.env.NEXT_PUBLIC_API_URL} theme="dark" />
```

- Import `style.css` once, for example in the page or in `app/layout.tsx`. Without it the widget has no styling.
- You can render the widget straight from an App Router page (a server component), because the package is already marked `"use client"`.
- `NEXT_PUBLIC_API_URL` is the backend's URL, set in the app's `.env.local`: `NEXT_PUBLIC_API_URL=https://api.example.com`.
- The backend only accepts browsers from the origins in its `CORS_ORIGINS` variable, so add the app's origins there. Separate them with commas; each is the full origin with no trailing slash: `CORS_ORIGINS=http://localhost:3000,https://app-one.com,https://app-two.com`.
- The widget fills the width of its parent element. Its height is the chart height plus the header and the orders panel.

## Props

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `apiBaseUrl` | `string` | none | Backend URL. Adds the bot badge and the orders panel (open orders, execution history). Without it the widget shows only the chart. |
| `theme` | `"light" \| "dark" \| "auto"` | `"light"` | Colour scheme. `"auto"` follows the visitor's system setting. The widget has no theme switch of its own. |
| `symbol` | `string` | `"BTCUSDT"` | Binance symbol. Prices are shown with 2 decimals. |
| `defaultInterval` | `Interval` | `"1h"` | Interval selected at first. `Interval` is `"1m"`, `"5m"`, `"15m"`, `"30m"`, `"1h"`, `"4h"` or `"1d"`. |
| `intervals` | `Interval[]` | `["1m", "5m", "15m", "1h", "4h", "1d"]` | Interval buttons in the header, in this order (exported as `DEFAULT_INTERVALS`). |
| `onIntervalChange` | `(interval: Interval) => void` | none | Called when the user picks another interval. |
| `chartHeight` | `number` | `480` | Chart height in pixels (price and volume panes). |
| `historyLimit` | `number` | `500` | Candles loaded at first (max 1000). Older ones load when the user scrolls left. |
| `className` | `string` | none | Extra class on the root element, e.g. for margins. |
| `restUrl` | `string` | Binance | Override for the Binance REST base URL. |
| `streamUrl` | `string` | Binance | Override for the Binance WebSocket base URL. |

The SMA lines show only on the interval the bot trades (`1h`). The types `TradingWidgetProps`, `Interval`, `Theme` and the backend data shapes are exported too.

## Test locally without publishing

Build the package and pack it into a `.tgz` file. That file is exactly what GitHub Packages would serve.

```sh
# in trading-bot/web
pnpm build
pnpm --filter @elkhanmursalov/crypto-trading-widget pack --pack-destination ~/Desktop
```

The build output lands in `web/packages/crypto-trading-widget/dist/`. It is git-ignored, so the editor may grey it out. Run `pack` for this package only. The `web/` workspace has no version, so `pnpm pack` run in `web/` fails.

Install the file in the Next.js app. You don't need the `.npmrc` or a token for this.

```sh
pnpm add ~/Desktop/elkhanmursalov-crypto-trading-widget-0.1.0.tgz lightweight-charts
```

After changing the widget, build and pack again, then reinstall with `--force` if the version number is unchanged. Also add the app's local address (e.g. `http://localhost:3000`) to the backend's `CORS_ORIGINS`.

## Release (maintainer)

1. Bump `version` in this package's `package.json`.
2. Commit, then tag `widget-v<version>` (e.g. `widget-v0.1.1`) and push the tag.
3. The `Publish widget` GitHub Action builds and publishes it.
