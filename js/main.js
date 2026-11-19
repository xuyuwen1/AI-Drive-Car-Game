// =====================================================
// 程序入口:画布初始化、键盘输入、游戏主循环
// =====================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 高分屏适配:按 devicePixelRatio 放大画布内部分辨率,保证画面清晰
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = CONFIG.WIDTH * dpr;
canvas.height = CONFIG.HEIGHT * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// 画布等比缩放以适配窗口(保持 480:720 比例)
function fitCanvas() {
  const scale = Math.min(
    window.innerWidth / CONFIG.WIDTH,
    window.innerHeight / CONFIG.HEIGHT
  );
  canvas.style.width = CONFIG.WIDTH * scale + 'px';
  canvas.style.height = CONFIG.HEIGHT * scale + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// 键盘输入状态(触屏虚拟按钮也写入这里,统一输入接口)
const Input = { left: false, right: false, up: false, down: false };

const KEYMAP = {
  ArrowLeft: 'left',  KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up',       KeyW: 'up',
  ArrowDown: 'down',   KeyS: 'down',
};

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) {
    Input[KEYMAP[e.code]] = true;
    e.preventDefault();  // 阻止方向键滚动页面
  }
  if (game.state === 'training') {
    // 训练模式快捷键:数字键切换加速倍率,R 重新训练,Esc 返回菜单
    if (e.code === 'Digit1') trainMode.speedMul = 1;
    if (e.code === 'Digit2') trainMode.speedMul = 2;
    if (e.code === 'Digit4') trainMode.speedMul = 4;
    if (e.code === 'Digit8') trainMode.speedMul = 8;
    if (e.code === 'KeyR') trainMode.reset();
    if (e.code === 'Escape') game.backToMenu();
    return;
  }
  if (e.code === 'KeyR' && game.state !== 'menu') game.start();
  if (e.code === 'KeyT' && game.state === 'playing') game.toggleAutopilot();
  if (e.code === 'Escape' || e.code === 'KeyP') game.togglePause();
});

window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) Input[KEYMAP[e.code]] = false;
});

// 窗口失焦时松开所有按键,避免“卡键”
window.addEventListener('blur', () => {
  for (const k in Input) Input[k] = false;
});

// 游戏实例与 UI 初始化
// (注意:实例名为小写 game,避免与 game.js 中的 Game 类在全局作用域重名冲突;
//  同理 trainMode 小写实例对应 train.js 中的 TrainMode 类)
const game = new Game();
const trainMode = new TrainMode();
UI.init();

// 主循环:requestAnimationFrame 驱动,dt 上限 0.05s 防止切后台后跳帧
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (game.state === 'training') {
    trainMode.update(dt);
    trainMode.draw(ctx);
  } else {
    game.update(dt);
    game.draw(ctx);
  }

  // 同步触屏按钮的显示状态(训练模式显示训练按钮,游戏中显示 AI 按钮)
  document.body.classList.toggle('training', game.state === 'training');
  document.body.classList.toggle('playing', game.state === 'playing');

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
