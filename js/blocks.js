/* ═══════════════ VOXEL SKY — 方块与物品定义 ═══════════════ */
/* 原创的方块/资源体系, 玩法融合体素挖掘建造与太空生存採集 */

const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, DEEPSTONE: 4,
  LOG: 5, LEAF: 6, DIHYDROGEN: 7, SODIUM_PLANT: 8, OXYGEN_PLANT: 9,
  COPPER_ORE: 10, SAND: 11, SNOW: 12, ICE: 13, TECH: 14,
  GLOW_ORE: 15, METAL: 16, GLASS: 17, LAVA_ROCK: 18, WATER: 19
};

/* tiles: [top, side, bottom] 引用 textures.js 图集索引 */
const BLOCK_DEFS = {
  [BLOCK.GRASS]:        { name: '苔原岩块', tiles: [0, 1, 2],   hardness: 0.55, drops: [{ item: 'ferrite', n: [1, 2] }], place: 'block_grass' },
  [BLOCK.DIRT]:         { name: '风化土块', tiles: [2, 2, 2],   hardness: 0.45, drops: [{ item: 'ferrite', n: [1, 2] }], place: 'block_dirt' },
  [BLOCK.STONE]:        { name: '铁尘岩', tiles: [3, 3, 3],     hardness: 0.9,  drops: [{ item: 'ferrite', n: [2, 4] }], place: 'block_stone' },
  [BLOCK.DEEPSTONE]:    { name: '深层岩', tiles: [4, 4, 4],     hardness: 1.4,  drops: [{ item: 'ferrite', n: [3, 5] }, { item: 'pure_ferrite', n: [0, 1] }], place: 'block_stone' },
  [BLOCK.LOG]:          { name: '碳晶木', tiles: [5, 5, 5],     hardness: 0.7,  drops: [{ item: 'carbon', n: [3, 5] }], place: 'block_wood' },
  [BLOCK.LEAF]:         { name: '碳晶叶', tiles: [6, 6, 6],     hardness: 0.2,  drops: [{ item: 'carbon', n: [1, 2] }] },
  [BLOCK.DIHYDROGEN]:   { name: '重氢晶体', tiles: [7, 7, 7],   hardness: 0.8,  drops: [{ item: 'dihydrogen', n: [3, 6] }], glow: 0x3a8fff },
  [BLOCK.SODIUM_PLANT]: { name: '钠盐花', tiles: [8, 8, 8],     hardness: 0.25, drops: [{ item: 'sodium', n: [2, 4] }], glow: 0xd8b020 },
  [BLOCK.OXYGEN_PLANT]: { name: '赤息花', tiles: [9, 9, 9],     hardness: 0.25, drops: [{ item: 'oxygen', n: [2, 4] }], glow: 0xc23a3a },
  [BLOCK.COPPER_ORE]:   { name: '铜矿脉', tiles: [10, 10, 10],  hardness: 1.2,  drops: [{ item: 'copper', n: [2, 4] }] },
  [BLOCK.SAND]:         { name: '硅砂块', tiles: [11, 11, 11],  hardness: 0.4,  drops: [{ item: 'ferrite', n: [1, 2] }] },
  [BLOCK.SNOW]:         { name: '霜盖岩', tiles: [12, 13, 2],   hardness: 0.5,  drops: [{ item: 'ferrite', n: [1, 2] }] },
  [BLOCK.ICE]:          { name: '永冻冰', tiles: [14, 14, 14],  hardness: 0.6,  drops: [{ item: 'dihydrogen', n: [1, 2] }] },
  [BLOCK.TECH]:         { name: '合金构件', tiles: [15, 15, 15], hardness: 1.6, drops: [{ item: 'tech_frag', n: [1, 1] }], place: 'block_tech', glow: 0x2a6a60 },
  [BLOCK.GLOW_ORE]:     { name: '荧钠矿', tiles: [20, 20, 20],  hardness: 1.1,  drops: [{ item: 'sodium', n: [3, 6] }], glow: 0xb89a20 },
  [BLOCK.METAL]:        { name: '装甲板块', tiles: [21, 21, 21], hardness: 1.5, drops: [{ item: 'pure_ferrite', n: [1, 2] }], place: 'block_metal' },
  [BLOCK.GLASS]:        { name: '晶化玻璃', tiles: [22, 22, 22], hardness: 0.35, drops: [], place: 'block_glass', transparent: true },
  [BLOCK.LAVA_ROCK]:    { name: '熔壳岩', tiles: [23, 23, 23],  hardness: 1.0,  drops: [{ item: 'ferrite', n: [2, 3] }], glow: 0x8a3010 }
};

