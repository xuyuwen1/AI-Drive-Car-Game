// =====================================================
// 训练基准:在 5 车道避障环境(无渲染)中用遗传算法训练神经网络,
// 验证「AI 确实能学会开车」,并产出可导入网页游戏的最佳网络。
// 环境逻辑与 python/driving_env.py 完全一致。
// 用法:
//   node tools/ai-bench.js                        # 训练(最多 300 代,自动提前结束)
//   node tools/ai-bench.js --gens 60              # 指定最大代数
//   node tools/ai-bench.js --import output/best_net.json   # 复测已训练网络
// =====================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 以与浏览器相同的方式载入游戏脚本(共享全局作用域)
const JS_DIR = path.join(__dirname, '..', 'js');
for (const f of ['config.js', 'utils.js', 'nn.js', 'ga.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), { filename: f });
}

const OUT_DIR = path.join(__dirname, '..', 'output');
const OUT_FILE = path.join(OUT_DIR, 'best_net.json');

// =====================================================
// 简化驾驶环境:5 车道避障
// 输入(7):5 个传感器(每车道最近障碍距离,归一化)+ 速度 + 横向位置
// 输出(2):转向(-1~1)、油门(-1~1,本环境暂不使用)
// =====================================================
const TOY = {
  LANES: 5,        // 车道数
  LOOKAHEAD: 130,  // 传感器探测距离(步)
  MAX_STEPS: 500,  // 单局最大步数(满分为 500)
  // 障碍密度设计:每 28~50 步一行、每行阻塞 1~2 车道,
  // 一局约 13 行障碍 —— 纯靠运气存活 500 步的概率约 2.8%,
  // 不换道必死,但每行总有 3~4 条空车道可走,满分是可达的学习目标

  // 生成一个随机世界:一组障碍行 { step, lanes }
  // 每 28~50 步决策一次,在决策后 130 步处出现一行障碍,
  // 随机阻塞 1~2 条车道(保证永远有可通行的空车道)
  makeWorld() {
    const rows = [];
    let nextSpawn = 30;
    while (nextSpawn <= this.MAX_STEPS) {
      const lanes = shuffle([0, 1, 2, 3, 4]).slice(0, randInt(1, 2)).sort((a, b) => a - b);
      rows.push({ step: nextSpawn + this.LOOKAHEAD, lanes });
      nextSpawn += randInt(28, 50);
    }
    return rows;
  },

  // 一辆车在一个世界里行驶,返回存活步数(适应度)
  // 车从中间车道出发,每步前进 1;若所在车道被障碍行阻塞则死亡
  runCar(nn, rows) {
    let lane = 2, y = 0, rowIdx = 0;
    while (y < this.MAX_STEPS) {
      y++;
      while (rowIdx < rows.length && rows[rowIdx].step < y) rowIdx++;
      // 碰撞检测
      if (rowIdx < rows.length && rows[rowIdx].step === y && rows[rowIdx].lanes.includes(lane)) {
        return y;
      }
      // 传感器:每个车道最近障碍的距离
      const inputs = new Float64Array(7);
      for (let l = 0; l < this.LANES; l++) {
        let dist = this.LOOKAHEAD + 1;
        for (let i = rowIdx; i < rows.length && rows[i].step - y <= this.LOOKAHEAD; i++) {
          if (rows[i].lanes.includes(l)) { dist = rows[i].step - y; break; }
        }
        inputs[l] = Math.min(dist / this.LOOKAHEAD, 1);
      }
      inputs[5] = 0.5;               // 速度(本环境固定)
      inputs[6] = lane / (this.LANES - 1);  // 横向位置
      // 神经网络决策:转向超过阈值则换道
      const out = nn.forward(inputs);
      if (out[0] > 0.3 && lane < this.LANES - 1) lane++;
      else if (out[0] < -0.3 && lane > 0) lane--;
    }
    return y;
  },
};

// ---------- 命令行参数 ----------
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
}

