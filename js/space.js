/* ═══════════════ VOXEL SKY — 太空场景 ═══════════════ */
/* 体素风格星球(立方体壳拼成) + 星空 + 恒星 + 太空飞行 */

class SpaceScene {
  constructor(renderer, system) {
    this.renderer = renderer;
    this.system = system;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030610);
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 30000);
    this.planetMeshes = [];
    this.buildStars();
    this.buildSun();
    this.buildPlanets();
    this.buildDust();
    const amb = new THREE.AmbientLight(0x334455, 0.7);
    this.scene.add(amb);
    this.sunLight = new THREE.DirectionalLight(0xfff2d8, 1.1);
    this.scene.add(this.sunLight);
  }

  buildStars() {
    const geo = new THREE.BufferGeometry();
    const pos = [], col = [];
    const rand = Textures.rng(this.system.seed ^ 777);
    for (let i = 0; i < 2600; i++) {
      const r = 12000 + rand() * 8000;
      const th = rand() * Math.PI * 2, ph = Math.acos(rand() * 2 - 1);
      pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      const c = 0.6 + rand() * 0.4;
      const tint = rand();
      col.push(c * (tint > 0.8 ? 0.8 : 1), c * (tint > 0.9 ? 0.85 : 1), c);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 14, vertexColors: true, sizeAttenuation: true, fog: false });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
    // 银河带
    const geo2 = new THREE.BufferGeometry();
    const pos2 = [], col2 = [];
    for (let i = 0; i < 1600; i++) {
      const a = rand() * Math.PI * 2;
      const spread = (rand() - 0.5) * 2600;
      const r = 13000 + rand() * 4000;
      pos2.push(r * Math.cos(a), spread + Math.sin(a * 3) * 800, r * Math.sin(a));
      const c = 0.25 + rand() * 0.3;
      col2.push(c * 0.9, c, c * 1.15);
    }
    geo2.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
    geo2.setAttribute('color', new THREE.Float32BufferAttribute(col2, 3));
    this.scene.add(new THREE.Points(geo2, new THREE.PointsMaterial({ size: 26, vertexColors: true, transparent: true, opacity: 0.55, fog: false })));
  }

  buildSun() {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(160, 160, 160), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
    group.add(core);
    // 体素日冕: 多层旋转方块
    for (let i = 0; i < 3; i++) {
      const s = 200 + i * 55;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
        new THREE.MeshBasicMaterial({ color: [0xffd95e, 0xff9d45, 0xff7043][i], transparent: true, opacity: 0.16 - i * 0.04, blending: THREE.AdditiveBlending, depthWrite: false }));
      shell.rotation.set(i * 0.5, i * 0.8, i * 0.3);
      group.add(shell);
      shell.userData.spin = 0.05 + i * 0.03;
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: SpaceScene.glowTexture(), color: 0xffe8b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(1500, 1500, 1);
    group.add(glow);
    group.position.set(0, 0, 0);
    this.sun = group;
    this.scene.add(group);
  }

  static glowTexture() {
    if (SpaceScene._glowTex) return SpaceScene._glowTex;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,200,0.55)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    SpaceScene._glowTex = new THREE.CanvasTexture(cv);
    return SpaceScene._glowTex;
  }

  /* 体素星球: 立方体壳 + 大气光晕 */
  buildVoxelPlanet(planet) {
    const group = new THREE.Group();
    const R = planet.radius;
    const rand = Textures.rng(planet.seed);
    const noise = new ValueNoise(planet.seed);
    const pal = planet.arch.palette;
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const positions = [], colors = [];
    const step = Math.max(6, R / 11);
    // 用经纬网格在球面放置方块
    const latSteps = Math.ceil(Math.PI * R / step);
    for (let i = 0; i <= latSteps; i++) {
      const phi = (i / latSteps) * Math.PI;
      const ringR = Math.sin(phi) * R;
      const lonSteps = Math.max(1, Math.ceil((2 * Math.PI * ringR) / step));
      for (let j = 0; j < lonSteps; j++) {
        const theta = (j / lonSteps) * Math.PI * 2;
        const x = Math.sin(phi) * Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(theta);
        const n = noise.fbm(x * 2.3 + 5, z * 2.3 + y * 1.7 + 5, 3);
        const hBump = (n - 0.5) * step * 1.6;
        const rr = R + hBump;
        // 量化到网格 → 方块感
        const q = step * 0.98;
        const px = Math.round(x * rr / q) * q, py = Math.round(y * rr / q) * q, pz = Math.round(z * rr / q) * q;
        positions.push([px, py, pz]);
        let c = pal.land;
        if (n < 0.42) c = pal.sea;
        else if (n > 0.68) c = pal.accent;
        const f = 0.75 + rand() * 0.4;
        colors.push(new THREE.Color(Textures.shade(c, f)));
      }
    }
    const mat = new THREE.MeshLambertMaterial({});
    const inst = new THREE.InstancedMesh(cube, mat, positions.length);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < positions.length; i++) {
      const s = step * (1.02 + rand() * 0.25);
      m4.makeScale(s, s, s);
      m4.setPosition(positions[i][0], positions[i][1], positions[i][2]);
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, colors[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    // 内核球体填充缝隙
    const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.94, 16, 12),
      new THREE.MeshLambertMaterial({ color: Textures.shade(pal.land, 0.55) }));
    group.add(core);
    // 大气光晕
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: SpaceScene.glowTexture(), color: planet.arch.sky, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(R * 4.4, R * 4.4, 1);
    group.add(glow);
    // 云层环 (装饰)
    if (rand() > 0.5) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.7, step * 0.4, 4, 40),
        new THREE.MeshBasicMaterial({ color: 0xd8dde4, transparent: true, opacity: 0.35 }));
      ring.rotation.x = Math.PI / 2 + (rand() - 0.5) * 0.7;
      group.add(ring);
    }
    group.userData.planet = planet;
    group.userData.spin = 0.008 + rand() * 0.01;
    return group;
  }

  buildPlanets() {
    for (const p of this.system.planets) {
      const mesh = this.buildVoxelPlanet(p);
      const a = p.orbitAngle;
      mesh.position.set(Math.cos(a) * p.orbitRadius, (Math.sin(a * 3) * 120), Math.sin(a) * p.orbitRadius);
      p.spacePos = mesh.position.clone();
      this.scene.add(mesh);
      this.planetMeshes.push(mesh);
    }
  }

  buildDust() {
    // 太空尘埃: 增强速度感
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const rand = Textures.rng(42);
    for (let i = 0; i < 400; i++) pos.push((rand() - 0.5) * 600, (rand() - 0.5) * 600, (rand() - 0.5) * 600);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8899aa, size: 0.9, transparent: true, opacity: 0.7 }));
    this.scene.add(this.dust);
  }

  update(dt, shipPos) {
    for (const m of this.planetMeshes) m.rotation.y += m.userData.spin * dt;
    for (const child of this.sun.children) if (child.userData.spin) {
      child.rotation.y += child.userData.spin * dt;
      child.rotation.x += child.userData.spin * 0.6 * dt;
    }
    if (shipPos) {
      // 尘埃跟随并环绕飞船
      this.dust.position.set(
        Math.round(shipPos.x / 600) * 600,
        Math.round(shipPos.y / 600) * 600,
        Math.round(shipPos.z / 600) * 600
      );
      this.sunLight.position.copy(shipPos).sub(new THREE.Vector3(0, 0, 0)).normalize().multiplyScalar(-100).add(shipPos);
      this.sunLight.target.position.copy(shipPos);
      this.sunLight.target.updateMatrixWorld();
    }
  }
}

