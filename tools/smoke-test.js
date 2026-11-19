// =====================================================
// 冒烟测试:在 Node 中用桩(stub)环境加载全部游戏脚本,
// 验证脚本加载、开局、操控、碰撞结算、训练模式进化等流程不报错。
// 运行:node tools/smoke-test.js
// =====================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const FILES = ['config.js', 'utils.js', 'nn.js', 'ga.js', 'road.js', 'cars.js', 'sensors.js', 'game.js', 'train.js', 'preset-net.js', 'ui.js', 'main.js'];
const source = FILES.map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8')).join('\n');

// --- 伪造 2D 绘图上下文:接受一切调用 ---
function makeCtx() {
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'roundRect') return undefined;  // 让 roundRect 走 polyfill 分支
      if (prop === 'canvas') return null;
      return () => {};
    },
    set(target, prop, val) { target[prop] = val; return true; },
  });
}

// --- 伪造 DOM 元素 ---
function makeEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    style: {},
    dataset: {},
    textContent: '',
    width: 0,
    height: 0,
    getContext: () => makeCtx(),
  };
}

const els = {};
const sandbox = {
  document: {
    getElementById: (id) => (els[id] || (els[id] = makeEl())),
    querySelectorAll: () => [],
    body: { classList: { add() {}, toggle() {} } },
  },
  window: {
    addEventListener() {},
    innerWidth: 480,
    innerHeight: 720,
    devicePixelRatio: 1,
  },
  navigator: { maxTouchPoints: 0 },
  localStorage: (() => {  // 简单的内存实现,让 loadStr/saveStr 真正读写
    const store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    };
  })(),
  performance: { now: () => 0 },
  // 只自动跑 5 帧,防止死循环
  requestAnimationFrame: (fn) => { if (rafCount++ < 5) fn(16.7 * rafCount); },
  console,
};
let rafCount = 0;
vm.createContext(sandbox);

try {
  vm.runInContext(source, sandbox, { filename: 'game.js' });
  console.log('✓ 全部脚本加载成功');
} catch (e) {
  console.error('✗ 脚本加载失败:', e);
  process.exit(1);
}

// --- 测试游戏流程:开始 → 行驶计分 → 操控 → 碰撞结算 ---
try {
  vm.runInContext(`
    // 1. 开始游戏
    game.start();
    if (game.state !== 'playing') throw new Error('开始游戏失败');
    const score0 = game.score;

    // 2. 跑 2 秒(应生成敌方车辆,计分增长)
    for (let i = 0; i < 120; i++) game.update(1 / 60);
    if (game.enemies.length === 0) throw new Error('2 秒内未生成任何敌方车辆');
    if (game.score <= score0) throw new Error('分数未增长');

    // 3. 操控:按左键应向左移动
    const x0 = game.player.x;
    Input.left = true;
    for (let i = 0; i < 10; i++) game.update(1 / 60);
    Input.left = false;
    if (game.player.x >= x0) throw new Error('按左键没有向左移动');

    // 4. 撞车结算:把一辆敌车放到玩家位置,应进入 gameover 并刷新最佳分
    game.enemies.push(new EnemyCar(2));
    const e = game.enemies[game.enemies.length - 1];
    e.x = game.player.x;
    e.y = game.player.y;
    game.update(1 / 60);
    if (game.state !== 'gameover') throw new Error('碰撞后未进入 gameover');
    if (game.bestScore !== game.score) throw new Error('最佳分未更新');
  `, sandbox, { filename: 'test.js' });
  console.log('✓ 游戏流程测试通过(开局/生成/计分/操控/碰撞结算)');
} catch (e) {
  console.error('✗ 游戏流程测试失败:', e);
  process.exit(1);
}

// --- 测试训练模式:进入 → 行驶 → 全灭进化 → 下一代的完整闭环 ---
try {
  vm.runInContext(`
    // 1. 进入训练模式
    game.startTraining();
    if (game.state !== 'training') throw new Error('进入训练模式失败');
    if (trainMode.cars.length !== CONFIG.TRAIN_POP_SIZE) throw new Error('种群数量不正确');
    const gen0 = trainMode.gen;

    // 2. 跑 3 秒:应有车辆存活、行驶距离增长、传感器与决策不报错
    for (let i = 0; i < 180; i++) trainMode.update(1 / 60);
    if (trainMode.aliveCount() === 0 && trainMode.gen === gen0) {
      throw new Error('3 秒内全灭且未进化(敌车密度异常)');
    }

    // 3. 强制全灭 → 应触发结算与进化:代数 +1、曲线记录、新一代出发
    for (const c of trainMode.cars) c.alive = false;
    trainMode.update(1 / 60);
    if (trainMode.gen !== gen0 + 1) throw new Error('全灭后未进化');
    if (trainMode.histBest.length !== 1) throw new Error('适应度曲线未记录');
    if (trainMode.aliveCount() !== CONFIG.TRAIN_POP_SIZE) throw new Error('新一代未全部出发');
    if (!loadStr('ai-car-train-net')) throw new Error('最佳网络未保存到 localStorage');

    // 4. 绘制训练画面(含领先者射线、信息面板、适应度曲线)不应报错
    trainMode.draw(ctx);

    // 5. 返回菜单
    game.backToMenu();
    if (game.state !== 'menu') throw new Error('返回菜单失败');
  `, sandbox, { filename: 'test-train.js' });
  console.log('✓ 训练模式测试通过(进化闭环/网络保存/射线绘制/返回菜单)');
} catch (e) {
  console.error('✗ 训练模式测试失败:', e);
  process.exit(1);
}

// --- 测试 AI 代驾:切换、AI 转向生效、网络优先级 ---
try {
  vm.runInContext(`
    // 1. 开始游戏并按 T 开启 AI 代驾(此时有训练模式刚保存的网络)
    game.start();
    game.toggleAutopilot();
    if (!game.autopilot) throw new Error('AI 代驾开启失败');
    if (!game.aiNet) throw new Error('未加载到 AI 网络');

    // 2. 手动清空输入,跑 3 秒:AI 应独立控制转向(x 坐标变化)
    Input.left = Input.right = false;
    const ax0 = game.player.x;
    for (let i = 0; i < 180; i++) game.update(1 / 60);
    if (Math.abs(game.player.x - ax0) < 1) throw new Error('AI 代驾期间车辆没有转向');

    // 3. 再按 T 切回手动
    game.toggleAutopilot();
    if (game.autopilot) throw new Error('AI 代驾关闭失败');

    // 4. 清空训练网络后,应回退到内置“出厂 AI”
    localStorage.setItem('ai-car-train-net', '');
    game.toggleAutopilot();
    if (!game.autopilot || !game.aiNet) throw new Error('未回退到出厂 AI');
    game.toggleAutopilot();

    // 5. 代驾画面(含传感器射线)绘制不报错
    game.draw(ctx);
  `, sandbox, { filename: 'test-autopilot.js' });
  console.log('✓ AI 代驾测试通过(切换/转向/网络回退/射线绘制)');
} catch (e) {
  console.error('✗ AI 代驾测试失败:', e);
  process.exit(1);
}
