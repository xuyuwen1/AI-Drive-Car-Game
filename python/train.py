# =====================================================
# 训练脚本:在简化驾驶环境中用遗传算法训练神经网络
# 输出:
#   output/best_net.json      —— 最佳网络(与网页版导入/导出格式一致)
#   output/training_curve.png —— 训练曲线(最佳/平均适应度随代数变化)
# 用法:
#   python train.py
#   python train.py --generations 300 --population 120 --seed 42
# =====================================================
import argparse
import json
import os
import time

import matplotlib
matplotlib.use("Agg")  # 无窗口环境也可运行
import matplotlib.pyplot as plt
import numpy as np

from driving_env import LANES, MAX_STEPS, make_world, run_car
from ga import Population

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
NN_SIZES = [7, 12, 2]  # 与网页游戏相同的网络结构


def main():
    parser = argparse.ArgumentParser(description="遗传算法训练驾驶 AI")
    parser.add_argument("--generations", type=int, default=300, help="最大训练代数")
    parser.add_argument("--population", type=int, default=60, help="种群规模")
    parser.add_argument("--seed", type=int, default=None, help="随机种子(可复现实验)")
    args = parser.parse_args()

    if args.seed is not None:
        np.random.seed(args.seed)
    rng = np.random.default_rng(args.seed)

    pop = Population(args.population, NN_SIZES)
    best_hist, mean_hist = [], []
    stuck = 0

    # 固定考核集:训练开始时随机生成 20 个世界,之后每代都用同一组世界评估。
    # 适应度成为网络的确定性函数,选择不再被随机噪声干扰,进化才能稳定收敛;
    # 考核集足够大,死记硬背也等价于真正学会(收敛后再用全新世界复核验证泛化)
    suite = [make_world(rng) for _ in range(20)]

    print(f"开始训练:种群 {args.population},最多 {args.generations} 代,单局上限 {MAX_STEPS} 步")
    print(f"评估方式:固定 {len(suite)} 个考核世界(每代相同,适应度确定,消除运气成分)")
    t0 = time.time()
    best_ever = -float("inf")
    stagnant = 0
    for gen in range(args.generations):
        pop.evaluate(lambda nn: sum(run_car(nn, w) for w in suite) / len(suite))
        best, mean = pop.stats()
        best_hist.append(best)
        mean_hist.append(mean)
        if gen % 5 == 0 or gen == args.generations - 1:
            print(f"代数 {gen:4d} | 最佳 {best:7.1f} | 平均 {mean:7.1f}")
        # 停滞自适应变异:长期无进步 → 提高变异强度,跳出局部最优
        if best > best_ever + 1e-9:
            best_ever = best
            stagnant = 0
        else:
            stagnant += 1
        if stagnant > 25:
            pop.set_mutation(0.25, 0.4)
        elif stagnant > 12:
            pop.set_mutation(0.15, 0.25)
        else:
            pop.set_mutation(0.03, 0.06)
        if best >= MAX_STEPS:
            stuck += 1
            if stuck >= 10:
                # 复核:连续 10 代满分后,用 20 个新世界复测冠军,平均 >= 90% 才确认学会
                champ = pop.best_member()
                scores = [run_car(champ["nn"], make_world(rng)) for _ in range(20)]
                avg = np.mean(scores)
                if avg >= MAX_STEPS * 0.9:
                    print(f"第 {gen} 代复核通过:冠军 20 局平均 {avg:.1f},确认学会,提前结束")
                    break
                print(f"第 {gen} 代复核未通过(冠军平均 {avg:.1f}),继续训练")
                stuck = 0
        else:
            stuck = 0
        pop.evolve()

    champion = pop.best_member()
    os.makedirs(OUT_DIR, exist_ok=True)
    json_path = os.path.join(OUT_DIR, "best_net.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(champion["nn"].to_dict(), f)
    print(f"最佳网络已保存:{json_path}")
    print(f"结构 {'-'.join(map(str, NN_SIZES))},基因数 {len(champion['nn'].genome)}")

    # 复测:用保存的网络跑 20 局,报告平均适应度
    scores = [run_car(champion["nn"], make_world(rng)) for _ in range(20)]
    print(f"训练耗时 {time.time() - t0:.1f} 秒")
    print(f"最佳网络 20 局平均适应度:{np.mean(scores):.1f} / {MAX_STEPS}")

    plot_curve(best_hist, mean_hist, os.path.join(OUT_DIR, "training_curve.png"))


def plot_curve(best, mean, out_path):
    """绘制训练曲线(遵循 dataviz 规范:浅色画布 + 已验证调色板 + 线尾直标)。"""
    # 调色板经 CVD 色盲模拟校验通过(蓝=最佳,橙=平均)
    SURFACE = "#fcfcfb"
    BLUE = "#2a78d6"
    ORANGE = "#eb6834"
    INK_PRIMARY = "#0b0b0b"
    INK_SECONDARY = "#52514e"
    INK_MUTED = "#898781"
    GRID = "#e1e0d9"
    AXIS = "#c3c2b7"

    plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "sans-serif"]
    plt.rcParams["axes.unicode_minus"] = False

    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150, facecolor=SURFACE)
    ax.set_facecolor(SURFACE)

    gens = np.arange(len(best))
    ax.plot(gens, best, color=BLUE, lw=2, label="最佳适应度")
    ax.plot(gens, mean, color=ORANGE, lw=2, label="平均适应度")

    # 线尾直接标注(文字用墨色而非系列色)
    if len(best) > 0:
        ax.annotate("最佳适应度", xy=(gens[-1], best[-1]),
                    xytext=(6, 0), textcoords="offset points",
                    va="center", color=INK_SECONDARY, fontsize=10)
        ax.annotate("平均适应度", xy=(gens[-1], mean[-1]),
                    xytext=(6, 0), textcoords="offset points",
                    va="center", color=INK_SECONDARY, fontsize=10)

    # 两条系列必须有图例
    ax.legend(loc="lower right", frameon=False, fontsize=10)

    # 只保留 y 方向浅色网格,弱化坐标轴
    ax.grid(axis="y", color=GRID, lw=0.8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(AXIS)
    ax.spines["bottom"].set_color(AXIS)
    ax.tick_params(colors=INK_MUTED, labelsize=9)

    ax.set_xlabel("代数", color=INK_SECONDARY, fontsize=11)
    ax.set_ylabel("适应度(存活步数)", color=INK_SECONDARY, fontsize=11)
    ax.set_title("遗传算法训练曲线 · 5 车道避障环境",
                 color=INK_PRIMARY, fontsize=13, pad=12)

    fig.tight_layout()
    fig.savefig(out_path, facecolor=SURFACE)
    plt.close(fig)
    print(f"训练曲线已保存:{out_path}")


if __name__ == "__main__":
    main()