/* ---------- 太空飞行控制 ---------- */
class SpaceFlight {
  constructor(ship, camera, system) {
    this.ship = ship; this.camera = camera; this.system = system;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.speed = 0; this.throttle = 0.4;
    this.pulseActive = false; this.pulseCharge = 100;
    this.keys = {};
    this.enabled = false;
    this.camShake = 0;
    this._mx = 0; this._my = 0;
    this.rollVel = 0;
  }
  onMouseMove(dx, dy) {
    if (!this.enabled) return;
    this._mx += dx; this._my += dy;
  }
  nearestPlanet() {
    let best = null, bd = Infinity;
    for (const p of this.system.planets) {
      const d = this.pos.distanceTo(p.spacePos);
      if (d < bd) { bd = d; best = p; }
    }
    return { planet: best, dist: bd };
  }
  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    // 姿态控制
    const pitchRate = -this._my * 0.0011;
    const yawRate = -this._mx * 0.0011;
    this._mx = 0; this._my = 0;
    let roll = 0;
    if (k['KeyQ']) roll += dt * 1.8;
    if (k['KeyE']) roll -= dt * 1.8;
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRate, yawRate, roll, 'YXZ'));
    this.quat.multiply(dq).normalize();

    // 油门
    if (k['KeyW']) this.throttle = Math.min(1, this.throttle + dt * 0.8);
    if (k['KeyS']) this.throttle = Math.max(0, this.throttle - dt * 1.0);

    // 脉冲引擎
    const wantPulse = k['Space'] && this.pulseCharge > 2;
    if (wantPulse && !this.pulseActive) { this.pulseActive = true; AudioSys.pulseDriveStart(); UI.speedLines(true); }
    if (!wantPulse && this.pulseActive) { this.pulseActive = false; AudioSys.pulseDriveEnd(); UI.speedLines(false); }
    if (this.pulseActive) {
      this.pulseCharge = Math.max(0, this.pulseCharge - dt * 7);
      if (this.pulseCharge <= 0) { this.pulseActive = false; AudioSys.pulseDriveEnd(); UI.speedLines(false); }
    } else {
      this.pulseCharge = Math.min(100, this.pulseCharge + dt * 3.5);
    }

    const maxSpeed = this.pulseActive ? 2600 : 160;
    const target = 20 + this.throttle * maxSpeed;
    this.speed += (target - this.speed) * Math.min(1, dt * (this.pulseActive ? 1.2 : 2.5));

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    this.pos.addScaledVector(dir, this.speed * dt);

    // 防止穿过恒星
    const sunD = this.pos.length();
    if (sunD < 420) this.pos.normalize().multiplyScalar(420);

    // 应用
    this.ship.position.copy(this.pos);
    this.ship.quaternion.copy(this.quat);
    this.ship.rotateY(Math.PI);

    // 相机
    const camOff = new THREE.Vector3(0, 2.8, 10.5).applyQuaternion(this.quat);
    this.camera.position.lerp(this.pos.clone().add(camOff), Math.min(1, dt * 8));
    if (this.pulseActive) {
      this.camera.position.x += (Math.random() - 0.5) * 0.35;
      this.camera.position.y += (Math.random() - 0.5) * 0.35;
    }
    if (this.camShake > 0) {
      this.camera.position.addScaledVector(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), this.camShake);
      this.camShake = Math.max(0, this.camShake - dt);
    }
    const look = this.pos.clone().addScaledVector(dir, 30);
    this.camera.up.set(0, 1, 0).applyQuaternion(this.quat);
    this.camera.lookAt(look);

    ShipFX.setThrust(this.ship, 0.3 + this.throttle * 0.5 + (this.pulseActive ? 0.4 : 0));
    AudioSys.shipEngineUpdate(this.throttle, this.pulseActive);
  }
}
