// ============ 鱼：boids 群游 + 参数化体型绘制 + 成长/寿命系统 ============
import { TAU, rgba, shade, fadeColor, rand, clamp, SCALE } from './util.js';

// ---- 成长系统：三个年龄阶段 ----
export const DAY_SECONDS = 240;          // 一游戏天 = 一昼夜循环（24 小时 × 10 秒）
export const STAGE_AGES = [1, 2];        // 阶段门槛（天）：0-1天 / 1-2天 / 2天以上
export const STAGE_NUT = [20, 50, 100];  // 每阶段营养点上限（升阶需吃满）
export const STAGE_NAMES = ['幼年', '少年', '成年'];

// ---- 寿命：各稀有度物种的大致寿命区间（天），常见短命、传说长寿 ----
const LIFE_BANDS = [[5, 20], [15, 35], [30, 55], [45, 75], [65, 100]];

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 物种的寿命中心：区间中值 + 按物种名固定的偏移（同种鱼寿命相近，各不相同）
function lifeCenter(sp) {
  const band = LIFE_BANDS[sp.rarity] || LIFE_BANDS[0];
  const hash = [...sp.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (band[0] + band[1]) / 2 + (((hash % 13) - 6) / 6) * (band[1] - band[0]) * 0.35;
}

// ---- 路过鱼：穿缸而过的旅人 ----
export const PASSER_NAMES = [
  '阿渡', '潮生', '小帆', '浪花', '远行', '阿迅', '千里', '泊泊', '海风', '小途',
  '阿远', '逆流', '阿程', '云游', '小航', '阿浪', '天涯', '海角', '独行', '疾风',
  '万里', '晨汐', '阿途', '洄游', '小驰', '逐浪', '阿帆', '追风', '白帆', '阿鸥',
  '北游', '小驿', '过客', '南来', '春汛', '小汛', '阿屿', '远客', '信使', '阿使',
  '川流', '小川', '阿溪', '江湖', '阿队', '远影', '阿洄', '沙鸥', '小隐', '阿澄',
];
const PASSER_PERSONAS = [
  '急性子，总觉得前面有更好的水域',
  '慢悠悠，相信风景都在路上',
  '好奇心旺盛，见到什么缸都想进来瞧瞧',
  '见多识广，讲起远方滔滔不绝',
  '有点社恐，只想赶紧游完这段路',
  '话痨，一开口就停不下来',
  '谨慎派，时刻留意渔网的方向',
  '乐天派，下雨也当是免费淋浴',
  '孤独的旅人，习惯了独来独往',
  '美食家，追逐每一片饵料丰美的水域',
  '诗人气质，看到什么都要感慨两句',
  '地头蛇，声称对这片海域了如指掌',
];
const PASSER_STYLES = [
  '说话干脆利落', '喜欢讲旅途见闻', '动不动就报里程', '语气里带着倦意',
  '热情洋溢，满是好奇', '惜字如金，一句顶三句', '叹气开场', '爱夸耀远方',
  '礼貌又疏离', '喜欢反问',
];

export function makePasserPersona() {
  return {
    name: PASSER_NAMES[(Math.random() * PASSER_NAMES.length) | 0],
    personality: PASSER_PERSONAS[(Math.random() * PASSER_PERSONAS.length) | 0],
    style: PASSER_STYLES[(Math.random() * PASSER_STYLES.length) | 0],
    passer: true, // 化名是本地白送的，不消耗 AI token
  };
}

export class Fish {
  constructor(sp, x, y, opts = {}) {
    this.sp = sp;
    this.x = x; this.y = y;
    const a = rand(0, TAU);
    const v = 55 * sp.speed;
    this.vx = Math.cos(a) * v;
    this.vy = Math.sin(a) * v * 0.35;
    this.phase = rand(0, TAU);
    this.seed = rand(0, 1000);
    this.z = opts.z ?? rand(0.78, 1.28);        // 深度：影响尺寸
    this.ageDays = opts.ageDays ?? 0;           // 年龄（游戏天）
    this.nutrition = opts.nutrition ?? 0;       // 营养点
    // 由年龄与营养推定阶段
    this.stage = 0;
    while (this.stage < 2 && this.ageDays >= STAGE_AGES[this.stage] && this.nutrition >= STAGE_NUT[this.stage]) {
      this.stage++;
    }
    this.nutrition = Math.min(this.nutrition, STAGE_NUT[this.stage]);
    this.justGrew = false;
    this.passer = opts.passer || null;          // 路过鱼：{ dir, purpose }
    // 寿命：标准寿命玩家可见；真正大限围绕它正态浮动（隐藏）
    const band = LIFE_BANDS[sp.rarity] || LIFE_BANDS[0];
    const spread = (band[1] - band[0]) / 7;
    if (opts.lifespanStd != null) {
      this.lifespanStd = opts.lifespanStd;
      this.lifespanActual = opts.lifespanActual ?? this.lifespanStd;
    } else {
      this.lifespanStd = Math.round(clamp(lifeCenter(sp) + gauss() * spread, Math.max(4, band[0] - 2), band[1] + 8));
      this.lifespanActual = Math.max(3, this.lifespanStd + gauss() * spread * 0.5);
    }
    this.dying = false;                          // 弥留：边缘微光、不进食、栖底、可交流
    this.burrowing = false;                      // 钻沙：10 秒后永远消失
    this.burrowT = 0;
    this.burrowX = 0;
    this.persona = opts.persona || null;
    this.chatLog = Array.isArray(opts.chatLog) ? opts.chatLog.slice(-20) : []; // 对话记忆（跨刷新持久化）
    this.energy = 0;
    this.hold = null;                            // 被选中时的悬停点
    this.targetFood = null;
    this.dustTimer = rand(60, 120);              // 产尘定时器（秒），让各鱼错开
    this.dustAboutTo = false;                    // 即将产尘：周围发蓝光预告
  }

  get sizeScale() {
    // 体型随营养点增长，各阶段因营养上限而不同
    return SCALE * this.sp.size * this.z * (0.42 + 0.58 * this.nutrition / 100);
  }

  get length() {
    return 34 * this.sizeScale * (this.sp.elongate || 1);
  }

  update(dt, t, world, fishes, foods, cursor, env = { rain: 0, storm: 0 }, ts = 1) {
    // 钻沙：缓缓沉入海床深处，10 秒后永远消失（移除与星星由主循环负责）
    if (this.burrowing) {
      this.burrowT += dt;
      this.x += (this.burrowX - this.x) * Math.min(1, dt * 0.8);
      this.y += (world.floorY - 4 - this.y) * Math.min(1, dt * 1.1);
      this.vx = 0; this.vy = 0;
      this.phase += dt * 1.6;
      return;
    }

    const sp = this.sp;
    const base = 55 * sp.speed;

    let ax = 0, ay = 0;

    // 游荡
    ax += Math.sin(t * 0.6 + this.seed) * 14;
    ay += Math.sin(t * 0.43 + this.seed * 1.7) * 9;

    // 深度偏好（雨天/暴风雨往深处躲；围观漂流瓶时按瓶子新鲜度放低，瓶子陷沙越深习性恢复越多）
    const [d0, d1] = sp.depth;
    let bandY = world.h * (d0 + (d1 - d0) * (0.5 + 0.5 * Math.sin(this.seed * 3.1)))
      + world.h * 0.2 * Math.min(1, env.rain * 0.7 + env.storm * 0.5);
    if (this.dying) bandY = world.floorY - 46; // 弥留的鱼只在水底附近徘徊
    ay += (bandY - this.y) * 0.14 * (1 - (this._bottleCur || 0) * 0.75);

    // 路过鱼：缓慢游入 → 兜圈赏景 → 一天内从对侧穿出屏幕
    if (this.passer) {
      const p = this.passer;
      p.spawnT = (p.spawnT || 0) + dt;           // 在缸内停留时间
      if (p.exitX == null) {
        p.exitX = p.dir > 0 ? world.w + 160 : -160; // 出口：屏幕另一侧外
        p.cooldown = rand(7, 17);                 // 逗留秒数，制造兜圈感
      }
      p.leaving = p.cooldown <= 0;                // 是否已进入离场阶段
      if (!p.leaving) {
        // 逗留：缓慢沿进入方向前行，垂直方向轻轻起伏（兜圈）
        p.cooldown -= dt;
        ax += p.dir * 34;
        ay += Math.sin(t * 0.5 + this.seed) * 22;
      } else {
        // 离场：朝出口推进，弱化其它吸引，直奔屏幕外
        const dx = p.exitX - this.x;
        ax += Math.sign(dx || p.dir) * 150;
        ay += (bandY - this.y) * 0.03;
        this.targetFood = null;
      }
      // 一天内必须离场：接近一天时显著加速
      if (p.spawnT > DAY_SECONDS * 0.55) {
        const dx = p.exitX - this.x;
        ax += Math.sign(dx || p.dir) * 300;
        this.targetFood = null;
      }
    }

    // 邻居：分离 / 同类对齐聚集
    let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0, n = 0;
    for (const o of fishes) {
      if (o === this) continue;
      const dx = o.x - this.x, dy = o.y - this.y;
      const d2 = dx * dx + dy * dy;
      const sr = 34 * (this.sizeScale + o.sizeScale);
      if (d2 < sr * sr && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = 1 - d / sr;
        sepX -= (dx / d) * f; sepY -= (dy / d) * f;
      }
      if (sp.school > 0 && o.sp === sp && d2 < 140 * 140) {
        aliX += o.vx; aliY += o.vy;
        cohX += o.x; cohY += o.y;
        n++;
      }
    }
    ax += sepX * 260; ay += sepY * 260;
    if (n > 0) {
      ax += ((aliX / n) - this.vx) * sp.school * 1.1 + ((cohX / n) - this.x) * sp.school * 0.5;
      ay += ((aliY / n) - this.vy) * sp.school * 1.1 + ((cohY / n) - this.y) * sp.school * 0.5;
    }

    // 边界（水面与沙床）——离场中的路过鱼不受左右边界束缚，好穿出屏幕
    const m = 70;
    const floor = world.floorY - 16;
    const passingOut = !!(this.passer && this.passer.leaving);
    if (!passingOut) {
      if (this.x < m) ax += (m - this.x) * 3.2;
      if (this.x > world.w - m) ax -= (this.x - (world.w - m)) * 3.2;
    }
    if (this.y < m * 0.8) ay += (m * 0.8 - this.y) * 3.6;
    if (this.y > floor - m * 0.4) ay -= (this.y - (floor - m * 0.4)) * 3.6;

    // 找吃的（弥留的鱼不再进食；沉在海底的饲料香味传得更远）
    let hungry = false;
    let best = null, bestD2 = Infinity;
    if (!this.dying) {
      for (const f of foods) {
        const dx = f.x - this.x, dy = f.y - this.y;
        const d2 = dx * dx + dy * dy;
        const r = f.restT > 0 ? 560 : 340; // 落底后吸引范围扩大
        if (d2 < r * r && d2 < bestD2) { best = f; bestD2 = d2; }
      }
    }
    if (best) {
      hungry = true;
      const d = Math.sqrt(bestD2) || 1;
      ax += ((best.x - this.x) / d) * 260;
      ay += ((best.y - this.y) / d) * 260;
      this.targetFood = best;
    } else {
      this.targetFood = null;
    }

    // 鼠标惊扰
    if (cursor.active) {
      const dx = this.x - cursor.x, dy = this.y - cursor.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 110 * 110 && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = (1 - d / 110) * 300;
        ax += (dx / d) * f; ay += (dy / d) * f;
      }
    }

    // 被选中：靠近悬停点
    if (this.hold) {
      const dx = this.hold.x - this.x, dy = this.hold.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 95) { ax += (dx / d) * 170; ay += (dy / d) * 170; }
      else if (d < 48) { ax -= (dx / d) * 100; ay -= (dy / d) * 100; }
    }

    // 搅动水流：鼠标快速划过就会带动鱼（不必按住）
    if (cursor.speed > 60) {
      const dx = this.x - cursor.x, dy = this.y - cursor.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 170 * 170) {
        const d = Math.sqrt(d2) || 1;
        const f = (1 - d / 170) * 1.3;
        ax += clamp(cursor.vx, -900, 900) * f;
        ay += clamp(cursor.vy, -700, 700) * f;
      }
    }

    // 暴风雨：焦躁乱窜；闪电余悸：猛地逃散
    if (env.storm > 0.03) {
      ax += rand(-1, 1) * 190 * env.storm;
      ay += rand(-1, 1) * 130 * env.storm;
    }
    if (this.scare > 0) {
      this.scare -= dt;
      ax += rand(-1, 1) * 700 * this.scare;
      ay += rand(-1, 1) * 480 * this.scare;
    }

    this.vx += ax * dt; this.vy += ay * dt;

    // 速度钳制（弥留的鱼格外缓慢）
    const max = base * (hungry ? 2.1 : 1) * (this.hold ? 0.62 : 1) * (0.85 + this.z * 0.3) * (this.dying ? 0.45 : 1);
    const min = base * 0.45;
    const v = Math.hypot(this.vx, this.vy) || 1;
    const cl = Math.min(max, Math.max(min, v));
    this.vx = (this.vx / v) * cl;
    this.vy = (this.vy / v) * cl;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.y = Math.min(Math.max(this.y, 24), floor);

    // 年龄随游戏天数增长；大限将至 → 弥留，一天后钻沙（受时间缩放控制：标题时 ts=0 则不长大）
    const gdt = dt * ts;
    this.ageDays += gdt / DAY_SECONDS;
    // 阶段推进：年龄到了 + 营养吃满，才长大一号（运行中即时生效，不必等刷新）
    if (this.stage < 2 && this.ageDays >= STAGE_AGES[this.stage] && this.nutrition >= STAGE_NUT[this.stage]) {
      this.stage++;
      this.justGrew = true;
    }
    if (!this.passer) {
      if (!this.dying && this.ageDays >= this.lifespanActual) {
        this.dying = true;
        this.justDying = true;
      }
      if (this.dying && !this.burrowing && this.ageDays >= this.lifespanActual + 1) {
        this.burrowing = true;
        this.burrowT = 0;
        this.burrowX = clamp(this.x, 50, world.w - 50);
        this.hold = null;
      }
    }
    this.phase += dt * (6 + v * 0.09) * (this.dying ? 0.6 : 1);
  }

  draw(ctx, t, env = { glow: 1 }) {
    const sp = this.sp;
    const L = this.length;
    // 生物光晕（夜里更亮）
    const glowBoost = env.glow || 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, L * (1.2 + 0.25 * glowBoost));
    gr.addColorStop(0, sp.glow);
    gr.addColorStop(1, fadeColor(sp.glow));
    ctx.globalAlpha = Math.min(1, 0.72 * glowBoost);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(this.x, this.y, L * (1.2 + 0.25 * glowBoost), 0, TAU);
    ctx.fill();
    ctx.restore();

    // 即将产尘：周围泛起一圈渐强的蓝色涟漪
    if (this.dustAboutTo) {
      const a = 0.35 + 0.3 * Math.sin(t * 5 + this.seed);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(this.x, this.y, L * 0.4, this.x, this.y, L * 1.9);
      rg.addColorStop(0, `rgba(111,227,255,${(a * 0.55).toFixed(3)})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(this.x, this.y, L * 1.9, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 弥留：边缘暗暗闪光
    if (this.dying) {
      const pl = 0.5 + 0.5 * Math.sin(t * 2.1 + this.seed);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(205,228,255,${(0.07 + pl * 0.13).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, L * (1.08 + pl * 0.14), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const ang = Math.atan2(this.vy, this.vx);
    const wig = Math.sin(this.phase);
    ctx.save();
    if (this.burrowing) ctx.globalAlpha = Math.max(0.05, 1 - this.burrowT / 8);
    ctx.translate(this.x, this.y);
    ctx.rotate(ang);
    if (Math.cos(ang) < 0) ctx.scale(1, -1);
    this.drawBody(ctx, L, wig, t);
    ctx.restore();
  }

  // ================= 身体绘制 =================
  bodyPath(ctx, len, h) {
    ctx.beginPath();
    ctx.moveTo(len * 0.52, 0);
    ctx.quadraticCurveTo(len * 0.26, -h * 0.64, -len * 0.1, -h * 0.5);
    ctx.quadraticCurveTo(-len * 0.4, -h * 0.34, -len * 0.46, -h * 0.08);
    ctx.lineTo(-len * 0.46, h * 0.08);
    ctx.quadraticCurveTo(-len * 0.4, h * 0.34, -len * 0.1, h * 0.5);
    ctx.quadraticCurveTo(len * 0.26, h * 0.64, len * 0.52, 0);
    ctx.closePath();
  }

  fillBody(ctx, len, h) {
    const g = ctx.createLinearGradient(0, -h * 0.8, 0, h * 0.8);
    g.addColorStop(0, shade(this.sp.body, 0.72));
    g.addColorStop(0.45, this.sp.body);
    g.addColorStop(1, this.sp.belly);
    if (this.sp.ghost) ctx.globalAlpha = 0.62; // 玻璃猫：近乎透明
    ctx.fillStyle = g;
    ctx.fill();
    if (this.sp.ghost) ctx.globalAlpha = 1;
  }

  drawTail(ctx, len, h, wig) {
    const bx = -len * 0.42;
    const tl = len * 0.36;
    const th = h * 1.55;
    const w = wig * h * 0.4;
    const g = ctx.createLinearGradient(bx, 0, bx - tl, 0);
    g.addColorStop(0, rgba(this.sp.body, 0.9));
    g.addColorStop(1, rgba(this.sp.accent === this.sp.body ? this.sp.body : this.sp.accent, 0.55));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx + len * 0.1, 0);
    ctx.quadraticCurveTo(bx - tl * 0.5, w - th * 0.12, bx - tl, w * 1.7 - th * 0.5);
    ctx.quadraticCurveTo(bx - tl * 0.42, w * 0.6, bx - tl, w * 1.7 + th * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  drawDorsal(ctx, len, h) {
    ctx.fillStyle = rgba(this.sp.body, 0.85);
    ctx.beginPath();
    ctx.moveTo(len * 0.14, -h * 0.52);
    ctx.quadraticCurveTo(-len * 0.04, -h * 1.02, -len * 0.24, -h * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  drawPectoral(ctx, len, h, wig) {
    ctx.save();
    ctx.translate(len * 0.08, h * 0.26);
    ctx.rotate(0.55 + wig * 0.35);
    ctx.fillStyle = rgba(this.sp.belly, 0.65);
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.17, len * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawEye(ctx, x, y, r) {
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a1420';
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + r * 0.05, y - r * 0.3, r * 0.18, 0, TAU);
    ctx.fill();
  }

  drawStripes(ctx, len, h) {
    ctx.save();
    this.bodyPath(ctx, len, h);
    ctx.clip();
    ctx.fillStyle = rgba(this.sp.accent, 0.55);
    if (this.sp.eyeBand) {
      // 蝴蝶鱼：一条穿过眼睛的黑带
      ctx.fillRect(len * 0.2, -h, len * 0.13, h * 2);
    } else if (this.sp.shape === 'round' && this.sp.id === 'clown') {
      // 小丑鱼：三条白带
      for (const [x, w] of [[len * 0.28, len * 0.1], [-len * 0.02, len * 0.12], [-len * 0.3, len * 0.09]]) {
        ctx.fillRect(x - w / 2, -h, w, h * 2);
      }
    } else if (this.sp.spiky) {
      // 蓑鲉：体侧红棕条纹
      for (let i = 0; i < 4; i++) {
        const x = len * 0.3 - i * len * 0.2;
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(0.08);
        ctx.fillRect(-len * 0.035, -h, len * 0.07, h * 2);
        ctx.restore();
      }
    } else {
      // 斑马纹：斜带
      for (let i = 0; i < 4; i++) {
        const x = len * 0.32 - i * len * 0.24;
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(0.12);
        ctx.fillRect(-len * 0.045, -h, len * 0.09, h * 2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawLure(ctx, len, h, t) {
    const pl = 0.72 + 0.28 * Math.sin(t * 3.2 + this.seed);
    const tipX = len * 0.5, tipY = -h * (this.sp.shape === 'angler' ? 1.5 : 1.15);
    ctx.strokeStyle = rgba(this.sp.belly, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(len * 0.28, -h * 0.5);
    ctx.quadraticCurveTo(len * 0.62, -h * 1.15, tipX, tipY);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, len * 0.34 * (0.7 + pl * 0.5));
    g.addColorStop(0, rgba(this.sp.lure, 0.85));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tipX, tipY, len * 0.34 * (0.7 + pl * 0.5), 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.75 + pl * 0.25})`;
    ctx.beginPath();
    ctx.arc(tipX, tipY, len * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawGlowDots(ctx, len, h, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = len * 0.34 - i * len * 0.19;
      const y = -h * 0.1 + Math.sin(i * 1.7 + this.seed) * h * 0.12;
      const a = 0.35 + 0.45 * Math.sin(t * 2.4 + i * 1.3 + this.seed);
      ctx.fillStyle = rgba(this.sp.accent === this.sp.body ? '#9ff2ff' : this.sp.accent, Math.max(0.08, a));
      ctx.beginPath();
      ctx.arc(x, y, len * 0.045, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBody(ctx, L, wig, t) {
    const sp = this.sp;
    const hFactor = sp.shape === 'round' ? 1.35 : sp.shape === 'angel' ? 1.95 : 1;
    const h = L * 0.42 * hFactor;

    switch (sp.shape) {
      case 'squid': return this.drawSquid(ctx, L, wig, t);
      case 'nautilus': return this.drawNautilus(ctx, L, t);
      case 'angler': return this.drawAngler(ctx, L, wig, t);
      case 'ray': return this.drawRay(ctx, L, wig, t);
      default: break;
    }

    // sleek / round / angel 通用流程
    this.drawTail(ctx, L, h, wig);
    if (sp.shape === 'angel') {
      // 神仙鱼长背鳍/腹鳍
      ctx.fillStyle = rgba(sp.accent, 0.5);
      ctx.beginPath();
      ctx.moveTo(L * 0.16, -h * 0.3);
      ctx.quadraticCurveTo(L * 0.02, -h * 1.3, -L * 0.3, -h * 0.55);
      ctx.quadraticCurveTo(-L * 0.1, -h * 0.5, L * 0.05, -h * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(L * 0.16, h * 0.3);
      ctx.quadraticCurveTo(L * 0.02, h * 1.3, -L * 0.3, h * 0.55);
      ctx.quadraticCurveTo(-L * 0.1, h * 0.5, L * 0.05, h * 0.34);
      ctx.closePath();
      ctx.fill();
      // 蓑鲉：撑开的羽状棘刺
      if (sp.spiky) {
        ctx.strokeStyle = rgba(sp.belly, 0.55);
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const x = L * (0.18 - i * 0.11);
          const sway = Math.sin(this.phase * 1.2 + i) * L * 0.03;
          ctx.beginPath();
          ctx.moveTo(x, -h * 0.32);
          ctx.quadraticCurveTo(x + sway * 0.5, -h * 0.85, x - L * 0.06 + sway, -h * (1.0 - i * 0.07));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + L * 0.02, h * 0.3);
          ctx.quadraticCurveTo(x + sway * 0.4, h * 0.8, x - L * 0.05 + sway, h * (0.95 - i * 0.06));
          ctx.stroke();
        }
      }
    } else {
      this.drawDorsal(ctx, L, h);
    }
    this.bodyPath(ctx, L, h);
    this.fillBody(ctx, L, h);
    if (sp.accent && (sp.id === 'zebra' || sp.id === 'clown' || sp.id === 'angelfish' || sp.eyeBand || sp.spiky)) {
      this.drawStripes(ctx, L, h);
    }
    if (sp.lureDots) this.drawGlowDots(ctx, L, h, t);
    if (sp.fangs) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(L * (0.4 + (s < 0 ? 0.02 : 0)), s * h * 0.16);
        ctx.lineTo(L * (0.36 + (s < 0 ? 0.02 : 0)), s * h * 0.28);
        ctx.stroke();
      }
    }
    this.drawPectoral(ctx, L, h, wig);
    if (sp.lure) this.drawLure(ctx, L, h, t);
    // 锦鲤金光
    if (sp.id === 'koi') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.bodyPath(ctx, L, h);
      ctx.clip();
      const sh = 0.25 + 0.25 * Math.sin(t * 2 + this.seed);
      ctx.fillStyle = `rgba(255,235,170,${sh})`;
      ctx.fillRect(-L * 0.5, -h, L, h * 2);
      ctx.restore();
    }
    this.drawEye(ctx, L * 0.34, -h * 0.16, L * 0.062);
  }

  drawSquid(ctx, L, wig, t) {
    const sp = this.sp;
    const h = L * 0.3;
    // 触腕（在身后）
    ctx.strokeStyle = rgba(sp.body, 0.75);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const oy = (i - 2) * h * 0.22;
      const wv = Math.sin(this.phase * 1.4 + i) * L * 0.09;
      ctx.lineWidth = L * 0.045;
      ctx.beginPath();
      ctx.moveTo(-L * 0.4, oy);
      ctx.quadraticCurveTo(-L * 0.62, oy + wv * 0.5, -L * (0.78 + i * 0.03), oy + wv);
      ctx.stroke();
    }
    // 尾鳍
    ctx.fillStyle = rgba(sp.accent, 0.5);
    const flap = Math.sin(this.phase * 1.6) * 0.3;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.34, s * h * 0.1);
      ctx.quadraticCurveTo(-L * 0.5, s * (h * 0.5 + flap * h), -L * 0.56, s * h * 0.75);
      ctx.quadraticCurveTo(-L * 0.46, s * h * 0.3, -L * 0.4, s * h * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    // 外套膜
    this.bodyPath(ctx, L * 1.05, h);
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, shade(sp.body, 0.8));
    g.addColorStop(0.5, sp.body);
    g.addColorStop(1, sp.belly);
    ctx.fillStyle = g;
    ctx.fill();
    // 发光点阵
    this.drawGlowDots(ctx, L, h, t);
    // 大眼睛
    this.drawEye(ctx, L * 0.3, h * 0.18, L * 0.075);
  }

  drawNautilus(ctx, L, t) {
    const sp = this.sp;
    const R = L * 0.48;
    // 壳体
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R * 1.25);
    g.addColorStop(0, sp.belly);
    g.addColorStop(0.65, sp.body);
    g.addColorStop(1, shade(sp.body, 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    // 螺旋纹
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = rgba(sp.accent, 0.55);
    ctx.lineWidth = R * 0.09;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-R * 0.15 * i, -R * 0.05 * i, R * (0.35 + i * 0.3), 0.4 + i, 2.6 + i + 0.4);
      ctx.stroke();
    }
    // 外壳生长纹
    ctx.strokeStyle = rgba(sp.accent, 0.3);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.restore();
    // 触手穗（开口在前方）
    ctx.strokeStyle = rgba(sp.belly, 0.7);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const oy = (i - 3) * R * 0.11;
      const wv = Math.sin(this.phase * 1.3 + i * 0.8) * R * 0.08;
      ctx.beginPath();
      ctx.moveTo(R * 0.82, oy * 0.6);
      ctx.quadraticCurveTo(R * 1.05, oy + wv * 0.4, R * (1.12 + i * 0.02), oy * 1.6 + wv);
      ctx.stroke();
    }
    // 漏斗喷水微光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pl = 0.4 + 0.3 * Math.sin(t * 2 + this.seed);
    ctx.fillStyle = rgba(sp.accent === sp.body ? '#ffe6b0' : sp.accent, pl * 0.4);
    ctx.beginPath();
    ctx.ellipse(-R * 0.95, 0, R * 0.2, R * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 眼
    this.drawEye(ctx, R * 0.62, R * 0.42, R * 0.1);
  }

  drawAngler(ctx, L, wig, t) {
    const sp = this.sp;
    const h = L * 0.5;
    this.drawTail(ctx, L * 0.8, h * 0.7, wig);
    // 圆胖身体
    ctx.beginPath();
    ctx.moveTo(L * 0.55, -h * 0.05);
    ctx.quadraticCurveTo(L * 0.5, -h * 0.72, 0, -h * 0.72);
    ctx.quadraticCurveTo(-L * 0.52, -h * 0.6, -L * 0.5, 0);
    ctx.quadraticCurveTo(-L * 0.52, h * 0.6, 0, h * 0.68);
    ctx.quadraticCurveTo(L * 0.5, h * 0.68, L * 0.55, -h * 0.05);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, shade(sp.body, 0.85));
    g.addColorStop(0.6, sp.body);
    g.addColorStop(1, sp.belly);
    ctx.fillStyle = g;
    ctx.fill();
    // 嘴 + 牙
    ctx.fillStyle = '#0a0f16';
    ctx.beginPath();
    ctx.moveTo(L * 0.52, -h * 0.02);
    ctx.quadraticCurveTo(L * 0.3, h * 0.1, L * 0.18, h * 0.16);
    ctx.quadraticCurveTo(L * 0.38, h * 0.3, L * 0.5, h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,248,255,0.9)';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = L * (0.48 - i * 0.075);
      ctx.beginPath();
      ctx.moveTo(x, h * 0.02 + i * h * 0.012);
      ctx.lineTo(x - L * 0.015, h * 0.12 + i * h * 0.012);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - L * 0.02, h * 0.26 - i * h * 0.01);
      ctx.lineTo(x - L * 0.005, h * 0.16 - i * h * 0.01);
      ctx.stroke();
    }
    // 小背刺
    ctx.strokeStyle = rgba(sp.belly, 0.4);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const x = -L * 0.05 - i * L * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.66);
      ctx.lineTo(x - L * 0.03, -h * 0.82);
      ctx.stroke();
    }
    this.drawPectoral(ctx, L, h * 0.7, wig);
    this.drawLure(ctx, L, h, t);
    this.drawEye(ctx, L * 0.28, -h * 0.3, L * 0.05);
  }

  // 月影鳐：扁平菱形身体 + 缓缓扇动的双翼
  drawRay(ctx, L, wig, t) {
    const sp = this.sp;
    const h = L * 0.42;
    const flap = Math.sin(this.phase * 1.5) * 0.16;
    // 双翼（在身体后面先画，压在身下）
    ctx.fillStyle = rgba(sp.body, 0.55);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(L * 0.3, s * h * 0.15);
      ctx.quadraticCurveTo(L * 0.05, s * h * (1.15 + flap), -L * 0.4, s * h * (0.95 + flap * 0.6));
      ctx.quadraticCurveTo(-L * 0.2, s * h * 0.4, -L * 0.15, s * h * 0.2);
      ctx.closePath();
      ctx.fill();
      // 翼上的发光纹
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(sp.accent === sp.body ? '#aee6ff' : sp.accent, 0.3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(L * 0.22, s * h * 0.2);
      ctx.quadraticCurveTo(L * 0.0, s * h * (0.85 + flap), -L * 0.32, s * h * 0.7);
      ctx.stroke();
      ctx.restore();
    }
    // 细长的尾巴
    ctx.strokeStyle = rgba(sp.body, 0.8);
    ctx.lineWidth = Math.max(1.2, L * 0.04);
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, 0);
    ctx.quadraticCurveTo(-L * 0.72, wig * h * 0.2, -L * 0.95, wig * h * 0.5);
    ctx.stroke();
    // 菱形身体
    ctx.beginPath();
    ctx.moveTo(L * 0.55, 0);
    ctx.quadraticCurveTo(L * 0.18, -h * 0.62, -L * 0.28, -h * 0.34);
    ctx.quadraticCurveTo(-L * 0.5, -h * 0.12, -L * 0.52, 0);
    ctx.quadraticCurveTo(-L * 0.5, h * 0.12, -L * 0.28, h * 0.34);
    ctx.quadraticCurveTo(L * 0.18, h * 0.62, L * 0.55, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, shade(sp.body, 0.85));
    g.addColorStop(0.55, sp.body);
    g.addColorStop(1, sp.belly);
    ctx.fillStyle = g;
    ctx.fill();
    // 沿背部的发光小星
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = L * 0.3 - i * L * 0.2;
      const a = 0.3 + 0.4 * Math.sin(t * 2 + i * 1.4 + this.seed);
      ctx.fillStyle = rgba('#cfe8ff', Math.max(0.08, a));
      ctx.beginPath();
      ctx.arc(x, -h * 0.18, L * 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    this.drawEye(ctx, L * 0.36, -h * 0.1, L * 0.05);
  }
}
