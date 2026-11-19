// =====================================================
// 训练模式:整个种群同屏行驶,实时进化(里程碑 3)
// 所有训练车共享同一个世界(同一组敌方车流),每辆车用自己的神经网络驾驶;
// 全部撞毁后,按存活距离计算适应度 → 遗传算法产生下一代 → 重新出发。
// 每代结束自动把当前最佳网络保存到 localStorage,供 AI 代驾模式使用。
// =====================================================
class TrainMode {
  constructor() {
    this.reset();
  }

  // 从头开始训练(首次进入 / 按 R 重启;加速倍率保留,与触屏按钮显示一致)
  reset() {
    this.pop = new Population({ size: CONFIG.TRAIN_POP_SIZE, nnSizes: [7, 12, 2] });
    this.gen = 0;
    this.histBest = [];   // 每代最佳适应度(用于绘制训练曲线)
    this.histMean = [];   // 每代平均适应度
    if (this.speedMul === undefined) this.speedMul = 1;  // 加速倍率(1/2/4/8)
    this.startGeneration();
  }

  // 新一代出发:清空世界,每辆车回到起点
  startGeneration() {
    this.gen++;
    this.cars = this.pop.members.map(m => ({
      nn: m.nn,
      x: CONFIG.WIDTH / 2,      // 从道路中央出发
      y: CONFIG.PLAYER_Y,       // 与玩家同高度(世界滚动,车固定在屏幕同一 y)
      h: CONFIG.TRAIN_H,
      alive: true,
      dist: 0,                  // 本局存活距离(适应度)
    }));
    this.enemies = [];
    this.spawnTimer = 0.6;
    this.genTime = 0;         // 本代已进行的游戏时间(秒)
  }

  aliveCount() {
    let n = 0;
    for (const c of this.cars) if (c.alive) n++;
    return n;
  }

  // 所有车都撞毁:结算适应度 → 记录曲线 → 进化 → 下一代
  settleAndEvolve() {
    for (let i = 0; i < this.pop.members.length; i++) {
      this.pop.members[i].fitness = this.cars[i].dist;
    }
    const { best, mean } = this.pop.stats();
    this.histBest.push(best);
    this.histMean.push(mean);
    // 保存当前最佳网络,代驾模式直接读取
    saveStr('ai-car-train-net', JSON.stringify(this.pop.bestMember().nn.toJSON()));
    this.pop.evolve();
    this.startGeneration();
  }

  // 每帧推进;加速倍率 N 时每帧模拟 N 小步
  update(dt) {
    for (let i = 0; i < this.speedMul; i++) this.step(dt / this.speedMul);
  }

  step(dt) {
    // 全灭或到达单代时长上限 → 结算与进化
    if (this.aliveCount() === 0 || this.genTime >= CONFIG.TRAIN_GEN_MAX_TIME) {
      this.settleAndEvolve();
      return;
    }
    this.genTime += dt;

    Road.update(dt, CONFIG.TRAIN_SPEED);

    // --- 生成敌车(固定中等难度,与游戏模式相同的安全车道逻辑) ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = CONFIG.TRAIN_SPAWN_INTERVAL * rand(0.85, 1.15);
    }
    for (const e of this.enemies) e.update(dt, CONFIG.TRAIN_SPEED);
    this.enemies = this.enemies.filter(e => e.y < CONFIG.HEIGHT + e.h + 60);

