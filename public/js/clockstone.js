// ============ 时钟日历石板：沉在左下角海床上的时间刻度 ============
import { TAU } from './util.js';

export class ClockStone {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 128;
    this.h = 86;
    this.placed = false;
  }

  place(w, world) {
    this.x = Math.max(90, w * 0.085);
    this.y = world.floorY - this.h * 0.32;   // 只埋住底沿，别挡住时间
    this.placed = true;
  }

  draw(ctx, t, day, hour, frac = 0) {
    if (!this.placed) return;
    const { x, y, w, h } = this;
    const night = hour < 6 || hour >= 18;

    ctx.save();
    ctx.translate(x, y);

    // 石面：微不规则的石板，带内圈刻线
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(22,44,60,0.95)');
    g.addColorStop(0.6, 'rgba(12,28,42,0.97)');
    g.addColorStop(1, 'rgba(6,15,26,0.98)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, [15, 16, 8, 7]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,210,0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,180,210,0.11)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, [10, 11, 5, 4]);
    ctx.stroke();

    // 日 / 月 图标（随昼夜变化）
    const cx = -w * 0.29, cy = -h * 0.04;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    ig.addColorStop(0, night ? 'rgba(185,212,255,0.42)' : 'rgba(255,218,150,0.5)');
    ig.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 小时进度环：10 秒转满一圈（从正上方顺时针）
    const ringR = 16;
    ctx.strokeStyle = 'rgba(140,180,210,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = night ? 'rgba(185,215,255,0.7)' : 'rgba(255,214,150,0.78)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();

    if (night) {
      // 弯月：外弧 + 内弧拼成一个闭合的月牙（两个弧端点重合）
      const R = 7.2, d = 3.4;
      const r = Math.hypot(d, R);              // 内圆半径：保证经过外圆的上下端点
      const th = Math.atan2(R, -d);            // 交点角度
      ctx.fillStyle = 'rgba(205,225,255,0.88)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, true);  // 外弧：顶 → 左 → 底
      ctx.arc(cx + d, cy, r, th, -th, false);               // 内弧：底 → 左（凹进外圆）→ 顶
      ctx.closePath();
      ctx.fill();
    } else {
      // 太阳 + 光芒
      ctx.fillStyle = 'rgba(255,226,160,0.92)';
      ctx.beginPath();
      ctx.arc(cx, cy, 6.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,226,160,0.6)';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 8.4, cy + Math.sin(a) * 8.4);
        ctx.lineTo(cx + Math.cos(a) * 11.6, cy + Math.sin(a) * 11.6);
        ctx.stroke();
      }
    }

    // 刻字：总天数 + 当前小时
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(210,236,250,0.92)';
    ctx.font = '600 17px "Microsoft YaHei", sans-serif';
    ctx.fillText(`第 ${day} 天`, -w * 0.08, -h * 0.15);
    ctx.fillStyle = 'rgba(158,205,232,0.82)';
    ctx.font = '500 15px "Microsoft YaHei", sans-serif';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    ctx.fillText(`${h12} ${hour < 12 ? 'a.m.' : 'p.m.'}`, -w * 0.08, h * 0.16);

    ctx.restore();
  }
}
