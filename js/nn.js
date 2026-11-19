// =====================================================
// 神经网络:多层全连接前馈网络
// 与 python/nn.py 结构完全一致,权重 JSON 格式互通:
//   { "sizes": [7, 12, 2], "genome": [...] }
// =====================================================
class NeuralNetwork {
  // sizes: 每层神经元数量,如 [7, 12, 2] = 7 输入、12 隐层、2 输出
  constructor(sizes) {
    this.sizes = sizes.slice();
    this.weights = [];  // 每层权重矩阵 sizes[i] x sizes[i+1](行主序)
    this.biases = [];   // 每层偏置
    for (let i = 0; i < sizes.length - 1; i++) {
      const rows = [];
      for (let j = 0; j < sizes[i]; j++) rows.push(new Float64Array(sizes[i + 1]));
      this.weights.push(rows);
      this.biases.push(new Float64Array(sizes[i + 1]));
    }
  }

  // Xavier 风格随机初始化:范围与输入输出规模相关,避免 tanh 饱和
  randomize() {
    for (let i = 0; i < this.weights.length; i++) {
      const fanIn = this.weights[i].length;
      const fanOut = this.weights[i][0].length;
      const std = Math.sqrt(2 / (fanIn + fanOut));
      for (const row of this.weights[i]) {
        for (let k = 0; k < row.length; k++) row[k] = rand(-1, 1) * std;
      }
      for (let k = 0; k < this.biases[i].length; k++) this.biases[i][k] = rand(-0.5, 0.5);
    }
  }

  // 前向传播:返回输出向量(各分量在 [-1, 1] 之间,激活函数 tanh)
  forward(inputs) {
    let a = inputs;
    for (let i = 0; i < this.weights.length; i++) {
      const W = this.weights[i], b = this.biases[i];
      const out = new Float64Array(W[0].length);
      for (let j = 0; j < W.length; j++) {
        const row = W[j], aj = a[j];
        for (let k = 0; k < row.length; k++) out[k] += row[k] * aj;
      }
      for (let k = 0; k < out.length; k++) out[k] = Math.tanh(out[k] + b[k]);
      a = out;
    }
    return a;
  }

  // ---------- 基因:扁平化权重,遗传算法的操作对象 ----------
  get genome() {
    let n = 0;
    for (let i = 0; i < this.weights.length; i++) {
      n += this.weights[i].length * this.weights[i][0].length + this.biases[i].length;
    }
    const g = new Float64Array(n);
    let p = 0;
    for (let i = 0; i < this.weights.length; i++) {
      for (const row of this.weights[i]) for (const v of row) g[p++] = v;
      for (const v of this.biases[i]) g[p++] = v;
    }
    return g;
  }

  set genome(g) {
    let p = 0;
    for (let i = 0; i < this.weights.length; i++) {
      for (const row of this.weights[i]) {
        for (let k = 0; k < row.length; k++) row[k] = g[p++];
      }
      for (let k = 0; k < this.biases[i].length; k++) this.biases[i][k] = g[p++];
    }
  }

  clone() {
    const c = new NeuralNetwork(this.sizes);
    c.genome = this.genome;
    return c;
  }

  // 均匀交叉:子代每个基因随机取自父本或母本
  static crossover(a, b) {
    const child = new NeuralNetwork(a.sizes);
    const ga = a.genome, gb = b.genome;
    const g = new Float64Array(ga.length);
    for (let i = 0; i < g.length; i++) g[i] = Math.random() < 0.5 ? ga[i] : gb[i];
    child.genome = g;
    return child;
  }

  // 高斯变异:以 rate 概率给每个基因加上 N(0, sigma) 扰动;
  // 另有极小的 resetRate 概率直接把基因重置为随机值,帮助跳出局部最优
  mutate(rate, sigma, resetRate = 0.005) {
    const g = this.genome;
    for (let i = 0; i < g.length; i++) {
      if (Math.random() < resetRate) {
        g[i] = rand(-1, 1);
      } else if (Math.random() < rate) {
        g[i] += gaussian() * sigma;
      }
    }
    this.genome = g;
  }

  // ---------- JSON 序列化(与 Python 版互通) ----------
  toJSON() {
    return { sizes: this.sizes.slice(), genome: Array.from(this.genome) };
  }

  static fromJSON(obj) {
    const nn = new NeuralNetwork(obj.sizes);
    nn.genome = Float64Array.from(obj.genome);
    return nn;
  }
}
