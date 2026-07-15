/* ═══════════════ VOXEL SKY — 主游戏引擎 ═══════════════ */
/* 状态机: boot → planet(步行/飞行) ⇄ space | 生存系统 | 任务链 */

const Game = (() => {
  const $ = UI.$;
  let renderer, clock;
  let system, currentPlanet = null, navTarget = null;
  let planetScene = null, world = null, playerCam = null, player = null;
  let spaceScene = null, spaceFlight = null;
  let ship = null, shipPlanet = null, planetFlight = null;
  let shipLandedPos = new THREE.Vector3();
  let mode = 'boot'; // boot | walk | fly | space | transition | dead
  let paused = false, menuOpen = null;

  /* ---------- 玩家状态 ---------- */
  const stats = {
    health: 100, hazard: 100, life: 100, units: 0,
    shipFuel: 0, maxFuel: 100
  };
  const inventory = new Array(24).fill(null);
  const hotbar = new Array(6).fill(null);
  let hotbarActive = 0;

  /* ---------- 飞船部件 (NMS式修复流程) ---------- */
  const shipParts = [
    { id: 'thruster', name: '起飞推进器', req: { metal_plating: 1, pure_ferrite: 30 }, fixed: false },
    { id: 'pulse', name: '脉冲引擎', req: { hermetic_seal: 1 }, fixed: false },
    { id: 'scanner_ship', name: '导航扫描仪', req: { copper: 15 }, fixed: false }
  ];
  let scannerFixed = false;

  /* ---------- 任务链 ---------- */
  const missions = [
    { id: 'wake', title: '苏醒', desc: '你在陌生星球上苏醒，危险防护正在流失。采集资源维持生存。', check: () => countItem('carbon') >= 10, progress: () => `采集碳 ${Math.min(10, countItem('carbon'))}/10 (激光采集植物)` },
    { id: 'scanner', title: '修复扫描仪', desc: '多功能工具的扫描仪已损坏。采集铁尘(激光采集岩石)修复它。', check: () => scannerFixed, progress: () => scannerFixed ? '' : `铁尘 ${Math.min(25, countItem('ferrite'))}/25 — 集齐后自动修复` },
    { id: 'findship', title: '寻找星舰', desc: '扫描仪定位到了坠毁的星舰信号。跟随橙色标记前进。', check: () => shipDistance() < 14, progress: () => `距离星舰 ${shipDistance() | 0}u` },
    { id: 'thruster', title: '修复起飞推进器', desc: '合成金属镀层(50铁尘)，并精炼纯铁×30。靠近星舰按E打开诊断界面。', check: () => shipParts[0].fixed, progress: () => '' },
    { id: 'pulse', title: '修复脉冲引擎', desc: '精炼浓缩碳(碳×2→1)并合成密封剂(浓缩碳×30)。', check: () => shipParts[1].fixed, progress: () => '' },
    { id: 'fuel', title: '加注起飞燃料', desc: '采集重氢晶体(蓝色晶簇)，合成起飞燃料并在背包中使用。', check: () => stats.shipFuel >= 50, progress: () => `燃料 ${stats.shipFuel | 0}/50` },
    { id: 'launch', title: '起飞!', desc: '登上星舰(按E)，按空格键点火起飞，冲出大气层。', check: () => mode === 'space', progress: () => '' },
    { id: 'explore', title: '星际探索者', desc: '这个星系还有更多星球等待探索。用脉冲引擎(空格)接近其他星球，按E进入大气层。M键打开星图。', check: () => system.planets.filter(p => p.discovered).length >= 2, progress: () => `已发现星球 ${system.planets.filter(p => p.discovered).length}/2` },
    { id: 'free', title: '无尽宇宙', desc: '自由探索。采集、建造(右键放置方块)、发现新世界。你的旅途才刚刚开始。', check: () => false, progress: () => '' }
  ];
  let missionIdx = 0;

  /* ═══════════════ 库存系统 ═══════════════ */
  function countItem(id) {
    let n = 0;
    for (const s of inventory) if (s && s.item === id) n += s.n;
    for (const s of hotbar) if (s && s.item === id) n += s.n;
    return n;
  }
  function addItem(id, n) {
    const def = ITEMS[id];
    if (!def) return 0;
    let left = n;
    for (const s of inventory) {
      if (s && s.item === id && s.n < def.max) {
        const add = Math.min(left, def.max - s.n);
        s.n += add; left -= add;
        if (!left) break;
      }
    }
    while (left > 0) {
      const idx = inventory.findIndex(s => !s);
      if (idx === -1) { UI.notify('存储矩阵已满!', 'warn'); break; }
      const add = Math.min(left, def.max);
      inventory[idx] = { item: id, n: add };
      left -= add;
    }
    const gained = n - left;
    if (gained > 0) UI.gain(id, gained);
    refreshOpenMenus();
    return gained;
  }
  function removeItem(id, n) {
    let need = n;
    const pools = [inventory, hotbar];
    for (const pool of pools) {
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        if (s && s.item === id) {
          const take = Math.min(need, s.n);
          s.n -= take; need -= take;
          if (s.n <= 0) pool[i] = null;
          if (!need) break;
        }
      }
      if (!need) break;
    }
    refreshOpenMenus();
    UI.renderHotbar(hotbar, hotbarActive);
    return n - need;
  }
  function useItem(id, use) {
    if (use === 'hazard' && countItem(id) > 0) {
      removeItem(id, Math.min(25, countItem(id)));
      stats.hazard = Math.min(100, stats.hazard + 50);
      AudioSys.refill(); UI.notify('危险防护已充能', 'info', null, true);
    } else if (use === 'life' && countItem(id) > 0) {
      removeItem(id, Math.min(25, countItem(id)));
      stats.life = Math.min(100, stats.life + 50);
      AudioSys.refill(); UI.notify('生命维持已充能', 'info', null, true);
    } else if (use === 'fuel') {
      if (stats.shipFuel >= stats.maxFuel) { UI.notify('燃料已满', 'warn'); return; }
      removeItem(id, 1);
      stats.shipFuel = Math.min(stats.maxFuel, stats.shipFuel + 50);
      AudioSys.refill(); UI.notify('起飞燃料 +50', 'info');
    } else if (use === 'hotbar') {
      const idx = hotbar.findIndex(s => !s);
      const cnt = countItem(id);
      if (idx === -1) { UI.notify('快捷栏已满', 'warn'); return; }
      const take = Math.min(cnt, 99);
      removeItem(id, take);
      hotbar[idx] = { item: id, n: take };
      UI.renderHotbar(hotbar, hotbarActive);
      AudioSys.uiClick();
    }
    refreshOpenMenus();
  }
  function craftRecipe(r) {
    for (const [it, n] of Object.entries(r.req)) if (countItem(it) < n) { AudioSys.uiError(); return; }
    for (const [it, n] of Object.entries(r.req)) removeItem(it, n);
    addItem(r.out, r.n);
    AudioSys.craft();
    UI.notify(`合成: ${ITEMS[r.out].name} ×${r.n}`, 'gain', Textures.ICONS[ITEMS[r.out].icon], true);
  }
  function refineRecipe(r, silent = false) {
    for (const [it, n] of Object.entries(r.in)) if (countItem(it) < n) { if (!silent) AudioSys.uiError(); return; }
    for (const [it, n] of Object.entries(r.in)) removeItem(it, n);
    addItem(r.out, r.n);
    if (!silent) AudioSys.craft();
  }
  function repairPart(id) {
    const part = shipParts.find(p => p.id === id);
    if (!part || part.fixed) return;
    for (const [it, n] of Object.entries(part.req)) if (countItem(it) < n) { AudioSys.uiError(); return; }
    for (const [it, n] of Object.entries(part.req)) removeItem(it, n);
    part.fixed = true;
    AudioSys.missionComplete();
    UI.notify(`${part.name} 已修复!`, 'info');
    UI.renderRepair(api);
    updateShipDamageFX();
  }
  function refreshOpenMenus() {
    if (menuOpen === 'inv') {
      UI.renderInventory(api); UI.renderCraft(api); UI.renderRefine(api);
    } else if (menuOpen === 'repair') UI.renderRepair(api);
  }

  /* ═══════════════ 场景构建 ═══════════════ */
  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: $('game-canvas'), antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      for (const cam of [playerCam, spaceScene && spaceScene.camera]) {
        if (cam) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
      }
    });
  }

  function buildPlanetScene(planet) {
    if (world) world.dispose();
    planetScene = new THREE.Scene();
    const arch = planet.arch;
    planetScene.background = new THREE.Color(arch.sky);
    planetScene.fog = new THREE.Fog(arch.fog, 40, 150);
    playerCam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
    const hemi = new THREE.HemisphereLight(arch.sky, 0x3a3228, 0.85);
    planetScene.add(hemi);
    const sun = new THREE.DirectionalLight(arch.sun, 0.95);
    sun.position.set(60, 100, 30);
    planetScene.add(sun);
    // 天空中的太阳方块
    const sunCube = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: arch.sun, fog: false }));
    sunCube.position.set(500, 420, 260);
    planetScene.add(sunCube);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SpaceScene.glowTexture(), color: arch.sun, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunGlow.scale.set(220, 220, 1); sunGlow.position.copy(sunCube.position);
    planetScene.add(sunGlow);
    // 天空中的姐妹星球 (体素卫星群)
    const others = system.planets.filter(p => p !== planet).slice(0, 2);
    others.forEach((p, i) => {
      const pal = p.arch.palette;
      const moonGroup = new THREE.Group();
      const core = new THREE.Mesh(new THREE.BoxGeometry(52, 52, 52),
        new THREE.MeshBasicMaterial({ color: Textures.shade(pal.land, 0.9), fog: false }));
      moonGroup.add(core);
      const rand = Textures.rng(p.seed);
      for (let j = 0; j < 10; j++) {
        const s = 8 + rand() * 14;
        const chip = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
          new THREE.MeshBasicMaterial({ color: Textures.shade(j % 3 ? pal.sea : pal.accent, 0.75 + rand() * 0.4), fog: false }));
        chip.position.set((rand() - 0.5) * 58, (rand() - 0.5) * 58, (rand() - 0.5) * 58);
        moonGroup.add(chip);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: SpaceScene.glowTexture(), color: p.arch.sky, transparent: true,
        opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      halo.scale.set(200, 200, 1);
      moonGroup.add(halo);
      moonGroup.position.set(-420 + i * 760, 380 - i * 90, -520);
      moonGroup.rotation.set(0.5, 0.6, 0.2);
      planetScene.add(moonGroup);
    });
    // 场景重建后重置采矿视觉辅助
    highlightMesh = null;
    laserBeam = null;
    particles.length = 0;
    world = new VoxelWorld(planet, planetScene);
    player = new PlayerController(playerCam, world);
    // 飞船实体
    ship = buildVoxelShip();
    planetScene.add(ship);
    return planetScene;
  }

  function clearLandingSite(x, z, r = 7) {
    // 清出着陆场: 移除地表以上的树木/植物, 形成平整空地
    const cx = Math.floor(x), cz = Math.floor(z);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r) continue;
      const wx = cx + dx, wz = cz + dz;
      const h = world.groundHeight(wx, wz);
      for (let y = h + 1; y < Math.min(WORLD_H, h + 10); y++) {
        if (world.getBlock(wx, y, wz) !== BLOCK.AIR) world.setBlock(wx, y, wz, BLOCK.AIR);
      }
    }
  }
  function placeShipOnGround(x, z) {
    clearLandingSite(x, z);
    const h = world.groundHeight(Math.floor(x), Math.floor(z));
    shipLandedPos.set(x, h + 2.6, z);
    ship.position.copy(shipLandedPos);
    ship.rotation.set(0, Math.PI * 0.3, 0);
    ShipFX.setGear(ship, true);
    ShipFX.setThrust(ship, 0);
    ShipFX.setDownThrust(ship, 0);
  }
  function shipDistance() {
    if (!player || !ship) return 9999;
    return player.pos.distanceTo(ship.position);
  }
  function updateShipDamageFX() {
    // 损坏时机身冒烟色调
    const broken = shipParts.some(p => !p.fixed && p.id !== 'scanner_ship');
    if (ship && ship.userData.mats) {
      ship.userData.mats.hull.color.setHex(broken ? 0x9aa0a8 : 0xd8dde4);
      ship.userData.mats.accent.color.setHex(broken ? 0xa8522a : 0xe8642a);
    }
  }

  /* ═══════════════ 开局流程 ═══════════════ */
  async function startGame() {
    UI.hide('boot-screen');
    UI.show('loading-screen');
    $('loading-text').textContent = '正在生成星系…';
    Textures.buildAtlas();
    Textures.buildIcons();
    initRenderer();
    system = generateSystem((Math.random() * 1e9) | 0);
    currentPlanet = system.planets[0];
    currentPlanet.discovered = true;
    $('loading-text').textContent = '正在生成星球地形…';
    buildPlanetScene(currentPlanet);
    // 出生点
    const spawnX = 8, spawnZ = 8;
    await world.preload(spawnX, spawnZ, 4, p => { $('loading-bar').style.width = (p * 100) + '%'; });
    const h = world.groundHeight(spawnX, spawnZ);
    player.pos.set(spawnX, h + 3, spawnZ);
    // 坠毁的飞船放在不远处
    placeShipOnGround(spawnX + 46, spawnZ + 30);
    updateShipDamageFX();
    UI.hide('loading-screen');
    UI.show('hud');
    mode = 'walk';
    player.enabled = true;
    stats.hazard = 74; stats.life = 88;
    AudioSys.startPlanetAmbient();
    UI.setHazardInfo(HAZARDS[currentPlanet.arch.hazard]);
    UI.setLocation(currentPlanet.name, currentPlanet.arch.desc + '星球 · ' + system.name);
    UI.setUnits(stats.units);
    UI.renderHotbar(hotbar, hotbarActive);
    UI.discoveryCard('探索者协议 · 重启', currentPlanet.name, [
      ['环境', currentPlanet.arch.desc], ['危险', HAZARDS[currentPlanet.arch.hazard].name], ['状态', '迫降幸存']
    ], 5200);
    setMission(0);
    requestPointerLock();
    clock = new THREE.Clock();
    loop();
  }

  function setMission(i) {
    missionIdx = i;
    const m = missions[i];
    UI.setMission(m.title, m.desc, m.progress());
    if (i > 0) AudioSys.missionComplete();
    // 任务标记
    if (m.id === 'findship' && ship) {
      UI.addMarker('mship', { pos: ship.position.clone().add(new THREE.Vector3(0, 3, 0)), icon: '▲', label: '坠毁的星舰', cls: 'ship' });
    }
  }
  function checkMission() {
    const m = missions[missionIdx];
    if (!m) return;
    UI.setMission(m.title, m.desc, m.progress());
    if (m.check()) {
      if (m.id === 'scanner') {} // handled elsewhere
      UI.notify(`任务完成: ${m.title}`, 'info', null, true);
      if (m.id === 'findship') UI.removeMarker('mship');
      setMission(missionIdx + 1);
    }
    // 扫描仪自动修复检查
    if (!scannerFixed && countItem('ferrite') >= 25 && missionIdx >= 1) {
      removeItem('ferrite', 25);
      scannerFixed = true;
      AudioSys.missionComplete();
      UI.notify('扫描仪已修复 — 按 C 扫描环境', 'info');
    }
  }

  /* ═══════════════ 生存系统 ═══════════════ */
  let hazardWarnTimer = 0, lifeWarnTimer = 0;
  function updateSurvival(dt) {
    if (mode !== 'walk') return;
    const hz = HAZARDS[currentPlanet.arch.hazard];
    // 危险防护流失
    if (hz.drain > 0) {
      stats.hazard = Math.max(0, stats.hazard - hz.drain * dt * 0.55);
      UI.hazardVignette(stats.hazard < 30 ? (1 - stats.hazard / 30) * 0.9 : 0);
      if (stats.hazard <= 0) {
        stats.health -= 3.2 * dt;
        if ((hazardWarnTimer -= dt) <= 0) { UI.notify('危险防护耗尽! 补充钠元素!', 'warn'); hazardWarnTimer = 6; UI.damageFlash(); AudioSys.damage(); }
      } else if (stats.hazard < 20 && (hazardWarnTimer -= dt) <= 0) {
        UI.notify('危险防护不足', 'warn'); hazardWarnTimer = 10;
      }
    } else {
      stats.hazard = Math.min(100, stats.hazard + dt * 2);
      UI.hazardVignette(0);
    }
    // 生命维持
    const running = player.keys['ShiftLeft'] || player.jetting;
    stats.life = Math.max(0, stats.life - dt * (running ? 0.5 : 0.22));
    if (stats.life <= 0) {
      stats.health -= 2.5 * dt;
      if ((lifeWarnTimer -= dt) <= 0) { UI.notify('生命维持耗尽! 补充氧元素!', 'warn'); lifeWarnTimer = 6; UI.damageFlash(); AudioSys.damage(); }
    } else if (stats.life < 20 && (lifeWarnTimer -= dt) <= 0) {
      UI.notify('生命维持不足', 'warn'); lifeWarnTimer = 10;
    }
    // 缓慢回血
    if (stats.hazard > 30 && stats.life > 30) stats.health = Math.min(100, stats.health + dt * 1.2);
    if (stats.health <= 0) die();
  }
  function die() {
    if (mode === 'dead') return;
    mode = 'dead';
    player.enabled = false;
    AudioSys.death();
    document.exitPointerLock();
    UI.show('death-screen');
  }
  function respawn() {
    stats.health = 100; stats.hazard = 60; stats.life = 70;
    const h = world.groundHeight(Math.floor(player.pos.x), Math.floor(player.pos.z));
    player.pos.y = h + 3; player.vel.set(0, 0, 0);
    UI.hide('death-screen');
    mode = 'walk';
    player.enabled = true;
    AudioSys.startPlanetAmbient();
    requestPointerLock();
  }

  /* ═══════════════ 采矿 / 放置 ═══════════════ */
  let highlightMesh = null;
  function ensureHighlight() {
    if (highlightMesh) return;
    highlightMesh = new THREE.Group();
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(1.006, 1.006, 1.006),
      new THREE.MeshBasicMaterial({ color: 0x5ef2e0, transparent: true, opacity: 0.09, depthWrite: false })
    );
    highlightMesh.add(wire, fill);
  }
  let laserBeam = null;
  function ensureLaser() {
    if (laserBeam) return;
    const geo = new THREE.CylinderGeometry(0.03, 0.07, 1, 4, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2); // 使光束沿 +Z 延伸, 与 lookAt 朝向一致
    laserBeam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff9d45, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    laserBeam.visible = false;
    // 命中点火花光点
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({
      map: SpaceScene.glowTexture(), color: 0xff8830, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    spark.scale.set(1.4, 1.4, 1);
    laserBeam.userData.spark = spark;
  }
  const particles = [];
  function spawnBreakParticles(x, y, z, block) {
    const def = BLOCK_DEFS[block];
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const colHex = def && def.glow ? def.glow : 0x8a8f94;
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colHex }));
      m.position.set(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6);
      m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4.5, (Math.random() - 0.5) * 4);
      m.userData.life = 0.7 + Math.random() * 0.4;
      planetScene.add(m);
      particles.push(m);
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) { planetScene.remove(p); particles.splice(i, 1); continue; }
      p.userData.vel.y -= 12 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      p.rotation.x += dt * 6; p.rotation.y += dt * 5;
      p.scale.setScalar(Math.max(0.05, p.userData.life));
    }
  }

  let mineSoundTimer = 0;
  function updateMining(dt) {
    ensureHighlight(); ensureLaser();
    if (!highlightMesh.parent) planetScene.add(highlightMesh);
    if (!laserBeam.parent) planetScene.add(laserBeam);
    const pick = player.pickBlock(6.5);
    if (pick) {
      highlightMesh.visible = true;
      highlightMesh.position.set(pick.x + 0.5, pick.y + 0.5, pick.z + 0.5);
      const def = BLOCK_DEFS[pick.block];
      UI.targetInfo(def ? def.name : '未知', def ? (def.drops.length ? '可采集 · ' + def.drops.map(d => ITEMS[d.item].name).join('/') : '结构方块') : '');
    } else {
      highlightMesh.visible = false;
      UI.targetInfo(null);
    }
    // 激光采集
    if (player.mining && pick && !player.overheated && menuOpen === null) {
      const def = BLOCK_DEFS[pick.block];
      if (def) {
        AudioSys.laserStart();
        laserBeam.visible = true;
        const spark = laserBeam.userData.spark;
        if (spark && !spark.parent) planetScene.add(spark);
        if (spark) {
          spark.visible = true;
          spark.position.copy(pick.point).addScaledVector(pick.normal, 0.12);
          spark.scale.setScalar(1.0 + Math.random() * 0.8);
        }
        // 激光从相机右下发射
        const origin = playerCam.position.clone()
          .add(new THREE.Vector3(0.35, -0.3, -0.2).applyQuaternion(playerCam.quaternion));
        laserBeam.position.copy(origin);
        laserBeam.lookAt(pick.point);
        laserBeam.scale.set(1, 1, origin.distanceTo(pick.point));
        // 同一目标累积进度
        const tKey = pick.x + ',' + pick.y + ',' + pick.z;
        if (player.mineTarget !== tKey) { player.mineTarget = tKey; player.mineProgress = 0; }
        player.mineProgress += dt / (def.hardness * 0.85);
        player.heat = Math.min(100, player.heat + dt * 22);
        if (player.heat >= 100) {
          player.overheated = true;
          AudioSys.laserStop();
          UI.notify('采矿光束过热!', 'warn');
        }
        UI.mineProgress(Math.min(1, player.mineProgress));
        mineSoundTimer -= dt;
        if (mineSoundTimer <= 0) { AudioSys.blockHit(); mineSoundTimer = 0.15; }
        if (player.mineProgress >= 1) {
          // 破坏方块
          world.setBlock(pick.x, pick.y, pick.z, BLOCK.AIR);
          spawnBreakParticles(pick.x, pick.y, pick.z, pick.block);
          AudioSys.blockBreak(def.hardness > 1);
          for (const drop of def.drops) {
            const n = drop.n[0] + ((Math.random() * (drop.n[1] - drop.n[0] + 1)) | 0);
            if (n > 0) addItem(drop.item, n);
          }
          // 掉落方块物品 (可放置类)
          if (def.place && Math.random() < 0.5) addItem(def.place, 1);
          player.mineProgress = 0; player.mineTarget = null;
        }
      }
    } else {
      AudioSys.laserStop();
      laserBeam.visible = false;
      if (laserBeam.userData.spark) laserBeam.userData.spark.visible = false;
      player.mineProgress = 0; player.mineTarget = null;
      UI.mineProgress(null);
    }
  }
  function placeBlock() {
    const slot = hotbar[hotbarActive];
    if (!slot) return;
    const def = ITEMS[slot.item];
    if (!def || !def.block) return;
    const pick = player.pickBlock(6);
    if (!pick) return;
    const nx = pick.x + pick.normal.x, ny = pick.y + pick.normal.y, nz = pick.z + pick.normal.z;
    // 不能放在玩家身体内
    const pp = player.pos;
    if (nx === Math.floor(pp.x) && nz === Math.floor(pp.z) && (ny === Math.floor(pp.y) || ny === Math.floor(pp.y + 1))) return;
    if (world.getBlock(nx, ny, nz) !== BLOCK.AIR) return;
    world.setBlock(nx, ny, nz, def.block);
    AudioSys.blockPlace();
    slot.n--;
    if (slot.n <= 0) hotbar[hotbarActive] = null;
    UI.renderHotbar(hotbar, hotbarActive);
  }

  /* ═══════════════ 扫描仪 ═══════════════ */
  let scanCooldown = 0;
  function doScan() {
    if (mode !== 'walk') return;
    if (!scannerFixed) { UI.notify('扫描仪已损坏 — 需要 25 铁尘修复', 'warn'); return; }
    if (scanCooldown > 0) return;
    scanCooldown = 8;
    AudioSys.scan();
    UI.scanPulse();
    UI.clearMarkers('scan_');
    const found = world.findBlocks(player.pos.x, player.pos.y, player.pos.z,
      [BLOCK.DIHYDROGEN, BLOCK.SODIUM_PLANT, BLOCK.OXYGEN_PLANT, BLOCK.COPPER_ORE, BLOCK.LOG, BLOCK.GLOW_ORE], 56, 12);
    const iconMap = {
      [BLOCK.DIHYDROGEN]: ['◇', '重氢'], [BLOCK.SODIUM_PLANT]: ['✿', '钠'],
      [BLOCK.OXYGEN_PLANT]: ['❀', '氧'], [BLOCK.COPPER_ORE]: ['◈', '铜'],
      [BLOCK.LOG]: ['♣', '碳'], [BLOCK.GLOW_ORE]: ['◉', '荧钠']
    };
    let delay = 300;
    for (const f of found) {
      setTimeout(() => {
        AudioSys.scanPing();
        const [icon, label] = iconMap[f.block];
        UI.addMarker('scan_' + f.x + '_' + f.y + '_' + f.z, {
          pos: new THREE.Vector3(f.x, f.y + 1, f.z), icon, label, cls: 'res', ttl: 20000
        });
      }, delay);
      delay += 90;
    }
    if (found.length === 0) UI.notify('附近未发现资源', 'info');
    stats.units += 2;
    UI.setUnits(stats.units);
  }

  /* ═══════════════ 飞船交互 ═══════════════ */
  function nearShip() { return mode === 'walk' && shipDistance() < 7; }
  function shipReady() { return shipParts[0].fixed && shipParts[1].fixed; }

  function tryEnterShip() {
    if (!shipReady()) {
      UI.hide('hud');
      menuOpen = 'repair';
      UI.renderRepair(api);
      UI.show('repair-screen');
      UI.show('hud');
      document.exitPointerLock();
      AudioSys.uiOpen();
      return;
    }
    if (stats.shipFuel < 25) {
      UI.notify('起飞燃料不足 (需要25) — 合成起飞燃料并使用', 'warn');
      menuOpen = 'repair';
      UI.renderRepair(api);
      UI.show('repair-screen');
      document.exitPointerLock();
      return;
    }
    enterShipCockpit();
  }

  function enterShipCockpit() {
    AudioSys.cockpitToggle(true);
    player.enabled = false;
    player.mining = false;
    AudioSys.laserStop(); AudioSys.jetpackStop();
    mode = 'preflight';
    UI.shipHUD(true);
    UI.interactPrompt(null);
    UI.targetInfo(null);
    UI.mineProgress(null);
    if (highlightMesh) highlightMesh.visible = false;
    if (laserBeam) laserBeam.visible = false;
    UI.notify('按 [空格] 点火起飞', 'info', null, true);
    AudioSys.shipEngineStart(false);
    planetFlight = new ShipFlight(ship, playerCam, world);
    planetFlight.pos.copy(ship.position);
    planetFlight.yaw = ship.rotation.y - Math.PI;
    // 相机切换到环绕展示视角
    camAnim = { t: 0, dur: 1.4, from: playerCam.position.clone() };
  }

  /* ---- 起飞动画 ---- */
  let launchAnim = null, camAnim = null, entryAnim = null, landAnim = null;
  function beginLaunch() {
    if (mode !== 'preflight') return;
    stats.shipFuel = Math.max(0, stats.shipFuel - 25);
    mode = 'transition';
    AudioSys.launchRumble();
    ShipFX.setGear(ship, false);
    launchAnim = { t: 0, dur: 4.2, from: ship.position.clone() };
    UI.clearMarkers('scan_');
    UI.removeMarker('mship');
  }
  function updateLaunch(dt) {
    launchAnim.t += dt;
    const t = launchAnim.t / launchAnim.dur;
    const ease = t * t * (3 - 2 * t);
    // 垂直上升 → 前倾加速
    const alt = ease * ease * 260;
    ship.position.y = launchAnim.from.y + alt;
    ship.rotation.x = -Math.min(0.5, t * 0.7);
    ship.position.z = launchAnim.from.z - Math.max(0, t - 0.4) * 120;
    ShipFX.setDownThrust(ship, Math.max(0, 1 - t * 1.4));
    ShipFX.setThrust(ship, Math.min(1, t * 1.8));
    // 相机跟随 + 抖动
    const camOff = new THREE.Vector3(6 - t * 4, 3 - t * 0.5, 12 - t * 2);
    playerCam.position.copy(ship.position).add(camOff);
    playerCam.position.x += (Math.random() - 0.5) * t * 0.5;
    playerCam.position.y += (Math.random() - 0.5) * t * 0.5;
    playerCam.lookAt(ship.position);
    // 天空渐变到深空
    const skyFrom = new THREE.Color(currentPlanet.arch.sky), skyTo = new THREE.Color(0x030610);
    planetScene.background = skyFrom.clone().lerp(skyTo, Math.min(1, t * 1.15));
    if (planetScene.fog) planetScene.fog.far = 150 + t * 3000;
    // HUD速度反馈
    UI.shipStats(ease * 620, ship.position.y - launchAnim.from.y + 4, 100, (stats.shipFuel / stats.maxFuel) * 100, Math.min(1, t * 1.6));
    if (launchAnim.t >= launchAnim.dur) {
      launchAnim = null;
      switchToSpace();
    }
  }

  function switchToSpace() {
    UI.whiteFade(1);
    setTimeout(() => {
      if (!spaceScene) spaceScene = new SpaceScene(renderer, system);
      spaceFlight = new SpaceFlight(ship, spaceScene.camera, system);
      // 把飞船移到太空场景
      planetScene.remove(ship);
      spaceScene.scene.add(ship);
      // 从当前星球位置出发: 沿切线方向飞出, 让星球留在画面侧方
      const p = currentPlanet;
      const radial = p.spacePos.clone().normalize();
      spaceFlight.pos.copy(p.spacePos).addScaledVector(radial, -(p.radius + 220));
      spaceFlight.pos.y += p.radius * 0.9;
      const tangent = new THREE.Vector3().crossVectors(radial, new THREE.Vector3(0, 1, 0)).normalize();
      const lookTarget = spaceFlight.pos.clone().addScaledVector(tangent, 400).addScaledVector(radial, -160);
      const lookM = new THREE.Matrix4().lookAt(spaceFlight.pos, lookTarget, new THREE.Vector3(0, 1, 0));
      spaceFlight.quat.setFromRotationMatrix(lookM);
      spaceFlight.enabled = true;
      spaceFlight.throttle = 0.5;
      mode = 'space';
      AudioSys.stopAmbient();
      AudioSys.startSpaceAmbient();
      AudioSys.shipEngineStop();
      AudioSys.shipEngineStart(true);
      UI.setLocation(system.name + ' 星系', '行星际空间');
      UI.whiteFade(0);
      UI.notify('已离开 ' + currentPlanet.name + ' — 空格:脉冲引擎 M:星图 E:接近星球时降落', 'info', null, true);
      checkMission();
    }, 650);
  }

  /* ---- 大气进入动画 (太空→星球) ---- */
  let entrySound = null;
  function beginAtmosphereEntry(planet) {
    mode = 'transition';
    spaceFlight.enabled = false;
    if (spaceFlight.pulseActive) { spaceFlight.pulseActive = false; AudioSys.pulseDriveEnd(); UI.speedLines(false); }
    entrySound = AudioSys.atmosphereEntry();
    entryAnim = { t: 0, dur: 6.5, planet, startPos: spaceFlight.pos.clone(), phase: 0 };
    UI.transitionText(planet.discovered ? planet.name : '未知星球', '正在进入大气层 · ATMOSPHERIC ENTRY');
    UI.shipTarget(null);
    UI.interactPrompt(null);
    UI.removeMarker('nav');
  }
  function updateAtmosphereEntry(dt) {
    const a = entryAnim;
    a.t += dt;
    const p = a.planet;
    const t = a.t / a.dur;
    if (a.phase === 0) {
      // 阶段1: 在太空场景中冲向星球 (保证有足够的火焰表演时间)
      const dist0 = spaceFlight.pos.distanceTo(p.spacePos);
      const dir = p.spacePos.clone().sub(spaceFlight.pos).normalize();
      const closing = Math.max(120, (dist0 - p.radius * 1.2) * 0.55);
      spaceFlight.pos.addScaledVector(dir, dt * closing);
      ship.position.copy(spaceFlight.pos);
      const lookM = new THREE.Matrix4().lookAt(spaceFlight.pos, p.spacePos, new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(lookM);
      spaceFlight.quat.slerp(q, Math.min(1, dt * 3));
      ship.quaternion.copy(spaceFlight.quat); ship.rotateY(Math.PI);
      // 进入时机身轻微翻滚+抖动
      ship.rotateZ(Math.sin(a.t * 2.2) * 0.08);
      const camOff = new THREE.Vector3(0, 2.8, 11).applyQuaternion(spaceFlight.quat);
      spaceScene.camera.position.copy(spaceFlight.pos).add(camOff);
      const shake = Math.min(1, a.t / 2.5);
      spaceScene.camera.position.x += (Math.random() - 0.5) * shake * 1.4;
      spaceScene.camera.position.y += (Math.random() - 0.5) * shake * 1.4;
      spaceScene.camera.lookAt(p.spacePos);
      ShipFX.setThrust(ship, 1);
      // 加热效果渐显
      UI.atmoHeat(Math.min(1, a.t / 2.2));
      const dist = spaceFlight.pos.distanceTo(p.spacePos);
      UI.transitionText(p.discovered ? p.name : '未知星球', '正在进入大气层 · ATMOSPHERIC ENTRY', '高度 ' + Math.max(0, (dist - p.radius) | 0) + ' km');
      if ((dist < p.radius * 1.3 && a.t > 3.2) || a.t > a.dur) {
        a.phase = 1;
        UI.whiteFade(1);
        a.phaseTime = 0;
      }
    } else if (a.phase === 1) {
      // 阶段2: 白屏切换到星球场景
      a.phaseTime = (a.phaseTime || 0) + dt;
      if (a.phaseTime > 0.7) {
        arriveAtPlanet(p);
      }
    }
  }
  async function arriveAtPlanet(planet) {
    entryAnim = null;
    currentPlanet = planet;
    const firstVisit = !planet.discovered;
    planet.discovered = true;
    // 构建星球场景
    spaceScene.scene.remove(ship);
    buildPlanetScene(planet); // 重新创建场景 (ship也重建了引用)
    UI.transitionText(null);
    $('loading-text').textContent = '正在着陆扫描地形…';
    const lx = 8 + ((Math.random() * 60) | 0), lz = 8 + ((Math.random() * 60) | 0);
    await world.preload(lx, lz, 4, () => {});
    clearLandingSite(lx, lz);
    // 降落动画: 飞船从高空下降
    const h = world.groundHeight(Math.floor(lx), Math.floor(lz));
    landAnim = { t: 0, dur: 5.0, x: lx, z: lz, groundY: h + 2.6, fromY: h + 150 };
    ship.position.set(lx, landAnim.fromY, lz);
    ship.rotation.set(0, Math.PI * 0.3, 0);
    ShipFX.setGear(ship, true);
    mode = 'landing';
    AudioSys.stopAmbient();
    AudioSys.startPlanetAmbient();
    UI.atmoHeat(0);
    UI.whiteFade(0);
    UI.interactPrompt(null);
    UI.targetInfo(null);
    UI.setHazardInfo(HAZARDS[planet.arch.hazard]);
    UI.setLocation(planet.name, planet.arch.desc + '星球 · ' + system.name);
    if (firstVisit) {
      stats.units += 500;
      UI.setUnits(stats.units);
      UI.discoveryCard('新星球发现 +500单位', planet.name, [
        ['环境', planet.arch.desc], ['危险', HAZARDS[planet.arch.hazard].name], ['资源', '丰富']
      ]);
    }
    if (entrySound) { entrySound.stop(); entrySound = null; }
  }
  function updateLanding(dt) {
    const a = landAnim;
    a.t += dt;
    const t = Math.min(1, a.t / a.dur);
    const ease = 1 - Math.pow(1 - t, 3);
    ship.position.y = a.fromY + (a.groundY - a.fromY) * ease;
    ship.position.x = a.x + Math.sin(t * 5) * (1 - t) * 2;
    ship.rotation.z = Math.sin(t * 4) * (1 - t) * 0.1;
    ShipFX.setDownThrust(ship, (1 - t) * 0.9 + 0.1);
    ShipFX.setThrust(ship, 0.2);
    // 相机环绕降落
    const ang = t * 1.2 + 2;
    playerCam.position.set(
      ship.position.x + Math.cos(ang) * 14,
      ship.position.y + 5 + (1 - t) * 8,
      ship.position.z + Math.sin(ang) * 14
    );
    playerCam.lookAt(ship.position);
    // HUD实时高度/速度
    UI.shipStats((1 - ease) * 120, Math.max(0, ship.position.y - a.groundY), 100, (stats.shipFuel / stats.maxFuel) * 100, 1 - t);
    if (t >= 1) {
      landAnim = null;
      shipLandedPos.copy(ship.position);
      ShipFX.setDownThrust(ship, 0);
      ShipFX.setThrust(ship, 0);
      AudioSys.shipLand();
      AudioSys.shipEngineStop();
      // 玩家下船, 面向星舰
      player.pos.set(ship.position.x + 4, ship.position.y + 1, ship.position.z + 3);
      player.vel.set(0, 0, 0);
      const dx = ship.position.x - player.pos.x, dz = ship.position.z - player.pos.z;
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = 0;
      player.enabled = true;
      mode = 'walk';
      UI.shipHUD(false);
      AudioSys.cockpitToggle(false);
      requestPointerLock();
      checkMission();
    }
  }

  /* ═══════════════ 主循环 ═══════════════ */
  let compassYaw = 0, orbitT = 0;
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    if (paused) return;
    scanCooldown = Math.max(0, scanCooldown - dt);

    if (mode === 'walk' || mode === 'preflight' || mode === 'dead') {
      if (mode === 'walk' && menuOpen === null) {
        player.update(dt);
        updateMining(dt);
        updateSurvival(dt);
        compassYaw = player.yaw;
        // 互动提示
        if (nearShip()) {
          UI.interactPrompt('E', shipReady() ? (stats.shipFuel >= 25 ? '登上星舰' : '星舰诊断 (燃料不足)') : '星舰诊断 (需要修复)');
        } else UI.interactPrompt(null);
      }
      if (mode === 'preflight') {
        // 登船展示视角: 缓慢环绕机身 (高机位避免树木遮挡)
        orbitT += dt * 0.22;
        const ang = orbitT + 2.2;
        const orbitPos = new THREE.Vector3(
          ship.position.x + Math.cos(ang) * 9,
          ship.position.y + 5.2,
          ship.position.z + Math.sin(ang) * 9
        );
        if (camAnim) {
          camAnim.t += dt;
          const t = Math.min(1, camAnim.t / camAnim.dur);
          playerCam.position.lerpVectors(camAnim.from, orbitPos, t * t * (3 - 2 * t));
          if (t >= 1) camAnim = null;
        } else {
          playerCam.position.copy(orbitPos);
        }
        playerCam.lookAt(ship.position.x, ship.position.y + 0.6, ship.position.z);
        AudioSys.shipEngineUpdate(0.15, false);
        ShipFX.setThrust(ship, 0.25 + Math.sin(performance.now() * 0.005) * 0.08);
      }
      world.update(player.pos.x, player.pos.z, 4);
      UI.updateCompass(compassYaw);
      UI.updateMarkers(playerCam, player.pos);
      UI.setVitals({
        health: stats.health, hazard: stats.hazard, life: stats.life,
        jetpack: player.jetpack, heat: player.heat
      });
      checkMission();
      renderer.render(planetScene, playerCam);
    }
    else if (mode === 'fly') {
      planetFlight.update(dt);
      world.update(planetFlight.pos.x, planetFlight.pos.z, 5);
      const groundH = world.groundHeight(Math.floor(planetFlight.pos.x), Math.floor(planetFlight.pos.z));
      UI.shipStats(planetFlight.speed * 4, planetFlight.pos.y - groundH, 100, (stats.shipFuel / stats.maxFuel) * 100, planetFlight.throttle);
      renderer.render(planetScene, playerCam);
    }
    else if (mode === 'space') {
      spaceFlight.update(dt);
      spaceScene.update(dt, spaceFlight.pos);
      const near = spaceFlight.nearestPlanet();
      const surf = near.dist - near.planet.radius;
      if (surf < 900) {
        UI.shipTarget(near.planet.discovered ? near.planet.name : '未知星球',
          surf < 350 ? '按 [E] 进入大气层' : '距离 ' + (surf | 0) + ' u');
        if (surf < 350) UI.interactPrompt('E', '进入大气层 — ' + (near.planet.discovered ? near.planet.name : '未知星球'));
        else UI.interactPrompt(null);
      } else {
        UI.interactPrompt(null);
        if (navTarget) {
          const d = spaceFlight.pos.distanceTo(navTarget.spacePos);
          UI.shipTarget('导航: ' + (navTarget.discovered ? navTarget.name : '未知星球'), (d | 0) + ' u · 空格加速');
        } else UI.shipTarget(null);
      }
      // 导航标记
      if (navTarget) {
        UI.addMarker('nav', { pos: navTarget.spacePos, icon: '◎', label: navTarget.discovered ? navTarget.name : '导航目标', cls: 'ship' });
        UI.updateMarkers(spaceScene.camera, spaceFlight.pos);
      }
      UI.shipStats(spaceFlight.speed, null, spaceFlight.pulseCharge, (stats.shipFuel / stats.maxFuel) * 100, spaceFlight.throttle);
      renderer.render(spaceScene.scene, spaceScene.camera);
    }
    else if (mode === 'transition') {
      if (launchAnim) { updateLaunch(dt); renderer.render(planetScene, playerCam); }
      else if (entryAnim) { updateAtmosphereEntry(dt); spaceScene.update(dt, spaceFlight.pos); renderer.render(spaceScene.scene, spaceScene.camera); }
    }
    else if (mode === 'landing') {
      updateLanding(dt);
      world.update(ship.position.x, ship.position.z, 4);
      renderer.render(planetScene, playerCam);
    }
    updateParticles(dt);
  }

  /* ═══════════════ 输入 ═══════════════ */
  function requestPointerLock() {
    $('game-canvas').requestPointerLock();
  }
  function setupInput() {
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== $('game-canvas')) return;
      if (mode === 'walk') player.onMouseMove(e.movementX, e.movementY);
      else if (mode === 'fly') planetFlight.onMouseMove(e.movementX, e.movementY);
      else if (mode === 'space') spaceFlight.onMouseMove(e.movementX, e.movementY);
    });
    document.addEventListener('mousedown', e => {
      if (menuOpen !== null || mode === 'boot') return;
      if (document.pointerLockElement !== $('game-canvas')) {
        if (['walk', 'fly', 'space', 'preflight'].includes(mode)) requestPointerLock();
        return;
      }
      if (mode === 'walk') {
        if (e.button === 0) player.mining = true;
        else if (e.button === 2) placeBlock();
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0 && player) player.mining = false;
    });
    document.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', e => {
      if (mode === 'boot') return;
      const k = e.code;
      if (player) player.keys[k] = true;
      if (planetFlight) planetFlight.keys[k] = true;
      if (spaceFlight) spaceFlight.keys[k] = true;

      if (k === 'Escape') { handleEscape(); return; }
      if (k === 'Tab') { e.preventDefault(); toggleMenu('inv'); return; }
      if (k === 'KeyM' && (mode === 'space' || mode === 'walk')) { toggleMenu('galaxy'); return; }
      if (menuOpen !== null) return;

      if (k === 'KeyC') doScan();
      if (k === 'KeyH') $('keys-hint').style.display = $('keys-hint').style.display === 'none' ? 'flex' : 'none';
      if (k === 'KeyE') {
        if (nearShip()) tryEnterShip();
        else if (mode === 'space') {
          const near = spaceFlight.nearestPlanet();
          if (near.dist - near.planet.radius < 350) beginAtmosphereEntry(near.planet);
        }
      }
      if (k === 'Space' && mode === 'preflight') beginLaunch();
      // 快捷栏
      if (/^Digit[1-6]$/.test(k)) {
        hotbarActive = parseInt(k.slice(5)) - 1;
        UI.renderHotbar(hotbar, hotbarActive);
        AudioSys.uiClick();
      }
    });
    document.addEventListener('keyup', e => {
      if (player) player.keys[e.code] = false;
      if (planetFlight) planetFlight.keys[e.code] = false;
      if (spaceFlight) spaceFlight.keys[e.code] = false;
    });
    // 滚轮切换快捷栏
    document.addEventListener('wheel', e => {
      if (mode !== 'walk' || menuOpen) return;
      hotbarActive = (hotbarActive + (e.deltaY > 0 ? 1 : -1) + 6) % 6;
      UI.renderHotbar(hotbar, hotbarActive);
    });
  }

  function handleEscape() {
    if (menuOpen) { closeMenus(); return; }
    if (['walk', 'space', 'fly'].includes(mode)) {
      toggleMenu('pause');
    }
  }
  function toggleMenu(name) {
    if (menuOpen === name) { closeMenus(); return; }
    closeMenus(true);
    menuOpen = name;
    document.exitPointerLock();
    AudioSys.uiOpen();
    if (player) player.mining = false;
    AudioSys.laserStop();
    if (name === 'inv') {
      UI.renderInventory(api); UI.renderCraft(api); UI.renderRefine(api);
      UI.show('inventory-screen');
    } else if (name === 'galaxy') {
      UI.show('galaxy-screen');
      UI.renderGalaxy(api);
    } else if (name === 'pause') {
      UI.show('pause-screen');
    }
  }
  function closeMenus(silent = false) {
    if (menuOpen && !silent) AudioSys.uiClose();
    menuOpen = null;
    ['inventory-screen', 'galaxy-screen', 'repair-screen', 'pause-screen'].forEach(UI.hide);
    if (['walk', 'fly', 'space', 'preflight'].includes(mode)) requestPointerLock();
  }

  function setupMenuButtons() {
    // 背包选项卡
    document.querySelectorAll('.menu-tab').forEach(tab => {
      tab.onclick = () => {
        AudioSys.uiClick();
        document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ['inv', 'craft', 'refine'].forEach(p => UI.hide('page-' + p));
        UI.show('page-' + tab.dataset.tab);
      };
      tab.onmouseenter = () => AudioSys.uiHover();
    });
    $('btn-respawn').onclick = () => { AudioSys.uiClick(); respawn(); };
    $('btn-resume').onclick = () => closeMenus();
    $('btn-fullscreen').onclick = () => {
      AudioSys.uiClick();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    };
    $('btn-restart').onclick = () => location.reload();
    document.querySelectorAll('.pause-btn, .boot-btn').forEach(b => b.onmouseenter = () => AudioSys.uiHover());
  }

  /* ---------- 星图导航 ---------- */
  function setNavTarget(p) {
    if (p === currentPlanet && mode !== 'space') { UI.notify('你已在这颗星球上', 'info'); return; }
    navTarget = p;
    UI.notify('导航目标: ' + (p.discovered ? p.name : '未知星球'), 'info', null, true);
  }
  function planetDistance(p) {
    if (mode === 'space') return ((spaceFlight.pos.distanceTo(p.spacePos)) | 0) + ' u';
    if (p === currentPlanet) return '0 u';
    return ((currentPlanet.spacePos ? currentPlanet.spacePos.distanceTo(p.spacePos) : p.orbitRadius) | 0) + ' u';
  }

  /* ---------- 启动画面 ---------- */
  function setupBoot() {
    // 像素星星
    const stars = $('boot-stars');
    for (let i = 0; i < 120; i++) {
      const s = document.createElement('div');
      s.className = 'boot-star';
      const size = Math.random() < 0.85 ? 2 : 4;
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-delay:${Math.random() * 3}s`;
      stars.appendChild(s);
    }
    $('btn-start').onclick = () => {
      AudioSys.init();
      AudioSys.uiClick();
      startGame();
    };
  }

  /* ---------- 对外接口 (供UI回调) ---------- */
  const api = {
    get inventory() { return inventory; },
    get system() { return system; },
    get currentPlanet() { return currentPlanet; },
    get navTarget() { return navTarget; },
    get shipParts() { return shipParts; },
    countItem, useItem, craftRecipe, refineRecipe, repairPart, setNavTarget, planetDistance,
    debug: {
      addItem, get stats() { return stats; }, get mode() { return mode; },
      fixAll() {
        shipParts.forEach(p => p.fixed = true);
        scannerFixed = true;
        stats.shipFuel = 100;
        updateShipDamageFX();
      },
      teleportToShip() {
        if (player && ship) { player.pos.set(ship.position.x + 4, ship.position.y + 2, ship.position.z + 3); }
      },
      lookDown() { if (player) { player.pitch = -1.15; player.applyLook(); } },
      startMine() { if (player) player.mining = true; },
      stopMine() { if (player) player.mining = false; },
      gotoNextPlanet() {
        if (mode !== 'space' || !spaceFlight) return null;
        const p = system.planets.find(pl => pl !== currentPlanet && !pl.discovered) ||
          system.planets.find(pl => pl !== currentPlanet);
        const dir = p.spacePos.clone().sub(spaceFlight.pos).normalize();
        spaceFlight.pos.copy(p.spacePos).addScaledVector(dir, -(p.radius + 300));
        return p.name;
      }
    }
  };

  /* ---------- 初始化 ---------- */
  function boot() {
    setupBoot();
    setupInput();
    setupMenuButtons();
  }

  return { boot, api };
})();

window.Game = Game;
window.addEventListener('DOMContentLoaded', () => Game.boot());
