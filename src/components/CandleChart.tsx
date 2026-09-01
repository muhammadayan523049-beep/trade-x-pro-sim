import { useMemo } from "react";

import {
  candlesFor,
  roundTo,
  type Candle,
  type Instrument,
  type TimeframeKey,
} from "@/lib/market-sim";

export interface IndicatorSet {
  sma: boolean;
  ema: boolean;
  bollinger: boolean;
  volume: boolean;
  rsi: boolean;
}

export const DEFAULT_INDICATORS: IndicatorSet = {
  sma: true,
  ema: false,
  bollinger: false,
  volume: true,
  rsi: false,
};

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += values[j]!;
    return sum / period;
  });
}

function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  values.forEach((v, i) => {
    if (i < period - 1) {
      out.push(null);
      return;
    }
    if (prev === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j]!;
      prev = sum / period;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out.push(prev);
  });
  return out;
}

function stdev(values: number[], period: number): (number | null)[] {
  const means = sma(values, period);
  return values.map((_, i) => {
    const mean = means[i];
    if (mean === null || mean === undefined) return null;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j += 1) acc += (values[j]! - mean) ** 2;
    return Math.sqrt(acc / period);
  });
}

function rsiSeries(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i += 1) {
    const change = values[i]! - values[i - 1]!;
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (i <= period) {
      gain += up;
      loss += down;
      out.push(i === period ? 100 - 100 / (1 + gain / (loss || 1e-9)) : null);
    } else {
      gain = (gain * (period - 1) + up) / period;
      loss = (loss * (period - 1) + down) / period;
      out.push(100 - 100 / (1 + gain / (loss || 1e-9)));
    }
  }
  return out;
}

function path(points: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  points.forEach((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)} `;
    pen = true;
  });
  return d.trim();
}

interface Props {
  instrument: Instrument;
  timeframe: TimeframeKey;
  now: number;
  indicators?: IndicatorSet;
  count?: number;
  height?: number;
}

export function CandleChart({
  instrument,
  timeframe,
  now,
  indicators = DEFAULT_INDICATORS,
  count = 80,
  height = 380,
}: Props) {
  const candles: Candle[] = useMemo(
    () => candlesFor(instrument, timeframe, count, now || 0),
    [instrument, timeframe, count, now],
  );

  const width = 1000;
  const rsiH = indicators.rsi ? 70 : 0;
  const volH = indicators.volume ? 56 : 0;
  const padTop = 14;
  const padBottom = 22;
  const gap = 10;
  const priceH = Math.max(120, height - rsiH - volH - padTop - padBottom - (rsiH ? gap : 0) - (volH ? gap : 0));

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const sma20 = useMemo(() => sma(closes, 20), [closes]);
  const ema50 = useMemo(() => ema(closes, Math.min(50, Math.max(5, Math.floor(count / 2)))), [closes, count]);
  const dev20 = useMemo(() => stdev(closes, 20), [closes]);
  const rsi = useMemo(() => rsiSeries(closes), [closes]);

  const bbUpper = sma20.map((m, i) => (m === null || dev20[i] === null ? null : m + 2 * dev20[i]!));
  const bbLower = sma20.map((m, i) => (m === null || dev20[i] === null ? null : m - 2 * dev20[i]!));

  const series: number[] = [...highs, ...lows];
  if (indicators.bollinger) {
    bbUpper.forEach((v) => v !== null && series.push(v));
    bbLower.forEach((v) => v !== null && series.push(v));
  }
  const rawMin = Math.min(...series);
  const rawMax = Math.max(...series);
  const pad = (rawMax - rawMin) * 0.08 || rawMax * 0.005 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;

  const step = width / Math.max(candles.length, 1);
  const bodyW = Math.max(2, step * 0.58);
  const x = (i: number) => i * step + step / 2;
  const y = (v: number) => padTop + priceH - ((v - min) / (max - min || 1)) * priceH;

  const volTop = padTop + priceH + (volH ? gap : 0);
  const maxVol = Math.max(...candles.map((c) => c.volume), 1);
  const rsiTop = volTop + volH + (rsiH ? gap : 0);

  const gridLines = 5;
  const last = candles[candles.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${instrument.symbol} simulated candlestick chart`}
    >
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const gy = padTop + (priceH / gridLines) * i;
        const value = max - ((max - min) / gridLines) * i;
        return (
          <g key={`g${i}`}>
            <line x1={0} x2={width} y1={gy} y2={gy} stroke="var(--border)" strokeWidth={1} />
            <text x={6} y={gy - 4} className="num" fontSize={11} fill="var(--muted-foreground)">
              {roundTo(value, instrument.digits)}
            </text>
          </g>
        );
      })}

      {indicators.bollinger && (
        <>
          <path d={path(bbUpper, x, y)} fill="none" stroke="var(--color-blue)" strokeWidth={1.2} opacity={0.7} />
          <path d={path(bbLower, x, y)} fill="none" stroke="var(--color-blue)" strokeWidth={1.2} opacity={0.7} />
        </>
      )}

      {candles.map((c, i) => {
        const up = c.close >= c.open;
        const color = up ? "var(--up)" : "var(--down)";
        const top = y(Math.max(c.open, c.close));
        const bottom = y(Math.min(c.open, c.close));
        return (
          <g key={c.time}>
            <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.1} />
            <rect
              x={x(i) - bodyW / 2}
              y={top}
              width={bodyW}
              height={Math.max(1.2, bottom - top)}
              fill={color}
              opacity={up ? 0.9 : 0.85}
              rx={1}
            />
          </g>
        );
      })}

      {indicators.sma && <path d={path(sma20, x, y)} fill="none" stroke="var(--color-amber)" strokeWidth={1.8} />}
      {indicators.ema && <path d={path(ema50, x, y)} fill="none" stroke="var(--color-blue)" strokeWidth={1.8} />}

      {last && (
        <g>
          <line
            x1={0}
            x2={width}
            y1={y(last.close)}
            y2={y(last.close)}
            stroke="var(--foreground)"
            strokeDasharray="4 4"
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={width - 6}
            y={y(last.close) - 5}
            textAnchor="end"
            fontSize={12}
            className="num"
            fill="var(--foreground)"
          >
            {roundTo(last.close, instrument.digits)}
          </text>
        </g>
      )}

      {indicators.volume &&
        candles.map((c, i) => {
          const h = (c.volume / maxVol) * (volH - 6);
          return (
            <rect
              key={`v${c.time}`}
              x={x(i) - bodyW / 2}
              y={volTop + volH - h}
              width={bodyW}
              height={Math.max(1, h)}
              fill={c.close >= c.open ? "var(--up)" : "var(--down)"}
              opacity={0.35}
            />
          );
        })}

      {indicators.rsi && (
        <g>
          <rect x={0} y={rsiTop} width={width} height={rsiH} fill="var(--muted)" opacity={0.45} rx={6} />
          {[30, 70].map((lvl) => (
            <line
              key={lvl}
              x1={0}
              x2={width}
              y1={rsiTop + rsiH - (lvl / 100) * rsiH}
              y2={rsiTop + rsiH - (lvl / 100) * rsiH}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
          ))}
          <path
            d={path(rsi, x, (v) => rsiTop + rsiH - (v / 100) * rsiH)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.6}
          />
          <text x={6} y={rsiTop + 13} fontSize={10} fill="var(--muted-foreground)">
            RSI 14
          </text>
        </g>
      )}
    </svg>
  );
}