    // --- 每辆存活的车:感知 → 决策 → 移动 → 碰撞/越界检测 ---
    for (const c of this.cars) {
      if (!c.alive) continue;
      const inputs = buildCarInputs(
        senseEnemies(c, this.enemies),
        CONFIG.TRAIN_SPEED,
        c.x
      );
      const out = c.nn.forward(inputs);
      // 输出 1 = 转向(横向速度);输出 2 = 油门在本环境不使用
      // (世界以固定速度滚动,训练目标单一:学会躲避车辆)
      c.x += out[0] * CONFIG.TRAIN_STEER_SPEED * dt;
      c.dist += CONFIG.TRAIN_SPEED * dt;
      // 冲出道路(车中心越过路肩)= 死亡:
      // 防止“躲到路边草地”成为作弊策略(敌车只在车道内,草地永远安全)
      if (c.x <= CONFIG.ROAD_X + 2 || c.x >= CONFIG.ROAD_X + CONFIG.ROAD_WIDTH - 2) {
        c.alive = false;
        continue;
      }
      for (const e of this.enemies) {
        if (aabbOverlap(trainCarHitbox(c), e.hitbox)) {
          c.alive = false;
          break;
        }
      }
    }
  }

  // 随机选一条“安全”车道生成敌方车(与 Game.spawnEnemy 相同逻辑)
  spawnEnemy() {
    const free = [];
    for (let lane = 0; lane < CONFIG.LANES; lane++) {
      const blocked = this.enemies.some(
        e => e.lane === lane && e.y < CONFIG.SAME_LANE_MIN_GAP
      );
      if (!blocked) free.push(lane);
    }
    if (free.length > 0) this.enemies.push(new EnemyCar(choice(free)));
  }

  draw(ctx) {
    Road.draw(ctx);

    // 敌车(半透明,让训练车与射线更醒目)
    ctx.globalAlpha = 0.6;
    for (const e of this.enemies) e.draw(ctx);
    ctx.globalAlpha = 1;

    // 训练车:小圆角方块;当前领先者高亮并画出它的传感器射线
    let leader = null;
    for (const c of this.cars) {
      if (!c.alive) continue;
      if (!leader || c.dist > leader.dist) leader = c;
      ctx.fillStyle = 'rgba(74, 144, 226, 0.8)';
      roundRect(ctx, c.x - CONFIG.TRAIN_W / 2, CONFIG.PLAYER_Y - CONFIG.TRAIN_H / 2,
        CONFIG.TRAIN_W, CONFIG.TRAIN_H, 6);
      ctx.fill();
    }
    if (leader) {
      // 领先者的 5 条传感器射线(演示时最直观:AI 的“眼睛”)
      drawCarRays(ctx, leader, this.enemies);
      ctx.fillStyle = '#eb6834';
      roundRect(ctx, leader.x - CONFIG.TRAIN_W / 2, CONFIG.PLAYER_Y - CONFIG.TRAIN_H / 2,
        CONFIG.TRAIN_W, CONFIG.TRAIN_H, 6);
      ctx.fill();
    }

    this.drawPanel(ctx);
    this.drawCurve(ctx);
  }

  // 左上角信息面板:代数 / 存活数 / 最佳与平均距离 / 操作提示
  drawPanel(ctx) {
    const { best, mean } = this.pop.stats();
    ctx.fillStyle = 'rgba(10, 14, 18, 0.62)';
    roundRect(ctx, 12, 12, 216, 84, 8);
    ctx.fill();

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8f0e8';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.fillText('第 ' + this.gen + ' 代 · 存活 ' + this.aliveCount() + '/' + CONFIG.TRAIN_POP_SIZE, 24, 22);
    ctx.fillStyle = '#9aa0a8';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText(
      '最佳 ' + Math.floor(best / 100) + ' m · 平均 ' + Math.floor(mean / 100) + ' m' +
      ' · 本代 ' + Math.floor(this.genTime) + '/' + CONFIG.TRAIN_GEN_MAX_TIME + 's',
      24, 46
    );
    ctx.fillText('1/2/4/8 加速 · R 重新训练 · Esc 返回', 24, 68);
  }

  // 右上角适应度曲线(遵循数据可视化规范:浅色卡片、蓝=最佳、橙=平均)
  drawCurve(ctx) {
    if (this.histBest.length < 2) return;  // 至少 2 代才有曲线

    const W = 232, H = 132;
    const x0 = CONFIG.WIDTH - W - 12, y0 = 12;

    // 卡片背景
    ctx.fillStyle = '#fcfcfb';
    roundRect(ctx, x0, y0, W, H, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 坐标范围:y 从 0 到历史最大值(留 5% 余量),x 覆盖全部代数
    const pad = 12;
    const maxV = Math.max(...this.histBest) * 1.05;
    const n = this.histBest.length;
    const px = i => x0 + pad + (W - pad * 2) * (n === 1 ? 0 : i / (n - 1));
    const py = v => y0 + H - pad - (H - pad * 2) * (v / maxV);

    // 浅色 y 网格(3 条)
    ctx.strokeStyle = '#e1e0d9';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = y0 + H - pad - (H - pad * 2) * (g / 3);
      ctx.beginPath();
      ctx.moveTo(x0 + pad, y);
      ctx.lineTo(x0 + W - pad, y);
      ctx.stroke();
    }

    // 两条折线:蓝 = 最佳,橙 = 平均
    const drawLine = (arr, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = px(i), y = py(arr[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawLine(this.histBest, '#2a78d6');
    drawLine(this.histMean, '#eb6834');

    // 图例(左上角,文字用墨色而非系列色)
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#2a78d6';
    ctx.fillRect(x0 + pad, y0 + 8, 10, 3);
    ctx.fillStyle = '#52514e';
    ctx.fillText('最佳', x0 + pad + 15, y0 + 3);
    ctx.fillStyle = '#eb6834';
    ctx.fillRect(x0 + pad + 48, y0 + 8, 10, 3);
    ctx.fillStyle = '#52514e';
    ctx.fillText('平均', x0 + pad + 63, y0 + 3);
  }
}

// 训练车的碰撞箱(比外观略小,判定宽容一点)
function trainCarHitbox(c) {
  const s = CONFIG.TRAIN_HITBOX_SCALE;
  const w = CONFIG.TRAIN_W * s, h = CONFIG.TRAIN_H * s;
  return { x: c.x - w / 2, y: CONFIG.PLAYER_Y - h / 2, w, h };
}
