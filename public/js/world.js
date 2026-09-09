// ============ 海底世界：水色 / 光柱 / 海雪 / 沙床海草 / 气泡 / 鲸影 ============
import { TAU, rand, SCALE } from './util.js';

// 白天/夜晚的水色渐变（stop, r, g, b）
const DAY_STOPS = [
  [0, 10, 58, 92], [0.16, 6, 42, 70], [0.42, 3, 19, 31], [0.75, 1, 10, 18], [1, 0, 4, 7],
];
const NIGHT_STOPS = [
  [0, 4, 15, 30], [0.16, 3, 16, 31], [0.42, 2, 11, 22], [0.75, 1, 5, 11], [1, 0, 2, 4],
];

export class World {
  constructor() {
    this.w = 0; this.h = 0;
    this.floorY = 0;
    this.snow = [];
    this.bubbles = [];
    this.kelp = [];
    this.rocks = [];
    this.vents = [];
    this.whale = null;
    this.whaleTimer = rand(26, 60); // 第一次鲸影别让观众等太久
    this.whaleOnSpawn = null;       // 回调：鲸出现时（用于 toast）
    this._bgGrad = null;
    this._sandGrad = null;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.floorY = h - Math.max(64, h * 0.09);
    this._bgGrad = null; this._sandGrad = null;

    // 海雪（三层视差）
    this.snow = [];
    const layers = [
      { n: (w * h) / 26000, size: 0.7, speed: 5, alpha: 0.10 },
      { n: (w * h) / 34000, size: 1.2, speed: 10, alpha: 0.16 },
      { n: (w * h) / 48000, size: 1.8, speed: 16, alpha: 0.24 },
    ];
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      for (let i = 0; i < Math.max(8, L.n); i++) {
        this.snow.push({
          x: rand(0, w), y: rand(0, h), layer: li,
          size: L.size * rand(0.7, 1.3), speed: L.speed * rand(0.7, 1.3),
          alpha: L.alpha, sway: rand(6, 20), seed: rand(0, 100),
        });
      }
    }

    // 海草
    this.kelp = [];
    const kelpN = Math.max(5, Math.round(w / 240));
    // 左下角时钟 / 右下角鲸之石：这两处不长海草，别挡住石板
    const avoidStone = (x) => {
      if (x < w * 0.155) return x + w * 0.13;
      if (x > w * 0.755) return x - w * 0.11;
      return x;
    };
    for (let i = 0; i < kelpN; i++) {
      this.kelp.push({
        x: avoidStone(((i + 0.5) / kelpN) * w + rand(-90, 90)),
        h: rand(70, 220), phase: rand(0, TAU), sway: rand(12, 38),
        width: rand(2.2, 4.4), hue: rand(160, 205),
        glowTip: Math.random() < 0.5,
      });
    }

    // 岩石
    this.rocks = [];
    const rockN = 4 + Math.round(w / 480);
    for (let i = 0; i < rockN; i++) {
      this.rocks.push({ x: rand(0, w), r: rand(12, 44), squash: rand(0.4, 0.75), tint: rand(0.6, 1) });
    }

