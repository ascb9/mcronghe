/* ═══════════════ VOXEL SKY — 体素星舰 ═══════════════ */
/* 用方块拼成的星际战机: 原创设计, 融合体素积木质感与科幻流线 */

function buildVoxelShip() {
  const ship = new THREE.Group();
  const mats = {
    hull: new THREE.MeshLambertMaterial({ color: 0xd8dde4 }),
    hullDark: new THREE.MeshLambertMaterial({ color: 0x4a5560 }),
    accent: new THREE.MeshLambertMaterial({ color: 0xe8642a }),
    accent2: new THREE.MeshLambertMaterial({ color: 0x2a8f84 }),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.75, emissive: 0x224455 }),
    engine: new THREE.MeshBasicMaterial({ color: 0x5ef2e0 }),
    engineCore: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    dark: new THREE.MeshLambertMaterial({ color: 0x22282e })
  };
  const B = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    ship.add(m);
    return m;
  };
  // ── 机身 (沿 -Z 朝前) ──
  B(1.6, 1.0, 4.2, 0, 0, 0.2, mats.hull);            // 主体
  B(1.2, 0.8, 1.6, 0, 0.1, -2.4, mats.hull);         // 前锥段
  B(0.8, 0.55, 1.2, 0, 0.08, -3.6, mats.hullDark);   // 鼻锥
  B(0.5, 0.3, 0.8, 0, 0.05, -4.4, mats.accent);      // 鼻尖
  B(1.7, 0.35, 2.2, 0, -0.6, -0.3, mats.hullDark);   // 底部
  // ── 座舱 ──
  B(0.95, 0.7, 1.3, 0, 0.75, -1.3, mats.glass);
  B(1.05, 0.22, 1.5, 0, 0.42, -1.3, mats.hullDark);  // 座舱框
  B(1.0, 0.5, 0.9, 0, 0.65, -0.2, mats.hull);        // 座舱后盖
  // ── 机翼 ──
  for (const s of [-1, 1]) {
    B(2.6, 0.22, 1.7, s * 2.0, -0.1, 0.6, mats.hull);
    B(1.6, 0.18, 1.1, s * 3.6, -0.05, 0.8, mats.hullDark);
    B(0.9, 0.5, 1.3, s * 4.4, 0.1, 0.9, mats.accent);     // 翼尖舱
    B(0.28, 1.1, 0.9, s * 4.4, 0.65, 1.1, mats.hullDark); // 翼尖立翼
    B(1.9, 0.3, 0.55, s * 1.7, -0.08, -0.9, mats.accent2);// 前掠条
    // 翼下挂架
    B(0.24, 0.5, 1.0, s * 2.6, -0.42, 0.5, mats.dark);
  }
  // ── 尾部引擎 ──
  B(1.9, 1.0, 1.1, 0, 0.05, 2.4, mats.hullDark);
  const engineGlows = [];
  for (const s of [-1, 1]) {
    B(0.72, 0.72, 0.5, s * 0.55, 0.05, 3.05, mats.dark);
    const g = B(0.5, 0.5, 0.12, s * 0.55, 0.05, 3.33, mats.engine);
    const core = B(0.26, 0.26, 0.14, s * 0.55, 0.05, 3.35, mats.engineCore);
    engineGlows.push(g, core);
  }
  // 上方脉冲引擎
  B(0.6, 0.5, 1.4, 0, 0.75, 2.2, mats.accent2);
  const topGlow = B(0.34, 0.3, 0.12, 0, 0.75, 2.95, mats.engine);
  engineGlows.push(topGlow);
  // ── 起落架 ──
  const gear = new THREE.Group();
  for (const [x, z] of [[-1.2, 1.6], [1.2, 1.6], [0, -2.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), mats.dark);
    leg.position.set(x, -1.05, z); gear.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.7), mats.hullDark);
    foot.position.set(x, -1.5, z); gear.add(foot);
  }
  ship.add(gear);
  // ── 引擎尾焰 ──
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xbffcff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.4, 4), flameMat);
    f.rotation.x = -Math.PI / 2;
    f.position.set(s * 0.55, 0.05, 4.6);
    ship.add(f); flames.push(f);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(s * 0.55, 0.05, 4.2);
    ship.add(inner); flames.push(inner);
  }
  // 着陆喷口尾焰 (向下)
  const downFlames = [];
  for (const [x, z] of [[-1.2, 1.4], [1.2, 1.4], [0, -1.8]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 4), flameMat.clone());
    f.rotation.x = Math.PI;
    f.position.set(x, -1.6, z);
    ship.add(f); downFlames.push(f);
  }
  // ── 灯光 ──
  const light = new THREE.PointLight(0x5ef2e0, 0.0, 14);
  light.position.set(0, 0, 3.6);
  ship.add(light);

  ship.userData = { engineGlows, flames, downFlames, flameMat, gear, engineLight: light, mats };
  return ship;
}

