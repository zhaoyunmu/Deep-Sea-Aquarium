// ============ 昼夜更替 + 天气事件（小雨 / 暴风雨 / 闪电） ============
import { TAU, rand, clamp } from './util.js';

export const CYCLE = 240; // 一昼夜的秒数（24 小时 × 10 秒/小时）

export class Weather {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.t0 = CYCLE * 0.1;        // 从上午 8 点左右开始
    this.state = 'clear';          // clear | rain | storm
    this.stateTimer = rand(35, 70);
    this.rainI = 0;                // 雨强度 0..1（平滑过渡）
    this.stormI = 0;
    this.drops = [];               // 水面雨点涟漪
    this.streaks = [];             // 顶部雨丝
    this._dropAcc = 0;
    this._streakAcc = 0;
    this._strikeT = -1;            // 闪电时间线
    this.nextFlashIn = rand(4, 10);
    this.onLightning = null;
    this.onStateChange = null;

    // 火烧云：只在晴天的黎明/黄昏有概率出现，并影响后续降雨概率
    // （朝霞不出门：黎明火烧云 → 白天大概率下雨、晚上大概率不下）
    // （晚霞行千里：黄昏火烧云 → 夜里雨概率升、第二天白天雨概率降）
    this.fire = 0;                 // 视觉强度 0..1
    this.fireX = 0.5;              // 日头在天边的位置
    this.fireDawn = false;
    this.fireDusk = false;
    this.forceFireDawn = false;   // 指令强制：下一个黎明必是火烧云
    this.forceFireDusk = false;   // 指令强制：下一个黄昏必是火烧云
    this.prevPhase = null;
    // 时钟日历：24 小时制，每小时 10 秒；dayCount 从 1 开始
    this.dayCount = 1;
    this.lastHour = -1;
    this.onNewDay = null;
    this.biasDay = 0;              // 白天降雨概率偏置
    this.biasNight = 0;            // 夜晚降雨概率偏置
    this.pendingDayBias = 0;       // 黄昏火烧云留给第二天白天的偏置
    this.onFireCloud = null;
  }

  resize(w, h) { this.w = w; this.h = h; }

  phase(t) {
    return ((((t + this.t0) % CYCLE) + CYCLE) % CYCLE) / CYCLE;
  }

  // 当前小时（0-23）：相位 0 = 日出 = 6:00
  hourAt(t) {
    return Math.floor(((this.phase(t) * 24) + 6) % 24);
  }

  // 当前小时内的进度（0..1）：给时钟的进度环用
  hourFrac(t) {
    const hf = ((this.phase(t) * 24) + 6) % 24;
    return hf - Math.floor(hf);
  }

  daylightAt(t) {
    const raw = Math.sin(this.phase(t) * TAU); // 0=日出 0.25=正午 0.5=日落 0.75=午夜
    const k = clamp((raw + 0.28) / 0.56, 0, 1);
    return k * k * (3 - 2 * k);
  }

  update(dt, t) {
    // --- 昼夜相位过境：过零 = 黎明，过半 = 黄昏（跳变视为调参，不触发） ---
    const ph = this.phase(t);
    if (this.prevPhase !== null && Math.abs(ph - this.prevPhase) < 0.2) {
      if (ph < this.prevPhase) this._onDawn();
      else if (this.prevPhase < 0.5 && ph >= 0.5) this._onDusk();
    }
    this.prevPhase = ph;

    // 时钟：跨过午夜（23 → 0）就是新的一天
    const hour = this.hourAt(t);
    if (this.lastHour >= 0 && hour < this.lastHour) {
      this.dayCount++;
      if (this.onNewDay) this.onNewDay(this.dayCount);
    }
    this.lastHour = hour;

    // --- 火烧云强度：只在黎明/黄昏的窗口里燃起，随后熄灭 ---
    let fireTarget = 0;
    if (this.fireDawn && (ph < 0.07 || ph > 0.96)) fireTarget = 1;
    else if (this.fireDusk && ph > 0.46 && ph < 0.57) fireTarget = 1;
    this.fire += (fireTarget - this.fire) * Math.min(1, dt * 1.4);
    this.fireX += ((this.fireDawn ? 0.3 : 0.72) - this.fireX) * Math.min(1, dt * 0.8);

    // --- 天气状态机 ---
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) this._pick(t);

    const targetRain = this.state === 'clear' ? 0 : 1;
    const targetStorm = this.state === 'storm' ? 1 : 0;
    this.rainI += clamp(targetRain - this.rainI, -dt * 0.22, dt * 0.22);
    this.stormI += clamp(targetStorm - this.stormI, -dt * 0.16, dt * 0.16);

    // --- 雨点在水面砸出的涟漪 ---
    const rate = this.rainI * (this.state === 'storm' ? 120 : 55);
    this._dropAcc += rate * dt;
    while (this._dropAcc >= 1) {
      this._dropAcc -= 1;
      if (this.drops.length < 240) {
        this.drops.push({ x: rand(0, this.w), y: rand(2, 15), life: 0, max: rand(0.4, 0.8) });
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      this.drops[i].life += dt;
      if (this.drops[i].life > this.drops[i].max) this.drops.splice(i, 1);
    }

    // --- 顶部雨丝 ---
    const srate = this.rainI * (this.state === 'storm' ? 70 : 26);
    this._streakAcc += srate * dt;
    while (this._streakAcc >= 1) {
      this._streakAcc -= 1;
      if (this.streaks.length < 90) {
        this.streaks.push({ x: rand(0, this.w), y: rand(-50, -5), len: rand(12, 26), v: rand(320, 460) });
      }
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.y += s.v * dt;
      if (s.y > 64) this.streaks.splice(i, 1);
    }

    // --- 闪电 ---
    if (this.stormI > 0.5) {
      this.nextFlashIn -= dt;
      if (this.nextFlashIn <= 0) {
        this.nextFlashIn = rand(4, 12);
        this._strikeT = 0.0001;
        if (this.onLightning) this.onLightning();
      }
    }
    if (this._strikeT > 0) {
      this._strikeT += dt;
      if (this.flashValue() <= 0) this._strikeT = -1;
    }
  }

  flashValue() {
    const st = this._strikeT;
    if (st <= 0) return 0;
    if (st < 0.08) return st / 0.08;
    if (st < 0.16) return 1 - ((st - 0.08) / 0.08) * 0.85;
    if (st < 0.22) return 0.15 + ((st - 0.16) / 0.06) * 0.5;
    if (st < 0.5) return 0.65 * (1 - (st - 0.22) / 0.28);
    return 0;
  }

  _onDawn() {
    // 黄昏火烧云欠下的「第二天白天少雨」在此兑现；昨夜的偏置清零
    this.biasDay = this.pendingDayBias;
    this.pendingDayBias = 0;
    this.biasNight = 0;
    this.fireDusk = false;
    // 晴天黎明有概率烧起火烧云 → 白天大概率下雨，晚上大概率不下；指令可强制下一个黎明为火烧云
    const wantFire = this.forceFireDawn;
    this.forceFireDawn = false;
    if (wantFire || (this.state === 'clear' && Math.random() < 0.45)) {
      this.fireDawn = true;
      this.biasDay = clamp(this.biasDay + 0.3, -0.5, 0.5);
      this.biasNight = -0.25;
      if (this.onFireCloud) this.onFireCloud('dawn');
    }
  }

  _onDusk() {
    // 白天结束，白天的偏置清零
    this.biasDay = 0;
    this.fireDawn = false;
    // 晴天黄昏有概率烧起火烧云 → 夜里雨概率升，第二天白天雨概率降；指令可强制下一个黄昏为火烧云
    const wantFire = this.forceFireDusk;
    this.forceFireDusk = false;
    if (wantFire || (this.state === 'clear' && Math.random() < 0.45)) {
      this.fireDusk = true;
      this.biasNight = clamp(this.biasNight + 0.3, -0.5, 0.5);
      this.pendingDayBias = -0.25;
      if (this.onFireCloud) this.onFireCloud('dusk');
    }
  }

  // 指令强制：让下一个黎明/黄昏必是火烧云
  forceFire(kind) {
    if (kind === 'dawn') {
      this.forceFireDawn = true;
      this.forceFireDusk = false;
    } else if (kind === 'dusk') {
      this.forceFireDusk = true;
      this.forceFireDawn = false;
    } else {
      return false;
    }
    return true;
  }

  _pick(t) {
    const isDay = this.daylightAt(t) > 0.45;
    const bias = isDay ? this.biasDay : this.biasNight;
    // 晴是常态：基础降雨 0.4、暴雨 0.12；火烧云的偏置（±0.3 / -0.25）让预言对比更鲜明
    const rainP = clamp(0.4 + bias, 0.05, 0.85);
    const stormP = clamp(0.12 + bias * 0.4, 0.05, 0.6);
    const r = Math.random();
    this.state = r < rainP ? 'rain' : r < rainP + stormP ? 'storm' : 'clear';
    this.stateTimer = this.state === 'clear' ? rand(55, 120) : rand(28, 65);
    if (this.onStateChange) this.onStateChange(this.state);
  }

  env(t) {
    const daylight = this.daylightAt(t);
    // 连续太阳高度角：0=日出 1=正午 0=日落 -1=午夜（可正可负，供天空/太阳/月亮连续用）
    const sunElev = Math.sin(this.phase(t) * TAU);
    // 曝光平滑因子：把太阳高度映射到 0(夜)~1(昼)，并做 smoothstep 让过零点更柔
    const e = clamp((sunElev + 0.3) / 0.7, 0, 1);
    const exposure = e * e * (3 - 2 * e);
    return {
      daylight,
      night: 1 - daylight,
      rain: this.rainI,
      storm: this.stormI,
      flash: this.flashValue(),
      glow: 1 + (1 - daylight) * 0.85,
      fire: this.fire,
      fireX: this.fireX,
      sunElev,
      exposure,
      phase: this.phase(t),
    };
  }

  // ---------- 绘制：顶部雨丝 + 水面涟漪（需在 'lighter' 中） ----------
  drawSurfaceFX(ctx) {
    if (this.rainI < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 雨丝
    for (const s of this.streaks) {
      const a = Math.max(0, 1 - s.y / 70) * this.rainI * 0.3;
      ctx.strokeStyle = `rgba(200,232,255,${a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + 2, s.y + s.len);
      ctx.stroke();
    }
    // 涟漪圈 + 溅点
    for (const d of this.drops) {
      const f = d.life / d.max;
      const a = Math.sin(Math.PI * f) * this.rainI;
      const r = 2 + 11 * f;
      ctx.strokeStyle = `rgba(190,230,255,${(a * 0.45).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, r, r * 0.32, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(230,248,255,${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 绘制：雨天灰幕 + 闪电（普通合成模式） ----------
  drawVeil(ctx) {
    if (this.rainI > 0.02) {
      ctx.fillStyle = `rgba(6,13,22,${(this.rainI * 0.22).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = `rgba(120,150,180,${(this.rainI * 0.05).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    const fl = this.flashValue();
    if (fl > 0.01) {
      ctx.fillStyle = `rgba(205,228,255,${(fl * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }
}