    // 气泡喷口
    this.vents = [];
    const ventN = 2 + Math.round(w / 700);
    for (let i = 0; i < ventN; i++) {
      this.vents.push({ x: rand(0.12, 0.88) * w, timer: rand(0, 3) });
    }
  }

  update(dt, t) {
    for (const s of this.snow) {
      s.y += s.speed * dt;
      s.x += Math.sin(t * 0.5 + s.seed) * s.sway * dt;
      if (s.y > this.h + 4) { s.y = -4; s.x = rand(0, this.w); }
      if (s.x < -12) s.x += this.w + 24; else if (s.x > this.w + 12) s.x -= this.w + 24;
    }

    for (const v of this.vents) {
      v.timer -= dt;
      if (v.timer <= 0) {
        v.timer = rand(0.5, 2.6);
        if (this.bubbles.length < 36) {
          this.bubbles.push({
            x: v.x + rand(-9, 9), y: this.floorY - 4,
            r: rand(1.5, 4.6) * SCALE, speed: rand(26, 58), seed: rand(0, 100), life: 0,
          });
        }
      }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt;
      b.y -= b.speed * dt;
      b.x += Math.sin(t * 3 + b.seed) * 12 * dt;
      if (b.y < this.h * 0.05 || b.life > 16) this.bubbles.splice(i, 1);
    }

    // 鲸影事件
    if (!this.whale) {
      this.whaleTimer -= dt;
      if (this.whaleTimer <= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const dur = rand(34, 48);
        this.whale = {
          dir,
          x: dir > 0 ? -this.w * 0.5 : this.w * 1.5,
          y: this.h * rand(0.16, 0.36),
          speed: (this.w * 2.0) / dur * dir,
          bob: rand(0, 100),
          size: Math.min(this.w, this.h) * rand(0.82, 1.0),
        };
        if (this.whaleOnSpawn) this.whaleOnSpawn();
      }
    } else {
      this.whale.x += this.whale.speed * dt;
      const gone = this.whale.dir > 0 ? this.whale.x > this.w * 1.5 : this.whale.x < -this.w * 0.5;
      if (gone) {
        this.whale = null;
        this.whaleTimer = rand(160, 380);
      }
    }
  }

  // ---------- 背景层 ----------
  drawBack(ctx, t, env = { daylight: 1, night: 0, rain: 0, storm: 0, glow: 1, flash: 0, fire: 0, fireX: 0.5 }) {
    const { w, h } = this;
    const dl = env.daylight, night = env.night, rain = env.rain;
    const fire = env.fire || 0;

    // 水色：昼 / 夜渐变插值，雨天再压暗混灰
    if (!this._bgGrad) this._bgGrad = { grad: null, key: '' };
    const key = [dl.toFixed(2), rain.toFixed(2)].join('|');
    if (this._bgGrad.key !== key) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const murky = [10, 20, 30];
      for (let i = 0; i < DAY_STOPS.length; i++) {
        const [stop, dr, dg, db] = DAY_STOPS[i];
        const [, nr, ng, nb] = NIGHT_STOPS[i];
        let r = dr + (nr - dr) * night;
        let gg = dg + (ng - dg) * night;
        let b = db + (nb - db) * night;
        const f = rain * 0.38;
        r += (murky[0] - r) * f; gg += (murky[1] - gg) * f; b += (murky[2] - b) * f;
        g.addColorStop(stop, `rgb(${r | 0},${gg | 0},${b | 0})`);
      }
      this._bgGrad = { grad: g, key };
    }
    ctx.fillStyle = this._bgGrad.grad;
    ctx.fillRect(0, 0, w, h);

    // 火烧云：天际烧成橙红，日头低垂，火云条带缓缓漂移
    if (fire > 0.01) {
      const gx = env.fireX * w;
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      g.addColorStop(0, `rgba(255,105,45,${(0.52 * fire).toFixed(3)})`);
      g.addColorStop(0.3, `rgba(255,75,70,${(0.3 * fire).toFixed(3)})`);
      g.addColorStop(0.65, `rgba(160,50,80,${(0.14 * fire).toFixed(3)})`);
      g.addColorStop(1, 'rgba(80,30,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.55);
      // 低垂的日头
      ctx.save();
      const s = ctx.createRadialGradient(gx, h * 0.04, 0, gx, h * 0.04, h * 0.22);
      s.addColorStop(0, `rgba(255,195,95,${(0.5 * fire).toFixed(3)})`);
      s.addColorStop(0.4, `rgba(255,120,50,${(0.22 * fire).toFixed(3)})`);
      s.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = s;
      ctx.fillRect(gx - h * 0.25, -h * 0.1, h * 0.5, h * 0.4);
      ctx.restore();
      // 火云条带
      for (let i = 0; i < 6; i++) {
        const y = h * (0.03 + (i % 3) * 0.034);
        const speed = 9 + (i % 3) * 6;
        const x = (((i * 0.23 + t * speed / w) % 1.4) - 0.2) * w;
        const cw = w * (0.18 + (i % 3) * 0.075);
        const a = (0.12 + (i % 2) * 0.06) * fire;
        ctx.fillStyle = `rgba(${255 - i * 9}, ${96 - i * 7}, ${58 - i * 5}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, cw, h * 0.015, 0, 0, TAU);
        ctx.fill();
      }
    }

    // 夜晚：月光透下来的柔斑
    if (night > 0.05 && rain < 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const mx = w * 0.72, my = -30;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
      const ma = 0.13 * night * (1 - rain * 0.7);
      mg.addColorStop(0, `rgba(185,212,255,${ma.toFixed(3)})`);
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 220, my - 220, 440, 440);
      ctx.restore();
    }

    // 体积光柱：夜里变成暗淡月光柱，雨天被云遮蔽，火烧云时染成橙红
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rayDim = (0.26 + 0.74 * dl) * (1 - 0.78 * rain) * (1 + fire * 0.5);
    for (let i = 0; i < 6; i++) {
      const x = ((i + 0.5) / 6) * w + Math.sin(t * 0.06 + i * 1.7) * 46;
      const tilt = 0.2 + Math.sin(t * 0.045 + i) * 0.07;
      const topW = 26 + i * 9, botW = 170 + i * 46;
      const a = Math.max(0.012, ((0.085 - i * 0.009) + Math.sin(t * 0.3 + i * 2.2) * 0.012) * rayDim);
      const cr = (150 + night * 20 + fire * 105) | 0;
      const cg2 = (225 - night * 22 - fire * 105) | 0;
      const cb = (255 - fire * 140) | 0;
      const g = ctx.createLinearGradient(x, 0, x + tilt * h, h * 0.9);
      g.addColorStop(0, `rgba(${cr},${cg2},${cb},${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${cr},${cg2},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - topW / 2, -12);
      ctx.lineTo(x + topW / 2, -12);
      ctx.lineTo(x + tilt * h + botW / 2, h * 0.88);
      ctx.lineTo(x + tilt * h - botW / 2, h * 0.88);
      ctx.closePath();
      ctx.fill();
    }
    // 水面碎光（焦散）——夜里和雨天基本消失，火烧云时染成金色
    const causA = (0.15 + 0.85 * dl) * (1 - 0.85 * rain);
    if (causA > 0.02) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const y0 = h * 0.045 + k * 20;
        for (let x = 0; x <= w; x += 22) {
          const y = y0 + Math.sin(x * 0.02 + t * 1.25 + k * 2.1) * 6 + Math.sin(x * 0.007 - t * 0.7) * 9;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const cr2 = (160 + 95 * fire) | 0;
        const cg3 = (235 - 55 * fire) | 0;
        const cb2 = (255 - 165 * fire) | 0;
        ctx.strokeStyle = `rgba(${cr2},${cg3},${cb2},${((0.06 - k * 0.014) * causA).toFixed(3)})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }
    ctx.restore();

    this.drawSnow(ctx);
    this.drawWhale(ctx, t);
  }

  drawSnow(ctx) {
    ctx.fillStyle = '#cfe9f5';
    for (const s of this.snow) {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawWhale(ctx, t) {
    const W = this.whale;
    if (!W) return;
    const s = W.size / 2;
    ctx.save();
    ctx.translate(W.x, W.y + Math.sin(t * 0.4 + W.bob) * 12);
    ctx.scale(W.dir, 1);
    ctx.globalAlpha = 0.17;
    ctx.fillStyle = '#0e2438';
    ctx.strokeStyle = 'rgba(120,200,240,0.08)';
    ctx.lineWidth = 3;

    // 身体 + 尾巴：一条连续轮廓，后段随摆尾一起渐进弯曲（力从脊柱传来）
    const stroke = Math.sin(t * 0.85 + W.bob);
    const bendStart = -s * 0.2;                 // 从这里开始弯（身体后段）
    const rearLen = s * 1.15;
    const maxBend = stroke * 0.3;
    const bendPt = (px, py) => {
      if (px >= bendStart) return [px, py];
      const tt = Math.min(1, (bendStart - px) / rearLen);
      const a = maxBend * Math.pow(tt, 1.3);
      const dx = px - bendStart;
      return [bendStart + dx * Math.cos(a) - py * Math.sin(a), dx * Math.sin(a) + py * Math.cos(a)];
    };
    // 把轮廓采样成点，逐点弯曲，再连成一条闭合路径
    const pts = [[s * 1.08, s * 0.02]];
    const quad = (x0, y0, cx, cy, x1, y1, n = 16) => {
      for (let i = 1; i <= n; i++) {
        const u = i / n, iu = 1 - u;
        pts.push([iu * iu * x0 + 2 * iu * u * cx + u * u * x1, iu * iu * y0 + 2 * iu * u * cy + u * u * y1]);
      }
    };
    quad(s * 1.08, s * 0.02, s * 0.55, -s * 0.44, -s * 0.3, -s * 0.32);          // 背部
    quad(-s * 0.3, -s * 0.32, -s * 0.68, -s * 0.2, -s * 0.8, -s * 0.075);        // 尾柄上沿
    quad(-s * 0.8, -s * 0.075, -s * 1.0, -s * 0.13, -s * 1.16, -s * 0.28);       // 上叶前缘 → 上叶尖（约 30° 上扬）
    quad(-s * 1.16, -s * 0.28, -s * 1.06, -s * 0.14, -s * 0.99, -s * 0.015);     // 上叶后缘 → 中央凹口
    quad(-s * 0.99, -s * 0.015, -s * 1.06, s * 0.12, -s * 1.16, s * 0.26);       // 下叶前缘 → 下叶尖（约 30° 下扬）
    quad(-s * 1.16, s * 0.26, -s * 1.0, s * 0.11, -s * 0.8, s * 0.07);           // 下叶后缘 → 尾柄下沿
    quad(-s * 0.8, s * 0.07, -s * 0.55, s * 0.2, -s * 0.18, s * 0.32);           // 腹后段
    quad(-s * 0.18, s * 0.32, s * 0.45, s * 0.4, s * 1.08, s * 0.02);            // 腹前段
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const [bx, by] = bendPt(px, py);
      i === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 腹部浅色 + 斑点
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#9fd4ee';
    ctx.beginPath();
    ctx.moveTo(s * 0.9, s * 0.1);
    ctx.quadraticCurveTo(s * 0.3, s * 0.42, -s * 0.3, s * 0.3);
    ctx.quadraticCurveTo(s * 0.3, s * 0.34, s * 0.9, s * 0.1);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(randSeedSpot(s, i), -s * 0.1 + (i % 3) * s * 0.08, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 中层：沙床 / 岩石 / 海草 ----------
  drawMid(ctx, t, env = { rain: 0, storm: 0 }) {
    const { w, floorY: fy } = this;
    const wind = 1 + env.rain * 0.4 + env.storm * 1.4;
    if (!this._sandGrad) {
      const g = ctx.createLinearGradient(0, fy - 10, 0, this.h);
      g.addColorStop(0, '#0c1a2c');
      g.addColorStop(0.4, '#071020');
      g.addColorStop(1, '#02060d');
      this._sandGrad = g;
    }
    // 沙床（带一点起伏）
    ctx.fillStyle = this._sandGrad;
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    ctx.lineTo(0, fy + 8);
    for (let x = 0; x <= w; x += 60) {
      ctx.quadraticCurveTo(x + 30, fy + Math.sin(x * 0.013 + 3) * 9, x + 60, fy + Math.sin(x * 0.02) * 6);
    }
    ctx.lineTo(w, this.h);
    ctx.closePath();
    ctx.fill();
    // 沙床边缘微光
    ctx.strokeStyle = 'rgba(120,190,230,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 60) {
      const y = fy + Math.sin(x * 0.02) * 6;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 岩石
    for (const r of this.rocks) {
      const y = fy + 10 + r.squash * 8;
      ctx.fillStyle = `rgba(10,20,34,${0.75 * r.tint + 0.2})`;
      ctx.beginPath();
      ctx.ellipse(r.x, y, r.r, r.r * r.squash * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,210,240,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 海草
    ctx.lineCap = 'round';
    for (const k of this.kelp) {
      const baseY = fy + 14;
      const SEG = 7;
      const ener = k.ener || 0;
      // 沿高度取曲线点：摆幅随高度增大（风越大摆得越猛，被鱼搅过会抖）
      const pts = [];
      for (let j = 0; j <= SEG; j++) {
        const f = j / SEG;
        const sway = (Math.sin(t * 0.55 + k.phase) * k.sway + Math.sin(t * 1.25 + k.phase * 2) * k.sway * 0.35) * f * f * wind
          + Math.sin(t * 7 + k.phase * 3) * ener * 9 * f;
        pts.push({ x: k.x + sway, y: baseY - k.h * f, f });
      }
      // 分段绘制锥形茎
      for (let j = 0; j < SEG; j++) {
        const p0 = pts[j], p1 = pts[j + 1];
        const w0 = k.width * (2.1 - 1.5 * p0.f);
        const w1 = k.width * (2.1 - 1.5 * p1.f);
        // 茎身渐变：根部深绿，梢部亮
        ctx.strokeStyle = `hsla(${k.hue - 12 * p0.f}, ${45 + 18 * p0.f}%, ${17 + 13 * p0.f}%, 0.92)`;
        ctx.lineWidth = (w0 + w1) / 2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        // 叶片：左右交替，越靠梢越短
        if (j >= 1) {
          const dir = j % 2 ? 1 : -1;
          const len = k.h * 0.16 * (1 - p0.f * 0.55) + 6;
          const nx = dir * len, ny = -len * 0.45;
          ctx.strokeStyle = `hsla(${k.hue - 6 * p0.f}, ${42 + 14 * p0.f}%, ${20 + 10 * p0.f}%, 0.72)`;
          ctx.lineWidth = 2.2 - p0.f;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(p0.x + nx * 0.5, p0.y + ny * 0.9 - len * 0.3, p0.x + nx, p0.y + ny);
          ctx.stroke();
          // 对侧短叶
          ctx.lineWidth = 1.6 - p0.f * 0.6;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(p0.x - nx * 0.35, p0.y + ny * 0.5, p0.x - nx * 0.6, p0.y + ny * 0.6);
          ctx.stroke();
        }
      }
      // 发光茎尖
      if (k.glowTip) {
        const tip = pts[SEG];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + k.phase);
        const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 9);
        g.addColorStop(0, `hsla(${k.hue + 40}, 90%, 72%, ${0.3 + pulse * 0.28})`);
        g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 9, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ---------- 前景：气泡 / 暗角 ----------
  drawFront(ctx, t) {
    for (const b of this.bubbles) {
      const a = Math.min(0.5, b.life * 2) * (b.y < this.h * 0.14 ? Math.max(0, b.y / (this.h * 0.14)) : 1);
      ctx.strokeStyle = `rgba(190,235,255,${a * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(220,245,255,${a * 0.25})`;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, TAU);
      ctx.fill();
    }
    // 暗角
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.36, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,2,6,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ---------- 鱼群 / 指针搅动海草 ----------
  stir(fishes, cursor, dt) {
    for (const k of this.kelp) {
      k.ener = Math.max(0, (k.ener || 0) - dt * 0.7);
      const topY = this.floorY - k.h;
      for (const f of fishes) {
        if (Math.abs(f.x - k.x) < 34 && f.y > topY - 30) {
          k.ener = Math.min(1.5, k.ener + dt * (1.2 + Math.abs(f.vx) * 0.012));
        }
      }
      if (cursor.active && Math.abs(cursor.x - k.x) < 40 && cursor.y > topY - 30) {
        k.ener = Math.min(1.5, k.ener + dt * 2.2);
      }
    }
  }
}

// 鲸身斑点用固定伪随机，避免每帧闪烁
function randSeedSpot(s, i) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * s * 1.2;
}
