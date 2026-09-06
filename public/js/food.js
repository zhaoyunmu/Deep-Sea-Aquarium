// ============ 饲料 / 神秘卵 / 粒子特效 ============
import { TAU, rgba, rand, SCALE } from './util.js';
import { RARITY_COLORS } from './species.js';

export class Food {
  constructor(x, y) {
    this.x = x + rand(-12, 12);
    this.y = y + rand(-8, 8);
    this.vy = rand(14, 26);
    this.r = rand(2, 3.6) * SCALE;
    this.seed = rand(0, 10);
    this.eaten = false;
    this.restT = 0;
  }
  update(dt, t, world) {
    if (this.y < world.floorY - 5) {
      this.y += this.vy * dt;
      this.x += Math.sin(t * 2 + this.seed) * 9 * dt;
    } else {
      this.y = world.floorY - 5;
      this.restT += dt; // 落底后慢慢失去吸引力
    }
  }
  draw(ctx) {
    const a = this.restT > 18 ? Math.max(0, 1 - (this.restT - 18) / 6) : 1;
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 3);
    g.addColorStop(0, `rgba(255,214,150,${0.5 * a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 3, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,226,180,${0.9 * a})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fill();
  }
  get gone() {
    return this.eaten || this.restT > 24;
  }
}

export class Egg {
  constructor(x, sp) {
    this.x = x;
    this.y = -24;
    this.vy = 26;
    this.sp = sp;
    this.landed = false;
    this.phase = rand(0, TAU);
    this.hatched = false;
    this.color = RARITY_COLORS[sp.rarity];
  }
  update(dt, t, world) {
    this.phase += dt;
    if (!this.landed) {
      this.vy = Math.min(110, this.vy + 30 * dt);
      this.y += this.vy * dt;
      this.x += Math.sin(this.phase * 1.5) * 11 * dt;
      if (this.y >= world.floorY - 12) {
        this.landed = true;
        this.y = world.floorY - 12;
        if (this.onLanded) this.onLanded();
      }
    }
  }
  draw(ctx, t) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2 + this.phase);
    const R = 10 * SCALE;
    // 沉底后的「点我」脉动环
    if (this.landed) {
      const rp = 0.5 + 0.5 * Math.sin(t * 2.6 + this.phase);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(this.color, 0.25 + rp * 0.4);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, (16 + rp * 8) * SCALE, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.15 + rp * 0.2);
      ctx.beginPath();
      ctx.arc(this.x, this.y, (24 + rp * 10) * SCALE, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R * 4 * pulse);
    g.addColorStop(0, rgba(this.color, 0.4 * pulse));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R * 4 * pulse, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 卵体
    const eg = ctx.createRadialGradient(this.x - 3, this.y - 4, 1, this.x, this.y, R);
    eg.addColorStop(0, 'rgba(255,255,255,0.95)');
    eg.addColorStop(0.4, rgba(this.color, 0.85));
    eg.addColorStop(1, rgba(this.color, 0.45));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, R * 0.82, R, Math.sin(this.phase) * 0.08, 0, TAU);
    ctx.fill();
    // 内部胎影
    ctx.fillStyle = 'rgba(10,20,30,0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x + 2, this.y + 2, R * 0.3, R * 0.42, 0.5, 0, TAU);
    ctx.fill();
  }
}

export class Sparkles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 14, speed = 70, up = true) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const v = rand(0.3, 1) * speed;
      this.list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (up ? 26 : 0),
        life: 0, max: rand(0.5, 1.2),
        size: rand(1, 2.6) * SCALE, color,
      });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985; p.vy *= 0.985;
      if (p.life > p.max) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const a = 1 - p.life / p.max;
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${(a * 0.9).toFixed(2)})`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.7), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ============ 发光尘：成年且营养满格的鱼定时产出，悬浮水中、发光、可点击收集 ============
export class DustMote {
  constructor(x, y, n) {
    this.x = x + rand(-16, 16);
    this.y = y + rand(-16, 16);
    this.n = n;                 // 收集后获得的发光尘数量（1-4）
    this.seed = rand(0, TAU);
    this.life = 0;
    this.max = rand(26, 40);    // 消散时限（秒），到期自然隐去
    this.vy = rand(-6, -2);     // 微微上浮，永不下坠
    this.collected = false;     // true = 已被点击收集或到时消散
  }
  update(dt, t, world) {
    this.life += dt;
    this.x += Math.sin(t * 1.25 + this.seed) * 9 * dt;   // 轻轻摇曳
    this.y += this.vy * dt;
    this.vy *= 0.995;
    this.y = Math.max(28, Math.min(this.y, world.floorY - 20)); // 不落沙床、不冲顶
    if (this.life > this.max) this.collected = true;
  }
  // 蓝色菱形发光尘——与左上角 HUD 图标同款
  draw(ctx, t) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.4 + this.seed);
    const r = 6 * SCALE * pulse;
    const fade = this.life > this.max - 4 ? Math.max(0, (this.max - this.life) / 4) : 1; // 即将消散时淡出
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 外圈光晕
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 3.6);
    g.addColorStop(0, `rgba(111,227,255,${(0.6 * pulse * fade).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 3.6, 0, TAU);
    ctx.fill();
    // 菱形本体（旋转 45° 的方块）
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    const dg = ctx.createLinearGradient(-r, -r, r, r);
    dg.addColorStop(0, `rgba(255,255,255,${(0.95 * fade).toFixed(3)})`);
    dg.addColorStop(0.45, `rgba(111,227,255,${(0.85 * fade).toFixed(3)})`);
    dg.addColorStop(1, `rgba(30,143,179,${(0.7 * fade).toFixed(3)})`);
    ctx.fillStyle = dg;
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.restore();
  }
  get gone() { return this.collected; }
}