/* ---------- 物品定义 ---------- */
const ITEMS = {
  carbon:           { name: '碳', en: 'CARBON', max: 250, desc: '基础有机元素，由星球植物中提取。用于合成与为便携科技供能。', icon: 'carbon', rarity: '常见' },
  condensed_carbon: { name: '浓缩碳', en: 'CONDENSED CARBON', max: 250, desc: '高密度碳晶体。用于高级合成与密封剂制造。', icon: 'condensed_carbon', rarity: '罕见' },
  ferrite:          { name: '铁尘', en: 'FERRITE DUST', max: 250, desc: '从岩石中采集的金属粉末，是修理与建造的基石。', icon: 'ferrite', rarity: '常见' },
  pure_ferrite:     { name: '纯铁', en: 'PURE FERRITE', max: 250, desc: '精炼提纯后的铁材，用于星舰部件修复。', icon: 'pure_ferrite', rarity: '罕见' },
  dihydrogen:       { name: '重氢', en: 'DI-HYDROGEN', max: 250, desc: '蓝色晶簇状恒星燃料，是起飞燃料的核心原料。', icon: 'dihydrogen', rarity: '常见' },
  sodium:           { name: '钠', en: 'SODIUM', max: 250, desc: '活性金属元素，可为危险防护装置充能。', icon: 'sodium', rarity: '常见', use: 'hazard' },
  oxygen:           { name: '氧', en: 'OXYGEN', max: 250, desc: '生命维持系统的必需气体元素。', icon: 'oxygen', rarity: '常见', use: 'life' },
  copper:           { name: '铜', en: 'COPPER', max: 250, desc: '恒星金属，可用于交易与高级合成。', icon: 'copper', rarity: '罕见' },
  tech_frag:        { name: '科技残片', en: 'TECH FRAGMENT', max: 50, desc: '废弃科技的残余部件，蕴含可观价值。', icon: 'tech_frag', rarity: '珍稀' },
  metal_plating:    { name: '金属镀层', en: 'METAL PLATING', max: 10, desc: '基础建造部件。修复起飞推进器必需。', icon: 'metal_plating', rarity: '部件' },
  hermetic_seal:    { name: '密封剂', en: 'HERMETIC SEAL', max: 10, desc: '维持舱体气密的工业部件。修复脉冲引擎必需。', icon: 'hermetic_seal', rarity: '部件' },
  launch_fuel:      { name: '起飞燃料', en: 'LAUNCH FUEL', max: 10, desc: '固态火箭燃料。为星舰起飞推进器补充燃料。', icon: 'launch_fuel', rarity: '部件', use: 'fuel' },
  // 可放置方块物品
  block_grass:      { name: '苔原岩块', en: 'TURF BLOCK', max: 99, desc: '可放置的地表方块。', icon: 'block_grass', rarity: '方块', block: BLOCK.GRASS },
  block_dirt:       { name: '风化土块', en: 'SOIL BLOCK', max: 99, desc: '可放置的土壤方块。', icon: 'block_dirt', rarity: '方块', block: BLOCK.DIRT },
  block_stone:      { name: '铁尘岩块', en: 'ROCK BLOCK', max: 99, desc: '可放置的岩石方块。', icon: 'block_stone', rarity: '方块', block: BLOCK.STONE },
  block_wood:       { name: '碳晶木块', en: 'WOOD BLOCK', max: 99, desc: '可放置的木质方块。', icon: 'block_wood', rarity: '方块', block: BLOCK.LOG },
  block_metal:      { name: '装甲板块', en: 'ARMOR BLOCK', max: 99, desc: '合成的金属建造方块，坚固美观。', icon: 'block_metal', rarity: '方块', block: BLOCK.METAL },
  block_glass:      { name: '晶化玻璃', en: 'GLASS BLOCK', max: 99, desc: '透明建造方块，适合建造穹顶。', icon: 'block_glass', rarity: '方块', block: BLOCK.GLASS },
  block_glow:       { name: '荧光块', en: 'GLOW BLOCK', max: 99, desc: '会发光的建造方块，照亮你的基地。', icon: 'block_glow', rarity: '方块', block: BLOCK.GLOW_ORE },
  block_tech:       { name: '合金构件', en: 'ALLOY BLOCK', max: 99, desc: '科技感十足的建造方块。', icon: 'block_tech', rarity: '方块', block: BLOCK.TECH }
};

/* ---------- 合成配方 ---------- */
const RECIPES = [
  { id: 'metal_plating', out: 'metal_plating', n: 1, req: { ferrite: 50 }, desc: '基础金属部件' },
  { id: 'hermetic_seal', out: 'hermetic_seal', n: 1, req: { condensed_carbon: 30 }, desc: '气密封装部件' },
  { id: 'launch_fuel', out: 'launch_fuel', n: 1, req: { dihydrogen: 40, metal_plating: 1 }, desc: '星舰起飞燃料' },
  { id: 'block_metal', out: 'block_metal', n: 4, req: { pure_ferrite: 8 }, desc: '金属建造方块 ×4' },
  { id: 'block_glass', out: 'block_glass', n: 4, req: { ferrite: 12, sodium: 4 }, desc: '玻璃建造方块 ×4' },
  { id: 'block_glow', out: 'block_glow', n: 2, req: { sodium: 15, copper: 5 }, desc: '荧光建造方块 ×2' },
  { id: 'block_tech', out: 'block_tech', n: 4, req: { pure_ferrite: 6, copper: 6 }, desc: '科技建造方块 ×4' }
];

/* ---------- 精炼配方 ---------- */
const REFINE_RECIPES = [
  { id: 'r_cc', in: { carbon: 2 }, out: 'condensed_carbon', n: 1, desc: '碳 → 浓缩碳' },
  { id: 'r_pf', in: { ferrite: 2 }, out: 'pure_ferrite', n: 1, desc: '铁尘 → 纯铁' },
  { id: 'r_na', in: { sodium: 2 }, out: 'oxygen', n: 1, desc: '钠 → 氧 (催化重构)' },
  { id: 'r_cu', in: { copper: 1 }, out: 'ferrite', n: 4, desc: '铜 → 铁尘 (降解)' }
];
