// ============ 音乐盒：沉入海中的播音器，在场时用它自己的曲子替代背景乐 ============
// 每只盒子绑定唯一曲目（单曲循环），曲名 = public/audio/box/ 里的文件名，
// 同名图片文件即封面。盒子永不陷沙，一直留在沙床上奏乐，直到被收回背包。
import { TAU, rand, SCALE } from './util.js';

// 整体比例尺：盒身 / 封面 / 光晕 / 音符统一放大倍率。
// √2 ≈ 1.414 → 视觉面积是原来的 2 倍（不是边长 2 倍）。
export const BOX_SIZE = Math.SQRT2;
// 落底时盒子中心距沙床面的高度（盒底刚好坐在沙上）
export const BOX_LAND_OFFSET = 20;

// 曲目列表（/api/tracks 读取 box 文件夹），60s 缓存；目录里没有文件就不会有音乐盒出现
let trackCache = { at: 0, list: [] };
export async function listTracks(force = false) {
  if (!force && trackCache.list.length && Date.now() - trackCache.at < 60000) return trackCache.list;
  try {
    const r = await fetch('/api/tracks');
    const list = await r.json();
    trackCache = { at: Date.now(), list: Array.isArray(list) ? list : [] };
  } catch {
    trackCache = { at: Date.now(), list: [] };
  }
  return trackCache.list;
}

// 封面图缓存：同 src 只加载一次；没加载完时返回 null（画面先画音符，图到了自然换上）
const coverImgs = new Map();
function coverImage(src) {
  if (!src) return null;
  let img = coverImgs.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    coverImgs.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export class MusicBox {
  /**
   * @param x 落点
   * @param track { name, src, cover } 这只盒子绑定的唯一曲目
   */
  constructor(x, track) {
    this.x = x;
    this.y = -30;
    this.vy = 20;
    this.track = track;
    this.phase = rand(0, TAU);
    this.landed = false;
    this.opened = false; // 与瓶子一致的「已被拾起」标记
    this.onLanded = null;
  }

  // 音乐盒是机械，永不陷沙：落底后就一直留在沙床上奏乐
  update(dt, t, world) {
    this.phase += dt;
    if (!this.landed) {
      this.vy = Math.min(60, this.vy + 12 * dt);
      this.y += this.vy * dt;
      this.x += Math.sin(this.phase * 0.9) * 9 * dt;
      if (this.y >= world.floorY - BOX_LAND_OFFSET) {
        this.landed = true;
        this.y = world.floorY - BOX_LAND_OFFSET;
        if (this.onLanded) this.onLanded();
      }
    }
  }

  /**
   * @param playing 是否是当前奏乐的那只（同屏多只时只有最新的一只在响）
   */
  draw(ctx, t, env = { glow: 1 }, playing = true) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 2.2 + this.phase);
    const glowA = (0.2 + pulse * 0.25) * Math.min(1.4, env.glow) * (playing ? 1 : 0.3);

    // 光晕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 46 * SCALE * BOX_SIZE);
    g.addColorStop(0, `rgba(255,220,150,${(glowA * 0.4).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 46 * SCALE * BOX_SIZE, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 盒身（微微摇晃）
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.phase * 0.7) * 0.05);
    ctx.scale(SCALE * BOX_SIZE, SCALE * BOX_SIZE);
    const bw = 30, bh = 22;
    ctx.strokeStyle = 'rgba(255,225,170,0.55)';
    ctx.lineWidth = 1.1;
    // 盒盖（奏乐时轻轻开合）
    ctx.save();
    ctx.translate(-bw / 2, -bh / 2 + 2);
    ctx.rotate(playing ? -0.16 - pulse * 0.12 : -0.05);
    ctx.fillStyle = '#7d5836';
    ctx.beginPath();
    ctx.roundRect(0, -6, bw, 6, [3, 3, 0, 0]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // 盒底
    ctx.fillStyle = '#6b4a2f';
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2 + 3, bw, bh - 3, [0, 0, 3, 3]);
    ctx.fill();
    ctx.stroke();
    // 封面：有图用图（等比放大盖满封面框、居中裁剪，所有盒子显示大小一致），没图画音符
    const img = coverImage(this.track.cover);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-bw / 2 + 2.5, -bh / 2 + 4.5, bw - 5, bh - 7.5, 2);
      ctx.clip();
      const boxW = bw - 5, boxH = bh - 7.5;
      const s = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight); // cover 裁剪
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, -dw / 2, -bh / 2 + 4.5 + (boxH - dh) / 2, dw, dh);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,235,180,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(-bw / 2 + 2.5, -bh / 2 + 4.5, bw - 5, bh - 7.5, 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255,235,180,${(0.5 + pulse * 0.3).toFixed(2)})`;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', 0, 0);
    }
    ctx.restore();

    // 奏乐时向上飘的音符
    if (playing) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,235,180,0.95)';
      ctx.font = `${12 * BOX_SIZE}px sans-serif`;
      ctx.textAlign = 'center';
      const lift = SCALE * BOX_SIZE;
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.45 + i * 0.5 + this.phase) % 1;
        ctx.globalAlpha = (1 - ph) * 0.75;
        const nx = this.x + Math.sin(t * 1.7 + i * 2.4 + this.phase) * 14 * lift;
        const ny = this.y - (24 + ph * 36) * lift;
        ctx.fillText(i % 2 ? '♪' : '♫', nx, ny);
      }
      ctx.restore();
    }
  }
}
