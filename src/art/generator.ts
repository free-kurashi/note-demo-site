import { mulberry32 } from "./rng";

export interface Stroke {
  pts: [number, number][]; // 0..1 の正規化座標
  width: number; // 短辺に対する比率
  hue: number;
  sat: number;
  light: number;
  alpha: number;
  dots: [number, number, number][]; // x, y, r
}

export interface Work {
  id: string;
  seed: number;
  hue: number;
  strokes: Stroke[];
}

const BASE_STROKES = 16;

export function makeStrokes(seed: number, hue: number, n: number, spread = 1): Stroke[] {
  const rnd = mulberry32(seed);
  const out: Stroke[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0.5 + (rnd() - 0.5) * 0.9 * spread;
    let y = 0.5 + (rnd() - 0.5) * 0.9 * spread;
    let ang = rnd() * Math.PI * 2;
    const curve = (rnd() - 0.5) * 0.22;
    const len = 26 + Math.floor(rnd() * 22);
    const step = 0.006 + rnd() * 0.008;
    const pts: [number, number][] = [];
    for (let k = 0; k < len; k++) {
      pts.push([x, y]);
      ang += curve + (rnd() - 0.5) * 0.08;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
    }
    const dots: [number, number, number][] = [];
    const dotCount = Math.floor(rnd() * 4);
    for (let d = 0; d < dotCount; d++) {
      const p = pts[Math.floor(rnd() * pts.length)];
      dots.push([p[0] + (rnd() - 0.5) * 0.05, p[1] + (rnd() - 0.5) * 0.05, 0.004 + rnd() * 0.012]);
    }
    out.push({
      pts,
      width: 0.004 + rnd() * 0.016,
      hue: (hue + (rnd() - 0.5) * 50 + 360) % 360,
      sat: 55 + rnd() * 35,
      light: 58 + rnd() * 22,
      alpha: 0.35 + rnd() * 0.4,
      dots,
    });
  }
  return out;
}

export function createWork(id: string, seed: number, hue: number): Work {
  return { id, seed, hue, strokes: makeStrokes(seed, hue, BASE_STROKES) };
}

/** 循環イベント(購入/チップ)で加わる「一筆」。金額が大きいほど筆数が増える。 */
export function brushFor(work: Work, eventSeed: number, amount: number): Stroke[] {
  const n = Math.min(6, 1 + Math.floor(amount / 1500));
  const strokes = makeStrokes(eventSeed, work.hue + 18, n, 0.8);
  work.strokes.push(...strokes);
  return strokes;
}

/** 0..1 の範囲 [t0, t1] だけ描画する。アニメーション用。 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  w: number,
  h: number,
  t0 = 0,
  t1 = 1,
  alphaScale = 1,
): void {
  const m = Math.min(w, h);
  const last = s.pts.length - 1;
  const i0 = Math.floor(t0 * last);
  const i1 = Math.min(last, Math.ceil(t1 * last));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  const color = (a: number) => `hsla(${s.hue}, ${s.sat}%, ${s.light}%, ${a})`;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = color(pass === 0 ? s.alpha * alphaScale * 0.12 : s.alpha * alphaScale * 0.55);
    ctx.beginPath();
    let started = false;
    for (let i = Math.max(1, i0); i <= i1; i++) {
      const taper = Math.sin((i / last) * Math.PI);
      const lw = Math.max(0.6, s.width * m * (0.25 + taper * 0.75)) * (pass === 0 ? 3.2 : 1);
      // 幅が変わるため数ステップごとに区切る
      if (!started || i % 4 === 0) {
        if (started) ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = lw;
        ctx.moveTo(s.pts[i - 1][0] * w, s.pts[i - 1][1] * h);
        started = true;
      }
      ctx.lineTo(s.pts[i][0] * w, s.pts[i][1] * h);
    }
    if (started) ctx.stroke();
  }
  if (t1 >= 1 && t0 < 1) {
    ctx.fillStyle = color(s.alpha * 0.7 * alphaScale);
    for (const [x, y, r] of s.dots) {
      ctx.beginPath();
      ctx.arc(x * w, y * h, r * m, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

export const PAPER = "#0a0a12";

export function drawWorkStatic(canvas: HTMLCanvasElement, work: Work): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  for (const s of work.strokes) drawStroke(ctx, s, w, h);
}
