// ============ 序章：藏在海底的故事 ============
// 集齐四条「深海的低语」后自动上演的神话终章；之后可在设置里重看（/genesis 也可）。
// 纯 Canvas 剪影分镜：巨鲸化海 → 澜见证 → 万灵诞生 → 鲸之石 → 漂流瓶 → 交给你。

import { TAU, rand, el } from './util.js';
import { whaleCall } from './audio.js';

// ============================================================================
//  分镜表 —— 这一块是留给你自己改的：改完保存，刷新页面（或点设置里的「🐋 序章」）就能看
//
//    name : 这一幕的名字，只出现在 /genesis list 的清单里
//    dur  : 这一幕持续几秒，可以写小数，例如 4.5
//    sub  : 这一幕的字幕，一行中文；留空 '' 就是这一幕不显示字幕
//    art  : 这一幕用哪段画面（见下面的「画面」一栏，换别的名字就是换画面）
//    sound: 这一幕开头的声音：'' 无声 · 'call' 鲸鸣 · 'callSoft' 轻声鲸鸣
//    fade : 可选。这一幕淡入要几秒（不写就用统一的 1.1 秒；写 0 就是硬切进来）
//
//  常用改法举例：
//    · 觉得第一幕太长 → 把 dur: 6.5 改成 dur: 4
//    · 想换文案 → 直接改 sub 引号里的中文（引号别删掉）
//    · 想多看一会儿鲸之石 → 把那一幕 dur 调大，或者把鲸之石那一幕复制一行
//    · 想让某一幕慢一点浮出来 → 给它加一个 fade: 2
//
//  注意：最后一行「接镜」是把动画交还给鱼缸的那一幕（海床高度、石碑位置都和鱼缸
//  里对齐，所以能无缝溶进去）。它的 art 请保持 'arrival'，不然接不上了。
// ============================================================================
const STORYBOARD = [
  { name: '静海', dur: 6.5, art: 'quiet', sound: '', sub: '很久以前，海比现在更安静。有一个声音，比浪潮还要低……' },
  { name: '鲸之歌', dur: 9, art: 'song', sound: 'call', sub: '那是巨鲸的歌。它唱了一千年，海就听了一千年。' },
  { name: '下沉', dur: 8.5, art: 'sink', sound: 'callSoft', sub: '唱完最后一支歌，它缓缓沉了下去。' },
  { name: '化作海', dur: 10, art: 'become', sound: '', sub: '它不是消失了——只是把自己铺成了这片海。' },
  { name: '澜', dur: 8.5, art: 'witness', sound: '', sub: '古老的水母看见了这一切。从那天起，她再也没有离开。' },
  { name: '万灵诞生', dur: 8.5, art: 'born', sound: '', sub: '后来，小小的灵魂在这里出生、长大、老去，再化作星辰。' },
  { name: '鲸之石', dur: 9, art: 'stone', sound: '', sub: '临别前，它把最后的智慧刻进一块石碑——等一句真话，将它唤醒。' },
  { name: '漂流瓶', dur: 7.5, art: 'notes', sound: '', sub: '而有些瓶子，装着不是墨水写就的话。' },
  { name: '尾幕', dur: 9.5, art: 'title', sound: '', sub: '这片海，现在交给你了。' },
  { name: '接镜', dur: 5, art: 'arrival', sound: '', sub: '' },
];

// 每一幕开关头声音（名字 → 实际声音）
const SOUNDS = { call: () => whaleCall(0.3), callSoft: () => whaleCall(0.5, true) };

