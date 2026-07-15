/* ═══════════════ VOXEL SKY — 程序化像素纹理 ═══════════════ */
/* 所有纹理均由代码生成 16x16 像素图案，原创设计 */
const Textures = (() => {
  const TILE = 16, COLS = 8, ROWS = 8;
  let atlasCanvas = null, atlasTexture = null;
  const iconCache = {};

  // 简易可复现随机
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
  function shade(c, f) {
    const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f)) | 0;
    const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f)) | 0;
    const b = Math.min(255, Math.max(0, (c & 255) * f)) | 0;
    return (r << 16) | (g << 8) | b;
  }

  /* ---------- 瓦片绘制器 ---------- */
  function drawNoisyTile(ctx, x0, y0, base, variance, seed) {
    const rand = rng(seed);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const f = 1 - variance / 2 + rand() * variance;
      ctx.fillStyle = hex(shade(base, f));
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
  function drawSpeckles(ctx, x0, y0, color, count, seed, size = 1) {
    const rand = rng(seed);
    ctx.fillStyle = hex(color);
    for (let i = 0; i < count; i++) {
      ctx.fillRect(x0 + (rand() * (TILE - size)) | 0, y0 + (rand() * (TILE - size)) | 0, size, size);
    }
  }
  function drawCrystalTile(ctx, x0, y0, base, glow, seed) {
    drawNoisyTile(ctx, x0, y0, shade(base, 0.4), 0.25, seed);
    const rand = rng(seed + 7);
    for (let i = 0; i < 4; i++) {
      const cx = 2 + (rand() * 11) | 0, cy = 2 + (rand() * 11) | 0;
      const h = 3 + (rand() * 4) | 0;
      for (let d = 0; d < h; d++) {
        const w = Math.max(1, h - d - 1);
        ctx.fillStyle = hex(d === h - 1 ? glow : shade(base, 0.85 + d * 0.15));
        ctx.fillRect(x0 + cx - (w >> 1), y0 + cy - d, w, 1);
      }
      ctx.fillStyle = hex(glow);
      ctx.fillRect(x0 + cx, y0 + cy - h, 1, 1);
    }
  }
  function drawOreTile(ctx, x0, y0, stoneBase, oreColor, seed) {
    drawNoisyTile(ctx, x0, y0, stoneBase, 0.22, seed);
    const rand = rng(seed + 13);
    for (let i = 0; i < 5; i++) {
      const cx = 2 + (rand() * 12) | 0, cy = 2 + (rand() * 12) | 0;
      ctx.fillStyle = hex(oreColor);
      ctx.fillRect(x0 + cx, y0 + cy, 2, 2);
      ctx.fillStyle = hex(shade(oreColor, 1.5));
      ctx.fillRect(x0 + cx, y0 + cy, 1, 1);
      ctx.fillStyle = hex(shade(oreColor, 0.6));
      ctx.fillRect(x0 + cx + 1, y0 + cy + 1, 1, 1);
    }
  }
  function drawGrassTop(ctx, x0, y0, base, seed) {
    drawNoisyTile(ctx, x0, y0, base, 0.3, seed);
    drawSpeckles(ctx, x0, y0, shade(base, 1.35), 9, seed + 3);
    drawSpeckles(ctx, x0, y0, shade(base, 0.65), 7, seed + 5);
  }
  function drawGrassSide(ctx, x0, y0, dirtBase, grassBase, seed) {
    drawNoisyTile(ctx, x0, y0, dirtBase, 0.25, seed);
    const rand = rng(seed + 21);
    for (let x = 0; x < TILE; x++) {
      const h = 2 + (rand() * 3) | 0;
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = hex(shade(grassBase, 0.85 + rand() * 0.4));
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }
  function drawLogTile(ctx, x0, y0, base, seed) {
    const rand = rng(seed);
    for (let x = 0; x < TILE; x++) {
      const streak = 0.75 + ((x * 7) % 5) * 0.09;
      for (let y = 0; y < TILE; y++) {
        ctx.fillStyle = hex(shade(base, streak * (0.9 + rand() * 0.2)));
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
    ctx.fillStyle = hex(shade(base, 0.55));
    for (let x = 2; x < TILE; x += 5) ctx.fillRect(x0 + x, y0, 1, TILE);
  }
  function drawLeafTile(ctx, x0, y0, base, glow, seed) {
    const rand = rng(seed);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const f = 0.6 + rand() * 0.75;
      ctx.fillStyle = hex(shade(base, f));
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
    drawSpeckles(ctx, x0, y0, glow, 6, seed + 9);
  }
  function drawTechTile(ctx, x0, y0, base, line, seed) {
    drawNoisyTile(ctx, x0, y0, base, 0.08, seed);
    ctx.fillStyle = hex(line);
    ctx.fillRect(x0, y0, TILE, 1); ctx.fillRect(x0, y0 + TILE - 1, TILE, 1);
    ctx.fillRect(x0, y0, 1, TILE); ctx.fillRect(x0 + TILE - 1, y0, 1, TILE);
    ctx.fillRect(x0 + 4, y0 + 4, 8, 1); ctx.fillRect(x0 + 4, y0 + 11, 8, 1);
    ctx.fillRect(x0 + 4, y0 + 4, 1, 8); ctx.fillRect(x0 + 11, y0 + 4, 1, 8);
    ctx.fillStyle = hex(shade(line, 1.6));
    ctx.fillRect(x0 + 7, y0 + 7, 2, 2);
  }

  /* ---------- 图集布局: index = row*COLS+col ---------- */
  /* 0 草顶 1 草侧 2 泥土 3 石头(铁尘) 4 深石 5 碳晶木 6 碳晶叶 7 重氢晶体
     8 钠花 9 氧花 10 铜矿 11 沙 12 雪顶 13 雪侧 14 冰 15 科技板
     16 红草顶 17 红草侧 18 紫草顶 19 紫草侧 20 发光石 21 基座金属 22 玻璃 23 熔岩石 */
  const TILE_DEFS = [];
  function buildAtlas() {
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = TILE * COLS; atlasCanvas.height = TILE * ROWS;
    const ctx = atlasCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const P = (i) => [(i % COLS) * TILE, ((i / COLS) | 0) * TILE];
    let p;
    p = P(0); drawGrassTop(ctx, p[0], p[1], 0x4fae62, 101);
    p = P(1); drawGrassSide(ctx, p[0], p[1], 0x7a5b3a, 0x4fae62, 102);
    p = P(2); drawNoisyTile(ctx, p[0], p[1], 0x7a5b3a, 0.28, 103);
    p = P(3); drawNoisyTile(ctx, p[0], p[1], 0x8a8f94, 0.22, 104);
    p = P(4); drawNoisyTile(ctx, p[0], p[1], 0x5a5f66, 0.2, 105);
    p = P(5); drawLogTile(ctx, p[0], p[1], 0x6d4c33, 106);
    p = P(6); drawLeafTile(ctx, p[0], p[1], 0x3e8e52, 0x9fffb0, 107);
    p = P(7); drawCrystalTile(ctx, p[0], p[1], 0x2a6fd4, 0xaee2ff, 108);
    p = P(8); drawGrassTop(ctx, p[0], p[1], 0x8a7a2e, 109); drawSpeckles(ctx, p[0], p[1], 0xffe042, 8, 110, 2);
    p = P(9); drawGrassTop(ctx, p[0], p[1], 0x9c4040, 111); drawSpeckles(ctx, p[0], p[1], 0xff8a8a, 8, 112, 2);
    p = P(10); drawOreTile(ctx, p[0], p[1], 0x8a8f94, 0xd47a3a, 113);
    p = P(11); drawNoisyTile(ctx, p[0], p[1], 0xd8c07a, 0.16, 114);
    p = P(12); drawGrassTop(ctx, p[0], p[1], 0xe8f2f6, 115);
    p = P(13); drawGrassSide(ctx, p[0], p[1], 0x7a6a58, 0xe8f2f6, 116);
    p = P(14); drawNoisyTile(ctx, p[0], p[1], 0x9fd4e8, 0.12, 117);
    p = P(15); drawTechTile(ctx, p[0], p[1], 0x3a444e, 0x5ef2e0, 118);
    p = P(16); drawGrassTop(ctx, p[0], p[1], 0xc46a3d, 119);
    p = P(17); drawGrassSide(ctx, p[0], p[1], 0x6e4a38, 0xc46a3d, 120);
    p = P(18); drawGrassTop(ctx, p[0], p[1], 0x8a5ac2, 121);
    p = P(19); drawGrassSide(ctx, p[0], p[1], 0x5a4468, 0x8a5ac2, 122);
    p = P(20); drawOreTile(ctx, p[0], p[1], 0x5a5f66, 0xffe042, 123);
    p = P(21); drawTechTile(ctx, p[0], p[1], 0x6a7076, 0xd8dde2, 124);
    p = P(22); (() => { const [x0, y0] = p; drawNoisyTile(ctx, x0, y0, 0xbfe8f0, 0.05, 125);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x0 + 2, y0 + 2, 1, 4); ctx.fillRect(x0 + 3, y0 + 2, 1, 2); })();
    p = P(23); drawOreTile(ctx, p[0], p[1], 0x3a3236, 0xff6a2a, 126);
    return atlasCanvas;
  }

  function getAtlasTexture() {
    if (!atlasTexture) {
      if (!atlasCanvas) buildAtlas();
      atlasTexture = new THREE.CanvasTexture(atlasCanvas);
      atlasTexture.magFilter = THREE.NearestFilter;
      atlasTexture.minFilter = THREE.NearestFilter;
      atlasTexture.generateMipmaps = false;
    }
    return atlasTexture;
  }
  // uv of tile i => [u0,v0,u1,v1] (v翻转)
  function tileUV(i) {
    const c = i % COLS, r = (i / COLS) | 0;
    const u0 = c / COLS, v1 = 1 - r / ROWS, v0 = 1 - (r + 1) / ROWS;
    const pad = 0.001;
    return [u0 + pad, v0 + pad, (c + 1) / COLS - pad, v1 - pad];
  }

  /* ---------- 物品图标 (32x32 像素画) ---------- */
  function makeIcon(id, draw) {
    if (iconCache[id]) return iconCache[id];
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    draw(c);
    iconCache[id] = cv.toDataURL();
    return iconCache[id];
  }
  function iconFromTile(id, tileIndex) {
    return makeIcon(id, c => {
      if (!atlasCanvas) buildAtlas();
      const x = (tileIndex % COLS) * TILE, y = ((tileIndex / COLS) | 0) * TILE;
      c.drawImage(atlasCanvas, x, y, TILE, TILE, 2, 2, 28, 28);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.strokeRect(2.5, 2.5, 27, 27);
    });
  }
  function px(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }
  function drawGem(c, main, hi, lo) {
    px(c, 12, 4, 8, 4, main); px(c, 8, 8, 16, 8, main); px(c, 10, 16, 12, 6, main);
    px(c, 14, 22, 4, 6, lo);
    px(c, 12, 4, 4, 4, hi); px(c, 8, 8, 4, 6, hi);
    px(c, 20, 12, 4, 4, lo); px(c, 18, 16, 4, 6, lo);
  }
  function drawDust(c, main, hi) {
    [[6,20],[12,22],[18,20],[24,22],[9,15],[16,16],[22,15],[13,10],[19,9]].forEach(([x,y],i)=>{
      px(c, x, y, 4, 4, i % 3 === 0 ? hi : main);
      px(c, x, y, 2, 2, hi);
    });
  }
  function drawFlask(c, liquid, hi) {
    px(c, 13, 3, 6, 3, '#cfd8dd');
    px(c, 12, 6, 8, 3, '#9aa8b0');
    px(c, 9, 9, 14, 18, '#c8dde5');
    px(c, 10, 14, 12, 12, liquid);
    px(c, 10, 14, 4, 4, hi);
    px(c, 9, 9, 2, 18, 'rgba(255,255,255,.5)');
  }
  function drawTech(c, base, glow) {
    px(c, 5, 8, 22, 16, base);
    px(c, 5, 8, 22, 2, '#e8eef2'); px(c, 5, 22, 22, 2, '#2a3238');
    px(c, 9, 12, 6, 8, glow); px(c, 18, 12, 5, 3, '#e8eef2');
    px(c, 18, 17, 5, 3, glow);
    px(c, 3, 12, 2, 8, '#5a666e'); px(c, 27, 12, 2, 8, '#5a666e');
  }

  const ICONS = {};
  function buildIcons() {
    if (!atlasCanvas) buildAtlas();
    ICONS.carbon = makeIcon('carbon', c => drawGem(c, '#4a4a52', '#8a8a96', '#26262c'));
    ICONS.condensed_carbon = makeIcon('cc', c => drawGem(c, '#7a4ad2', '#c9a8ff', '#4a2a86'));
    ICONS.ferrite = makeIcon('ferrite', c => drawDust(c, '#a8865a', '#e0c090'));
    ICONS.pure_ferrite = makeIcon('pf', c => drawGem(c, '#c8ccd2', '#ffffff', '#84888e'));
    ICONS.dihydrogen = makeIcon('dh', c => drawGem(c, '#2a6fd4', '#aee2ff', '#1a3f84'));
    ICONS.sodium = makeIcon('na', c => drawDust(c, '#e8c22a', '#fff4a0'));
    ICONS.oxygen = makeIcon('o2', c => drawFlask(c, '#ff5d5d', '#ffb0b0'));
    ICONS.copper = makeIcon('cu', c => drawGem(c, '#d4783a', '#ffc088', '#8a4a1e'));
    ICONS.metal_plating = makeIcon('mp', c => {
      px(c, 4, 6, 24, 20, '#9aa4ac'); px(c, 4, 6, 24, 3, '#d8e0e6'); px(c, 4, 23, 24, 3, '#5a646c');
      px(c, 7, 10, 2, 2, '#3a444c'); px(c, 23, 10, 2, 2, '#3a444c');
      px(c, 7, 20, 2, 2, '#3a444c'); px(c, 23, 20, 2, 2, '#3a444c');
      px(c, 12, 13, 8, 6, '#7a848c');
    });
    ICONS.hermetic_seal = makeIcon('hs', c => drawTech(c, '#4a3a5e', '#c9a8ff'));
    ICONS.launch_fuel = makeIcon('lf', c => {
      px(c, 10, 4, 12, 24, '#c23a3a'); px(c, 10, 4, 12, 4, '#e8e0d8');
      px(c, 10, 4, 4, 24, '#e86a6a'); px(c, 13, 12, 6, 8, '#fff');
      px(c, 14, 13, 4, 2, '#c23a3a'); px(c, 14, 17, 4, 2, '#c23a3a');
    });
    ICONS.units = makeIcon('un', c => drawGem(c, '#e8c22a', '#fff4a0', '#a8861a'));
    ICONS.tech_frag = makeIcon('tf', c => drawTech(c, '#2a4a56', '#5ef2e0'));
    // 方块图标直接取图集
    ICONS.block_grass = iconFromTile('b_grass', 1);
    ICONS.block_dirt = iconFromTile('b_dirt', 2);
    ICONS.block_stone = iconFromTile('b_stone', 3);
    ICONS.block_tech = iconFromTile('b_tech', 15);
    ICONS.block_glass = iconFromTile('b_glass', 22);
    ICONS.block_metal = iconFromTile('b_metal', 21);
    ICONS.block_glow = iconFromTile('b_glow', 20);
    ICONS.block_wood = iconFromTile('b_wood', 5);
    return ICONS;
  }

  /* ---------- 星系图行星缩略图 ---------- */
  function planetThumb(palette, seed) {
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24;
    const c = cv.getContext('2d');
    const rand = rng(seed);
    const R = 11;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const dx = x - 12, dy = y - 12;
      if (dx * dx + dy * dy > R * R) continue;
      const t = rand();
      let col = palette.land;
      if (t < 0.32) col = palette.sea;
      else if (t > 0.86) col = palette.accent;
      let f = 1 - Math.max(0, (dx + dy) / (R * 2)) * 0.75;
      if (dx * dx + dy * dy > (R - 1.4) * (R - 1.4)) f *= 0.68;
      c.fillStyle = hex(shade(col, f));
      c.fillRect(x, y, 1, 1);
    }
    return cv;
  }

  return { buildAtlas, getAtlasTexture, tileUV, buildIcons, ICONS, planetThumb, rng, shade, hex, TILE, COLS, ROWS };
})();
