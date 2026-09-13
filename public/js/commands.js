// ============ 开发者指令：通过和沫沫对话直接拨弄这片海 ============
// 本地执行，零 token；也支持沫沫在 AI 回复里用 [[cmd: …]] 标记触发
import { SPECIES } from './species.js';
import { CYCLE } from './weather.js';
import { DAY_KEY } from './save.js';
import { Star } from './star.js';
import { rand } from './util.js';

const WEATHER_ALIAS = {
  clear: 'clear', sunny: 'clear', 晴: 'clear', 晴天: 'clear',
  rain: 'rain', rainy: 'rain', 雨: 'rain', 小雨: 'rain', 下雨: 'rain',
  storm: 'storm', 暴雨: 'storm', 暴风雨: 'storm',
  auto: 'auto', 自动: 'auto',
};
const WEATHER_NAME = { clear: '晴天', rain: '小雨', storm: '暴风雨', auto: '自动循环' };

// 时辰名称 → 小时（24 小时制；日出 = 6:00 与时钟石板一致）
const NAMED_HOURS = {
  dawn: 6, 黎明: 6, 清晨: 6, 早上: 7,
  morning: 9, 上午: 9,
  noon: 12, 中午: 12, 正午: 12,
  afternoon: 15, 下午: 15,
  dusk: 18, 黄昏: 18, 傍晚: 18,
  evening: 20, night: 20, 夜晚: 20, 晚上: 20,
  midnight: 0, 午夜: 0, 深夜: 23,
};

// 解析时间参数：命名时辰 / 14 / 14:30 / 2pm / +2 / -1
function parseTimeArg(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return { error: true };
  if (NAMED_HOURS[v] !== undefined) return { hour: NAMED_HOURS[v] };
  let m = v.match(/^([+-])(\d{1,2}(?:\.\d+)?)$/);
  if (m) return { delta: (m[1] === '-' ? -1 : 1) * parseFloat(m[2]) };
  m = v.match(/^(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)$/);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (m[2][0] === 'p') h += 12;
    return { hour: h };
  }
  m = v.match(/^(\d{1,2})\s*[:：]\s*(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return { error: true };
    return { hour: h + min / 60 };
  }
  m = v.match(/^(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h > 23) return { error: true };
    return { hour: h };
  }
  return { error: true };
}

