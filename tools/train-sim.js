// =====================================================
// 训练模拟:在 Node 中无渲染地跑训练模式(真实游戏环境),
// 验证「种群同屏进化」确实能让适应度逐代上升。
// 用法:node tools/train-sim.js [代数上限,默认 30] [加速倍率,默认 8] [--save]
//   --save:训练结束后把最佳网络写入 js/preset-net.js(网页内置的“出厂 AI”)
// =====================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const FILES = ['config.js', 'utils.js', 'nn.js', 'ga.js', 'road.js', 'cars.js', 'sensors.js', 'train.js'];
for (const f of FILES) {
  vm.runInThisContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), { filename: f });
}

// TrainMode 只在保存网络时触碰 localStorage(utils 已做 try/catch,这里再补一个空实现更稳)
if (typeof localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
}

const MAX_GEN = Number(process.argv[2] || 30);
const MUL = Number(process.argv[3] || 8);
const SAVE = process.argv.includes('--save');
const t0 = Date.now();

const tm = new TrainMode();
tm.speedMul = MUL;
tm.lastLoggedGen = 0;  // 用于“完成一代才打印一行”的日志标记
console.log(`训练模拟:最多 ${MAX_GEN} 代,加速 ${MUL}x,种群 ${CONFIG.TRAIN_POP_SIZE},网络 7-12-2`);

while (tm.gen <= MAX_GEN) {
  tm.update(1 / 60);
  if (tm.gen > tm.lastLoggedGen) {
    // 刚结算的是上一代:从曲线记录里取它的最佳/平均(当前种群是未评估的新一代)
    const best = tm.histBest[tm.histBest.length - 1];
    const mean = tm.histMean[tm.histMean.length - 1];
    if (best !== undefined) {
      console.log(
        '代数 ' + String(tm.gen - 1).padStart(3) +
        ' | 最佳 ' + Math.floor(best).toString().padStart(6) + ' px' +
        ' | 平均 ' + Math.floor(mean).toString().padStart(6) + ' px'
      );
    }
    tm.lastLoggedGen = tm.gen;
  }
  if (Date.now() - t0 > 300000) {  // 5 分钟保险丝
    console.log('超过 5 分钟,提前结束');
    break;
  }
}
console.log(`完成,耗时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);

if (SAVE) {
  // 把冠军网络写成网页可直接加载的 js 文件(内置“出厂 AI”)
  const best = tm.pop.bestMember().nn.toJSON();
  const src = '// 出厂 AI:由 tools/train-sim.js 在真实游戏环境中训练生成(自动生成,勿手改)\n' +
    '// 网页打开即可体验 AI 代驾,无需自己训练;也可在训练模式中训练出更好的网络覆盖它\n' +
    'const PRESET_NET = ' + JSON.stringify(best) + ';\n';
  fs.writeFileSync(path.join(JS_DIR, 'preset-net.js'), src);
  console.log(`出厂 AI 已保存:js/preset-net.js(适应度 ${tm.histBest[tm.histBest.length - 1].toFixed(0)} px)`);
}
