/* ═══════════════ VOXEL SKY — 体素世界引擎 ═══════════════ */
/* 区块化体素地形 + 程序化星球生成 (原创噪声地形) */

/* ---------- 2D 值噪声 ---------- */
class ValueNoise {
  constructor(seed) {
    this.perm = new Uint8Array(512);
    const rand = Textures.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  hash(x, y) { return this.perm[(this.perm[x & 255] + y) & 255] / 255; }
  smooth(t) { return t * t * (3 - 2 * t); }
  noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = this.smooth(xf), v = this.smooth(yf);
    const a = this.hash(xi, yi), b = this.hash(xi + 1, yi);
    const c = this.hash(xi, yi + 1), d = this.hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.noise2(x * freq, y * freq) * amp;
      norm += amp; amp *= gain; freq *= lac;
    }
    return sum / norm;
  }
}

/* ---------- 星球定义 ---------- */
const HAZARDS = {
  none:    { name: '宜居', icon: '❀', drain: 0,     vignette: '' },
  heat:    { name: '极热', icon: '☀', drain: 1.6,   vignette: '' },
  cold:    { name: '极寒', icon: '❄', drain: 1.5,   vignette: 'cold' },
  toxic:   { name: '剧毒', icon: '☣', drain: 1.8,   vignette: 'toxic' },
  radio:   { name: '辐射', icon: '☢', drain: 2.0,   vignette: 'toxic' }
};

const PLANET_ARCHETYPES = [
  { biome: 'lush',   hazard: 'none',  top: BLOCK.GRASS, mid: BLOCK.DIRT, sky: 0x7ec8e0, fog: 0xaad8e8, sun: 0xfff2d0, grassTint: 0x4fae62,
    palette: { land: 0x4fae62, sea: 0x2a6fd4, accent: 0x9c4040 }, treeDensity: 0.012, desc: '繁茂' },
  { biome: 'scorch', hazard: 'heat',  top: BLOCK.SAND,  mid: BLOCK.SAND, sky: 0xe8a860, fog: 0xe8b880, sun: 0xffd8a0, grassTint: 0xd8a04a,
    palette: { land: 0xd8c07a, sea: 0xc46a3d, accent: 0x8a3010 }, treeDensity: 0.003, desc: '灼热' },
  { biome: 'frozen', hazard: 'cold',  top: BLOCK.SNOW,  mid: BLOCK.DIRT, sky: 0xa8cce0, fog: 0xcfe4f0, sun: 0xe8f4ff, grassTint: 0xd8ecf4,
    palette: { land: 0xe8f2f6, sea: 0x9fd4e8, accent: 0x5a7a9c }, treeDensity: 0.006, desc: '冰封' },
  { biome: 'toxic',  hazard: 'toxic', top: BLOCK.GRASS, mid: BLOCK.DIRT, sky: 0x8aa860, fog: 0xa8c080, sun: 0xe0ffc0, grassTint: 0x8a5ac2,
    palette: { land: 0x8a5ac2, sea: 0x4a7a3a, accent: 0xd8b020 }, treeDensity: 0.016, desc: '剧毒' },
  { biome: 'ember',  hazard: 'radio', top: BLOCK.LAVA_ROCK, mid: BLOCK.DEEPSTONE, sky: 0xc47a5a, fog: 0xa86048, sun: 0xffb080, grassTint: 0xc46a3d,
    palette: { land: 0xc46a3d, sea: 0x3a3236, accent: 0xff6a2a }, treeDensity: 0.002, desc: '余烬' }
];

const PLANET_NAME_A = ['诺瓦', '艾欧', '塞拉', '克洛', '维斯', '奥丁', '琉特', '赫尔', '扎恩', '凯普'];
const PLANET_NAME_B = ['利安', '德拉', '西斯', '玛尔', '塔罗', '努姆', '菲德', '罗恩', '维亚', '克斯'];

