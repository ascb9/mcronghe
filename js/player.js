/* ═══════════════ VOXEL SKY — 玩家控制器 ═══════════════ */
/* FPS移动 + 采矿光束 + 方块放置 + 喷气背包 */

class PlayerController {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(8, 40, 8);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.height = 1.7; this.radius = 0.32;
    this.speed = 5.2; this.runSpeed = 8.5;
    this.jetpack = 100; this.jetting = false;
    this.keys = {};
    this.mining = false; this.mineTarget = null; this.mineProgress = 0;
    this.placeMode = false;
    this.heat = 0; this.overheated = false;
    this.stepTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.enabled = false;
    this.wasOnGround = true;
    this.fallSpeed = 0;
  }

  applyLook() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.position.copy(this.pos);
    this.camera.position.y += this.height - 0.15;
  }

  onMouseMove(dx, dy) {
    if (!this.enabled) return;
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  /* ----- 碰撞 ----- */
  collide(pos, vel, dt) {
    const w = this.world;
    const r = this.radius, h = this.height;
    // Y轴
    pos.y += vel.y * dt;
    if (vel.y <= 0) {
      const feet = pos.y;
      for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (w.isSolid(pos.x + ox, feet - 0.02, pos.z + oz)) {
          pos.y = Math.floor(feet - 0.02) + 1;
          if (!this.onGround && this.fallSpeed < -12) AudioSys.land(true);
          else if (!this.onGround && this.fallSpeed < -4) AudioSys.land(false);
          vel.y = 0; this.onGround = true;
          break;
        }
        this.onGround = false;
      }
      if (vel.y !== 0) this.onGround = false;
    } else {
      this.onGround = false;
      for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (w.isSolid(pos.x + ox, pos.y + h, pos.z + oz)) {
          pos.y = Math.floor(pos.y + h) - h - 0.001;
          vel.y = 0; break;
        }
      }
    }
    // X轴
    pos.x += vel.x * dt;
    for (const oy of [0.1, h * 0.5, h - 0.1]) {
      for (const oz of [-r, r]) {
        if (vel.x > 0 && w.isSolid(pos.x + r, pos.y + oy, pos.z + oz)) { pos.x = Math.floor(pos.x + r) - r - 0.001; vel.x = 0; }
        else if (vel.x < 0 && w.isSolid(pos.x - r, pos.y + oy, pos.z + oz)) { pos.x = Math.floor(pos.x - r) + 1 + r + 0.001; vel.x = 0; }
      }
    }
    // Z轴
    pos.z += vel.z * dt;
    for (const oy of [0.1, h * 0.5, h - 0.1]) {
      for (const ox of [-r, r]) {
        if (vel.z > 0 && w.isSolid(pos.x + ox, pos.y + oy, pos.z + r)) { pos.z = Math.floor(pos.z + r) - r - 0.001; vel.z = 0; }
        else if (vel.z < 0 && w.isSolid(pos.x + ox, pos.y + oy, pos.z - r)) { pos.z = Math.floor(pos.z - r) + 1 + r + 0.001; vel.z = 0; }
      }
    }
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3();
    if (k['KeyW']) move.add(forward);
    if (k['KeyS']) move.sub(forward);
    if (k['KeyD']) move.add(right);
    if (k['KeyA']) move.sub(right);
    const running = k['ShiftLeft'] || k['ShiftRight'];
    const spd = running ? this.runSpeed : this.speed;
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(spd);
    // 平滑加速
    this.vel.x += (move.x - this.vel.x) * Math.min(1, dt * 10);
    this.vel.z += (move.z - this.vel.z) * Math.min(1, dt * 10);

    // 跳跃 / 喷气背包
    const wantJet = k['Space'];
    if (wantJet && this.onGround && this.jetpack > 15) {
      this.vel.y = 7.4; this.onGround = false;
      AudioSys.jump();
      this._jumpHold = 0;
    } else if (wantJet && !this.onGround && this.jetpack > 0) {
      this._jumpHold = (this._jumpHold || 0) + dt;
      if (this._jumpHold > 0.18) {
        this.vel.y += 16 * dt;
        this.vel.y = Math.min(this.vel.y, 6.5);
        this.jetpack = Math.max(0, this.jetpack - 32 * dt);
        if (!this.jetting) { this.jetting = true; AudioSys.jetpackStart(); }
      }
    } else {
      this._jumpHold = 0;
      if (this.jetting) { this.jetting = false; AudioSys.jetpackStop(); }
    }
    if (!wantJet && this.jetting) { this.jetting = false; AudioSys.jetpackStop(); }
    if (this.onGround) this.jetpack = Math.min(100, this.jetpack + 46 * dt);

    // 重力
    this.vel.y -= 21 * dt;
    this.vel.y = Math.max(this.vel.y, -38);
    this.fallSpeed = this.vel.y;

    const wasGround = this.onGround;
    this.collide(this.pos, this.vel, Math.min(dt, 0.05));
    if (this.pos.y < -10) { this.pos.y = 60; this.vel.y = 0; }

    // 脚步声
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 1.5) {
      this.stepTimer -= dt * hSpeed;
      if (this.stepTimer <= 0) {
        AudioSys.footstep(!running);
        this.stepTimer = 2.6;
      }
    }
    // 冷却激光
    if (!this.mining) {
      this.heat = Math.max(0, this.heat - 28 * dt);
      if (this.heat < 35) this.overheated = false;
    }
    this.applyLook();
  }

  /* ----- 射线拾取 ----- */
  pickBlock(maxDist = 6) {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(this.world.chunkMeshes(), false);
    if (!hits.length) return null;
    const hit = hits[0];
    const p = hit.point.clone().addScaledVector(hit.face.normal, -0.5);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const block = this.world.getBlock(bx, by, bz);
    if (block === BLOCK.AIR) return null;
    return {
      x: bx, y: by, z: bz, block,
      normal: hit.face.normal, point: hit.point, dist: hit.distance
    };
  }
}
