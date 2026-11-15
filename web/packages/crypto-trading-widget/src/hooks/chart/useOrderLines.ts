import { useEffect } from "react";
import { LineStyle, type ISeriesApi } from "lightweight-charts";

import type { ChartColors } from "../../styles/chartColors";
import type { OpenOrder } from "../../types/backend";
import { orderLineTitle } from "../../utils/chartOverlays";

/** A dashed horizontal line at the price of every open order; green for buys, red for sells. */
export function useOrderLines(
  series: ISeriesApi<"Candlestick"> | null,
  orders: OpenOrder[] | undefined,
  colors: ChartColors,
): void {
  useEffect(() => {
    if (!series || !orders?.length) return;
    const lines = orders.map((order) =>
      series.createPriceLine({
        price: order.price,
        color: order.side === "BUY" ? colors.up : colors.down,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: orderLineTitle(order),
      }),
    );
    return () => lines.forEach((line) => series.removePriceLine(line));
  }, [series, orders, colors]);
}
