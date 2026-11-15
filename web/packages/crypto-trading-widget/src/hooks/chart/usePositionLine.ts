import { useEffect, useRef } from "react";
import { LineStyle, type IPriceLine, type ISeriesApi } from "lightweight-charts";

import type { ChartColors } from "../../styles/chartColors";
import type { Position } from "../../types/backend";
import { positionLineTitle, positionPnl } from "../../utils/chartOverlays";

/**
 * A solid line at the entry price of the open position. Its label shows the profit or loss
 * at the latest price and updates on every price tick; green in profit, red in loss.
 */
export function usePositionLine(
  series: ISeriesApi<"Candlestick"> | null,
  position: Position | undefined,
  lastPrice: number | null,
  quote: string,
  colors: ChartColors,
): void {
  const lineRef = useRef<IPriceLine | null>(null);
  const entryPrice = position?.in_position ? position.entry_price : null;

  // Draw the line while there is a position; remove it when the position closes.
  useEffect(() => {
    if (!series || entryPrice === null) return;
    const line = series.createPriceLine({
      price: entryPrice,
      color: colors.text,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "Position",
    });
    lineRef.current = line;
    return () => {
      series.removePriceLine(line);
      lineRef.current = null;
    };
  }, [series, entryPrice, colors]);

  // Refresh the profit/loss label with the latest price.
  useEffect(() => {
    const line = lineRef.current;
    if (!line || !position || entryPrice === null || lastPrice === null) return;
    const pnl = positionPnl(position.quantity, entryPrice, lastPrice);
    line.applyOptions({
      title: positionLineTitle(pnl, quote),
      color: pnl.amount >= 0 ? colors.up : colors.down,
    });
  }, [series, position, entryPrice, lastPrice, quote, colors]);
}
