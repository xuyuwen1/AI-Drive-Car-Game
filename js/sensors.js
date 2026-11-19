// =====================================================
// 射线传感器:从车头发射 5 条射线探测前方车辆(训练与代驾共用)
// 与离线玩具环境(每车道最近障碍距离)不同,真实游戏是连续坐标,
// 因此用角度扇形射线:±60°、±30°、0°(0° = 车头正前方)。
// 每条射线返回归一化距离 [0,1]:1 = 该方向没有车,0 = 车已贴脸
// =====================================================

// 射线与轴对齐矩形求交(slab 法)。
// 返回射线起点到矩形的最近距离 t(0 <= t <= maxLen),无交点返回 null
function rayAABB(px, py, dx, dy, box, maxLen) {
  let tmin = 0, tmax = maxLen;
  // x 方向:求射线参数 t 的区间
  if (Math.abs(dx) < 1e-9) {
    if (px < box.x || px > box.x + box.w) return null;  // 平行且不在范围内
  } else {
    let t1 = (box.x - px) / dx;
    let t2 = (box.x + box.w - px) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  // y 方向
  if (Math.abs(dy) < 1e-9) {
    if (py < box.y || py > box.y + box.h) return null;
  } else {
    let t1 = (box.y - py) / dy;
    let t2 = (box.y + box.h - py) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return Math.max(tmin, 0);  // 起点在矩形内部时视为 0(贴脸)
}

// 探测一辆车前方的障碍分布。
// car: { x, y, w, h }(y 为车辆中心,车头朝屏幕上方)
// 返回 Float64Array(5),按 CONFIG.RAY_ANGLES 顺序的归一化距离
function senseEnemies(car, enemies) {
  const out = new Float64Array(CONFIG.RAY_ANGLES.length);
  const px = car.x;
  const py = car.y - car.h / 2 - 4;  // 射线起点:车头前方一点
  for (let i = 0; i < CONFIG.RAY_ANGLES.length; i++) {
    const a = CONFIG.RAY_ANGLES[i] * Math.PI / 180;
    const dx = Math.sin(a);   // 屏幕坐标系:y 向下,x 向右
    const dy = -Math.cos(a);  // 0° 指向屏幕上方
    let best = CONFIG.RAY_LEN;
    for (const e of enemies) {
      const t = rayAABB(px, py, dx, dy, e.hitbox, CONFIG.RAY_LEN);
      if (t !== null && t < best) best = t;
    }
    out[i] = best / CONFIG.RAY_LEN;
  }
  return out;
}

// 组装神经网络的完整输入(7 个,与离线训练环境结构一致):
// [0..4] 5 条射线距离(0 近 ~ 1 远)
// [5]    速度归一化 [0,1]
// [6]    自身横向位置归一化 [0,1](0 = 路左,1 = 路右)
function buildCarInputs(rays, speed, x) {
  const inputs = new Float64Array(7);
  inputs.set(rays);
  inputs[5] = clamp(
    (speed - CONFIG.PLAYER_MIN_SPEED) / (CONFIG.PLAYER_MAX_SPEED - CONFIG.PLAYER_MIN_SPEED),
    0, 1
  );
  inputs[6] = clamp((x - CONFIG.ROAD_X) / CONFIG.ROAD_WIDTH, 0, 1);
  return inputs;
}

// 可视化一辆车的传感器射线(训练模式画领先者,代驾模式画玩家)
// 命中点离得越近颜色越红,直观展示 AI 看到了什么
function drawCarRays(ctx, car, enemies) {
  const px = car.x;
  const py = car.y - car.h / 2 - 4;
  const rays = senseEnemies(car, enemies);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.85)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < CONFIG.RAY_ANGLES.length; i++) {
    const a = CONFIG.RAY_ANGLES[i] * Math.PI / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const len = rays[i] * CONFIG.RAY_LEN;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + dx * len, py + dy * len);
    ctx.stroke();
    if (len < CONFIG.RAY_LEN - 1) {
      ctx.fillStyle = rays[i] < 0.35 ? '#e23b3b' : '#ffd23f';
      ctx.beginPath();
      ctx.arc(px + dx * len, py + dy * len, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