/* ---------- 星球表面飞行控制器 ---------- */
class ShipFlight {
  constructor(ship, camera, world) {
    this.ship = ship; this.camera = camera; this.world = world;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0; this.throttle = 0;
    this.keys = {};
    this.enabled = false;
    this.landed = true;
    this.camShake = 0;
  }
  onMouseMove(dx, dy) {
    if (!this.enabled) return;
    this._mx = (this._mx || 0) + dx;
    this._my = (this._my || 0) + dy;
  }
  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    // 鼠标转向 → 目标角速度
    const mx = this._mx || 0, my = this._my || 0;
    this._mx = 0; this._my = 0;
    this.yaw -= mx * 0.0016;
    this.pitch -= my * 0.0016;
    this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch));
    // 滚转跟随转向
    const targetRoll = THREE.MathUtils.clamp(-mx * 0.02, -0.8, 0.8);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 4);

    // 油门
    if (k['KeyW']) this.throttle = Math.min(1, this.throttle + dt * 0.9);
    if (k['KeyS']) this.throttle = Math.max(0, this.throttle - dt * 1.2);
    const maxSpeed = 42;
    const targetSpeed = 6 + this.throttle * maxSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.6);

    // 前进方向
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.pos.addScaledVector(dir, this.speed * dt);

    // 地形最低高度限制
    const groundH = this.world ? this.world.groundHeight(Math.floor(this.pos.x), Math.floor(this.pos.z)) : 0;
    const minY = groundH + 6;
    if (this.pos.y < minY) {
      this.pos.y += (minY - this.pos.y) * Math.min(1, dt * 5);
      if (this.pitch < 0) this.pitch += dt * 1.4;
    }
    if (this.pos.y > 220) { this.pos.y = 220; if (this.pitch > 0) this.pitch = Math.max(0, this.pitch - dt * 2); }

    // 应用姿态
    this.ship.position.copy(this.pos);
    this.ship.rotation.order = 'YXZ';
    this.ship.rotation.y = this.yaw + Math.PI;
    this.ship.rotation.x = -this.pitch;
    this.ship.rotation.z = this.roll;

    // 第三人称相机
    const camOff = new THREE.Vector3(0, 3.2, 9.5);
    camOff.applyEuler(new THREE.Euler(-this.pitch * 0.5, this.yaw + Math.PI, 0, 'YXZ'));
    const camTarget = this.pos.clone().add(camOff);
    this.camera.position.lerp(camTarget, Math.min(1, dt * 6));
    if (this.camShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake;
      this.camShake = Math.max(0, this.camShake - dt * 0.5);
    }
    const look = this.pos.clone().addScaledVector(dir, 10);
    this.camera.lookAt(look);

    // 引擎视觉
    ShipFX.setThrust(this.ship, 0.35 + this.throttle * 0.65);
    AudioSys.shipEngineUpdate(this.throttle, false);
  }
}

/* ---------- 飞船视觉辅助 ---------- */
const ShipFX = {
  setThrust(ship, level) {
    const u = ship.userData;
    if (!u) return;
    for (const f of u.flames) {
      f.material.opacity = Math.min(0.85, level * 0.9);
      f.scale.set(1, 0.6 + level * 0.9 + Math.random() * 0.15, 1);
    }
    u.engineLight.intensity = level * 2.2;
  },
  setDownThrust(ship, level) {
    const u = ship.userData;
    if (!u) return;
    for (const f of u.downFlames) {
      f.material.opacity = Math.min(0.8, level);
      f.scale.set(1, 0.5 + level * 0.8 + Math.random() * 0.2, 1);
    }
  },
  setGear(ship, deployed) {
    const u = ship.userData;
    if (u && u.gear) u.gear.visible = deployed;
  }
};