function generateSystem(seed) {
  const rand = Textures.rng(seed);
  const count = 4 + (rand() * 2) | 0;
  const planets = [];
  const usedArch = [];
  for (let i = 0; i < count; i++) {
    let a = (rand() * PLANET_ARCHETYPES.length) | 0;
    if (i === 0) a = 3; // 起始星球: 剧毒 (贴近原作开局)
    else if (usedArch.length < PLANET_ARCHETYPES.length) {
      while (usedArch.includes(a)) a = (rand() * PLANET_ARCHETYPES.length) | 0;
    }
    usedArch.push(a);
    const arch = PLANET_ARCHETYPES[a];
    const name = PLANET_NAME_A[(rand() * 10) | 0] + PLANET_NAME_B[(rand() * 10) | 0] +
      '-' + String.fromCharCode(65 + ((rand() * 26) | 0)) + ((rand() * 9 + 1) | 0);
    planets.push({
      id: i, name, arch, seed: (seed * 7 + i * 131071) >>> 0,
      orbitRadius: 900 + i * 620 + rand() * 200,
      orbitAngle: rand() * Math.PI * 2,
      radius: 130 + rand() * 80,
      discovered: false
    });
  }
  const sysName = PLANET_NAME_A[(rand() * 10) | 0] + '欧几里得-' + ((rand() * 899 + 100) | 0);
  return { name: sysName, planets, seed };
}

/* ---------- 体素世界 ---------- */
const CHUNK = 16, WORLD_H = 56, SEA = 14;

class VoxelWorld {
  constructor(planet, scene) {
    this.planet = planet;
    this.scene = scene;
    this.chunks = new Map();      // key => {data, mesh, glassMesh}
    this.edits = planet.edits || (planet.edits = new Map()); // 玩家改动持久化
    this.noise = new ValueNoise(planet.seed);
    this.noise2 = new ValueNoise(planet.seed ^ 0x9e3779b9);
    this.material = new THREE.MeshLambertMaterial({
      map: Textures.getAtlasTexture(), vertexColors: true
    });
    this.glassMaterial = new THREE.MeshLambertMaterial({
      map: Textures.getAtlasTexture(), vertexColors: true, transparent: true, opacity: 0.55
    });
    this.dirty = new Set();
  }
  key(cx, cz) { return cx + ',' + cz; }

