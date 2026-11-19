# =====================================================
# 神经网络:多层全连接前馈网络
# 与 js/nn.js 结构完全一致,权重 JSON 格式互通:
#   {"sizes": [7, 12, 2], "genome": [...]}
# =====================================================
import numpy as np


class NeuralNetwork:
    """多层全连接前馈网络,隐层与输出层均使用 tanh 激活。

    sizes: 每层神经元数量,如 [7, 12, 2] 表示 7 输入、12 隐层、2 输出
    """

    def __init__(self, sizes):
        self.sizes = list(sizes)
        self.weights = []   # 每层权重矩阵 (in, out)
        self.biases = []    # 每层偏置 (out,)
        for i in range(len(sizes) - 1):
            self.weights.append(np.zeros((sizes[i], sizes[i + 1])))
            self.biases.append(np.zeros(sizes[i + 1]))
        self.randomize()

    def randomize(self):
        """Xavier 风格初始化:范围与输入输出规模相关,避免 tanh 饱和。"""
        for i in range(len(self.weights)):
            fan_in, fan_out = self.weights[i].shape
            std = np.sqrt(2.0 / (fan_in + fan_out))
            self.weights[i] = np.random.uniform(-std, std, self.weights[i].shape)
            self.biases[i] = np.random.uniform(-0.5, 0.5, self.biases[i].shape)

    def forward(self, inputs):
        """前向传播,返回输出向量(各分量在 [-1, 1] 之间)。"""
        a = np.asarray(inputs, dtype=np.float64)
        for W, b in zip(self.weights, self.biases):
            a = np.tanh(a @ W + b)
        return a

    # ---------- 基因(扁平化权重,遗传算法的操作对象) ----------
    # 展平顺序与 JS 版一致:逐层 [W1, b1, W2, b2, ...],保证 JSON 跨语言互通
    @property
    def genome(self):
        return np.concatenate(
            [np.concatenate([w.ravel(), b.ravel()])
             for w, b in zip(self.weights, self.biases)]
        )

    @genome.setter
    def genome(self, g):
        g = np.asarray(g, dtype=np.float64)
        pos = 0
        for w, b in zip(self.weights, self.biases):
            n = w.size
            w[...] = g[pos:pos + n].reshape(w.shape)
            pos += n
            b[...] = g[pos:pos + b.size]
            pos += b.size

    def clone(self):
        """深拷贝一个网络。"""
        c = NeuralNetwork.__new__(NeuralNetwork)  # 跳过 __init__,直接复制参数
        c.sizes = list(self.sizes)
        c.weights = [w.copy() for w in self.weights]
        c.biases = [b.copy() for b in self.biases]
        return c

    def mutate(self, rate, sigma, reset_rate=0.005):
        """高斯变异:以 rate 概率给每个基因加上 N(0, sigma) 扰动;
        另有极小的 reset_rate 概率直接把基因重置为随机值,帮助跳出局部最优。"""
        g = self.genome
        r = np.random.random(g.size)
        g[r < reset_rate] = np.random.uniform(-1, 1, int((r < reset_rate).sum()))
        mask = (r >= reset_rate) & (np.random.random(g.size) < rate)
        g[mask] += np.random.randn(int(mask.sum())) * sigma
        self.genome = g

    @staticmethod
    def crossover(a, b):
        """均匀交叉:子代每个基因随机取自父本或母本。"""
        ga, gb = a.genome, b.genome
        child = NeuralNetwork.__new__(NeuralNetwork)
        child.sizes = list(a.sizes)
        child.weights = [np.empty_like(w) for w in a.weights]
        child.biases = [np.empty_like(bias) for bias in a.biases]
        child.genome = np.where(np.random.random(ga.size) < 0.5, ga, gb)
        return child

    # ---------- JSON 序列化(与网页版互通) ----------
    def to_dict(self):
        return {"sizes": self.sizes, "genome": self.genome.tolist()}

    @staticmethod
    def from_dict(d):
        nn = NeuralNetwork.__new__(NeuralNetwork)
        nn.sizes = list(d["sizes"])
        nn.weights = []
        nn.biases = []
        for i in range(len(nn.sizes) - 1):
            nn.weights.append(np.zeros((nn.sizes[i], nn.sizes[i + 1])))
            nn.biases.append(np.zeros(nn.sizes[i + 1]))
        nn.genome = np.array(d["genome"], dtype=np.float64)
        return nn
