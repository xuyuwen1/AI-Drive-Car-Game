// =====================================================
// 游戏世界:状态机、车辆生成、碰撞检测、计分、特效
// 状态:menu(菜单) / playing(游戏中) / gameover(结束) / training(训练模式)
// 训练模式的更新与绘制由 TrainMode(train.js)接管,Game 只负责状态切换
// =====================================================
class Game {
  constructor() {
    this.state = 'menu';
    this.paused = false;
    this.reset();
  }

  // 重置一局
  reset() {
    this.player = new PlayerCar();
    this.enemies = [];
    this.spawnTimer = 0.8;  // 开局 0.8 秒后出现第一辆车
    this.elapsed = 0;       // 本局经过时间(秒)
    this.distance = 0;      // 累计行驶距离(像素)
    this.score = 0;         // 分数
    this.particles = [];    // 碰撞粒子
    this.crashFlash = 0;    // 碰撞白闪强度
    this.shake = 0;         // 震屏强度
    this.bestScore = loadNum('ai-car-best');
    this.autopilot = false; // AI 代驾开关(按 T 切换)
    this.aiNet = null;      // 当前代驾使用的神经网络
    this.notice = null;     // 短暂提示消息 { text, t }
  }

  // 加载可用网络:优先训练模式保存的,其次内置“出厂 AI”
  loadBestNet() {
    const saved = loadStr('ai-car-train-net');
    if (saved) {
      try {
        const nn = NeuralNetwork.fromJSON(JSON.parse(saved));
        if (nn.sizes.join('-') === '7-12-2') return nn;
      } catch (e) { /* 损坏的数据忽略,回退到出厂 AI */ }
    }
    if (typeof PRESET_NET !== 'undefined') return NeuralNetwork.fromJSON(PRESET_NET);
    return null;
  }

  // 切换 AI 代驾(游戏中按 T)
  toggleAutopilot() {
    if (this.state !== 'playing') return;
    if (this.autopilot) {
      this.autopilot = false;
      this.notice = { text: '已切回手动驾驶', t: 1.5 };
      return;
    }
    this.aiNet = this.loadBestNet();
    if (!this.aiNet) {
      this.notice = { text: '没有可用的 AI 网络,请先在训练模式训练', t: 2.5 };
      return;
    }
    this.autopilot = true;
    this.notice = { text: 'AI 代驾已开启(再按 T 切回)', t: 1.5 };
  }

  // 开始新游戏(菜单/结算界面按钮调用)
  start() {
    this.reset();
    this.state = 'playing';
    this.paused = false;
    UI.hideOverlays();
  }

  // 进入训练模式(种群进化画面,由 TrainMode 接管)
  startTraining() {
    UI.hideOverlays();
    this.state = 'training';
  }

  // 从训练模式返回菜单
  backToMenu() {
    this.state = 'menu';
    UI.showMenu();
  }

  // 暂停/继续(Esc / P)
  togglePause() {
    if (this.state !== 'playing') return;
    this.paused = !this.paused;
    UI.setPauseOverlay(this.paused);
  }

  update(dt) {
    if (this.state === 'menu') {
      Road.update(dt, CONFIG.MENU_SCROLL_SPEED);  // 菜单背景:公路缓慢滚动
      return;
    }
    if (this.state === 'training') return;  // 训练模式:由 TrainMode 完全接管
    if (this.state !== 'playing' || this.paused) return;

    this.elapsed += dt;
    Road.update(dt, this.player.speed);  // 世界以玩家速度滚动

    // --- 生成敌方车辆(难度随时间递增) ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      const ramp = Math.min(1, this.elapsed / CONFIG.SPAWN_RAMP_TIME);
      const interval = lerp(CONFIG.SPAWN_INTERVAL_START, CONFIG.SPAWN_INTERVAL_MIN, ramp);
      this.spawnTimer = interval * rand(0.8, 1.2);
    }

    // --- 玩家 ---
    if (this.notice) {
      this.notice.t -= dt;
      if (this.notice.t <= 0) this.notice = null;
    }
    if (this.autopilot && this.aiNet) {
      // AI 代驾:感知(5 条射线)→ 神经网络决策 → 连续转向;油门保持巡航
      const inputs = buildCarInputs(
        senseEnemies(this.player, this.enemies),
        this.player.speed,
        this.player.x
      );
      const out = this.aiNet.forward(inputs);
      this.player.update(dt, Input, out[0]);
    } else {
      this.player.update(dt, Input);
    }
    this.distance += this.player.speed * dt;
    this.score = Math.floor(this.distance * CONFIG.SCORE_PER_PIXEL);

    // --- 敌方车辆(同车道保持车距) ---
    for (const e of this.enemies) e.update(dt, this.player.speed);
    this.resolveLaneOverlaps();
    this.enemies = this.enemies.filter(e => e.y < CONFIG.HEIGHT + e.h + 60);

    // --- 碰撞检测 ---
    for (const e of this.enemies) {
      if (aabbOverlap(this.player.hitbox, e.hitbox)) {
        this.gameOver();
        return;
      }
    }

    // --- 特效更新 ---
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);
    this.crashFlash = Math.max(0, this.crashFlash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  // 随机选一条“安全”车道生成敌方车(避免刚生成就与前车重叠)
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

  // 同车道内:后车追近到最小间距后,速度与前车保持一致(形成车队,不穿模)
  resolveLaneOverlaps() {
    const byLane = {};
    for (const e of this.enemies) {
      if (!byLane[e.lane]) byLane[e.lane] = [];
      byLane[e.lane].push(e);
    }
    for (const lane in byLane) {
      const cars = byLane[lane].sort((a, b) => a.y - b.y);  // y 小的在前(更靠上)
      for (let i = 1; i < cars.length; i++) {
        const front = cars[i - 1], back = cars[i];
        const gap = back.y - front.y - (back.h + front.h) / 2;
        if (gap < CONFIG.SAME_LANE_MIN_GAP && back.speed > front.speed) {
          back.speed = front.speed;
        }
      }
    }
  }

  // 撞车:进入结束状态、更新最佳分、播放爆炸特效
  gameOver() {
    this.state = 'gameover';
    this.shake = 1;
    this.crashFlash = 1;
    this.spawnExplosion(this.player.x, this.player.y);
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveNum('ai-car-best', this.bestScore);
    }
    UI.showGameOver(this.score, this.bestScore);
  }

  // 爆炸粒子特效
  spawnExplosion(x, y) {
    for (let i = 0; i < 26; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(40, 260);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.4, 0.9),
        maxLife: 0.9,
        size: rand(3, 7),
        color: choice(['#ffd23f', '#ff7a3d', '#e23b3b', '#8a8a92', '#f5f5f0']),
        update(dt) {
          this.life -= dt;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.vx *= 0.98;
          this.vy *= 0.98;
        },
      });
    }
  }

  draw(ctx) {
    Road.draw(ctx);

    ctx.save();
    if (this.shake > 0) {
      // 震屏:随机小偏移
      ctx.translate(rand(-1, 1) * this.shake * 8, rand(-1, 1) * this.shake * 8);
    }

    for (const e of this.enemies) e.draw(ctx);
    // AI 代驾时把传感器的“眼睛”画出来
    if (this.state === 'playing' && this.autopilot) {
      drawCarRays(ctx, this.player, this.enemies);
    }
    if (this.state !== 'gameover') this.player.draw(ctx);

    // 粒子
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 碰撞白闪
    if (this.crashFlash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (this.crashFlash * 0.55) + ')';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    if (this.state !== 'menu') HUD.draw(ctx, this);
  }
}
