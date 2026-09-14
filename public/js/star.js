// ============ 星辰：鱼儿长眠后降落的纪念，可收进背包 ============
import { TAU, rand, clamp, SCALE } from './util.js';
import { DAY_SECONDS } from './fish.js';
import { AI } from './ai.js';

const LAST_WORDS = [
  '深海那么大，谢谢你来看过我。',
  '别难过，我变成了星星。',
  '下一个纪元，再见。',
  '沙子很暖和，我先睡啦。',
  '记得偶尔想起我。',
  '我的光，如今归你了。',
];

export class Star {
  /**
   * @param x 落点
   * @param info { name, species, stage, age } 逝者档案
   * @param note 遗言（可后补）
   */
  constructor(x, info, note = null) {
    this.x = x;
    this.y = -30;
    this.vy = 20;
    this.info = info;
    this.note = note;
    this.phase = rand(0, TAU);
    this.landed = false;
    this.opened = false;
    this.fav = false; // 收藏过的星辰：永不熄灭
    this.age = 0; // 落底后的天数，3 天后熄灭
    this.onLanded = null;
  }

  get alive() { return this.age < 3; }

  update(dt, t, world) {
    this.phase += dt;
    if (!this.landed) {
      this.vy = Math.min(55, this.vy + 11 * dt);
      this.y += this.vy * dt;
      this.x += Math.sin(this.phase * 0.8) * 8 * dt;
      if (this.y >= world.floorY - 8) {
        this.landed = true;
        this.y = world.floorY - 8;
        if (this.onLanded) this.onLanded();
      }
    } else if (this.fav) {
      this.age = 0; // 收藏过的星星不熄灭（重新放回海里的也重新亮起）
    } else {
      this.age += dt / DAY_SECONDS; // 停留三天后熄灭
    }
  }

  draw(ctx, t) {
    // 熄灭前的渐隐
    const fade = this.age > 2.55 ? clamp((3 - this.age) / 0.45, 0, 1) : 1;
    const tw = 0.7 + 0.3 * Math.sin(t * 3.1 + this.phase);
    const glowA = (0.3 + tw * 0.3) * fade;

    // 光晕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 42);
    g.addColorStop(0, `rgba(255,242,180,${(glowA * 0.45).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 42 * SCALE, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 五角星
    ctx.save();
    ctx.globalAlpha = 0.35 + fade * 0.65;
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.phase * 0.6) * 0.18);
    ctx.scale(SCALE, SCALE);
    const R = 12, r = 5.2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255,238,170,${(0.75 + tw * 0.25) * 0.5 * fade + 0.3 * fade})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,246,200,${0.7 * fade})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 星心
    ctx.fillStyle = `rgba(255,255,255,${(0.5 + tw * 0.4) * fade})`;
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// 逝者的遗言：AI 在线由它亲口留下，离线用罐装告别
export async function generateLastWords(fish) {
  if (AI.online) {
    try {
      const reply = await AI.chat(
        [
          `你是万灵缸里一条即将钻进海床长眠的${fish.sp.name}，名叫「${fish.persona?.name || '无名'}」。`,
          `性格：${fish.persona?.personality || '神秘'}。说话方式：${fish.persona?.style || '简短'}。活了 ${fish.ageDays.toFixed(1)} 天。`,
          '留下最后一句话：10 到 20 个字，温柔、符合你的性格，可以是对访客、对大海的告别或感谢。只输出这一句。',
        ].join('\n'),
        [{ role: 'user', content: '留下你的最后一句话。' }],
        1.1,
        90,
      );
      const line = reply.trim().replace(/^[「"']|[」"']$/g, '').split('\n')[0];
      if (line) return line.slice(0, 50);
    } catch { /* 用罐装告别 */ }
  }
  return LAST_WORDS[(Math.random() * LAST_WORDS.length) | 0];
}
