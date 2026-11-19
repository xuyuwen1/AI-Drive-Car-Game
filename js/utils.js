// =====================================================
// 通用工具函数
// =====================================================

// [min, max) 之间的随机浮点数
function rand(min, max) { return min + Math.random() * (max - min); }

// [min, max] 之间的随机整数
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

// 把 v 限制在 [lo, hi] 内
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

// 线性插值
function lerp(a, b, t) { return a + (b - a) * t; }

// 从数组中随机取一个元素
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// 两个轴对齐矩形( {x, y, w, h} )是否相交
function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// 圆角矩形路径(旧浏览器兜底实现)
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// localStorage 安全读写(file:// 协议下部分浏览器会禁用 localStorage)
function loadNum(key, def = 0) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : Number(v);
  } catch (e) { return def; }
}

function saveNum(key, val) {
  try { localStorage.setItem(key, String(val)); } catch (e) { /* 忽略 */ }
}

// 字符串读写(用于保存/读取训练出的神经网络 JSON)
function loadStr(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v;
  } catch (e) { return def; }
}

function saveStr(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* 忽略 */ }
}

// 标准正态分布随机数(Box-Muller 变换,用于高斯变异)
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 返回打乱后的新数组(不修改原数组)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