// ---------- 训练 ----------
function train(gens) {
  const pop = new Population({ size: 100, nnSizes: [7, 12, 2] });
  let stuck = 0;
  // 固定考核集:训练开始时随机生成 40 个世界,之后每代都用同一组世界评估。
  // 适应度成为网络的确定性函数,选择不再被随机噪声干扰,进化才能稳定收敛;
  // 考核集足够大,死记硬背也等价于真正学会(收敛后再用全新世界复核验证泛化)
  const SUITE_SIZE = 40;
  const suite = [];
  for (let i = 0; i < SUITE_SIZE; i++) suite.push(TOY.makeWorld());

  console.log(`开始训练:种群 100,最多 ${gens} 代,单局上限 ${TOY.MAX_STEPS} 步`);
  console.log(`评估方式:固定 ${SUITE_SIZE} 个考核世界(每代相同,适应度确定,消除运气成分)`);
  let bestEver = -Infinity;
  let stagnant = 0;
  for (let g = 0; g < gens; g++) {
    pop.evaluate((nn) => {
      let total = 0;
      for (const w of suite) total += TOY.runCar(nn, w);
      return total / suite.length;
    });
    const { best, mean } = pop.stats();
    if (g % 5 === 0 || g === gens - 1) {
      console.log(
        '代数 ' + String(g).padStart(4) +
        ' | 最佳 ' + best.toFixed(1).padStart(6) +
        ' | 平均 ' + mean.toFixed(1).padStart(6)
      );
    }
    // 停滞自适应变异:长期无进步 → 提高变异强度,跳出局部最优
    if (best > bestEver + 1e-9) { bestEver = best; stagnant = 0; }
    else stagnant++;
    if (stagnant > 25) pop.setMutation(0.25, 0.4);
    else if (stagnant > 12) pop.setMutation(0.15, 0.25);
    else pop.setMutation(0.03, 0.06);
    if (best >= TOY.MAX_STEPS) {
      stuck++;
      if (stuck >= 10) {
        // 复核:连续 10 代满分后,用 20 个新世界复测冠军,平均 >= 90% 才确认学会
        const champ = pop.bestMember();
        let total = 0;
        const RUNS = 20;
        for (let i = 0; i < RUNS; i++) total += TOY.runCar(champ.nn, TOY.makeWorld());
        const avg = total / RUNS;
        if (avg >= TOY.MAX_STEPS * 0.9) {
          console.log(`第 ${g} 代复核通过:冠军 20 局平均 ${avg.toFixed(1)},确认学会,提前结束`);
          break;
        }
        console.log(`第 ${g} 代复核未通过(冠军平均 ${avg.toFixed(1)}),继续训练`);
        stuck = 0;
      }
    } else stuck = 0;
    pop.evolve();
  }
  const champion = pop.bestMember();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(champion.nn.toJSON()));
  console.log(`最佳网络已保存:${OUT_FILE}(结构 7-12-2,基因数 ${champion.nn.genome.length})`);
  // 复测:用保存的网络跑 20 局
  let total = 0;
  const RUNS = 20;
  for (let i = 0; i < RUNS; i++) total += TOY.runCar(champion.nn, TOY.makeWorld());
  console.log(`最佳网络 ${RUNS} 局平均适应度:${(total / RUNS).toFixed(1)} / ${TOY.MAX_STEPS}`);
}

// ---------- 导入复测(验证 JSON 格式互通) ----------
function importTest(file) {
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const nn = NeuralNetwork.fromJSON(obj);
  let total = 0;
  const RUNS = 20;
  for (let i = 0; i < RUNS; i++) total += TOY.runCar(nn, TOY.makeWorld());
  console.log(`导入网络:${file}`);
  console.log(`结构 ${obj.sizes.join('-')},${RUNS} 局平均适应度:${(total / RUNS).toFixed(1)} / ${TOY.MAX_STEPS}`);
}

if (args.includes('--import')) {
  importTest(getArg('--import', OUT_FILE));
} else {
  train(Number(getArg('--gens', 300)));
}
