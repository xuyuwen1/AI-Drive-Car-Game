# Python 离线训练(与网页版互通的 AI 核心)

这套代码与网页游戏的 AI 核心(`js/nn.js`、`js/ga.js`)**结构完全一致**,
用 Python + NumPy 实现,用于:

1. **离线实验**:不打开浏览器也能训练,方便批量试验不同参数
2. **报告图表**:生成 matplotlib 训练曲线(`output/training_curve.png`)
3. **训练成果互通**:训练好的网络保存为 JSON,可直接导入网页游戏的 AI 代驾模式

## 安装依赖

```
pip install numpy matplotlib
```

## 运行

```
cd python
python train.py                                            # 默认:种群 60,最多 300 代
python train.py --generations 300 --population 120 --seed 42
```

训练会自动提前结束(连续 10 代跑满满分,且 20 个全新世界复测平均 ≥ 90%),
实测约 200 代收敛、耗时约 10 分钟(时间主要花在逐车模拟上,可减小 `--population` 提速)。

## 输出(保存在项目根目录 output/ 下)

| 文件 | 说明 |
| --- | --- |
| `best_net.json` | 最佳网络,与网页版导入/导出格式一致 |
| `training_curve.png` | 训练曲线(最佳/平均适应度随代数变化) |

## 文件说明

| 文件 | 内容 |
| --- | --- |
| `nn.py` | 神经网络(7-12-2,tanh 激活,Xavier 初始化) |
| `ga.py` | 遗传算法(锦标赛选择、均匀交叉、高斯变异、精英保留) |
| `driving_env.py` | 简化驾驶环境(5 车道避障,输入输出与游戏一致) |
| `train.py` | 训练脚本与训练曲线绘图 |

## 与网页版的关系

```
python/nn.py  ⇄  js/nn.js   (JSON 权重格式互通)
python/ga.py  ⇄  js/ga.js   (算法逻辑一致)
python/driving_env.py ⇄ tools/ai-bench.js (同一套验证环境)
```

网页版 `js/nn.js` 的 `NeuralNetwork.toJSON() / fromJSON()` 与
Python 版 `to_dict() / from_dict()` 产出完全相同的格式:
`{"sizes": [7, 12, 2], "genome": [122 个浮点数]}`。