// ============================================================================
//  画面 —— 每一幕画什么（这段是画面代码，一般不用动；改中文请改上面的分镜表）
//  p = 这一幕的进度 0→1，ctx/W/H 是画布，t = 从开场算起的总秒数
// ============================================================================
const ART = {
  // 静海：只有微尘（这时候海更安静——光柱和海雪都还没来）
  quiet(p, ctx, W, H) {
    motes(ctx, W, H, 0.35 * p, 0.5);
  },

  // 鲸之歌：巨鲸横穿画面，歌声一圈圈荡开
  song(p, ctx, W, H) {
    const s = Math.min(W, H) * 0.42;
    const x = -s * 1.6 + p * (W + s * 3.2);
    const y = H * (0.44 + Math.sin(p * 3) * 0.01);
    backlight(ctx, x, y, s * 2.1, 0.9);
    songRings(ctx, x - s * 0.9, y, p, 1);
    whale(ctx, x, y, s, 0.9 - p * 0.15, Math.sin(p * 6) * 0.6);
    motes(ctx, W, H, 0.5, 0.6);
  },

  // 下沉：原地翻身缓缓落下，歌声渐弱
  sink(p, ctx, W, H) {
    const s = Math.min(W, H) * 0.42;
    const x = W * 0.46 + p * W * 0.05;
    const y = H * 0.42 + p * H * 0.22;
    backlight(ctx, x, y, s * 2.0, 0.8 * (1 - p * 0.5));
    songRings(ctx, x - s * 0.9, y, p, 1 - p * 0.8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p * 0.24);
    whale(ctx, 0, 0, s, (0.9 - p * 0.55) * (1 - easeIn(p) * 0.3), Math.sin(p * 4) * 0.3 * (1 - p));
    ctx.restore();
    motes(ctx, W, H, 0.5, 0.5);
  },

  // 化作海：鲸躺在沙床上散成沙尘，海床与海草随之生出；光柱和海雪也随着它一起到来
  become(p, ctx, W, H, t) {
    const s = Math.min(W, H) * 0.42;
    const fy = FLOOR(H);
    ambient(ctx, W, H, t, Math.min(1, p * 1.4));
    backlight(ctx, W * 0.5, fy - s * 0.15, s * 1.8, 0.7 * Math.max(0, 1 - p * 1.2));
    ctx.save();
    ctx.translate(W * 0.5, fy - s * 0.16);
    ctx.globalAlpha = Math.max(0, 0.85 - p * 1.1);
    whale(ctx, 0, 0, s, 0.2, 0);
    ctx.restore();
    if (p > 0.15 && p < 0.85) dissolveDust(ctx, W * 0.5, fy - s * 0.15, s, p);
    floor(ctx, W, H, Math.min(1, p * 1.6));
    kelp(ctx, W, H, fy, Math.min(1, p * 1.2), 6, 0.1);
    motes(ctx, W, H, 0.5, 0.7);
  },

  // 澜：古老的水母从沙床后面升起来
  witness(p, ctx, W, H, t) {
    const fy = FLOOR(H);
    ambient(ctx, W, H, t, 1);
    // 先快后慢：探出沙面很快，之后慢慢飘高（先画她、再画沙床，才是从沙里升起来）
    const rise = 1 - Math.pow(1 - p, 2);
    jelly(ctx, W * 0.5, fy + 90 - rise * H * 0.62, Math.min(W, H) * 0.15, Math.min(1, p * 2.2));
    floor(ctx, W, H, 1);
    kelp(ctx, W, H, fy, 1, 6, 0.1 + p * 0.2);
    motes(ctx, W, H, 0.55, 0.5);
  },

  // 万灵诞生：卵、小鱼、小水母，以及一颗落进沙床的星辰
  born(p, ctx, W, H, t) {
    const fy = FLOOR(H);
    ambient(ctx, W, H, t, 1);
    floor(ctx, W, H, 1);
    kelp(ctx, W, H, fy, 1, 7, 0.3);
    eggs(ctx, W, fy, p);
    littleFish(ctx, W, H, fy, p, t);
    jelly(ctx, W * 0.16, H * 0.45 + Math.sin(t * 0.5) * 8, Math.min(W, H) * 0.08, 1);
    // 老去的灵魂化作星辰：一颗星从上方的水里缓缓落到沙床上
    if (p > 0.3) {
      const sp = Math.min(1, (p - 0.3) / 0.42);
      const ease = 1 - Math.pow(1 - sp, 2);
      const sx = W * 0.74;
      const sy = H * 0.2 + ease * (fy - 14 - H * 0.2);
      memorialStar(ctx, sx, sy, Math.min(W, H) * 0.012 + 6, Math.min(1, sp * 2.5), t);
      motes(ctx, W, H, 0.55, 0.6);
      return;
    }
    motes(ctx, W, H, 0.55, 0.6);
  },

  // 鲸之石：石碑从沙里升起，鲸纹点亮
  stone(p, ctx, W, H, t) {
    const fy = FLOOR(H);
    ambient(ctx, W, H, t, 1);
    floor(ctx, W, H, 1);
    kelp(ctx, W, H, fy, 1, 7, 0.3);
    whaleStone(ctx, W * 0.62, fy + 6, Math.min(W, H) * 0.155, p, t);
    motes(ctx, W, H, 0.5, 0.55);
  },

  // 漂流瓶：几只瓶子带着暖光沉下来
  notes(p, ctx, W, H, t) {
    const fy = FLOOR(H);
    ambient(ctx, W, H, t, 1);
    floor(ctx, W, H, 1);
    kelp(ctx, W, H, fy, 1, 7, 0.3);
    whaleStone(ctx, W * 0.62, fy + 6, Math.min(W, H) * 0.155, 1, 0);
    bottles(ctx, W, H, fy, p);
    motes(ctx, W, H, 0.55, 0.6);
  },

  // 尾幕：标题浮现（收尾不再自己淡出，交给下一幕的渐隐渐显接过去）
  title(p, ctx, W, H) {
    motes(ctx, W, H, 0.4 * (1 - p * 0.5), 0.4);
    titleCard(ctx, W, H, Math.min(1, p / 0.12));
  },

  // 接镜：镜头落回真实鱼缸——海床高度、鲸之石的位置和大小都和缸里一模一样，
  // 所以最后整段动画溶进鱼缸时，两边的石碑会正好叠在一起，像镜头推进去一样。
  // 注意画法顺序也和缸里一致：先石碑、再沙床（沙会盖住碑脚）。
  arrival(p, ctx, W, H, t) {
    const fy = FLOOR(H);
    ambient(ctx, W, H, t, 1);
    whaleStone(ctx, stoneX(W), fy, STONE_W, 1, t, true);
    floor(ctx, W, H, 1);
    kelp(ctx, W, H, fy, 1, 7, 0.25);
    motes(ctx, W, H, 0.5, 0.5);
  },
};

