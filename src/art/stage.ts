import { drawStroke, PAPER } from "./generator";
import type { Stroke, Work } from "./generator";

interface Anim {
  stroke: Stroke;
  start: number;
  duration: number;
  done: number; // 描画済みの進行度
}

/** 全作品を重ねて描く、累積型のキャンバス。 */
export class ArtStage {
  private ctx: CanvasRenderingContext2D;
  private anims: Anim[] = [];
  private w = 0;
  private h = 0;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private canvas: HTMLCanvasElement,
    private getWorks: () => Work[],
  ) {
    this.ctx = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  redraw(): void {
    this.anims = [];
    this.ctx.fillStyle = PAPER;
    this.ctx.fillRect(0, 0, this.w, this.h);
    for (const work of this.getWorks()) {
      for (const s of work.strokes) drawStroke(this.ctx, s, this.w, this.h, 0, 1, 0.3);
    }
  }

  /** 新しい筆を時間差でなぞるように描く。 */
  add(strokes: Stroke[], duration = 2200): void {
    const now = performance.now();
    strokes.forEach((stroke, i) => {
      if (this.reduced) {
        drawStroke(this.ctx, stroke, this.w, this.h, 0, 1, 0.9);
      } else {
        this.anims.push({ stroke, start: now + i * 260, duration, done: 0 });
      }
    });
  }

  private loop(now: number): void {
    this.anims = this.anims.filter((a) => {
      if (now < a.start) return true;
      const t = Math.min(1, (now - a.start) / a.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      drawStroke(this.ctx, a.stroke, this.w, this.h, a.done, eased, 0.9);
      a.done = eased;
      return t < 1;
    });
    requestAnimationFrame((t) => this.loop(t));
  }
}
