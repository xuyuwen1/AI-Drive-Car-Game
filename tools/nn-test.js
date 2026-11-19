// =====================================================
// 单元测试:神经网络与遗传算法
// 运行:node tools/nn-test.js
// =====================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 以与浏览器相同的方式载入游戏脚本(共享全局作用域)
const JS_DIR = path.join(__dirname, '..', 'js');
for (const f of ['config.js', 'utils.js', 'nn.js', 'ga.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), { filename: f });
}

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { failures++; console.error('  ✗ ' + name); }
}

// 1. 前向传播:输出形状与值域
const nn = new NeuralNetwork([7, 12, 2]);
nn.randomize();
const out = nn.forward([0.5, 0.2, 0.8, 0.1, 0.9, 0.5, 0.5]);
check('前向传播输出长度 = 2', out.length === 2);
check('输出值域在 [-1, 1](tanh 激活)', Math.abs(out[0]) <= 1 && Math.abs(out[1]) <= 1);

// 2. 基因读写与克隆
const g = nn.genome;
check('基因长度 = 7*12+12 + 12*2+2 = 122', g.length === 122);
const c = nn.clone();
check('克隆基因与母本一致', Array.from(c.genome).every((v, i) => v === g[i]));
c.genome[0] = 999;
check('克隆与母本相互独立', nn.genome[0] !== 999);

// 3. 交叉与变异
const child = NeuralNetwork.crossover(nn, c);
check('交叉后基因长度不变', child.genome.length === 122);
child.mutate(1.0, 0.3);  // 全部基因都参与变异
check('变异后基因发生变化', child.genome.some((v, i) => v !== g[i]));

// 4. JSON 序列化往返(与 Python 版互通的关键)
const json = nn.toJSON();
const nn2 = NeuralNetwork.fromJSON(JSON.parse(JSON.stringify(json)));
check('JSON 往返后基因一致', Array.from(nn2.genome).every((v, i) => Math.abs(v - g[i]) < 1e-12));

// 5. 遗传算法:代数推进与精英保留
const pop = new Population({ size: 20, nnSizes: [7, 12, 2] });
pop.evaluate((n) => n.genome[0]);  // 以第一个基因作为适应度,便于断言
const before = pop.bestMember().fitness;
pop.evolve();
pop.evaluate((n) => n.genome[0]);
check('进化后种群规模不变', pop.members.length === 20);
check('代数推进到第 1 代', pop.generation === 1);
check('精英保留:最佳适应度不下降', pop.bestMember().fitness >= before - 1e-9);

console.log(failures === 0 ? '✓ 全部通过' : '✗ ' + failures + ' 项失败');
process.exit(failures === 0 ? 0 : 1);