// 把小时格式化成时钟石板上那种写法（1 p.m. / 12 a.m. / 14:30 → 2:30 p.m.）
function fmtHour(hour) {
  const total = ((hour % 24) + 24) % 24;
  const hh = Math.floor(total);
  const mm = Math.round((total - hh) * 60) % 60;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'a.m.' : 'p.m.'}`;
}

export const COMMANDS = [
  {
    name: 'help', alias: ['?', '帮助'], usage: '/help', desc: '列出所有指令',
    run(_, T) {
      return { ok: true, msg: '可用指令：\n' + COMMANDS.map((c) => `${c.usage} — ${c.desc}`).join('\n') };
    },
  },
  {
    name: 'weather', alias: ['天气'], usage: '/weather <晴|小雨|暴雨|自动>', desc: '切换天气（也认 clear/rain/storm/auto）',
    run(arg, T) {
      const key = WEATHER_ALIAS[(arg || '').trim().toLowerCase()];
      if (!key) return { ok: false, msg: '用法：/weather 晴|小雨|暴雨|自动' };
      const w = T.weather;
      if (key === 'auto') {
        w.stateTimer = rand(30, 60);
        return { ok: true, msg: '天气恢复自动循环' };
      }
      w.state = key;
      w.stateTimer = 9999;                       // 钉住，方便测试
      w.rainI = key === 'clear' ? 0 : 1;
      w.stormI = key === 'storm' ? 1 : 0;
      return { ok: true, msg: `天气已切换为${WEATHER_NAME[key]}` };
    },
  },
  {
    name: 'fire', alias: ['火烧云'], usage: '/fire <黎明|黄昏>', desc: '让下一个黎明或黄昏必为火烧云（/fire dawn / fire dusk）',
    run(arg, T) {
      const k = (arg || '').trim().toLowerCase();
      const kind = k === '黎明' || k === 'dawn' ? 'dawn' : k === '黄昏' || k === 'dusk' ? 'dusk' : null;
      if (!kind) return { ok: false, msg: '用法：/fire 黎明|dawn 或 /fire 黄昏|dusk（让下一个黎明/黄昏为火烧云）' };
      const w = T.weather;
      if (!w.forceFire(kind)) return { ok: false, msg: '设置失败' };
      return { ok: true, msg: `已安排：下一个${kind === 'dawn' ? '黎明' : '黄昏'}将为火烧云` };
    },
  },
  {
    name: 'time', alias: ['时间'], usage: '/time [14 | 2pm | 14:30 | 黄昏 | +2 | -1]', desc: '跳到指定时辰（不带参数=报当前时间）；/time day 5 改总天数',
    run(arg, T) {
      const w = T.weather;
      const now = performance.now() / 1000;
      const s = (arg || '').trim();

      // 不带参数：报当前时间
      if (!s) {
        const h = w.hourAt(now) + w.hourFrac(now);
        return { ok: true, msg: `现在是第 ${w.dayCount} 天 ${fmtHour(h)}` };
      }

      // /time day <n>：设置总天数
      const dm = s.match(/^(?:day|天)\s*(\d+)$/i);
      if (dm) {
        const n = parseInt(dm[1], 10);
        if (!(n > 0)) return { ok: false, msg: '天数要大于 0' };
        w.dayCount = n;
        try { localStorage.setItem(DAY_KEY, String(n)); } catch { /* 忽略 */ }
        return { ok: true, msg: `总天数已设为第 ${n} 天` };
      }

      const p = parseTimeArg(s);
      if (!p || p.error) {
        return { ok: false, msg: '用法：/time 14 · /time 2pm · /time 14:30 · /time 黄昏 · /time +2 · /time day 5' };
      }
      let hour;
      if (p.delta !== undefined) {
        hour = w.hourAt(now) + w.hourFrac(now) + p.delta;
        hour = ((hour % 24) + 24) % 24;
      } else {
        hour = p.hour;
      }
      // 时钟约定：相位 0 = 日出 = 6:00
      const phase = ((((hour - 6) / 24) % 1) + 1) % 1;
      w.t0 = phase * CYCLE - now;
      return { ok: true, msg: `时间已跳到 ${fmtHour(hour)}` };
    },
  },
  {
    name: 'whale', alias: ['鲸鱼'], usage: '/whale', desc: '立刻放一只鲸影游过',
    run(_, T) {
      const w = T.world;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const dur = 40;
      w.whale = {
        dir,
        x: dir > 0 ? -w.w * 0.5 : w.w * 1.5,
        y: w.h * rand(0.2, 0.34),
        speed: (w.w * 2.0) / dur * dir,
        bob: rand(0, 100),
        size: Math.min(w.w, w.h) * rand(0.82, 1.0),
      };
      if (w.whaleOnSpawn) w.whaleOnSpawn();
      return { ok: true, msg: '远处有一道巨大的影子游过来了' };
    },
  },
  {
    name: 'bottle', alias: ['漂流瓶'], usage: '/bottle [字条]', desc: '降一只漂流瓶（可带自定义字条）',
    run(arg, T) {
      const note = (arg || '').trim();
      const b = T.spawnBottle(undefined, note || null);
      b.onLanded = () => { };
      return { ok: true, msg: note ? `漂流瓶带着你的字条落下了：「${note}」` : '一只漂流瓶正在落下' };
    },
  },
  {
    name: 'musicbox', alias: ['音乐盒', 'box'], usage: '/musicbox <序号 | 曲目关键词>', desc: '降一只音乐盒（/musicbox 2 = 第 2 首，也可用关键词）',
    run(arg, T) {
      const tracks = T.boxTracks || [];
      if (!tracks.length) return { ok: false, msg: '还没导入曲目：把音频文件放进 public/audio/box/ 文件夹，等 1 分钟后再试' };
      const list = tracks.map((t, i) => `${i + 1}.${t.name}`).join('、');
      const key = (arg || '').trim();
      let track = null;
      if (/^\d+$/.test(key)) {
        // 按序号取（顺序 = 曲目列表顺序，/musicbox 不带参数报序号表）
        const idx = parseInt(key, 10);
        if (idx < 1 || idx > tracks.length) return { ok: false, msg: `序号要在 1 ~ ${tracks.length} 之间。可用：${list}` };
        track = tracks[idx - 1];
      } else if (key) {
        track = tracks.find((t) => t.name.toLowerCase().includes(key.toLowerCase()));
        if (!track) return { ok: false, msg: `没有叫「${key}」的曲目。可用：${list}` };
      }
      const mb = T.spawnBox(track || undefined);
      if (!mb) return { ok: false, msg: '海里的音乐盒够多了（最多同时两只），先收回一只吧' };
      const idx = tracks.indexOf(mb.track) + 1;
      // 不带参数时顺便报一遍序号表，方便下次按号点歌
      return { ok: true, msg: `第 ${idx} 首《${mb.track.name}》音乐盒正在落下${key ? '' : `（曲目表：${list}）`}` };
    },
  },
  {
    name: 'summon', alias: ['召唤', '加鱼'], usage: '/summon <物种> [营养0-100]', desc: '往缸里加一条鱼',
    run(arg, T) {
      const parts = (arg || '').trim().split(/\s+/);
      const key = (parts[0] || '').toLowerCase();
      if (!key) return { ok: false, msg: '用法：/summon <物种>，例如 /summon koi' };
      const sp = SPECIES.find((s) => s.id === key)
        || SPECIES.find((s) => s.name === parts[0])
        || SPECIES.find((s) => s.name.includes(parts[0]));
      if (!sp) return { ok: false, msg: `没找到「${parts[0]}」。可用：${SPECIES.map((s) => s.id).join('、')}` };
      const f = T.spawnFish(sp.id);
      const nut = Number(parts[1]);
      if (Number.isFinite(nut)) {
        f.nutrition = Math.max(0, Math.min(100, nut));
        f.stage = f.nutrition >= 100 ? 2 : f.nutrition >= 50 ? 1 : 0;
      }
      return { ok: true, msg: `已召唤一条${sp.name}` };
    },
  },
  {
    name: 'lumens', alias: ['发光尘'], usage: '/lumens <数量 | +N | -N>', desc: '修改发光尘数量',
    run(arg, T) {
      const s = (arg || '').trim();
      if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return { ok: false, msg: '用法：/lumens 500 或 /lumens +50' };
      const v = parseFloat(s);
      if (s.startsWith('+') || s.startsWith('-')) T.collection.addLumens(v);
      else T.collection.addLumens(v - T.collection.lumens);
      return { ok: true, msg: `发光尘现在是 ${T.collection.lumens}` };
    },
  },
  {
    name: 'farewell', alias: ['弥留'], usage: '/farewell <鱼的名字>', desc: '让指定鱼进入弥留（大限将至）',
    run(arg, T) {
      const name = (arg || '').trim();
      if (!name) return { ok: false, msg: '用法：/farewell <鱼的名字>，先用 /list 看名字' };
      const f = T.fishes.find((x) => !x.passer && !x.dying && (
        x.persona?.name === name || x.sp.name === name || (x.persona?.name || '').includes(name)
      ));
      if (!f) return { ok: false, msg: `没找到叫「${name}」的鱼` };
      f.ageDays = f.lifespanActual;
      return { ok: true, msg: `「${f.persona?.name || f.sp.name}」已进入弥留` };
    },
  },
  {
    name: 'list', alias: ['名单'], usage: '/list', desc: '列出缸里的鱼（名字/物种/年龄）',
    run(_, T) {
      const rows = T.fishes.filter((f) => !f.passer).map((f) => {
        const nm = f.persona?.name || '(无名)';
        return `${nm} · ${f.sp.name} · ${f.ageDays.toFixed(1)}/${f.lifespanStd}天${f.dying ? ' · 弥留' : ''}`;
      });
      return { ok: true, msg: rows.length ? rows.join('\n') : '缸里暂时没有鱼' };
    },
  },
  {
    name: 'star', alias: ['星星'], usage: '/star [名字]', desc: '降一颗星辰（测试用）',
    run(arg, T) {
      const info = { name: (arg || '').trim() || '无名', species: '开发者模式', stage: '', age: 0 };
      const st = new Star(T.world.w * rand(0.3, 0.7), info, '这颗星星来自开发者模式');
      T.stars.push(st);
      return { ok: true, msg: '一颗星星正在落下' };
    },
  },
  {
    name: 'genesis', alias: ['神话', '序章'], usage: '/genesis', desc: '重演藏在海底的故事（神话序章动画）',
    run(_, T) {
      if (!T.playGenesis) return { ok: false, msg: '序章模块没有加载' };
      T.playGenesis();
      return { ok: true, msg: '……海开始讲那个古老的故事了' };
    },
  },
  {
    name: 'save', alias: ['存档'], usage: '/save', desc: '立刻保存进度',
    run(_, T) {
      T.saveFish();
      return { ok: true, msg: '已保存' };
    },
  },
];

/** 解析一行以 / 开头的文本；不是指令返回 null */
export function parseCommand(text) {
  const m = (text || '').trim().match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!m) return null;
  const rawName = m[1];
  const name = rawName.toLowerCase();
  const cmd = COMMANDS.find((c) => c.name === name || (c.alias || []).includes(rawName));
  return { name: rawName, arg: m[2].trim(), cmd };
}

/** 执行一条指令，返回 { ok, msg }；不是指令返回 null */
export function executeCommand(text, T) {
  const p = parseCommand(text);
  if (!p) return null;
  if (!p.cmd) return { ok: false, msg: `没有这条指令：/${p.name}（用 /help 查看全部）` };
  try {
    return p.cmd.run(p.arg, T);
  } catch (err) {
    return { ok: false, msg: `指令执行出错：${err.message}` };
  }
}

const CMD_RE = /\[\[\s*cmd\s*[:：]\s*([^\]]+?)\s*\]\]/gi;

/** 从 AI 回复里抽出 [[cmd: …]] 指令，并返回去掉标记的干净文本 */
export function extractCommands(reply) {
  const cmds = [];
  const clean = (reply || '').replace(CMD_RE, (_, c) => {
    cmds.push(c.trim());
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { clean, cmds };
}

/** 给沫沫的系统提示里用：可用指令清单 */
export function commandCheatSheet() {
  return COMMANDS.filter((c) => c.name !== 'help').map((c) => c.usage).join('、');
}
