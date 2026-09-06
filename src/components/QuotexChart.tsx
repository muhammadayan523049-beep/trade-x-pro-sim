import { useMemo } from "react";

import { candlesFor, roundTo, type Candle, type Instrument, type TimeframeKey } from "@/lib/market-sim";

export interface TradeMarker {
  id: string;
  entry: number;
  direction: "up" | "down";
  expiresAtMs: number;
  openedAtMs: number;
}

interface Props {
  instrument: Instrument;
  timeframe: TimeframeKey;
  now: number;
  markers?: TradeMarker[];
  count?: number;
  height?: number;
  mode?: "candles" | "area";
}

/**
 * Quotex-style price chart: dark-free pastel grid, live price pill on the right
 * axis, entry lines and expiry countdown rails for every open binary trade.
 */
export function QuotexChart({
  instrument,
  timeframe,
  now,
  markers = [],
  count = 60,
  height = 420,
  mode = "candles",
}: Props) {
  const candles: Candle[] = useMemo(
    () => candlesFor(instrument, timeframe, count, now || 0),
    [instrument, timeframe, count, now],
  );

  const width = 1000;
  const axisW = 86;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - axisW;
  const plotH = Math.max(120, height - padTop - padBottom);

  // Leave room on the right for the future (expiry rails), like Quotex does.
  const futureRatio = 0.24;
  const barsW = plotW * (1 - futureRatio);

  const step = barsW / Math.max(candles.length, 1);
  const msPerBar = candles.length > 1 ? candles[1]!.time - candles[0]!.time : 60_000;
  const lastTime = candles[candles.length - 1]?.time ?? now;

  const xForTime = (t: number) => barsW - ((lastTime - t) / msPerBar) * step + step / 2;
  const x = (i: number) => i * step + step / 2;

  const values = [...candles.map((c) => c.high), ...candles.map((c) => c.low)];
  markers.forEach((m) => values.push(m.entry));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = (rawMax - rawMin) * 0.12 || rawMax * 0.004 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const y = (v: number) => padTop + plotH - ((v - min) / (max - min || 1)) * plotH;

  const bodyW = Math.max(2, step * 0.6);
  const last = candles[candles.length - 1];
  const up = last ? last.close >= last.open : true;
  const liveY = last ? y(last.close) : 0;

  const areaPath = candles.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(c.close).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${instrument.symbol} live simulated chart`}
    >
      <defs>
        <linearGradient id="qxfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--up)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--up)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: 6 }).map((_, i) => {
        const gy = padTop + (plotH / 5) * i;
        const value = max - ((max - min) / 5) * i;
        return (
          <g key={`grid${i}`}>
            <line x1={0} x2={plotW} y1={gy} y2={gy} stroke="var(--border)" strokeWidth={1} />
            <text x={plotW + 10} y={gy + 4} fontSize={13} className="num" fill="var(--muted-foreground)">
              {roundTo(value, instrument.digits)}
            </text>
          </g>
        );
      })}
      <line x1={plotW} x2={plotW} y1={0} y2={height} stroke="var(--border)" />

      {mode === "area" ? (
        <>
          <path
            d={`${areaPath} L${x(candles.length - 1).toFixed(1)} ${padTop + plotH} L${x(0).toFixed(1)} ${padTop + plotH} Z`}
            fill="url(#qxfill)"
          />
          <path d={areaPath} fill="none" stroke="var(--up)" strokeWidth={2.2} />
        </>
      ) : (
        candles.map((c, i) => {
          const bull = c.close >= c.open;
          const color = bull ? "var(--up)" : "var(--down)";
          const top = y(Math.max(c.open, c.close));
          const bottom = y(Math.min(c.open, c.close));
          return (
            <g key={c.time}>
              <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.4} />
              <rect
                x={x(i) - bodyW / 2}
                y={top}
                width={bodyW}
                height={Math.max(1.5, bottom - top)}
                fill={color}
                rx={1.5}
              />
            </g>
          );
        })
      )}

      {markers.map((m) => {
        const mx = Math.min(plotW - 4, Math.max(0, xForTime(m.expiresAtMs)));
        const ex = Math.max(0, xForTime(m.openedAtMs));
        const color = m.direction === "up" ? "var(--up)" : "var(--down)";
        return (
          <g key={m.id}>
            <line
              x1={0}
              x2={plotW}
              y1={y(m.entry)}
              y2={y(m.entry)}
              stroke={color}
              strokeDasharray="6 6"
              strokeWidth={1.4}
              opacity={0.85}
            />
            <line x1={mx} x2={mx} y1={padTop} y2={padTop + plotH} stroke={color} strokeWidth={1.6} opacity={0.7} />
            <circle cx={ex} cy={y(m.entry)} r={5} fill={color} />
          </g>
        );
      })}

      {last && (
        <g>
          <line
            x1={0}
            x2={plotW}
            y1={liveY}
            y2={liveY}
            stroke={up ? "var(--up)" : "var(--down)"}
            strokeDasharray="5 5"
            strokeWidth={1.3}
          />
          <rect
            x={plotW + 2}
            y={liveY - 15}
            width={axisW - 6}
            height={30}
            rx={7}
            fill={up ? "var(--up)" : "var(--down)"}
          />
          <text
            x={plotW + axisW / 2}
            y={liveY + 5}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            className="num"
            fill="var(--primary-foreground)"
          >
            {roundTo(last.close, instrument.digits)}
          </text>
        </g>
      )}
    </svg>
  );
}
