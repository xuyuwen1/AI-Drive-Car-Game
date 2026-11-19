// =====================================================
// 全局配置 —— 所有可调参数集中在这里
// (结构模仿参考项目 rust-drive-ai 的 src/configs.rs)
// =====================================================
const CONFIG = {
  // ---------- 画布 ----------
  WIDTH: 480,          // 内部逻辑宽度(像素)
  HEIGHT: 720,         // 内部逻辑高度(像素)

  // ---------- 道路 ----------
  ROAD_X: 40,          // 道路左边缘 x
  ROAD_WIDTH: 400,     // 道路总宽
  LANES: 4,            // 车道数
  GRASS_COLOR: '#3f7d3a',
  ROAD_COLOR: '#3a3a3e',
  LANE_LINE_COLOR: '#e8e8d8',
  EDGE_COLOR: '#d8d8c8',
  DASH_LEN: 40,        // 车道虚线长度
  DASH_GAP: 36,        // 车道虚线间隔
  MENU_SCROLL_SPEED: 120,  // 菜单背景公路滚动速度

  // ---------- 玩家车 ----------
  PLAYER_W: 44,
  PLAYER_H: 76,
  PLAYER_Y: 560,             // 玩家车固定在屏幕上的 y(只左右变道)
  PLAYER_DEFAULT_SPEED: 150, // 巡航速度 px/s
  PLAYER_MIN_SPEED: 60,
  PLAYER_MAX_SPEED: 260,
  PLAYER_ACCEL: 140,         // 油门加速度 px/s^2
  PLAYER_BRAKE: 220,         // 刹车减速度 px/s^2
  PLAYER_STEER_SPEED: 280,   // 横向移动速度 px/s

  // ---------- 敌方车辆 ----------
  TRUCK_RATE: 0.22,          // 卡车的出现概率
  ENEMY_MIN_SPEED: 55,       // 小汽车速度范围
  ENEMY_MAX_SPEED: 130,
  TRUCK_MIN_SPEED: 40,       // 卡车速度范围(更慢)
  TRUCK_MAX_SPEED: 75,
  SPAWN_INTERVAL_START: 1.3, // 初始生成间隔(秒)
  SPAWN_INTERVAL_MIN: 0.55,  // 难度上限时的生成间隔
  SPAWN_RAMP_TIME: 120,      // 难度递增到上限所需时间(秒)
  SAME_LANE_MIN_GAP: 200,    // 同车道车辆最小间距

  // ---------- 训练模式(种群同屏进化) ----------
  TRAIN_POP_SIZE: 60,          // 种群规模(同屏训练车数量)
  TRAIN_SPEED: 150,            // 训练世界滚动速度 px/s(与玩家巡航速度一致,
                               // 保证训练环境与真实游戏的输入分布相同,AI 无缝代驾)
  TRAIN_STEER_SPEED: 300,      // 训练车最大横向速度 px/s
  TRAIN_W: 40,                 // 训练车尺寸
  TRAIN_H: 70,
  TRAIN_SPAWN_INTERVAL: 1.05,  // 训练敌车生成间隔(固定中等难度)
  TRAIN_HITBOX_SCALE: 0.8,     // 训练车碰撞箱缩放
  TRAIN_GEN_MAX_TIME: 40,      // 单代时长上限(秒):到点强制结算,防止个别车活得
                               // 太久拖慢进化节奏(存活的按当前距离计分)

  // ---------- 传感器(训练与 AI 代驾共用) ----------
  RAY_LEN: 320,                        // 射线探测距离 px
  RAY_ANGLES: [-60, -30, 0, 30, 60],   // 5 条射线角度(度,0 = 车头正前方)

  // ---------- 碰撞 ----------
  PLAYER_HITBOX_SCALE: 0.72, // 碰撞箱缩小比例(判定比外观更宽容,手感更好)
  ENEMY_HITBOX_SCALE: 0.82,

  // ---------- 计分 ----------
  SCORE_PER_PIXEL: 0.1,      // 每行驶 10px 得 1 分
};

// 车辆配色(仿 Road Fighter 红白机风格)
const CAR_COLORS = {
  player: { body: '#e23b3b', roof: '#a82727', accent: '#ffd23f', stripe: true },
  enemy: [
    { body: '#4f7dd9', roof: '#31549c' },
    { body: '#e8d44d', roof: '#b3a02f' },
    { body: '#58c46a', roof: '#3a9149' },
    { body: '#d9d9d9', roof: '#9a9a9a' },
  ],
  truck: [
    { body: '#8a6b45', roof: '#5f472c', accent: '#c9a86a' },
    { body: '#7d7d85', roof: '#55555c', accent: '#b8b8c0' },
  ],
};
