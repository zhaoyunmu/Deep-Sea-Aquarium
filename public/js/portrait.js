// ============ 物种标本头像：直接复用缸内绘制代码，保证和真鱼长得一样 ============
import { TAU } from './util.js';
import { SCALE } from './util.js';
import { Fish } from './fish.js';

// 各体型的最大延展系数（用于把不同体型缩放进同样大的画布）
const EXTENT = {
  sleek: 1.4, round: 1.45, angel: 1.7, squid: 1.95,
  nautilus: 1.4, angler: 1.8, ray: 1.6, ribbon: 2.3,
};

const cache = new Map();

/** 渲染一个物种的静态标本，返回 canvas；没有 shape 的条目（如？？？）返回 null */
export function speciesPortrait(sp, size = 96) {
  if (!sp || !sp.shape) return null;
  const key = sp.id + '@' + size;
  if (cache.has(key)) return cache.get(key);

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  // 摆好姿势的标本鱼：成年体型，朝右，尾巴摆到好看的固定角度
  const fish = new Fish(sp, 0, 0, { z: 1 / SCALE }); // 抵消全局实体放大，标本大小归一
  fish.nutrition = 100;
  fish.x = 0;
  fish.y = 0;
  fish.vx = 40;
  fish.vy = 0;
  fish.phase = 0.9;

  // 皇带鱼需要轨迹才有身体
  if (sp.shape === 'ribbon') {
    fish.trail = [];
    for (let i = 1; i <= 26; i++) {
      const f = i / 26;
      fish.trail.push({ x: -f * 72, y: Math.sin(f * 3.4) * 10 });
    }
  }

  const extent = (EXTENT[sp.shape] || 1.5) * (sp.elongate || 1);
  const scale = (size * 0.42) / (34 * sp.size * extent);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  fish.draw(ctx, 1.35, { glow: 1 });
  ctx.restore();

  cache.set(key, c);
  return c;
}
