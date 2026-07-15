/* ═══════════════ VOXEL SKY — UI 逻辑 ═══════════════ */

const UI = (() => {
  const $ = id => document.getElementById(id);

  /* ---------- 通知 ---------- */
  function notify(text, type = 'info', iconSrc = null, silent = false) {
    const stack = $('notify-stack');
    const el = document.createElement('div');
    el.className = 'notify' + (type === 'gain' ? ' gain' : type === 'warn' ? ' warn' : '');
    if (iconSrc) {
      const img = document.createElement('img');
      img.className = 'n-icon'; img.src = iconSrc;
      el.appendChild(img);
    }
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    stack.appendChild(el);
    while (stack.children.length > 4) stack.removeChild(stack.firstChild);
    if (!silent) {
      if (type === 'warn') AudioSys.hazardWarn();
      else AudioSys.notify();
    }
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
    }, 3400);
  }

  // 资源获取合并提示
  const gainBuffer = {};
  let gainTimer = null;
  function gain(item, n) {
    gainBuffer[item] = (gainBuffer[item] || 0) + n;
    AudioSys.pickup();
    if (gainTimer) clearTimeout(gainTimer);
    gainTimer = setTimeout(() => {
      for (const [it, cnt] of Object.entries(gainBuffer)) {
        const def = ITEMS[it];
        notify(`+${cnt} ${def ? def.name : it}`, 'gain', Textures.ICONS[def ? def.icon : it], true);
      }
      for (const k in gainBuffer) delete gainBuffer[k];
    }, 350);
  }

  /* ---------- 生存状态条 ---------- */
  function setBar(id, pct) {
    const el = $(id);
    if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
  function setVitals(st) {
    setBar('hazard-bar', st.hazard);
    setBar('life-bar', st.life);
    setBar('health-bar', st.health);
    setBar('jetpack-bar', st.jetpack);
    setBar('heat-bar', st.heat);
    $('vital-hazard').classList.toggle('warning', st.hazard < 25);
    $('vital-life').classList.toggle('warning', st.life < 25);
  }
  function setHazardInfo(hazard) {
    $('hazard-icon').textContent = hazard.icon;
    $('hazard-name').textContent = '危险防护 · ' + hazard.name;
    const v = $('hazard-vignette');
    v.className = hazard.vignette || '';
  }
  function hazardVignette(opacity) {
    $('hazard-vignette').style.opacity = opacity;
  }
  function damageFlash() {
    const el = $('damage-flash');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }

  /* ---------- 采矿进度环 ---------- */
  function mineProgress(p) {
    const svg = $('mine-progress'), fill = $('mine-progress-fill');
    if (p === null) { svg.classList.remove('active'); return; }
    svg.classList.add('active');
    fill.style.strokeDashoffset = 163.4 * (1 - p);
  }

  /* ---------- 目标信息 ---------- */
  function targetInfo(name, sub) {
    const el = $('target-info');
    if (!name) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('target-name').textContent = name;
    $('target-sub').textContent = sub || '';
  }
  function interactPrompt(key, text) {
    const el = $('interact-prompt');
    if (!key) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('interact-key').textContent = key;
    $('interact-text').textContent = text;
  }

  /* ---------- 任务 ---------- */
  function setMission(title, desc, progress) {
    $('mission-title').textContent = title;
    $('mission-desc').textContent = desc;
    $('mission-progress').textContent = progress || '';
  }

  /* ---------- 罗盘 ---------- */
  const DIRS = [[0, '北 N'], [45, '东北'], [90, '东 E'], [135, '东南'], [180, '南 S'], [225, '西南'], [270, '西 W'], [315, '西北']];
  let compassBuilt = false;
  function buildCompass() {
    const strip = $('compass-strip');
    strip.innerHTML = '';
    for (let rep = -1; rep <= 1; rep++) {
      for (const [deg, label] of DIRS) {
        const d = document.createElement('div');
        d.className = 'cdir'; d.textContent = label;
        d.style.left = ((deg + rep * 360) * 1.6 + 300) + 'px';
        strip.appendChild(d);
      }
      for (let t = 0; t < 360; t += 15) {
        const tick = document.createElement('div');
        tick.className = 'ctick';
        tick.style.left = ((t + rep * 360) * 1.6 + 300) + 'px';
        strip.appendChild(tick);
      }
    }
    compassBuilt = true;
  }
  function updateCompass(yaw) {
    if (!compassBuilt) buildCompass();
    let deg = (-yaw * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    $('compass-strip').style.transform = `translateX(${210 - (deg * 1.6 + 300)}px)`;
  }

  /* ---------- 世界标记 ---------- */
  const markers = new Map();
  function addMarker(id, opts) {
    removeMarker(id);
    const el = document.createElement('div');
    el.className = 'marker ' + (opts.cls || '');
    el.innerHTML = `<div class="m-icon">${opts.icon}</div><div class="m-label">${opts.label}</div><div class="m-dist"></div>`;
    $('markers').appendChild(el);
    markers.set(id, { el, pos: opts.pos, expires: opts.ttl ? performance.now() + opts.ttl : null });
  }
  function removeMarker(id) {
    const m = markers.get(id);
    if (m) { m.el.remove(); markers.delete(id); }
  }
  function clearMarkers(prefix) {
    for (const [id] of markers) if (!prefix || id.startsWith(prefix)) removeMarker(id);
  }
  const _v = new THREE.Vector3();
  function updateMarkers(camera, playerPos) {
    const now = performance.now();
    for (const [id, m] of markers) {
      if (m.expires && now > m.expires) { removeMarker(id); continue; }
      _v.copy(m.pos).project(camera);
      const behind = _v.z > 1;
      if (behind || _v.x < -1.05 || _v.x > 1.05 || _v.y < -1.05 || _v.y > 1.05) {
        m.el.style.opacity = '0';
        continue;
      }
      m.el.style.opacity = '1';
      m.el.style.left = ((_v.x * 0.5 + 0.5) * innerWidth) + 'px';
      m.el.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight) + 'px';
      if (playerPos) {
        const d = m.pos.distanceTo(playerPos);
        m.el.querySelector('.m-dist').textContent = d > 999 ? (d / 1000).toFixed(1) + 'ku' : (d | 0) + 'u';
      }
    }
  }

  /* ---------- 扫描脉冲 ---------- */
  function scanPulse() {
    const el = $('scan-pulse');
    el.classList.remove('active'); void el.offsetWidth; el.classList.add('active');
  }

  /* ---------- 速度线 ---------- */
  let slBuilt = false;
  function speedLines(on) {
    const el = $('speed-lines');
    if (on && !slBuilt) {
      for (let i = 0; i < 40; i++) {
        const l = document.createElement('div');
        l.className = 'sline';
        l.style.left = Math.random() * 100 + '%';
        l.style.height = 60 + Math.random() * 200 + 'px';
        l.style.animationDuration = (0.25 + Math.random() * 0.5) + 's';
        l.style.animationDelay = Math.random() * 0.5 + 's';
        el.appendChild(l);
      }
      slBuilt = true;
    }
    $('transition-layer').classList.remove('hidden');
    el.classList.toggle('active', on);
  }

  /* ---------- 位置标签 ---------- */
  function setLocation(planet, sub) {
    $('loc-planet').textContent = planet;
    $('loc-sub').textContent = sub;
  }
  function setUnits(n) {
    $('units-count').textContent = n.toLocaleString();
  }

  /* ---------- 飞船 HUD ---------- */
  function shipHUD(visible) {
    $('ship-hud').classList.toggle('hidden', !visible);
    $('vitals').classList.toggle('hidden', visible);
    $('tool-panel').classList.toggle('hidden', visible);
    $('hotbar').classList.toggle('hidden', visible);
    $('crosshair').classList.toggle('hidden', visible);
  }
  function shipStats(speed, alt, pulse, fuel, throttle) {
    $('ship-speed').innerHTML = (speed | 0) + '<small> u/s</small>';
    $('ship-alt').textContent = alt === null ? '轨道' : (alt | 0) + ' m';
    setBar('pulse-bar', pulse);
    setBar('fuel-bar', fuel);
    $('ship-throttle-fill').style.height = (throttle * 100) + '%';
  }
  function shipTarget(name, dist) {
    const el = $('ship-target');
    if (!name) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('ship-target-name').textContent = name;
    $('ship-target-dist').textContent = dist;
  }

  /* ---------- 发现卡 ---------- */
  function discoveryCard(eyebrow, name, stats, duration = 4200) {
    const el = $('discovery-card');
    el.classList.remove('hidden', 'out');
    $('dc-eyebrow').textContent = eyebrow;
    $('dc-name').textContent = name;
    $('dc-stats').innerHTML = stats.map(s => `<span>${s[0]} <b>${s[1]}</b></span>`).join('');
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.classList.add('hidden'), 700);
    }, duration);
  }

  /* ---------- 快捷栏 ---------- */
  function renderHotbar(slots, active) {
    const hb = $('hotbar');
    hb.innerHTML = '';
    slots.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'hb-slot' + (i === active ? ' active' : '');
      d.innerHTML = `<span class="hb-num">${i + 1}</span>`;
      if (s) {
        const def = ITEMS[s.item];
        d.innerHTML += `<img src="${Textures.ICONS[def.icon]}"><span class="hb-count">${s.n}</span>`;
      }
      hb.appendChild(d);
    });
  }

  /* ---------- 背包界面 ---------- */
  let selectedSlot = -1;
  function renderInventory(game) {
    const grid = $('inv-grid');
    grid.innerHTML = '';
    const inv = game.inventory;
    $('inv-capacity').textContent = inv.filter(s => s).length + ' / ' + inv.length;
    inv.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'inv-slot' + (i === selectedSlot ? ' selected' : '');
      if (s) {
        const def = ITEMS[s.item];
        d.innerHTML = `<img src="${Textures.ICONS[def.icon]}"><span class="slot-count">${s.n}</span>
          <span class="slot-bar" style="width:${(s.n / def.max) * 100}%"></span>`;
      }
      d.onclick = () => {
        AudioSys.uiClick();
        selectedSlot = i;
        renderInventory(game);
        renderDetail(game, s);
      };
      d.onmouseenter = () => AudioSys.uiHover();
      grid.appendChild(d);
    });
  }
  function renderDetail(game, slot) {
    const el = $('inv-detail');
    if (!slot) { el.innerHTML = '<div class="invd-empty">选择一个物品查看详情</div>'; return; }
    const def = ITEMS[slot.item];
    let actions = '';
    if (def.use === 'hazard') actions = `<button class="invd-btn" data-use="hazard">充能危险防护 (25)</button>`;
    if (def.use === 'life') actions = `<button class="invd-btn" data-use="life">充能生命维持 (25)</button>`;
    if (def.use === 'fuel') actions = `<button class="invd-btn" data-use="fuel">为飞船加注燃料</button>`;
    if (def.block) actions = `<button class="invd-btn" data-use="hotbar">放入快捷栏</button>`;
    el.innerHTML = `
      <div class="invd-name">${def.name}<small>${def.en} · ${def.rarity}</small></div>
      <div class="invd-desc">${def.desc}</div>
      <div class="invd-actions">${actions}</div>`;
    el.querySelectorAll('.invd-btn').forEach(btn => {
      btn.onclick = () => game.useItem(slot.item, btn.dataset.use);
    });
  }

  /* ---------- 合成 / 精炼列表 ---------- */
  function renderCraft(game) {
    const list = $('craft-list');
    list.innerHTML = '';
    for (const r of RECIPES) {
      const def = ITEMS[r.out];
      const canCraft = Object.entries(r.req).every(([it, n]) => game.countItem(it) >= n);
      const reqHtml = Object.entries(r.req).map(([it, n]) => {
        const have = game.countItem(it);
        return `<span class="${have >= n ? 'ok' : 'lack'}">${ITEMS[it].name} ${have}/${n}</span>`;
      }).join('');
      const d = document.createElement('div');
      d.className = 'craft-item';
      d.innerHTML = `<img src="${Textures.ICONS[def.icon]}">
        <div class="craft-mid"><div class="craft-name">${def.name} ×${r.n}</div>
        <div class="craft-req">${reqHtml}</div></div>
        <button class="craft-btn" ${canCraft ? '' : 'disabled'}>合成</button>`;
      d.querySelector('.craft-btn').onclick = () => game.craftRecipe(r);
      list.appendChild(d);
    }
  }
  function renderRefine(game) {
    const list = $('refine-list');
    list.innerHTML = '';
    for (const r of REFINE_RECIPES) {
      const def = ITEMS[r.out];
      const canCraft = Object.entries(r.in).every(([it, n]) => game.countItem(it) >= n);
      const reqHtml = Object.entries(r.in).map(([it, n]) => {
        const have = game.countItem(it);
        return `<span class="${have >= n ? 'ok' : 'lack'}">${ITEMS[it].name} ${have}/${n}</span>`;
      }).join('');
      const d = document.createElement('div');
      d.className = 'craft-item';
      d.innerHTML = `<img src="${Textures.ICONS[def.icon]}">
        <div class="craft-mid"><div class="craft-name">${r.desc} → ${def.name} ×${r.n}</div>
        <div class="craft-req">${reqHtml}</div></div>
        <button class="craft-btn" ${canCraft ? '' : 'disabled'}>精炼 ×1</button>`;
      const btn = d.querySelector('.craft-btn');
      btn.onclick = () => game.refineRecipe(r);
      // 长按连续精炼
      let holdTimer = null;
      btn.onmousedown = () => { holdTimer = setInterval(() => game.refineRecipe(r, true), 180); };
      const stop = () => { if (holdTimer) { clearInterval(holdTimer); holdTimer = null; } };
      btn.onmouseup = stop; btn.onmouseleave = stop;
      list.appendChild(d);
    }
  }

  /* ---------- 修复界面 ---------- */
  function renderRepair(game) {
    const list = $('repair-list');
    list.innerHTML = '';
    for (const part of game.shipParts) {
      const d = document.createElement('div');
      d.className = 'repair-item' + (part.fixed ? ' fixed' : '');
      let inner = `<div class="repair-icon">${part.fixed ? '✔' : '⚠'}</div>
        <div class="repair-info"><div class="repair-name">${part.name}</div>
        <div class="repair-status">${part.fixed ? '系统在线 · ONLINE' : '损坏 · DAMAGED'}</div>`;
      if (!part.fixed) {
        const reqHtml = Object.entries(part.req).map(([it, n]) => {
          const have = game.countItem(it);
          return `<span class="${have >= n ? 'ok' : 'lack'}" style="color:${have >= n ? 'var(--c-cyan)' : 'var(--c-red)'}">${ITEMS[it].name} ${have}/${n}</span>`;
        }).join('');
        inner += `<div class="repair-req">${reqHtml}</div>`;
      }
      inner += '</div>';
      if (!part.fixed) {
        const canFix = Object.entries(part.req).every(([it, n]) => game.countItem(it) >= n);
        inner += `<button class="craft-btn" ${canFix ? '' : 'disabled'}>修复</button>`;
      }
      d.innerHTML = inner;
      const btn = d.querySelector('.craft-btn');
      if (btn) btn.onclick = () => game.repairPart(part.id);
      list.appendChild(d);
    }
    // 飞船像素画
    const art = $('repair-ship-art');
    if (!art.querySelector('canvas')) {
      const cv = document.createElement('canvas');
      cv.width = 96; cv.height = 40;
      cv.style.cssText = 'width:240px;height:100px;image-rendering:pixelated';
      const c = cv.getContext('2d');
      drawShipPixelArt(c);
      art.appendChild(cv);
    }
  }
  function drawShipPixelArt(c) {
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    px(38, 16, 22, 10, '#d8dde4'); px(40, 12, 14, 6, '#9fe8ff');
    px(30, 18, 8, 7, '#4a5560'); px(24, 20, 6, 4, '#e8642a');
    px(58, 14, 10, 13, '#4a5560');
    px(66, 17, 4, 3, '#5ef2e0'); px(66, 22, 4, 3, '#5ef2e0');
    px(20, 24, 56, 3, '#3a444e');
    px(10, 25, 18, 4, '#d8dde4'); px(68, 25, 18, 4, '#d8dde4');
    px(6, 24, 6, 7, '#e8642a'); px(84, 24, 6, 7, '#e8642a');
    px(42, 28, 3, 6, '#22282e'); px(52, 28, 3, 6, '#22282e');
    px(40, 34, 7, 2, '#4a5560'); px(50, 34, 7, 2, '#4a5560');
  }

  /* ---------- 星系图 ---------- */
  function renderGalaxy(game) {
    $('galaxy-sysname').textContent = game.system.name + ' 星系';
    const map = $('galaxy-map');
    map.innerHTML = '';
    const W = map.clientWidth, H = map.clientHeight;
    const cx = W / 2, cy = H / 2;
    const star = document.createElement('div');
    star.className = 'gm-star';
    map.appendChild(star);
    const maxOrbit = Math.max(...game.system.planets.map(p => p.orbitRadius));
    game.system.planets.forEach((p, i) => {
      const rr = 60 + (p.orbitRadius / maxOrbit) * (Math.min(W, H) / 2 - 90);
      const orbit = document.createElement('div');
      orbit.className = 'gm-orbit';
      orbit.style.width = rr * 2 + 'px'; orbit.style.height = rr * 2 + 'px';
      map.appendChild(orbit);
      const a = p.orbitAngle;
      const el = document.createElement('div');
      el.className = 'gm-planet' +
        (game.currentPlanet === p ? ' current' : '') +
        (game.navTarget === p ? ' nav-target' : '');
      el.style.left = (cx + Math.cos(a) * rr) + 'px';
      el.style.top = (cy + Math.sin(a) * rr * 0.72) + 'px';
      el.appendChild(Textures.planetThumb(p.arch.palette, p.seed));
      const label = document.createElement('span');
      label.textContent = p.discovered ? p.name : '未知星球';
      el.appendChild(label);
      el.onmouseenter = () => {
        AudioSys.uiHover();
        $('galaxy-info').innerHTML = p.discovered
          ? `<b>${p.name}</b> · ${p.arch.desc}星球 · 危险等级: ${HAZARDS[p.arch.hazard].name} · 距离: ${game.planetDistance(p)}`
          : `<b>未知星球</b> · 需要抵达后扫描 · 距离: ${game.planetDistance(p)}`;
      };
      el.onclick = () => {
        AudioSys.uiClick();
        game.setNavTarget(p);
        renderGalaxy(game);
      };
      map.appendChild(el);
    });
  }

  /* ---------- 大气过渡文本 ---------- */
  function transitionText(planet, sub, alt) {
    const el = $('transition-text');
    if (!planet) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('tt-planet').textContent = planet;
    $('tt-sub').textContent = sub;
    $('tt-alt').textContent = alt || '';
  }
  function atmoHeat(opacity) {
    $('transition-layer').classList.remove('hidden');
    $('atmo-heat').style.opacity = opacity;
  }
  function whiteFade(opacity, instant = false) {
    const el = $('white-fade');
    if (instant) el.style.transition = 'none';
    else el.style.transition = 'opacity .6s';
    el.style.opacity = opacity;
    if (instant) requestAnimationFrame(() => el.style.transition = 'opacity .6s');
  }

  /* ---------- 屏幕切换 ---------- */
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }

  return {
    $, notify, gain, setVitals, setHazardInfo, hazardVignette, damageFlash,
    mineProgress, targetInfo, interactPrompt, setMission, updateCompass,
    addMarker, removeMarker, clearMarkers, updateMarkers, scanPulse, speedLines,
    setLocation, setUnits, shipHUD, shipStats, shipTarget, discoveryCard,
    renderHotbar, renderInventory, renderCraft, renderRefine, renderRepair, renderGalaxy,
    transitionText, atmoHeat, whiteFade, show, hide,
    get selectedSlot() { return selectedSlot; },
    set selectedSlot(v) { selectedSlot = v; }
  };
})();
