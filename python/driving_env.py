# =====================================================
# 简化驾驶环境:5 车道避障
# 用于在无渲染的条件下验证「神经网络 + 遗传算法」能否学会驾驶。
# 逻辑与 tools/ai-bench.js 完全一致。
# 输入(7 个)与网页游戏采用相同的结构:
#   5 个传感器(每车道最近障碍距离,归一化)+ 速度 + 自身横向位置
# 输出(2 个):转向(-1~1)、油门(-1~1,本环境暂不使用)
# =====================================================
import numpy as np

LANES = 5          # 车道数
LOOKAHEAD = 130    # 传感器探测距离(步)
MAX_STEPS = 500    # 单局最大步数(满分为 500)
# 障碍密度设计:每 28~50 步一行、每行阻塞 1~2 车道,
# 一局约 13 行障碍 —— 纯靠运气存活 500 步的概率约 2.8%,
# 不换道必死,但每行总有 3~4 条空车道可走,满分是可达的学习目标


def make_world(rng):
    """生成一个随机世界:一组障碍行 {step, lanes}。

    每 28~50 步决策一次,在决策后 130 步处出现一行障碍,
    随机阻塞 1~2 条车道(保证永远有可通行的空车道)。
    """
    rows = []
    next_spawn = 30
    while next_spawn <= MAX_STEPS:
        lanes = rng.choice(LANES, size=int(rng.integers(1, 3)), replace=False)
        rows.append({"step": int(next_spawn) + LOOKAHEAD,
                     "lanes": sorted(lanes.tolist())})
        next_spawn += int(rng.integers(28, 51))
    return rows


def run_car(nn, rows):
    """一辆车在一个世界里行驶,返回存活步数(适应度)。

    车从中间车道出发,每步前进 1;若所在车道被障碍行阻塞则死亡。
    """
    lane = LANES // 2
    y = 0
    row_idx = 0
    while y < MAX_STEPS:
        y += 1
        # 越过已通过的障碍行
        while row_idx < len(rows) and rows[row_idx]["step"] < y:
            row_idx += 1
        # 碰撞检测
        if (row_idx < len(rows) and rows[row_idx]["step"] == y
                and lane in rows[row_idx]["lanes"]):
            return float(y)
        # 传感器:每个车道最近障碍的距离
        inputs = np.zeros(7)
        for l in range(LANES):
            dist = LOOKAHEAD + 1
            for r in rows[row_idx:]:
                if r["step"] - y > LOOKAHEAD:
                    break
                if l in r["lanes"]:
                    dist = r["step"] - y
                    break
            inputs[l] = min(dist / LOOKAHEAD, 1.0)
        inputs[5] = 0.5                    # 速度(本环境固定)
        inputs[6] = lane / (LANES - 1)     # 横向位置
        # 神经网络决策:转向超过阈值则换道
        out = nn.forward(inputs)
        if out[0] > 0.3 and lane < LANES - 1:
            lane += 1
        elif out[0] < -0.3 and lane > 0:
            lane -= 1
    return float(y)
