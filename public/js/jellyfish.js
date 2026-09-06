// ============ 水母：脉冲推进 + verlet 触手 ============
import { TAU, rand, SCALE } from './util.js';

const VARIANTS = [
  { // 月水母 · 桃粉
    glow: 'rgba(255,175,205,0.55)', body: 'rgba(255,195,220,0.16)',
    rim: 'rgba(255,210,228,0.6)', inner: 'rgba(255,165,195,0.4)',
    tent: 'rgba(255,200,220,0.55)',
  },
  { // 灯辉水母 · 青蓝
    glow: 'rgba(110,240,255,0.5)', body: 'rgba(175,245,255,0.13)',
    rim: 'rgba(160,240,255,0.55)', inner: 'rgba(95,225,255,0.32)',
    tent: 'rgba(150,235,255,0.5)',
  },
];

function makeChain(n, segLen, rootX, rootY) {
  const pts = [];
  for (let j = 0; j < n; j++) {
    pts.push({ x: rootX, y: rootY + j * segLen, px: rootX, py: rootY + j * segLen });
  }
  return pts;
}

export class Jellyfish {
  constructor(w, h, variant = 0) {
    this.vi = variant;
    this.x = rand(0.15, 0.85) * w;
    this.y = h * rand(0.22, 0.45);
    this.r = rand(26, 46) * SCALE;
    this.phase = rand(0, TAU);
    this.seed = rand(0, 100);
    this.vx = 0; this.vy = 0;
    this.tentacles = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2;
      this.tentacles.push({
        off,
        segLen: this.r * rand(0.38, 0.46),
        pts: makeChain(9, this.r * 0.42, this.x + off * this.r * 0.16, this.y + this.r * 0.5),
      });
    }
    // 口腕（短而粗的几条）
    this.arms = [];
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * 0.22;
      this.arms.push({
        off,
        segLen: this.r * 0.3,
        pts: makeChain(5, this.r * 0.3, this.x + off * this.r, this.y + this.r * 0.4),
      });
    }
  }

  update(dt, t, w, h) {
    this.phase += dt * (1.7 + Math.sin(this.seed) * 0.25);
    // 收缩产生向上推力，平时缓缓下沉
    const contract = Math.max(0, -Math.sin(this.phase));
    this.vy += (contract * 52 - 11) * dt;
    this.vx += Math.sin(t * 0.4 + this.seed) * 7 * dt;
    this.vx = Math.max(-26, Math.min(26, this.vx * 0.995));
    this.vy = Math.max(-64, Math.min(46, this.vy));
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 70) this.vx += 24 * dt;
    if (this.x > w - 70) this.vx -= 24 * dt;
    if (this.y < h * 0.1) this.vy += 34 * dt;
    if (this.y > h * 0.72) this.vy -= 34 * dt;

    const pulse = Math.sin(this.phase);
    const follow = (chain, rootOffX, rootYScale) => {
      chain.pts[0].x = this.x + chain.off * rootOffX;
      chain.pts[0].y = this.y + this.r * rootYScale;
      for (let j = 1; j < chain.pts.length; j++) {
        const p = chain.pts[j];
        const vx = (p.x - p.px) * 0.94;
        const vy = (p.y - p.py) * 0.94;
        p.px = p.x; p.py = p.y;
        p.x += vx + Math.sin(t * 1.3 + j * 0.55 + chain.off * 2 + this.seed) * 6 * dt * j;
        p.y += vy + (16 - pulse * 8) * dt;
        const prev = chain.pts[j - 1];
        let dx = p.x - prev.x, dy = p.y - prev.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - chain.segLen) / d;
        p.x -= dx * diff;
        p.y -= dy * diff;
      }
    };
    for (const T of this.tentacles) follow(T, this.r * 0.16, 0.46);
    for (const A of this.arms) follow(A, this.r * 0.24, 0.38);
  }

  draw(ctx, t) {
    const C = VARIANTS[this.vi];
    const R = this.r;
    const pulse = Math.sin(this.phase);
    const sx = 1 - pulse * 0.11, sy = 1 + pulse * 0.17;

    // 光晕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R * 2.7);
    g.addColorStop(0, C.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.3 + Math.max(0, pulse) * 0.14;
    ctx.fillStyle = g;
    ctx.fillRect(this.x - R * 2.7, this.y - R * 2.7, R * 5.4, R * 5.4);
    ctx.restore();

    // 触手
    ctx.save();
    ctx.lineCap = 'round';
    const drawChain = (chain, width, alpha) => {
      ctx.beginPath();
      ctx.moveTo(chain.pts[0].x, chain.pts[0].y);
      for (let j = 1; j < chain.pts.length - 1; j++) {
        const mx = (chain.pts[j].x + chain.pts[j + 1].x) / 2;
        const my = (chain.pts[j].y + chain.pts[j + 1].y) / 2;
        ctx.quadraticCurveTo(chain.pts[j].x, chain.pts[j].y, mx, my);
      }
      const last = chain.pts[chain.pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.strokeStyle = C.tent;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    for (const T of this.tentacles) drawChain(T, 1.1, 0.35);
    for (const A of this.arms) drawChain(A, 2.6, 0.28);
    ctx.restore();

    // 伞盖
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.moveTo(-R, R * 0.16);
    ctx.bezierCurveTo(-R, -R * 0.98, R, -R * 0.98, R, R * 0.16);
    const scallops = 4;
    for (let i = 0; i < scallops; i++) {
      const x0 = R - (i * 2 * R) / scallops;
      const x1 = R - ((i + 1) * 2 * R) / scallops;
      ctx.quadraticCurveTo((x0 + x1) / 2, R * 0.34, x1, R * 0.16);
    }
    ctx.closePath();
    ctx.fillStyle = C.body;
    ctx.fill();
    ctx.strokeStyle = C.rim;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 内核光
    const cg = ctx.createRadialGradient(0, -R * 0.08, 0, 0, -R * 0.08, R * 0.92);
    cg.addColorStop(0, C.inner);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, -R * 0.05, R * 0.92, 0, TAU);
    ctx.fill();

    // 月水母的四叶生殖腺花纹
    if (this.vi === 0) {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = 'rgba(255,150,190,0.9)';
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * R * 0.34, Math.sin(a) * R * 0.26 - R * 0.04, R * 0.16, R * 0.11, a, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