  /* ----- 地形生成 ----- */
  groundHeight(x, z) {
    const n = this.noise.fbm(x * 0.012, z * 0.012, 5);
    const hills = this.noise2.fbm(x * 0.045, z * 0.045, 3);
    const mountains = Math.pow(this.noise.fbm(x * 0.006 + 100, z * 0.006 + 100, 4), 2.4);
    return Math.floor(6 + n * 16 + hills * 6 + mountains * 26);
  }
  genColumn(x, z, out) {
    const arch = this.planet.arch;
    const h = this.groundHeight(x, z);
    for (let y = 0; y < WORLD_H; y++) {
      let b = BLOCK.AIR;
      if (y === 0) b = BLOCK.DEEPSTONE;
      else if (y < h - 6) {
        b = BLOCK.DEEPSTONE;
        const o = this.noise2.noise2(x * 0.13, y * 0.13 + z * 0.07);
        if (o > 0.82) b = BLOCK.COPPER_ORE;
        else if (o < 0.06) b = BLOCK.GLOW_ORE;
      }
      else if (y < h - 1) b = BLOCK.STONE;
      else if (y < h) b = arch.mid;
      else if (y === h) b = h <= SEA + 1 && arch.biome !== 'ember' ? BLOCK.SAND : arch.top;
      out[y] = b;
    }
    return h;
  }
  surfaceFeature(x, z, h, set) {
    if (h <= SEA + 1) return;
    const arch = this.planet.arch;
    const r = this.noise2.hash(x * 3 + 7, z * 3 + 11);
    const r2 = this.noise.hash(x * 5 + 3, z * 5 + 17);
    // 树 (碳晶木)
    if (r < arch.treeDensity * 40 && r2 < 0.32) {
      const th = 3 + ((r * 997) % 3 | 0);
      for (let i = 1; i <= th; i++) set(x, h + i, z, BLOCK.LOG);
      for (let dy = th - 1; dy <= th + 1; dy++)
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - th) > 3) continue;
          if (dx === 0 && dz === 0 && dy <= th) continue;
          set(x + dx, h + dy, z + dz, BLOCK.LEAF);
        }
      return;
    }
    // 重氢晶体
    if (r > 0.986) { set(x, h + 1, z, BLOCK.DIHYDROGEN); return; }
    // 钠盐花
    if (r > 0.972 && r <= 0.986) { set(x, h + 1, z, BLOCK.SODIUM_PLANT); return; }
    // 赤息花 (氧)
    if (r > 0.958 && r <= 0.972) { set(x, h + 1, z, BLOCK.OXYGEN_PLANT); return; }
  }

  genChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
    const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;
    const col = new Uint8Array(WORLD_H);
    const heights = [];
    for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
      const h = this.genColumn(wx, wz, col);
      heights.push({ x, z, wx, wz, h });
      for (let y = 0; y < WORLD_H; y++) data[idx(x, y, z)] = col[y];
    }
    // 地表特征 (可跨区块的仅限本区块内简单写入)
    const set = (wx, y, wz, b) => {
      const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= WORLD_H) return;
      if (data[idx(lx, y, lz)] === BLOCK.AIR) data[idx(lx, y, lz)] = b;
    };
    for (const hh of heights) this.surfaceFeature(hh.wx, hh.wz, hh.h, set);
    // 应用玩家改动
    const ekey = this.key(cx, cz);
    const edits = this.edits.get(ekey);
    if (edits) for (const [k, b] of edits) {
      const [x, y, z] = k.split(',').map(Number);
      data[idx(x, y, z)] = b;
    }
    return data;
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_H) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return BLOCK.AIR;
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    return c.data[(wy * CHUNK + lz) * CHUNK + lx];
  }
  setBlock(wx, wy, wz, b) {
    if (wy < 1 || wy >= WORLD_H) return false;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const k = this.key(cx, cz);
    const c = this.chunks.get(k);
    if (!c) return false;
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    c.data[(wy * CHUNK + lz) * CHUNK + lx] = b;
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(lx + ',' + wy + ',' + lz, b);
    this.dirty.add(k);
    if (lx === 0) this.dirty.add(this.key(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirty.add(this.key(cx + 1, cz));
    if (lz === 0) this.dirty.add(this.key(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(this.key(cx, cz + 1));
    return true;
  }
  isSolid(wx, wy, wz) {
    const b = this.getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return b !== BLOCK.AIR && b !== BLOCK.WATER;
  }

  /* ----- 网格生成 ----- */
  // 面: [dx,dy,dz, 4顶点, 法线]
  static FACES = [
    { dir: [1, 0, 0],  verts: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], normal: [1,0,0], light: 0.8 },
    { dir: [-1, 0, 0], verts: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], normal: [-1,0,0], light: 0.8 },
    { dir: [0, 1, 0],  verts: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], normal: [0,1,0], light: 1.0, tile: 0 },
    { dir: [0, -1, 0], verts: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]], normal: [0,-1,0], light: 0.55, tile: 2 },
    { dir: [0, 0, 1],  verts: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], normal: [0,0,1], light: 0.7 },
    { dir: [0, 0, -1], verts: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], normal: [0,0,-1], light: 0.7 }
  ];

  buildChunkMesh(cx, cz) {
    const k = this.key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) { c = { data: this.genChunk(cx, cz), mesh: null, glassMesh: null }; this.chunks.set(k, c); }
    const data = c.data;
    const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;
    const solidAt = (x, y, z) => {
      if (y < 0) return BLOCK.DEEPSTONE;
      if (y >= WORLD_H) return BLOCK.AIR;
      if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return data[idx(x, y, z)];
      return this.getBlockOrGen(cx * CHUNK + x, y, cz * CHUNK + z);
    };
    const build = (transparentPass) => {
      const pos = [], norm = [], uv = [], col = [], indices = [];
      let vi = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
        const b = data[idx(x, y, z)];
        if (b === BLOCK.AIR) continue;
        const def = BLOCK_DEFS[b];
        if (!def) continue;
        if (!!def.transparent !== transparentPass) continue;
        for (const face of VoxelWorld.FACES) {
          const nb = solidAt(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
          const nbDef = BLOCK_DEFS[nb];
          if (nb !== BLOCK.AIR && !(nbDef && nbDef.transparent && nb !== b)) continue;
          const tileIdx = face.tile === 0 ? def.tiles[0] : face.tile === 2 ? def.tiles[2] : def.tiles[1];
          const [u0, v0, u1, v1] = Textures.tileUV(tileIdx);
          const uvs = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
          for (let i = 0; i < 4; i++) {
            const v = face.verts[i];
            pos.push(x + v[0], y + v[1], z + v[2]);
            norm.push(...face.normal);
            uv.push(uvs[i][0], uvs[i][1]);
            let l = face.light;
            if (def.glow) {
              const g = def.glow;
              col.push(Math.min(1, l + ((g >> 16 & 255) / 255) * 0.7), Math.min(1, l + ((g >> 8 & 255) / 255) * 0.7), Math.min(1, l + ((g & 255) / 255) * 0.7));
            } else col.push(l, l, l);
          }
          indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          vi += 4;
        }
      }
      if (indices.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(indices);
      return geo;
    };
    // 移除旧网格
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.glassMesh) { this.scene.remove(c.glassMesh); c.glassMesh.geometry.dispose(); }
    const solidGeo = build(false);
    if (solidGeo) {
      c.mesh = new THREE.Mesh(solidGeo, this.material);
      c.mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      c.mesh.userData.isChunk = true;
      this.scene.add(c.mesh);
    } else c.mesh = null;
    const glassGeo = build(true);
    if (glassGeo) {
      c.glassMesh = new THREE.Mesh(glassGeo, this.glassMaterial);
      c.glassMesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.scene.add(c.glassMesh);
    } else c.glassMesh = null;
    return c;
  }

  getBlockOrGen(wx, wy, wz) {
    if (wy < 0) return BLOCK.DEEPSTONE;
    if (wy >= WORLD_H) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (c) {
      const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
      return c.data[(wy * CHUNK + lz) * CHUNK + lx];
    }
    // 邻区块未加载: 用地形函数估算 (只判断是否远低于地面)
    const h = this.groundHeight(wx, wz);
    if (wy > h) return BLOCK.AIR;
    return BLOCK.STONE;
  }

  /* ----- 区块流式加载 ----- */
  update(px, pz, radius = 4) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    let built = 0;
    // 先重建脏区块
    for (const k of this.dirty) {
      const [cx, cz] = k.split(',').map(Number);
      if (this.chunks.has(k)) { this.buildChunkMesh(cx, cz); built++; }
      this.dirty.delete(k);
      if (built >= 3) break;
    }
    // 螺旋加载新区块 (每帧最多2个)
    outer:
    for (let r = 0; r <= radius; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const k = this.key(pcx + dx, pcz + dz);
        const c = this.chunks.get(k);
        if (!c || (!c.mesh && !c.glassMesh && !c.empty)) {
          const cc = this.buildChunkMesh(pcx + dx, pcz + dz);
          if (!cc.mesh && !cc.glassMesh) cc.empty = true;
          built++;
          if (built >= 2) break outer;
        }
      }
    }
    // 卸载远处区块
    for (const [k, c] of this.chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > radius + 2) {
        if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
        if (c.glassMesh) { this.scene.remove(c.glassMesh); c.glassMesh.geometry.dispose(); }
        this.chunks.delete(k);
      }
    }
    return built;
  }
  // 同步预加载 (进入星球时)
  preload(px, pz, radius, onProgress) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const list = [];
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) list.push([pcx + dx, pcz + dz]);
    list.sort((a, b) => (Math.abs(a[0] - pcx) + Math.abs(a[1] - pcz)) - (Math.abs(b[0] - pcx) + Math.abs(b[1] - pcz)));
    return new Promise(resolve => {
      let i = 0;
      const step = () => {
        const t0 = performance.now();
        while (i < list.length && performance.now() - t0 < 28) {
          this.buildChunkMesh(list[i][0], list[i][1]); i++;
        }
        if (onProgress) onProgress(i / list.length);
        if (i < list.length) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }
  dispose() {
    for (const [, c] of this.chunks) {
      if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
      if (c.glassMesh) { this.scene.remove(c.glassMesh); c.glassMesh.geometry.dispose(); }
    }
    this.chunks.clear();
  }
  chunkMeshes() {
    const arr = [];
    for (const [, c] of this.chunks) { if (c.mesh) arr.push(c.mesh); if (c.glassMesh) arr.push(c.glassMesh); }
    return arr;
  }
  // 找出附近某类方块 (扫描仪)
  findBlocks(px, py, pz, types, range = 48, limit = 10) {
    const found = [];
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const cr = Math.ceil(range / CHUNK);
    for (let dcx = -cr; dcx <= cr; dcx++) for (let dcz = -cr; dcz <= cr; dcz++) {
      const c = this.chunks.get(this.key(pcx + dcx, pcz + dcz));
      if (!c) continue;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
        const b = c.data[(y * CHUNK + z) * CHUNK + x];
        if (!types.includes(b)) continue;
        const wx = (pcx + dcx) * CHUNK + x + 0.5, wz = (pcz + dcz) * CHUNK + z + 0.5;
        const d2 = (wx - px) ** 2 + (y - py) ** 2 + (wz - pz) ** 2;
        if (d2 < range * range) found.push({ x: wx, y: y + 0.5, z: wz, block: b, d: Math.sqrt(d2) });
      }
    }
    found.sort((a, b) => a.d - b.d);
    // 去重: 相邻同类只保留一个
    const out = [];
    for (const f of found) {
      if (out.length >= limit) break;
      if (out.some(o => o.block === f.block && (o.x - f.x) ** 2 + (o.y - f.y) ** 2 + (o.z - f.z) ** 2 < 36)) continue;
      out.push(f);
    }
    return out;
  }
}
