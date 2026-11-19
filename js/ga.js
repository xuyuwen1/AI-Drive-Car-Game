// =====================================================
// 遗传算法:种群、锦标赛选择、均匀交叉、高斯变异、精英保留
// 与 python/ga.py 逻辑一致
// =====================================================
class Population {
  // size: 种群规模;nnSizes: 网络结构,如 [7, 12, 2]
  constructor({ size, nnSizes, mutationRate = 0.03, mutationSigma = 0.06, eliteCount = 8 }) {
    this.size = size;
    this.mutationRate = mutationRate;
    this.mutationSigma = mutationSigma;
    this.eliteCount = eliteCount;
    this.generation = 0;
    this.members = [];
    for (let i = 0; i < size; i++) {
      const nn = new NeuralNetwork(nnSizes);
      nn.randomize();
      this.members.push({ nn, fitness: 0 });
    }
  }

  // 动态调整变异参数(用于停滞时加强探索)
  setMutation(rate, sigma) {
    this.mutationRate = rate;
    this.mutationSigma = sigma;
  }

  // 用适应度函数评估整个种群:fitnessFn(nn) -> number
  evaluate(fitnessFn) {
    for (const m of this.members) m.fitness = fitnessFn(m.nn);
  }

  // 统计信息:{ best 最佳适应度, mean 平均适应度 }
  stats() {
    let best = -Infinity, sum = 0;
    for (const m of this.members) {
      if (m.fitness > best) best = m.fitness;
      sum += m.fitness;
    }
    return { best, mean: sum / this.members.length };
  }

  // 当前适应度最高的个体
  bestMember() {
    let b = this.members[0];
    for (const m of this.members) if (m.fitness > b.fitness) b = m;
    return b;
  }

  // 锦标赛选择:k=3 个随机个体中取适应度最高者
  tournament() {
    let best = this.members[randInt(0, this.size - 1)];
    for (let i = 1; i < 3; i++) {
      const c = this.members[randInt(0, this.size - 1)];
      if (c.fitness > best.fitness) best = c;
    }
    return best;
  }

  // 产生下一代(精英保留 + 交叉变异),不评估,由外部调用 evaluate
  evolve() {
    const ranked = this.members.slice().sort((a, b) => b.fitness - a.fitness);
    const next = [];
    // 精英保留:最优秀的几个原样进入下一代
    for (let i = 0; i < this.eliteCount; i++) {
      next.push({ nn: ranked[i].nn.clone(), fitness: 0 });
    }
    // 其余个体:两个锦标赛胜者交叉,再变异
    while (next.length < this.size) {
      const p1 = this.tournament(), p2 = this.tournament();
      const child = NeuralNetwork.crossover(p1.nn, p2.nn);
      child.mutate(this.mutationRate, this.mutationSigma);
      next.push({ nn: child, fitness: 0 });
    }
    this.members = next;
    this.generation++;
  }
}
