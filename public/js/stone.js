// ============ 鲸之石：嵌在海床里的石碑，刻着鲸纹，是智慧的入口 ============
import { TAU } from './util.js';
import { AI } from './ai.js';

export class WhaleStone {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 92;
    this.h = 118;
    this.placed = false;
    this.hover = false;
  }

  place(w, world) {
    this.x = w * 0.845;
    // 让石碑下半截深深沉入沙床：底部埋进沙面之下较多
    this.y = world.floorY - this.h * 0.16;
    this.placed = true;
  }

  contains(x, y) {
    return x > this.x - 56 && x < this.x + 56 && y > this.y - 74 && y < this.y + 58;
  }

  draw(ctx, t) {
    if (!this.placed) return;
    const lit = AI.online;
    const { x, y, w, h } = this;

    ctx.save();
    ctx.translate(x, y);

    // ---- 点亮时照亮周围海水 ----
    if (lit) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(0, -h * 0.18, 6, 0, -h * 0.18, 170);
      lg.addColorStop(0, 'rgba(111,227,255,0.16)');
      lg.addColorStop(0.5, 'rgba(111,227,255,0.06)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(-180, -h - 60, 360, h + 130);
      ctx.restore();
    }

    // ---- 石板：竖直石碑，微不规则 ----
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(26,50,66,0.97)');
    g.addColorStop(0.55, 'rgba(14,32,48,0.98)');
    g.addColorStop(1, 'rgba(6,17,28,0.99)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, [16, 17, 7, 6]);
    ctx.fill();
    // 边缘受光
    ctx.strokeStyle = lit ? 'rgba(160,240,255,.3)' : 'rgba(140,180,210,.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 内圈刻线裁边
    ctx.strokeStyle = lit ? 'rgba(160,240,255,.22)' : 'rgba(140,180,210,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, [11, 12, 5, 4]);
    ctx.stroke();

    // ---- 鲸纹刻线（参考 DeepSeek 鲸标：圆头、上卷尾、眼点、腹弧）----
    // 先裁剪进石板轮廓：纹路只会出现在石板内，像真正的刻痕
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, [13, 14, 6, 5]);
    ctx.clip();
    const k = (w - 26) / 104;
    // 纹路中心 (55, 34) 对齐到石板中心偏上
    ctx.translate(-55 * k, -34 * k - h * 0.06);
    ctx.scale(k, k);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (lit) {
      ctx.shadowColor = 'rgba(111,227,255,.9)';
      ctx.shadowBlur = 9;
    }
    const ink = lit ? 'rgba(190,245,255,.92)' : 'rgba(165,200,225,.38)';
    // 身体一线成形
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(46, 26);
    ctx.bezierCurveTo(40, 14, 24, 12, 15, 22);
    ctx.bezierCurveTo(8, 30, 9, 40, 17, 45);
    ctx.bezierCurveTo(26, 51, 38, 50, 46, 43);
    ctx.bezierCurveTo(51, 47, 58, 48, 64, 45);
    ctx.bezierCurveTo(70, 50, 79, 51, 86, 47);
    ctx.bezierCurveTo(80, 56, 68, 60, 56, 58);
    ctx.bezierCurveTo(40, 62, 18, 58, 10, 44);
    ctx.bezierCurveTo(4, 32, 12, 18, 30, 15);
    ctx.bezierCurveTo(40, 14, 48, 17, 52, 22);
    ctx.stroke();
    // 眼（镂空）
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8,20,34,.95)';
    ctx.beginPath();
    ctx.arc(26, 27, 2.6, 0, TAU);
    ctx.fill();
    // 腹弧
    ctx.strokeStyle = lit ? 'rgba(190,245,255,.55)' : 'rgba(165,200,225,.25)';
    ctx.beginPath();
    ctx.moveTo(16, 48);
    ctx.bezierCurveTo(28, 54, 44, 53, 56, 46);
    ctx.stroke();
    ctx.restore();

    // ---- 悬停提示 ----
    if (this.hover) {
      const text = lit ? '已赋予海洋智慧' : '尚未赋予海洋智慧——点它唤醒';
      ctx.save();
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(text).width;
      const bx = x - tw / 2 - 12;
      const by = y - h / 2 - 40;
      ctx.fillStyle = 'rgba(4,16,30,0.85)';
      ctx.strokeStyle = lit ? 'rgba(111,227,255,.45)' : 'rgba(140,180,210,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + 24, 26, 13);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lit ? '#aef0ff' : '#d8ecf5';
      ctx.fillText(text, bx + 12, by + 18);
      ctx.restore();
    }

    ctx.restore();
  }
}