const TOTAL = STORYBOARD.reduce((a, s) => a + s.dur, 0);
const FONT = 'Georgia, "Noto Serif SC", "STSong", "SimSun", serif';

// ---------- 与鱼缸对齐 ----------
// 放映时由 main.js 传进来：海床高度、鲸之石的位置和宽度都用鱼缸里那一套，
// 这样最后「接镜」那一幕才能和真实鱼缸无缝叠上。拿不到就退回画面自己的 0.8H。
let FLOOR_Y = null;   // 鱼缸里沙床的高度（世界坐标）
let STONE_X = null;   // 鲸之石中心 x
let STONE_W = 92;     // 鲸之石宽度（鱼缸里固定 92）
const FLOOR = (H) => FLOOR_Y ?? H * 0.8;
const stoneX = (W) => STONE_X ?? W * 0.845;

// ---------- 形状库 ----------

// 体积光柱：和鱼缸里同款（水面斜射下来，随时间缓慢摆）
function rays(ctx, W, H, t, a) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = ((i + 0.5) / 6) * W + Math.sin(t * 0.06 + i * 1.7) * 46;
    const tilt = 0.2 + Math.sin(t * 0.045 + i) * 0.07;
    const topW = 26 + i * 9, botW = 170 + i * 46;
    const al = Math.max(0.012, (0.085 - i * 0.009) + Math.sin(t * 0.3 + i * 2.2) * 0.012) * a;
    const g = ctx.createLinearGradient(x, 0, x + tilt * H, H * 0.9);
    g.addColorStop(0, `rgba(150,225,255,${al.toFixed(3)})`);
    g.addColorStop(1, 'rgba(150,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - topW / 2, -12);
    ctx.lineTo(x + topW / 2, -12);
    ctx.lineTo(x + tilt * H + botW / 2, H * 0.88);
    ctx.lineTo(x + tilt * H - botW / 2, H * 0.88);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// 海雪：三层视差的小白点缓缓下沉（和鱼缸里同款）
let SNOW = [];
function seedSnow() {
  SNOW = [];
  const layers = [[0.7, 5, 0.10], [1.2, 10, 0.16], [1.8, 16, 0.24]];
  for (const [size, sp, alp] of layers) {
    const n = Math.max(8, (innerWidth * innerHeight) / 34000);
    for (let i = 0; i < n; i++) {
      SNOW.push({
        x: Math.random(), y: Math.random(), size: size * rand(0.7, 1.3),
        sp: sp * rand(0.7, 1.3), a: alp, sway: rand(6, 20), seed: rand(0, 100),
      });
    }
  }
}
function snow(ctx, W, H, t, a) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.fillStyle = '#cfe9f5';
  for (const s of SNOW) {
    const y = (((s.y + (t * s.sp) / H) % 1) + 1) % 1;
    const x = (((s.x + (Math.sin(t * 0.3 + s.seed) * s.sway) / W) % 1) + 1) % 1;
    ctx.globalAlpha = s.a * a;
    ctx.beginPath();
    ctx.arc(x * W, y * H, s.size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// 海水里的「活气」：光柱 + 海雪（从「化作海」那一幕开始出现）
function ambient(ctx, W, H, t, a) {
  rays(ctx, W, H, t, a);
  snow(ctx, W, H, t, a);
}

// 星辰：暖光 + 四道光刺（老去的灵魂落在沙床上的那颗星）
function memorialStar(ctx, x, y, r, a, t) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
  g.addColorStop(0, `rgba(255,240,200,${0.5 * a})`);
  g.addColorStop(0.4, `rgba(255,222,152,${0.15 * a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.4, 0, TAU);
  ctx.fill();
  const tw = 0.75 + 0.25 * Math.sin(t * 2.4);
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255,246,218,${0.8 * a * tw})`;
  ctx.lineWidth = 1.7;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x - dx * r, y - dy * r);
    ctx.lineTo(x + dx * r, y + dy * r);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,246,218,${0.35 * a * tw})`;
  ctx.lineWidth = 1.1;
  for (const [dx, dy] of [[0.7, 0.7], [0.7, -0.7]]) {
    ctx.beginPath();
    ctx.moveTo(x - dx * r * 0.55, y - dy * r * 0.55);
    ctx.lineTo(x + dx * r * 0.55, y + dy * r * 0.55);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,252,240,${0.9 * a})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// 背光：鲸身后方一片微亮的水光，让剪影从暗背景里浮出来
function backlight(ctx, x, y, r, a) {
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
  g.addColorStop(0, `rgba(88,150,200,${0.22 * a})`);
  g.addColorStop(0.55, `rgba(50,95,140,${0.10 * a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// 巨鲸剪影：与世界鲸影同一套连续轮廓（身+尾一线，后段随摆尾渐进弯曲）
function whale(ctx, x, y, s, alpha, stroke) {  const bendStart = -s * 0.25, rearLen = s * 1.15, maxBend = stroke * 0.18;
  const bendPt = (px, py) => {
    if (px >= bendStart) return [px, py];
    const tt = Math.min(1, (bendStart - px) / rearLen);
    const a = maxBend * Math.pow(tt, 1.3);
    const dx = px - bendStart;
    return [bendStart + dx * Math.cos(a) - py * Math.sin(a), dx * Math.sin(a) + py * Math.cos(a)];
  };
  const pts = [[s * 1.08, s * 0.02]];
  const quad = (x0, y0, cx, cy, x1, y1, n = 14) => {
    for (let i = 1; i <= n; i++) {
      const u = i / n, iu = 1 - u;
      pts.push([iu * iu * x0 + 2 * iu * u * cx + u * u * x1, iu * iu * y0 + 2 * iu * u * cy + u * u * y1]);
    }
  };
  quad(s * 1.08, s * 0.02, s * 0.55, -s * 0.44, -s * 0.3, -s * 0.32);
  quad(-s * 0.3, -s * 0.32, -s * 0.68, -s * 0.2, -s * 0.8, -s * 0.075);
  quad(-s * 0.8, -s * 0.075, -s * 1.0, -s * 0.13, -s * 1.16, -s * 0.28);
  quad(-s * 1.16, -s * 0.28, -s * 1.06, -s * 0.14, -s * 0.99, -s * 0.015);
  quad(-s * 0.99, -s * 0.015, -s * 1.06, s * 0.12, -s * 1.16, s * 0.26);
  quad(-s * 1.16, s * 0.26, -s * 1.0, s * 0.11, -s * 0.8, s * 0.07);
  quad(-s * 0.8, s * 0.07, -s * 0.55, s * 0.2, -s * 0.18, s * 0.32);
  quad(-s * 0.18, s * 0.32, s * 0.45, s * 0.4, s * 1.08, s * 0.02);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const [bx, by] = bendPt(px, py);
    i === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
  });
  ctx.closePath();
  ctx.fillStyle = '#030c17';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,210,245,0.32)';
  ctx.lineWidth = Math.max(1.5, s * 0.008);
  ctx.stroke();
  // 腹部受光（比世界鲸影略亮，剪影才读得出体积）
  ctx.save();
  ctx.globalAlpha = alpha * 0.12;
  ctx.fillStyle = '#9fd4ee';
  ctx.beginPath();
  ctx.moveTo(s * 0.9, s * 0.1);
  ctx.quadraticCurveTo(s * 0.3, s * 0.42, -s * 0.3, s * 0.3);
  ctx.quadraticCurveTo(s * 0.3, s * 0.34, s * 0.9, s * 0.1);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// 歌声涟漪：从鲸头前方一圈圈荡开
function songRings(ctx, x, y, p, str) {
  if (str <= 0.02) return;
  for (let i = 0; i < 3; i++) {
    const rp = ((p * 2.2 + i / 3) % 1);
    ctx.save();
    ctx.globalAlpha = (1 - rp) * 0.22 * str;
    ctx.strokeStyle = '#8fd8f5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 20 + rp * 150, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// 海床：一条微微起伏的亮边 + 下方渐暗
function floor(ctx, W, H, a) {
  if (a <= 0) return;
  const fy = FLOOR(H);
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, fy, 0, H);
  g.addColorStop(0, '#0a1626');
  g.addColorStop(1, '#02060d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, fy + 6);
  for (let x = 0; x <= W; x += 70) {
    ctx.quadraticCurveTo(x + 35, fy + Math.sin(x * 0.011 + 3) * 8, x + 70, fy + Math.sin(x * 0.02) * 5);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,190,230,0.14)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 70) {
    const y = fy + Math.sin(x * 0.02) * 5;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// 海草剪影：几株摇摆的叶带
function kelp(ctx, W, H, fy, a, n, sway) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a * 0.8;
  ctx.strokeStyle = '#07203a';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * W + Math.sin(i * 7.3) * 30;
    const h = H * (0.1 + (i % 3) * 0.05);
    const ph = i * 1.7;
    ctx.lineWidth = 5 - (i % 2);
    ctx.beginPath();
    ctx.moveTo(x, fy + 8);
    ctx.bezierCurveTo(
      x + Math.sin(ph + sway * 2) * 14, fy - h * 0.4,
      x - Math.sin(ph * 1.3 + sway * 2.4) * 18, fy - h * 0.75,
      x + Math.sin(ph + sway * 3) * 22, fy - h,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// 澜：巨大水母的剪影，伞盖呼吸 + 长须飘垂
function jelly(ctx, x, y, r, glow) {
  ctx.save();
  ctx.translate(x, y);
  // 体光
  const lg = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.4);
  lg.addColorStop(0, `rgba(150,220,255,${0.14 * glow})`);
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
  // 长须
  ctx.strokeStyle = 'rgba(150,215,250,0.35)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const ox = (i - 3) * r * 0.24;
    ctx.beginPath();
    ctx.moveTo(ox, r * 0.15);
    ctx.bezierCurveTo(
      ox + Math.sin(i * 2.1) * r * 0.2, r * 1.1,
      ox - Math.sin(i * 1.3) * r * 0.25, r * 2.0,
      ox + Math.sin(i * 0.9) * r * 0.3, r * 2.9,
    );
    ctx.stroke();
  }
  // 伞盖（呼吸）
  const pulse = 1 + Math.sin(performance.now() / 900) * 0.05;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * pulse, r * 0.72 * pulse, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(9,28,48,0.92)';
  ctx.fill();
  ctx.strokeStyle = `rgba(160,225,255,${0.4 * glow})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 伞缘微光
  ctx.beginPath();
  ctx.ellipse(0, 0, r * pulse, r * 0.72 * pulse, 0, Math.PI, 0);
  ctx.strokeStyle = `rgba(190,240,255,${0.18 * glow})`;
  ctx.stroke();
  ctx.restore();
}

// 卵：沙床上一排微微发光的小圆
function eggs(ctx, W, fy, p) {
  for (let i = 0; i < 5; i++) {
    const x = W * (0.3 + i * 0.09) + Math.sin(i * 5.1) * 20;
    const tw = 0.5 + 0.5 * Math.sin(p * 9 + i * 1.9);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 2) * (0.35 + tw * 0.3);
    ctx.fillStyle = '#bfeaff';
    ctx.beginPath();
    ctx.arc(x, fy - 6, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// 小鱼群：剪影穿梭
function littleFish(ctx, W, H, fy, p, t) {
  for (let i = 0; i < 9; i++) {
    const sp = 60 + (i % 3) * 30;
    const x = ((p * sp + i * 173) % (W + 80)) - 40;
    const y = H * (0.3 + ((i * 0.37) % 0.42)) + Math.sin(t * 1.2 + i) * 10;
    const dir = (i % 2) * 2 - 1;
    const s = 7 + (i % 3) * 3;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = '#0a2136';
    ctx.strokeStyle = 'rgba(150,210,245,0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s * 1.6, -s * 0.34);
    ctx.lineTo(-s * 1.6, s * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// 鲸之石：从沙里升起的石碑，鲸纹渐渐刻亮
function whaleStone(ctx, x, fy, s, p, t, full = false) {
  const h = s * 1.28, w = s;
  const y = fy + h * 0.18 - Math.min(1, p * 1.4) * h * 0.34;
  const lit = p > 0.35;
  ctx.save();
  ctx.translate(x, y);
  // 点亮时照亮周围
  if (lit) {
    const lg = ctx.createRadialGradient(0, -h * 0.18, 6, 0, -h * 0.18, s * 2.2);
    lg.addColorStop(0, `rgba(111,227,255,${0.14 * Math.min(1, (p - 0.35) * 2)})`);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-s * 2.4, -h * 1.6, s * 4.8, h * 2.6);
  }
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, 'rgba(26,50,66,0.97)');
  g.addColorStop(1, 'rgba(6,17,28,0.99)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, [s * 0.17, s * 0.18, s * 0.07, s * 0.06]);
  ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(160,240,255,.3)' : 'rgba(140,180,210,.16)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 一笔鲸纹（与世界鲸之石同一道刻痕）
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, [s * 0.13]);
  ctx.clip();
  const k = (w - 26) / 104;
  ctx.translate(-46.9 * k, -34 * k - h * 0.06);   // 墨迹中心 46.9：与鱼缸里的石碑用同一套对中
  ctx.scale(k, k);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (lit) {
    ctx.shadowColor = 'rgba(111,227,255,.9)';
    ctx.shadowBlur = 9;
  }
  // full = true 时用和鱼缸里一模一样的亮度（接镜那一幕要，免得溶解时忽明忽暗）
  ctx.strokeStyle = full ? 'rgba(190,245,255,.92)'
    : lit ? `rgba(190,245,255,${0.55 + Math.sin(t * 1.5) * 0.15})`
      : 'rgba(165,200,225,.38)';
  ctx.beginPath();
  engraving(ctx);
  ctx.stroke();
  // 眼点与腹弧：和鱼缸里的石碑一模一样（接镜那一幕要能重合）
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(8,20,34,.95)';
  ctx.beginPath();
  ctx.arc(26, 27, 2.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = full || lit ? 'rgba(190,245,255,.55)' : 'rgba(165,200,225,.25)';
  ctx.beginPath();
  ctx.moveTo(16, 48);
  ctx.bezierCurveTo(28, 54, 44, 53, 56, 46);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// 鲸纹的一笔成形路径（stone.js 同款坐标）
function engraving(ctx) {
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
}

// 漂流瓶：斜斜下沉，瓶腹里一点暖光
function bottles(ctx, W, H, fy, p) {
  const defs = [
    { x: 0.24, t: 0.0, sp: 0.55 }, { x: 0.55, t: 0.3, sp: 0.5 }, { x: 0.8, t: 0.55, sp: 0.6 },
  ];
  for (const d of defs) {
    const lp = Math.max(0, Math.min(1, (p - d.t) / d.sp));
    if (lp <= 0) continue;
    const x = W * d.x + Math.sin(lp * 5 + d.t * 9) * 14;
    const y = lp * (fy - 40) + 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.5 + d.t);
    const a = Math.min(1, lp * 3);
    // 瓶腹
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,36,54,0.95)';
    ctx.beginPath();
    ctx.roundRect(-9, -16, 18, 32, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,190,225,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 瓶颈 + 塞
    ctx.fillStyle = 'rgba(16,36,54,0.95)';
    ctx.fillRect(-4, -26, 8, 11);
    ctx.fillStyle = 'rgba(120,90,60,0.8)';
    ctx.fillRect(-4.5, -30, 9, 5);
    // 瓶中的字条微光
    const tw = 0.6 + 0.4 * Math.sin(p * 7 + d.t * 11);
    ctx.fillStyle = `rgba(255,233,176,${0.5 * tw})`;
    ctx.beginPath();
    ctx.arc(0, -2, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// 化尘：鲸身散出的上浮微粒
function dissolveDust(ctx, x, y, s, p) {
  const n = 40;
  ctx.save();
  ctx.fillStyle = 'rgba(190,220,240,0.5)';
  for (let i = 0; i < n; i++) {
    const seed = i * 12.9898;
    const ox = Math.sin(seed) * s * 0.9;
    const oy = Math.cos(seed * 1.7) * s * 0.22;
    const rise = ((p - 0.15) * (60 + (i % 7) * 30)) % (s * 0.5);
    ctx.globalAlpha = 0.5 * (1 - p) * (0.4 + (i % 5) / 8);
    ctx.beginPath();
    ctx.arc(x + ox, y + oy - rise, 1.6 + (i % 3) * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// 悬浮微尘：整段的底色粒子（比例坐标，窗口变化也不乱）
let MOTES = [];
function seedMotes() {
  MOTES = Array.from({ length: 70 }, () => ({
    x: Math.random(), y: Math.random(), r: rand(0.6, 2.2),
    vy: rand(0.004, 0.016), vx: rand(-0.008, 0.008), ph: rand(0, TAU),
  }));
}
function motes(ctx, W, H, a, drift) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.fillStyle = '#cfe8f7';
  const t = performance.now() / 1000;
  for (const m of MOTES) {
    const y = ((m.y - t * m.vy * drift) % 1 + 1) % 1;
    const x = (m.x + t * m.vx * drift % 1 + 1) % 1;
    ctx.globalAlpha = a * (0.25 + 0.3 * Math.sin(t + m.ph));
    ctx.beginPath();
    ctx.arc(x * W, y * H, m.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// 尾幕标题
function titleCard(ctx, W, H, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(127,168,189,0.85)';
  ctx.font = `${Math.round(13 * uiScale(W))}px ${FONT}`;
  ctx.fillText('D E E P   ·   S E A   ·   A Q U A R I U M', W / 2, H * 0.42);
  ctx.fillStyle = 'rgba(215,240,252,0.95)';
  ctx.font = `${Math.round(64 * uiScale(W))}px ${FONT}`;
  ctx.fillText('万 灵 缸', W / 2, H * 0.54);
  ctx.restore();
}
function uiScale(W) { return Math.max(0.9, Math.min(1.7, W / 1250)); }

const easeIn = (p) => p * p;

// ---------- 播放器 ----------

let playing = false;
let stopPlayback = null;   // 当前这一场的「收掉」函数（页面切到后台时要用）

// 收尾：最后这几秒整段动画溶进鱼缸（露出一模一样的海床与鲸之石）
const DISSOLVE = 1.8;
// 幕与幕之间的渐隐渐显（秒）：上一幕的画面淡出、下一幕淡入，不会硬切。
// 想让切换更利落就调小（0 = 每幕直接硬切），想更缓慢就调大；单幕可在分镜表里写 fade: 1.6
const SCENE_FADE = 1.1;

function fitCanvas(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * 放映序章。
 * opts.from      = 从第几幕开始（0 起，测试/预览用）
 * opts.speed     = 播放速度倍率（1 = 正常；0.5 慢放，2 快放）
 * opts.floorY    = 鱼缸里沙床的高度（对齐「接镜」用；不给就用画面自己的 0.8H）
 * opts.stoneX    = 鱼缸里鲸之石的中心 x / opts.stoneW = 它的宽度
 * opts.enterGame = 收尾时进入游戏（由 main.js 提供：收起标题页、让世界恢复运转）
 */
export function playGenesis(opts = {}) {
  if (playing) return;
  const from = Math.max(0, Math.min(STORYBOARD.length - 1, Math.floor(opts.from) || 0));
  const speed = Math.max(0.25, Math.min(3, Number(opts.speed) || 1));
  FLOOR_Y = Number.isFinite(opts.floorY) ? opts.floorY : null;
  STONE_X = Number.isFinite(opts.stoneX) ? opts.stoneX : null;
  STONE_W = Number.isFinite(opts.stoneW) ? opts.stoneW : 92;
  const enterGame = typeof opts.enterGame === 'function' ? opts.enterGame : null;
  playing = true;
  const ov = el('genesis-overlay');
  const cv = el('genesis-canvas');
  ov.classList.remove('hidden');
  ov.style.transition = '';
  ov.style.opacity = '1';
  ov.style.pointerEvents = '';
  seedMotes();
  seedSnow();

  const ctx = fitCanvas(cv);
  const buf = makeBuffer(cv.width, cv.height);   // 幕间渐隐用的离屏画布
  let raf = 0;
  // 从第 from 幕开始：把「已经过去的时间」预先扣掉，后面的分幕逻辑就不用改
  const skipped = STORYBOARD.slice(0, from).reduce((a, s) => a + s.dur, 0);
  const start = performance.now() - (skipped * 1000) / speed;
  let entered = from - 1;   // 已触发开头声音的分镜序号
  let ending = false;

  // 收尾：海床与石碑先现出来，界面再浮上来（到这一刻已经算进入游戏了）
  const hudEls = [el('hud'), el('exit-bar')].filter(Boolean);
  let hudDone = false;
  const showHud = () => {
    if (hudDone) return;
    hudDone = true;
    if (enterGame) enterGame();   // 标题页进来的：这时候收起标题页、世界开始运转
    for (const h of hudEls) { h.style.transition = 'none'; h.style.opacity = '0'; }
    setTimeout(() => {
      for (const h of hudEls) { h.style.transition = 'opacity 1.2s ease'; h.style.opacity = '1'; }
    }, 400);
  };
  const resetHud = () => {
    for (const h of hudEls) { h.style.transition = ''; h.style.opacity = ''; }
  };

  const finish = () => {
    if (ending) return;
    ending = true;
    cancelAnimationFrame(raf);
    ov.style.opacity = '0';
    ov.style.pointerEvents = 'none';   // 淡出的这段时间不再挡点击
    setTimeout(() => {
      ov.classList.add('hidden');
      ov.style.transition = '';
      ov.style.opacity = '1';
      ov.style.pointerEvents = '';
      resetHud();
      playing = false;
      stopPlayback = null;
    }, 900);
  };
  stopPlayback = finish;

  const onSkip = (e) => { e.stopPropagation(); finish(); };
  ov.addEventListener('click', onSkip, { once: true });
  const onKey = (e) => { if (e.key === 'Escape' || e.key === ' ') finish(); };
  window.addEventListener('keydown', onKey, { once: true });

  // 把某一幕的某个进度画到指定画布上（字幕另画）
  const drawArt = (g, scene, prog, W, H, t) => {
    const art = ART[scene.art] || ART.quiet;
    art(prog, g, W, H, t);
  };

  const frame = (now) => {
    const t = ((now - start) / 1000) * speed;
    if (t > TOTAL) { finish(); return; }
    // 收尾不再淡成黑：整个画面溶进鱼缸，露出后面的真实海水
    const dissolving = t > TOTAL - DISSOLVE;
    let fade = Math.min(1, t / 2);
    if (dissolving) {
      fade = 1;
      const k = Math.max(0, (TOTAL - t) / DISSOLVE);
      ov.style.transition = 'none';
      ov.style.opacity = String(k);
      showHud();
    }

    const W = innerWidth, H = innerHeight;
    // 背景深海渐变
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04101f');
    bg.addColorStop(0.55, '#03101d');
    bg.addColorStop(1, '#010509');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 找到当前分镜
    let acc = 0, idx = 0;
    for (let i = 0; i < STORYBOARD.length; i++) {
      if (t < acc + STORYBOARD[i].dur) { idx = i; break; }
      acc += STORYBOARD[i].dur;
    }
    const sc = STORYBOARD[idx];
    if (entered !== idx) {
      entered = idx;
      // 跳幕开始时，第一幕的进入声音会响——这是刻意的，方便单独预览
      if (SOUNDS[sc.sound]) SOUNDS[sc.sound]();
    }
    const p = (t - acc) / sc.dur;

    // 幕与幕之间渐隐渐显：上一幕停在它结束的那一刻，这一幕淡着盖上来
    const fadeSec = sc.fade ?? SCENE_FADE;
    const cross = idx > 0 && fadeSec > 0 ? Math.min(1, (t - acc) / fadeSec) : 1;

    ctx.save();
    ctx.globalAlpha = fade;
    if (cross < 1) {
      // 幕与幕的交叉渐隐：上一幕淡出、这一幕淡入，两边各自过一遍离屏画布
      // （画面里的元素会自己设 globalAlpha，所以只能先画到离屏再整体压透明度）
      const g = buf.ctx;
      const paint = (scene, prog, alpha) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, buf.cv.width, buf.cv.height);
        drawArt(g, scene, prog, W, H, t);
        ctx.globalAlpha = fade * alpha;
        ctx.drawImage(buf.cv, 0, 0, W, H);
      };
      paint(STORYBOARD[idx - 1], 1, 1 - cross);   // 上一幕的结尾，淡出
      paint(sc, p, cross);                        // 这一幕的开头，淡入
    } else {
      drawArt(ctx, sc, p, W, H, t);
    }

    // 字幕：本幕后 40% 处淡入，幕尾淡出
    const subA = p < 0.18 ? p / 0.18 : p > 0.86 ? (1 - p) / 0.14 : 1;
    if (sc.sub) {
      ctx.globalAlpha = fade * cross * Math.max(0, subA);
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(19 * uiScale(W))}px ${FONT}`;
      ctx.fillStyle = 'rgba(205,228,242,0.92)';
      ctx.shadowColor = 'rgba(0,10,20,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(sc.sub, W / 2, H * 0.9);
    }
    ctx.restore();

    if (!ending) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

// 幕间渐隐用的离屏画布（和主画布同尺寸，避免两条画面互相抢 globalAlpha）
function makeBuffer(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, ctx: cv.getContext('2d') };
}

/** 分镜清单（给 /genesis list 用） */
export const storyboard = STORYBOARD;

/**
 * 页面可见性变化：切到后台就收掉这一场（浏览器会停掉动画帧，留着会变成
 * 一层「看不见却挡着点击」的幕布）；回到前台再兜一次底，清掉任何残留。
 */
export function onVisibilityChange(hidden) {
  const ov = el('genesis-overlay');
  if (!ov) return;
  if (hidden) {
    if (stopPlayback) stopPlayback();
    return;
  }
  if (!playing && !ov.classList.contains('hidden')) {
    ov.classList.add('hidden');
    ov.style.transition = '';
    ov.style.opacity = '1';
    ov.style.pointerEvents = '';
    for (const h of [el('hud'), el('exit-bar')]) {
      if (h) { h.style.transition = ''; h.style.opacity = ''; }
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => onVisibilityChange(document.visibilityState === 'hidden'));
}

// 自动触发：等所有面板都关上的「安静时刻」再开场（最多等 90 秒，否则放弃，可手动重看）
// play = 实际放映的函数（由 main.js 传入，好带上鱼缸的坐标）
export function armGenesis(play = playGenesis) {
  const quiet = () => !document.querySelector('.overlay:not(.hidden)');
  let waited = 0;
  const iv = setInterval(() => {
    waited += 0.8;
    if (quiet()) {
      clearInterval(iv);
      setTimeout(play, 1600);
    } else if (waited > 90) {
      clearInterval(iv);
    }
  }, 800);
}
