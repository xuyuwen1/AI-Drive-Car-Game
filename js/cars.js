// =====================================================
// 车辆实体与绘制:玩家车、敌方车辆
// (后续里程碑会加入 AI 训练车,继承类似的物理接口)
// =====================================================

// 车道中心 x 坐标
function laneCenterX(lane) {
  const laneW = CONFIG.ROAD_WIDTH / CONFIG.LANES;
  return CONFIG.ROAD_X + laneW * (lane + 0.5);
}

// 绘制一辆俯视小车(x, y 为车辆中心,车头朝上)
// palette: { body, roof, accent?, stripe? }
function drawCarSprite(ctx, x, y, w, h, palette, isTruck = false) {
  ctx.save();
  ctx.translate(x, y);

  // 车轮(车身四周露出一点)
  ctx.fillStyle = '#1c1c20';
  const wheelW = 7, wheelH = 16, wx = w / 2 - 1, wy = h / 2 - 14;
  ctx.fillRect(-wx - wheelW, -wy - wheelH / 2, wheelW, wheelH);  // 左前
  ctx.fillRect(-wx - wheelW,  wy - wheelH / 2, wheelW, wheelH);  // 左后
  ctx.fillRect( wx,          -wy - wheelH / 2, wheelW, wheelH);  // 右前
  ctx.fillRect( wx,           wy - wheelH / 2, wheelW, wheelH);  // 右后

  // 车身
  roundRect(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fillStyle = palette.body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.stroke();

  if (isTruck) {
    // --- 卡车:前方车头 + 后方货厢 ---
    roundRect(ctx, -w / 2 + 4, -h / 2 + h * 0.34, w - 8, h * 0.62, 4);
    ctx.fillStyle = palette.roof;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.stroke();
    // 车头挡风玻璃
    ctx.fillStyle = '#bfe0ee';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 6, w - 16, 9);
    // 车头颜色(与货厢区分)
    roundRect(ctx, -w / 2 + 5, -h / 2 + 16, w - 10, h * 0.14, 4);
    ctx.fillStyle = palette.accent || palette.body;
    ctx.fill();
    // 货厢分格线
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      const gy = -h / 2 + h * 0.34 + (h * 0.62) * (i / 3);
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, gy);
      ctx.lineTo(w / 2 - 4, gy);
      ctx.stroke();
    }
  } else {
    // --- 小汽车:前挡风玻璃 + 车顶 + 后挡风玻璃 ---
    roundRect(ctx, -w / 2 + 6, -h / 2 + 7, w - 12, h * 0.16, 4);
    ctx.fillStyle = '#bfe0ee';
    ctx.fill();
    roundRect(ctx, -w / 2 + 6, -h / 2 + h * 0.32, w - 12, h * 0.30, 6);
    ctx.fillStyle = palette.roof;
    ctx.fill();
    roundRect(ctx, -w / 2 + 6, -h / 2 + h * 0.70, w - 12, h * 0.13, 4);
    ctx.fillStyle = '#bfe0ee';
    ctx.fill();

    // 赛车条纹(玩家车装饰)
    if (palette.stripe) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(-3, -h / 2 + 4, 6, h - 8);
    }

    // 车灯:前黄后红
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(-w / 2 + 7, -h / 2 + 2, 6, 5);
    ctx.fillRect( w / 2 - 13, -h / 2 + 2, 6, 5);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(-w / 2 + 7, h / 2 - 7, 6, 5);
    ctx.fillRect( w / 2 - 13, h / 2 - 7, 6, 5);
  }

  ctx.restore();
}

// =====================================================
// 玩家车:由键盘/触屏控制
// =====================================================
class PlayerCar {
  constructor() {
    this.w = CONFIG.PLAYER_W;
    this.h = CONFIG.PLAYER_H;
    this.x = CONFIG.WIDTH / 2;
    this.y = CONFIG.PLAYER_Y;
    this.speed = CONFIG.PLAYER_DEFAULT_SPEED;
    this.palette = CAR_COLORS.player;
    this.tilt = 0;  // 转向时的车身倾斜(纯视觉效果)
  }

  // steerOverride:AI 代驾时传入网络输出的连续转向值 [-1, 1],替代键盘输入
  update(dt, input, steerOverride = null) {
    // 横向移动(变道)
    if (steerOverride !== null) {
      this.x += steerOverride * CONFIG.PLAYER_STEER_SPEED * dt;
    } else {
      if (input.left)  this.x -= CONFIG.PLAYER_STEER_SPEED * dt;
      if (input.right) this.x += CONFIG.PLAYER_STEER_SPEED * dt;
    }
    const minX = CONFIG.ROAD_X + this.w / 2 + 4;
    const maxX = CONFIG.ROAD_X + CONFIG.ROAD_WIDTH - this.w / 2 - 4;
    this.x = clamp(this.x, minX, maxX);

    // 纵向速度:油门/刹车;松手后缓慢回到巡航速度
    if (input.up)   this.speed += CONFIG.PLAYER_ACCEL * dt;
    if (input.down) this.speed -= CONFIG.PLAYER_BRAKE * dt;
    if (!input.up && !input.down) {
      this.speed = lerp(this.speed, CONFIG.PLAYER_DEFAULT_SPEED, 1 - Math.exp(-0.8 * dt));
    }
    this.speed = clamp(this.speed, CONFIG.PLAYER_MIN_SPEED, CONFIG.PLAYER_MAX_SPEED);

    // 视觉倾斜:朝转向方向微微倾斜,平滑过渡
    const targetTilt = input.left ? -0.12 : (input.right ? 0.12 : 0);
    this.tilt = lerp(this.tilt, targetTilt, 1 - Math.exp(-10 * dt));
  }

  // 碰撞箱(缩小一圈,判定更宽容)
  get hitbox() {
    const s = CONFIG.PLAYER_HITBOX_SCALE;
    const w = this.w * s, h = this.h * s;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    drawCarSprite(ctx, 0, 0, this.w, this.h, this.palette, false);
    ctx.restore();
  }
}

// =====================================================
// 敌方车辆:沿自己的车道向前行驶(比玩家慢,被玩家追上)
// =====================================================
class EnemyCar {
  constructor(lane) {
    this.lane = lane;
    this.isTruck = Math.random() < CONFIG.TRUCK_RATE;
    this.w = this.isTruck ? 50 : 44;
    this.h = this.isTruck ? 118 : 76;
    this.x = laneCenterX(lane);
    this.y = -this.h;  // 从屏幕上方外进入
    this.speed = this.isTruck
      ? rand(CONFIG.TRUCK_MIN_SPEED, CONFIG.TRUCK_MAX_SPEED)
      : rand(CONFIG.ENEMY_MIN_SPEED, CONFIG.ENEMY_MAX_SPEED);
    this.palette = this.isTruck ? choice(CAR_COLORS.truck) : choice(CAR_COLORS.enemy);
  }

  // 敌方自身速度为 this.speed,与玩家同向行驶。
  // 敌方在屏幕上的相对速度 = worldSpeed - this.speed(玩家更快时敌方从上方接近)
  update(dt, worldSpeed) {
    this.y += (worldSpeed - this.speed) * dt;
  }

  get hitbox() {
    const s = CONFIG.ENEMY_HITBOX_SCALE;
    const w = this.w * s, h = this.h * s;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  draw(ctx) {
    drawCarSprite(ctx, this.x, this.y, this.w, this.h, this.palette, this.isTruck);
  }
}
