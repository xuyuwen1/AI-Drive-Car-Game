// =====================================================
// UI 层:HUD 绘制、菜单/结算/暂停覆盖层、触摸虚拟按钮
// =====================================================
const UI = {
  els: {},

  init() {
    this.els.menu = document.getElementById('menu-overlay');
    this.els.gameover = document.getElementById('gameover-overlay');
    this.els.pause = document.getElementById('pause-overlay');
    this.els.finalScore = document.getElementById('final-score');
    this.els.bestScore = document.getElementById('best-score');

    document.getElementById('btn-start').addEventListener('click', () => game.start());
    document.getElementById('btn-restart').addEventListener('click', () => game.start());
    document.getElementById('btn-train').addEventListener('click', () => game.startTraining());
    document.getElementById('btn-export').addEventListener('click', () => this.exportNet());
    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('file-import').click();
    });
    document.getElementById('file-import').addEventListener('change', (e) => this.importNet(e));

    this.initTouch();
  },

  // 导出当前 AI 网络为 JSON 文件(Python 离线训练的网络也是这个格式,互通)
  exportNet() {
    const net = game.loadBestNet();
    const btn = document.getElementById('btn-export');
    if (!net) {
      btn.textContent = '暂无网络 ✗';
      setTimeout(() => { btn.textContent = '导出 AI 网络'; }, 1800);
      return;
    }
    const blob = new Blob([JSON.stringify(net.toJSON())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'best_net.json';
    a.click();
    URL.revokeObjectURL(a.href);
    btn.textContent = '已导出 ✓';
    setTimeout(() => { btn.textContent = '导出 AI 网络'; }, 1800);
  },

  // 导入 JSON 网络(可导入 Python 离线训练的 best_net.json)
  importNet(e) {
    const file = e.target.files[0];
    const btn = document.getElementById('btn-import');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        const nn = NeuralNetwork.fromJSON(obj);
        if (nn.sizes.join('-') !== '7-12-2') throw new Error('网络结构不匹配');
        saveStr('ai-car-train-net', JSON.stringify(obj));
        btn.textContent = '导入成功 ✓';
      } catch (err) {
        btn.textContent = '文件无效 ✗';
      }
      setTimeout(() => { btn.textContent = '导入 AI 网络'; }, 1800);
    };
    reader.readAsText(file);
    e.target.value = '';  // 清空,允许再次选择同一个文件
  },

  hideOverlays() {
    this.els.menu.classList.remove('visible');
    this.els.gameover.classList.remove('visible');
    this.els.pause.classList.remove('visible');
  },

  showMenu() {
    this.els.menu.classList.add('visible');
    this.els.gameover.classList.remove('visible');
    this.els.pause.classList.remove('visible');
  },

  showGameOver(score, best) {
    this.els.finalScore.textContent = '本局分数:' + score;
    this.els.bestScore.textContent = '历史最佳:' + best;
    this.els.gameover.classList.add('visible');
  },

  setPauseOverlay(show) {
    this.els.pause.classList.toggle('visible', show);
  },

  // 触屏设备显示虚拟方向盘按钮,并绑定按压事件
  initTouch() {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
    document.body.classList.add('touch');
    const buttons = document.querySelectorAll('.touch-btn[data-key]');
    for (const btn of buttons) {
      const key = btn.dataset.key;
      const press = (on) => (e) => {
        e.preventDefault();
        Input[key] = on;
      };
      btn.addEventListener('pointerdown', press(true));
      btn.addEventListener('pointerup', press(false));
      btn.addEventListener('pointercancel', press(false));
      btn.addEventListener('pointerleave', press(false));
    }

    // AI 代驾切换按钮(游戏中显示)
    const aiBtn = document.getElementById('touch-ai');
    aiBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.toggleAutopilot();
      aiBtn.classList.toggle('on', game.autopilot);
    });

    // 训练模式:加速倍率循环 1 → 2 → 4 → 8 → 1
    const speedBtn = document.getElementById('touch-speed');
    speedBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      trainMode.speedMul = trainMode.speedMul >= 8 ? 1 : trainMode.speedMul * 2;
      speedBtn.textContent = '⏩ ' + trainMode.speedMul + 'x';
    });

    // 训练模式:返回菜单
    document.getElementById('touch-back').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.backToMenu();
    });
  },
};

// HUD:直接绘制在 canvas 顶部的计分信息
const HUD = {
  draw(ctx, game) {
    const pad = 16;

    // 半透明顶栏背景
    ctx.fillStyle = 'rgba(10, 14, 18, 0.5)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, 64);

    ctx.textBaseline = 'top';

    // 左:分数
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px Consolas, monospace';
    ctx.fillText(String(game.score).padStart(5, '0'), pad, 8);
    ctx.fillStyle = '#9aa0a8';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('分数', pad, 44);

    // 中:速度
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f0e8';
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.fillText(Math.round(game.player.speed * 0.4) + ' km/h', CONFIG.WIDTH / 2, 12);
    ctx.fillStyle = '#9aa0a8';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('速度', CONFIG.WIDTH / 2, 40);

    // 右:距离与最佳分
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8f0e8';
    ctx.font = 'bold 20px Consolas, monospace';
    ctx.fillText(Math.floor(game.distance / 100) + ' m', CONFIG.WIDTH - pad, 10);
    ctx.fillStyle = '#9aa0a8';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('最佳 ' + game.bestScore, CONFIG.WIDTH - pad, 40);

    // AI 代驾标记
    if (game.autopilot) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText('◈ AI 驾驶中', CONFIG.WIDTH / 2, 50);
    }

    // 短暂提示(切换 AI 等)
    if (game.notice) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(232, 240, 232, ' + Math.min(1, game.notice.t) + ')';
      ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
      ctx.fillText(game.notice.text, CONFIG.WIDTH / 2, CONFIG.HEIGHT * 0.30);
    }
  },
};
