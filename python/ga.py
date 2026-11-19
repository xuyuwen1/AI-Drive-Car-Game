# =====================================================
# 遗传算法:种群、锦标赛选择、均匀交叉、高斯变异、精英保留
# 与 js/ga.js 逻辑一致
# =====================================================
import numpy as np

from nn import NeuralNetwork


class Population:
    """神经网络种群。

    size: 种群规模
    nn_sizes: 网络结构,如 [7, 12, 2]
    mutation_rate / mutation_sigma: 变异概率与幅度
    elite_count: 每代直接保留的精英数量
    """

    def __init__(self, size, nn_sizes, mutation_rate=0.03,
                 mutation_sigma=0.06, elite_count=8):
        self.size = size
        self.mutation_rate = mutation_rate
        self.mutation_sigma = mutation_sigma
        self.elite_count = elite_count
        self.generation = 0
        self.members = []
        for _ in range(size):
            self.members.append({"nn": NeuralNetwork(nn_sizes), "fitness": 0.0})

    def set_mutation(self, rate, sigma):
        """动态调整变异参数(用于停滞时加强探索)。"""
        self.mutation_rate = rate
        self.mutation_sigma = sigma

    def evaluate(self, fitness_fn):
        """用适应度函数评估整个种群:fitness_fn(nn) -> float。"""
        for m in self.members:
            m["fitness"] = fitness_fn(m["nn"])

    def stats(self):
        """返回 (最佳适应度, 平均适应度)。"""
        fits = [m["fitness"] for m in self.members]
        return max(fits), sum(fits) / len(fits)

    def best_member(self):
        """当前适应度最高的个体。"""
        return max(self.members, key=lambda m: m["fitness"])

    def _tournament(self):
        """锦标赛选择:k=3 个随机个体中取适应度最高者。"""
        best = self.members[np.random.randint(self.size)]
        for _ in range(2):
            c = self.members[np.random.randint(self.size)]
            if c["fitness"] > best["fitness"]:
                best = c
        return best

    def evolve(self):
        """产生下一代(精英保留 + 交叉变异),不评估,由外部调用 evaluate。"""
        ranked = sorted(self.members, key=lambda m: m["fitness"], reverse=True)
        next_members = []
        # 精英保留:最优秀的几个原样进入下一代
        for i in range(self.elite_count):
            next_members.append({"nn": ranked[i]["nn"].clone(), "fitness": 0.0})
        # 其余个体:两个锦标赛胜者交叉,再变异
        while len(next_members) < self.size:
            p1, p2 = self._tournament(), self._tournament()
            child = NeuralNetwork.crossover(p1["nn"], p2["nn"])
            child.mutate(self.mutation_rate, self.mutation_sigma)
            next_members.append({"nn": child, "fitness": 0.0})
        self.members = next_members
        self.generation += 1
