// =====================================================
// 道路渲染:草地 + 路面 + 车道线,随车速滚动
// =====================================================
const Road = {
  offset: 0,  // 滚动偏移量(像素)

  // 以 speed(世界滚动速度 = 玩家速度)更新滚动
  update(dt, speed) {
    // 152 = 两组车道虚线的周期,与草地条纹周期一致,保证视觉同步
    this.offset = (this.offset + speed * dt) % 152;
  },

  draw(ctx) {
    const { WIDTH, HEIGHT, ROAD_X, ROAD_WIDTH, LANES } = CONFIG;

    // --- 草地背景 ---
    ctx.fillStyle = CONFIG.GRASS_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 草地上的滚动条纹(增强速度感)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    for (let y = -152 + this.offset; y < HEIGHT; y += 152) {
      ctx.fillRect(0, y, WIDTH, 38);
    }

    // --- 路面 ---
    ctx.fillStyle = CONFIG.ROAD_COLOR;
    ctx.fillRect(ROAD_X, 0, ROAD_WIDTH, HEIGHT);

    // --- 车道虚线(随世界一起向下滚动) ---
    const laneW = ROAD_WIDTH / LANES;
    ctx.strokeStyle = CONFIG.LANE_LINE_COLOR;
    ctx.lineWidth = 4;
    ctx.setLineDash([CONFIG.DASH_LEN, CONFIG.DASH_GAP]);
    ctx.lineDashOffset = -this.offset;
    for (let i = 1; i < LANES; i++) {
      const x = ROAD_X + laneW * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // --- 道路两侧边缘实线 ---
    ctx.strokeStyle = CONFIG.EDGE_COLOR;
    ctx.lineWidth = 6;
    for (const x of [ROAD_X + 3, ROAD_X + ROAD_WIDTH - 3]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
  },
};
