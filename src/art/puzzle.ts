import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { hash, mulberry32 } from "./rng";

export const COLS = 10;
export const ROWS = 10;
export const TOTAL = COLS * ROWS; // 100ピース
const ASPECT = 1.5; // 横 / 縦

const LAND = ["#e8c27a", "#8fd3c7", "#e58fb0", "#9bb7ef", "#b6d98a", "#f0a77a", "#c4a3e8", "#7fcfe0"];

/** ピースが埋まる順番。固定シードのシャッフルなので、毎回同じ順で重複しない。 */
export function pieceOrder(): number[] {
  const rnd = mulberry32(hash("world-puzzle"));
  const order = Array.from({ length: TOTAL }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** 辺 A→B に、(ox, oy) 方向へ出るつまみ(ジグソーの凸/凹)を描く。ox=oy=0 なら直線。 */
function edge(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, ox: number, oy: number): void {
  if (!ox && !oy) {
    ctx.lineTo(bx, by);
    return;
  }
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const p = (t: number, k: number): [number, number] => [ax + ux * L * t + ox * L * k, ay + uy * L * t + oy * L * k];
  ctx.lineTo(...p(0.4, 0));
  ctx.bezierCurveTo(...p(0.4, 0.04), ...p(0.36, 0.07), ...p(0.36, 0.12));
  ctx.bezierCurveTo(...p(0.34, 0.2), ...p(0.42, 0.26), ...p(0.5, 0.26));
  ctx.bezierCurveTo(...p(0.58, 0.26), ...p(0.66, 0.2), ...p(0.64, 0.12));
  ctx.bezierCurveTo(...p(0.64, 0.07), ...p(0.6, 0.04), ...p(0.6, 0));
  ctx.lineTo(bx, by);
}

/** 世界地図の100ピース・ジグソーパズル。 */
export class WorldPuzzle {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private map: HTMLCanvasElement | null = null;
  private filled = 0;
  private order = pieceOrder();
  private rank = new Map<number, number>(); // ピース番号 → 埋まる順位
  private tabsH: number[][] = []; // 横の継ぎ目(上下)。+1=下向きに凸, -1=上向き, 0=外周
  private tabsV: number[][] = []; // 縦の継ぎ目(左右)。+1=右向きに凸, -1=左向き, 0=外周
  private reveal: { piece: number; start: number } | null = null;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.order.forEach((piece, i) => this.rank.set(piece, i));
    const rnd = mulberry32(hash("tabs"));
    const sign = () => (rnd() < 0.5 ? -1 : 1);
    this.tabsH = Array.from({ length: ROWS + 1 }, (_, r) => Array.from({ length: COLS }, () => (r === 0 || r === ROWS ? 0 : sign())));
    this.tabsV = Array.from({ length: ROWS }, () => Array.from({ length: COLS + 1 }, (_, c) => (c === 0 || c === COLS ? 0 : sign())));
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  get count(): number {
    return this.filled;
  }

  /** 埋まっているピース数を設定する。animate=true なら、新しく埋まったピースを光らせる。 */
  setFilled(n: number, animate = false): void {
    const next = Math.max(0, Math.min(TOTAL, n));
    const prev = this.filled;
    this.filled = next;
    if (animate && next > prev && !this.reduced) {
      this.reveal = { piece: this.order[next - 1], start: performance.now() };
      requestAnimationFrame((t) => this.tick(t));
    } else {
      this.reveal = null;
      this.draw(0);
    }
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = Math.round(this.w / ASPECT);
    this.canvas.style.height = `${this.h}px`;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.map = this.buildMap(dpr);
    this.draw(0);
  }

  private tick(now: number): void {
    if (!this.reveal) return;
    const t = Math.min(1, (now - this.reveal.start) / 1100);
    this.draw(t);
    if (t < 1) requestAnimationFrame((n) => this.tick(n));
    else this.reveal = null;
  }

  /** 世界地図をオフスクリーンに描く(陸地は国ごとに色分け) */
  private buildMap(dpr: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.round(this.w * dpr);
    c.height = Math.round(this.h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const sea = ctx.createLinearGradient(0, 0, 0, this.h);
    sea.addColorStop(0, "#12365a");
    sea.addColorStop(1, "#0b2440");
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, this.w, this.h);

    const countries = feature(world as never, (world as never as { objects: { countries: never } }).objects.countries) as unknown as {
      features: { id?: string }[];
    };
    const land = { type: "FeatureCollection" as const, features: countries.features.filter((f) => f.id !== "010") }; // 南極は除く
    const pad = Math.min(this.w, this.h) * 0.03;
    const projection = geoNaturalEarth1().fitExtent(
      [
        [pad, pad],
        [this.w - pad, this.h - pad],
      ],
      land as never,
    );
    const path = geoPath(projection, ctx);
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    land.features.forEach((f, i) => {
      ctx.beginPath();
      path(f as never);
      ctx.fillStyle = LAND[(i * 7 + hash(String(f.id ?? i))) % LAND.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(10,25,40,0.55)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });
    return c;
  }

  private piecePath(piece: number): void {
    const { ctx } = this;
    const r = Math.floor(piece / COLS);
    const c = piece % COLS;
    const pw = this.w / COLS;
    const ph = this.h / ROWS;
    const x0 = c * pw;
    const y0 = r * ph;
    const x1 = x0 + pw;
    const y1 = y0 + ph;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    edge(ctx, x0, y0, x1, y0, 0, this.tabsH[r][c]); // 上辺
    edge(ctx, x1, y0, x1, y1, this.tabsV[r][c + 1], 0); // 右辺
    edge(ctx, x1, y1, x0, y1, 0, this.tabsH[r + 1][c]); // 下辺
    edge(ctx, x0, y1, x0, y0, this.tabsV[r][c], 0); // 左辺
    ctx.closePath();
  }

  /** reveal: 0..1(新しく埋まったピースの出現アニメーション)。0 のときは通常描画。 */
  private draw(reveal: number): void {
    const { ctx, w, h } = this;
    ctx.fillStyle = "#12171c";
    ctx.fillRect(0, 0, w, h);
    const animating = this.reveal?.piece;
    for (let piece = 0; piece < TOTAL; piece++) {
      const filled = (this.rank.get(piece) ?? TOTAL) < this.filled;
      this.piecePath(piece);
      if (filled && piece !== animating && this.map) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(this.map, 0, 0, w, h);
        ctx.restore();
        this.piecePath(piece);
        ctx.strokeStyle = "rgba(8,16,24,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (piece !== animating) {
        ctx.fillStyle = "#1d252c";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    if (animating !== undefined && this.map) {
      const a = reveal;
      this.piecePath(animating);
      ctx.fillStyle = "#1d252c";
      ctx.fill();
      ctx.save();
      this.piecePath(animating);
      ctx.clip();
      ctx.globalAlpha = a;
      ctx.drawImage(this.map, 0, 0, w, h);
      ctx.restore();
      this.piecePath(animating);
      ctx.shadowColor = `rgba(255,236,180,${1 - a})`;
      ctx.shadowBlur = 18 * (1 - a);
      ctx.strokeStyle = `rgba(255,244,214,${0.9 - a * 0.4})`;
      ctx.lineWidth = 2 - a;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}
