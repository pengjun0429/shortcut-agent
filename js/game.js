(() => {
  'use strict';

  // ============ CONFIG ============
  const API_BASE = 'https://shortcut-agent-api.pengjun0429.workers.dev';
  const DESPAWN_BASE = 6000;
  const DESPAWN_MIN = 2200;
  const SPAWN_INTERVAL_BASE = 2200;
  const SPAWN_INTERVAL_MIN = 700;
  const SCORE_PER_CLEAR = 100;
  const MAX_ALERTS = 6;
  const COMBO_WINDOW = 3000;
  const WAVE_INTERVAL = 30;

  // ============ DOM ============
  const $ = (s) => document.querySelector(s);
  const scoreEl = $('#score');
  const healthBarEl = $('#health-bar');
  const timerEl = $('#timer');
  const clockEl = $('#clock');
  const windowsContainer = $('#windows-container');
  const startScreen = $('#start-screen');
  const gameoverScreen = $('#gameover-screen');
  const leaderboardScreen = $('#leaderboard-screen');
  const startBtn = $('#start-btn');
  const restartBtn = $('#restart-btn');
  const lbBtn = $('#lb-btn');
  const lbCloseBtn = $('#lb-close-btn');
  const playerNameInput = $('#player-name');
  const comboDisplay = $('#combo-display');
  const comboKeys = $('#combo-keys');
  const comboCountEl = $('#combo-count');
  const waveAnnounce = $('#wave-announce');
  const waveText = $('#wave-text');
  const desktop = $('#desktop');
  const finalScoreEl = $('#final-score');
  const finalTimeEl = $('#final-time');
  const finalClearedEl = $('#final-cleared');
  const finalComboEl = $('#final-combo');
  const submitStatus = $('#submit-status');
  const userInfoEl = $('#user-info');
  const userNameEl = $('#user-name');
  const userAvatarEl = $('#user-avatar');
  const logoutBtn = $('#logout-btn');

  // ============ STATE ============
  let state = {
    running: false,
    score: 0,
    health: 10,
    maxHealth: 10,
    time: 0,
    cleared: 0,
    maxCombo: 0,
    combo: 0,
    lastClearTime: 0,
    alerts: [],
    spawnTimer: null,
    tickTimer: null,
    clockTimer: null,
    difficulty: 0,
    playerName: 'ANONYMOUS',
    windowIdCounter: 0,
    comboTimeout: null,
    user: null,
  };

  // ============ THREAT DEFINITIONS ============
  const THREATS = [
    {
      type: 'virus',
      className: 'virus',
      icon: '🦠',
      title: 'VIRUS INTRUSION',
      desc: '偵測到惡意軟體入侵系統！立即終止病毒程序！',
      keys: 'Alt + F4',
      check(e) {
        return e.altKey && e.key.toLowerCase() === 'f4';
      },
      score: SCORE_PER_CLEAR,
    },
    {
      type: 'memory',
      className: 'memory',
      icon: '💾',
      title: 'MEMORY OVERLOAD',
      desc: '記憶體占用率 98%！剪下並清除異常檔案！',
      keys: 'Ctrl+X → Ctrl+V',
      check(e, alertObj) {
        if (!e.ctrlKey) return false;
        if (e.key.toLowerCase() === 'x' && alertObj.phase === 0) {
          alertObj.phase = 1;
          updateAlertHint(alertObj, 'Ctrl+V');
          updateAlertPhase(alertObj, '剪下完成 → 按 Ctrl+V 丟棄');
          return false;
        }
        if (e.key.toLowerCase() === 'v' && alertObj.phase === 1) {
          return true;
        }
        return false;
      },
      score: SCORE_PER_CLEAR + 50,
    },
    {
      type: 'critical',
      className: 'critical',
      icon: '🔥',
      title: 'CORE ANOMALY',
      desc: '核心運算單元異常！緊急重啟序列啟動！',
      keys: 'Delete × 3',
      sequence: ['delete', 'delete', 'delete'],
      check(e, alertObj) {
        if (e.key === 'Delete') {
          if (!alertObj.pressedKeys) alertObj.pressedKeys = [];
          alertObj.pressedKeys.push('delete');
          updateAlertPhase(alertObj, `序列: DELETE (${alertObj.pressedKeys.length}/3)`);
          if (alertObj.pressedKeys.length >= 3) {
            alertObj.pressedKeys = [];
            return true;
          }
        }
        return false;
      },
      score: SCORE_PER_CLEAR + 150,
    },
    {
      type: 'firewall',
      className: 'firewall',
      icon: '🛡️',
      title: 'DATA LEAK',
      desc: '偵測到資料外洩！緊急儲存防火牆規則！',
      keys: 'Ctrl+S → Ctrl+S',
      check(e, alertObj) {
        if (!e.ctrlKey) return false;
        if (e.key.toLowerCase() === 's') {
          alertObj.phase = (alertObj.phase || 0) + 1;
          if (alertObj.phase === 1) {
            updateAlertHint(alertObj, 'Ctrl+S (again)');
            updateAlertPhase(alertObj, '第一次儲存完成 → 再按 Ctrl+S 確認');
            return false;
          }
          if (alertObj.phase >= 2) {
            return true;
          }
        }
        return false;
      },
      score: SCORE_PER_CLEAR + 80,
    },
    {
      type: 'corruption',
      className: 'corruption',
      icon: '💉',
      title: 'SYSTEM CORRUPTION',
      desc: '系統檔案損壞！立即回復到安全狀態！',
      keys: 'Ctrl + Z',
      check(e) {
        return e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey && !e.altKey;
      },
      score: SCORE_PER_CLEAR + 60,
    },
    {
      type: 'process',
      className: 'process',
      icon: '👻',
      title: 'ZOMBIE PROCESS',
      desc: '偵測到僵屍程序佔用 CPU！強制結束工作管理員！',
      keys: 'Ctrl+Shift+Esc',
      sequence: ['control', 'shift', 'escape'],
      check(e, alertObj) {
        const seq = THREATS[5].sequence;
        if (['Control', 'Shift', 'Escape'].includes(e.key)) {
          if (!alertObj.pressedKeys) alertObj.pressedKeys = [];
          const key = e.key.toLowerCase();
          if (!alertObj.pressedKeys.includes(key)) {
            alertObj.pressedKeys.push(key);
          }
          updateAlertPhase(alertObj, `序列: ${alertObj.pressedKeys.map(k => k.toUpperCase()).join(' → ')}`);
          if (alertObj.pressedKeys.length === seq.length) {
            const matched = alertObj.pressedKeys.every((k, i) => k === seq[i]);
            alertObj.pressedKeys = [];
            return matched;
          }
        }
        return false;
      },
      score: SCORE_PER_CLEAR + 120,
    },
  ];

  // ============ HELPERS ============
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function randomPos() {
    const maxX = desktop.clientWidth - 400;
    const maxY = desktop.clientHeight - 250;
    return {
      x: rand(40, Math.max(40, maxX)),
      y: rand(20, Math.max(20, maxY)),
    };
  }

  function updateHealth() {
    const filled = Math.max(0, state.health);
    const bars = '█'.repeat(filled) + '░'.repeat(state.maxHealth - filled);
    healthBarEl.textContent = bars;
    if (filled <= 3) {
      healthBarEl.style.textShadow = '0 0 12px var(--neon-red), 0 0 24px var(--neon-red)';
    } else {
      healthBarEl.style.textShadow = '0 0 8px var(--neon-red)';
    }
  }

  function updateScore() {
    scoreEl.textContent = state.score;
    scoreEl.style.transform = 'scale(1.3)';
    setTimeout(() => { scoreEl.style.transform = 'scale(1)'; }, 150);
  }

  function updateCombo() {
    comboCountEl.textContent = state.combo;
    if (state.combo >= 5) {
      comboCountEl.style.textShadow = '0 0 12px var(--neon-purple), 0 0 24px var(--neon-purple)';
    } else if (state.combo >= 3) {
      comboCountEl.style.textShadow = '0 0 8px var(--neon-purple)';
    } else {
      comboCountEl.style.textShadow = 'none';
    }
  }

  function addCombo() {
    const now = Date.now();
    if (now - state.lastClearTime < COMBO_WINDOW) {
      state.combo++;
    } else {
      state.combo = 1;
    }
    state.lastClearTime = now;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    updateCombo();
    if (state.combo >= 3) {
      const bonus = state.combo * 10;
      state.score += bonus;
      showCombo(`COMBO x${state.combo} (+${bonus})`);
    }
  }

  // ============ ALERT WINDOWS ============
  function createAlertWindow(threat) {
    if (state.alerts.length >= MAX_ALERTS) return;
    if (state.alerts.some(a => a.type === threat.type)) return;

    const id = ++state.windowIdCounter;
    const pos = randomPos();
    const despawnTime = Math.max(DESPAWN_MIN, DESPAWN_BASE - state.difficulty * 180);

    const el = document.createElement('div');
    el.className = `alert-window ${threat.className}`;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.dataset.id = id;
    el.innerHTML = `
      <div class="title-bar">
        <span>${threat.title}</span>
        <div class="title-icons"><span></span><span></span><span></span></div>
      </div>
      <div class="window-body">
        <div class="alert-icon">${threat.icon}</div>
        <h3>${threat.title}</h3>
        <p>${threat.desc}</p>
        <span class="hint-keys">${threat.keys}</span>
        <div class="phase-hint"></div>
      </div>
      <div class="expiry-bar"><div class="fill" style="animation-duration:${despawnTime}ms"></div></div>
    `;

    windowsContainer.appendChild(el);

    const alertObj = {
      id,
      type: threat.type,
      threat,
      el,
      phase: 0,
      pressedKeys: [],
      despawnTimer: setTimeout(() => despawnAlert(id, true), despawnTime),
    };

    state.alerts.push(alertObj);
  }

  function despawnAlert(id, missed = false) {
    const idx = state.alerts.findIndex(a => a.id === id);
    if (idx === -1) return;
    const alertObj = state.alerts[idx];
    clearTimeout(alertObj.despawnTimer);
    alertObj.el.classList.add('closing');
    setTimeout(() => alertObj.el.remove(), 300);
    state.alerts.splice(idx, 1);

    if (missed) {
      state.health--;
      state.combo = 0;
      updateCombo();
      updateHealth();
      flashDamage();
      showPopup(alertObj.el, 'MISS!', true);
      if (state.health <= 0) gameOver();
    }
  }

  function flashDamage() {
    desktop.classList.remove('damage-flash');
    void desktop.offsetWidth;
    desktop.classList.add('damage-flash');
  }

  function showPopup(refEl, text, type = '') {
    const popup = document.createElement('div');
    popup.className = 'score-popup' + (type === 'miss' ? ' miss' : type === 'combo' ? ' combo' : '');
    popup.textContent = text;
    const rect = refEl.getBoundingClientRect();
    popup.style.left = (rect.left + rect.width / 2 - 30) + 'px';
    popup.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
  }

  function updateAlertHint(alertObj, newKey) {
    const hintEl = alertObj.el.querySelector('.hint-keys');
    if (hintEl) hintEl.textContent = newKey;
  }

  function updateAlertPhase(alertObj, text) {
    const phaseEl = alertObj.el.querySelector('.phase-hint');
    if (phaseEl) phaseEl.textContent = text;
  }

  // ============ WINDOW DRAGGING ============
  function makeDraggable(el) {
    const titleBar = el.querySelector('.title-bar');
    if (!titleBar) return;
    let isDragging = false, startX, startY, origLeft, origTop;
    titleBar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-btns')) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      origLeft = el.offsetLeft; origTop = el.offsetTop;
      el.style.zIndex = ++state.windowIdCounter + 10;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      el.style.left = (origLeft + e.clientX - startX) + 'px';
      el.style.top = (origTop + e.clientY - startY) + 'px';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  // ============ MOUSE ACTION BUTTONS ============
  function addActionButtons(alertObj) {
    const body = alertObj.el.querySelector('.window-body');
    if (!body) return;
    const threat = alertObj.threat;
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'alert-actions';

    if (threat.type === 'virus') {
      const btn = document.createElement('button');
      btn.className = 'alert-action-btn danger';
      btn.textContent = 'FORCE CLOSE (Alt+F4)';
      btn.addEventListener('click', () => {
        if (state.running && alertObj.el.parentNode) {
          state.score += threat.score;
          state.cleared++;
          addCombo();
          updateScore();
          showPopup(alertObj.el, '+' + threat.score);
          despawnAlert(alertObj.id, false);
        }
      });
      actionsContainer.appendChild(btn);
    } else if (threat.type === 'memory') {
      const btn1 = document.createElement('button');
      btn1.className = 'alert-action-btn';
      btn1.textContent = 'STEP 1: CUT (Ctrl+X)';
      btn1.addEventListener('click', () => {
        if (alertObj.phase === 0) {
          alertObj.phase = 1;
          updateAlertHint(alertObj, 'Ctrl+V');
          updateAlertPhase(alertObj, '剪下完成 → 按 Ctrl+V 丟棄');
          btn1.textContent = 'DONE';
          btn1.disabled = true;
          btn1.style.opacity = '0.4';
        }
      });
      const btn2 = document.createElement('button');
      btn2.className = 'alert-action-btn danger';
      btn2.textContent = 'STEP 2: PASTE (Ctrl+V)';
      btn2.addEventListener('click', () => {
        if (alertObj.phase === 1 && state.running && alertObj.el.parentNode) {
          state.score += threat.score;
          state.cleared++;
          addCombo();
          updateScore();
          showPopup(alertObj.el, '+' + threat.score);
          despawnAlert(alertObj.id, false);
        }
      });
      actionsContainer.appendChild(btn1);
      actionsContainer.appendChild(btn2);
    } else if (threat.type === 'critical') {
      for (let i = 0; i < 3; i++) {
        const btn = document.createElement('button');
        btn.className = 'alert-action-btn danger';
        btn.textContent = `DELETE ${i + 1}/3`;
        btn.addEventListener('click', () => {
          if (!alertObj.pressedKeys) alertObj.pressedKeys = [];
          alertObj.pressedKeys.push('delete');
          btn.textContent = '✓ ' + (i + 1) + '/3';
          btn.style.opacity = '0.3';
          btn.disabled = true;
          updateAlertPhase(alertObj, `序列: DELETE (${alertObj.pressedKeys.length}/3)`);
          if (alertObj.pressedKeys.length >= 3) {
            alertObj.pressedKeys = [];
            if (state.running && alertObj.el.parentNode) {
              state.score += threat.score;
              state.cleared++;
              addCombo();
              updateScore();
              showPopup(alertObj.el, '+' + threat.score);
              despawnAlert(alertObj.id, false);
            }
          }
        });
        actionsContainer.appendChild(btn);
      }
    } else if (threat.type === 'firewall') {
      const btn1 = document.createElement('button');
      btn1.className = 'alert-action-btn';
      btn1.textContent = 'STEP 1: SAVE (Ctrl+S)';
      btn1.addEventListener('click', () => {
        alertObj.phase = (alertObj.phase || 0) + 1;
        updateAlertHint(alertObj, 'Ctrl+S (again)');
        updateAlertPhase(alertObj, '第一次儲存完成 → 再按 Ctrl+S 確認');
        btn1.textContent = 'SAVED';
        btn1.disabled = true;
        btn1.style.opacity = '0.4';
      });
      const btn2 = document.createElement('button');
      btn2.className = 'alert-action-btn danger';
      btn2.textContent = 'STEP 2: CONFIRM (Ctrl+S)';
      btn2.addEventListener('click', () => {
        if (alertObj.phase >= 1 && state.running && alertObj.el.parentNode) {
          state.score += threat.score;
          state.cleared++;
          addCombo();
          updateScore();
          showPopup(alertObj.el, '+' + threat.score);
          despawnAlert(alertObj.id, false);
        }
      });
      actionsContainer.appendChild(btn1);
      actionsContainer.appendChild(btn2);
    } else if (threat.type === 'corruption') {
      const btn = document.createElement('button');
      btn.className = 'alert-action-btn';
      btn.textContent = 'UNDO (Ctrl+Z)';
      btn.addEventListener('click', () => {
        if (state.running && alertObj.el.parentNode) {
          state.score += threat.score;
          state.cleared++;
          addCombo();
          updateScore();
          showPopup(alertObj.el, '+' + threat.score);
          despawnAlert(alertObj.id, false);
        }
      });
      actionsContainer.appendChild(btn);
    } else if (threat.type === 'process') {
      const btn = document.createElement('button');
      btn.className = 'alert-action-btn danger';
      btn.textContent = 'FORCE KILL (Ctrl+Shift+Esc)';
      btn.addEventListener('click', () => {
        if (state.running && alertObj.el.parentNode) {
          state.score += threat.score;
          state.cleared++;
          addCombo();
          updateScore();
          showPopup(alertObj.el, '+' + threat.score);
          despawnAlert(alertObj.id, false);
        }
      });
      actionsContainer.appendChild(btn);
    }
    body.appendChild(actionsContainer);
  }

  // ============ WAVE SYSTEM ============
  function showWave(waveNum) {
    waveText.textContent = `WAVE ${waveNum}`;
    waveAnnounce.classList.remove('hidden');
    setTimeout(() => waveAnnounce.classList.add('hidden'), 2000);
  }

  // ============ COMBO DISPLAY ============
  function showCombo(text) {
    comboKeys.textContent = text;
    comboDisplay.classList.remove('hidden');
    clearTimeout(state.comboTimeout);
    state.comboTimeout = setTimeout(() => {
      comboDisplay.classList.add('hidden');
    }, 1200);
  }

  // ============ SPAWNING ============
  function scheduleSpawn() {
    const interval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - state.difficulty * 50);
    state.spawnTimer = setTimeout(() => {
      if (!state.running) return;
      const threat = THREATS[rand(0, THREATS.length - 1)];
      createAlertWindow(threat);
      scheduleSpawn();
    }, rand(interval, interval + 500));
  }

  // ============ GAME LOOP ============
  function startGame() {
    state = {
      ...state,
      running: true,
      score: 0,
      health: 10,
      maxHealth: 10,
      time: 0,
      cleared: 0,
      maxCombo: 0,
      combo: 0,
      lastClearTime: 0,
      alerts: [],
      difficulty: 0,
      windowIdCounter: 0,
    };
    scoreEl.textContent = '0';
    updateHealth();
    updateCombo();
    timerEl.textContent = '00:00';
    windowsContainer.innerHTML = '';

    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');

    state.tickTimer = setInterval(() => {
      if (!state.running) return;
      state.time++;
      state.difficulty = Math.floor(state.time / 10);
      timerEl.textContent = formatTime(state.time);
      if (state.time % WAVE_INTERVAL === 0 && state.time > 0) {
        showWave(Math.floor(state.time / WAVE_INTERVAL) + 1);
      }
    }, 1000);

    updateClock();
    state.clockTimer = setInterval(updateClock, 1000);
    scheduleSpawn();
  }

  function gameOver() {
    state.running = false;
    clearTimeout(state.spawnTimer);
    clearInterval(state.tickTimer);
    clearInterval(state.clockTimer);
    state.alerts.forEach(a => clearTimeout(a.despawnTimer));
    state.alerts.forEach(a => a.el.remove());
    state.alerts = [];

    finalScoreEl.textContent = state.score;
    finalTimeEl.textContent = formatTime(state.time);
    finalClearedEl.textContent = state.cleared;
    finalComboEl.textContent = state.maxCombo;

    gameoverScreen.classList.remove('hidden');
    submitScore();
  }

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  }

  // ============ KEYBOARD ============
  document.addEventListener('keydown', (e) => {
    if (!state.running) return;

    // Block browser shortcuts
    if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') {
      e.preventDefault(); return;
    }
    if (e.ctrlKey && e.shiftKey) {
      const blockCS = ['i','j','c','Delete','Escape'];
      if (blockCS.includes(e.key) || blockCS.includes(e.key.toUpperCase())) {
        e.preventDefault();
      }
    }
    if (e.ctrlKey && e.altKey) {
      e.preventDefault();
    }
    if (e.ctrlKey) {
      const blocked = ['f4','x','v','w','r','n','p','s','u','z','a','d','l','h','j','o','i','c','b','k'];
      if (blocked.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    }
    if (e.altKey) {
      const blockedAlt = ['f4','f5','tab','space','arrowup','arrowdown','arrowleft','arrowright'];
      if (blockedAlt.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    }
    if (e.shiftKey && e.key === 'Escape') e.preventDefault();

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      parts.push(e.key.toUpperCase());
    }
    if (parts.length > 1) showCombo(parts.join(' + '));

    for (let i = state.alerts.length - 1; i >= 0; i--) {
      const alertObj = state.alerts[i];
      if (alertObj.threat.check(e, alertObj)) {
        state.score += alertObj.threat.score;
        state.cleared++;
        addCombo();
        updateScore();
        showPopup(alertObj.el, '+' + alertObj.threat.score);
        despawnAlert(alertObj.id, false);
        return;
      }
    }
  });

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const ctxMenu = $('#context-menu');
    ctxMenu.classList.remove('hidden');
    ctxMenu.style.left = e.pageX + 'px';
    ctxMenu.style.top = e.pageY + 'px';
  });

  document.addEventListener('click', () => {
    $('#context-menu').classList.add('hidden');
  });

  document.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      $('#context-menu').classList.add('hidden');
      if (action === 'refresh') {
        windowsContainer.innerHTML = '';
      } else if (action === 'about') {
        alert('快捷鍵特工 — OS 密碼戰 v1.0.0\n作者: pengjun0429');
      }
    });
  });

  document.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('dblclick', (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === 'notepad') {
        const win = document.createElement('div');
        win.className = 'alert-window virus';
        win.style.cssText = 'left:200px;top:100px;width:350px;';
        win.innerHTML = `
          <div class="title-bar"><span>記事本</span><div class="title-icons"><span></span><span></span><span></span></div></div>
          <div class="window-body" style="text-align:left;padding:12px;">
            <p style="color:var(--neon-cyan);font-size:11px;">C:\\Users\\Player> 這是一段模擬文字</p>
            <p style="color:rgba(200,214,229,0.5);font-size:11px;margin-top:8px;">[系統正常運作中...]</p>
          </div>`;
        windowsContainer.appendChild(win);
      } else if (action === 'terminal') {
        const win = document.createElement('div');
        win.className = 'alert-window critical';
        win.style.cssText = 'left:250px;top:120px;width:380px;';
        win.innerHTML = `
          <div class="title-bar"><span>終端機</span><div class="title-icons"><span></span><span></span><span></span></div></div>
          <div class="window-body" style="text-align:left;padding:12px;">
            <p style="color:var(--neon-green);font-size:11px;">C:\\OS_CORE> system --status</p>
            <p style="color:var(--neon-red);font-size:11px;margin-top:4px;">[WARNING] 核心溫度過高</p>
            <p style="color:var(--neon-yellow);font-size:11px;">[INFO] 正在掃描威脅...</p>
          </div>`;
        windowsContainer.appendChild(win);
      }
    });
  });

  // ============ GOOGLE AUTH ============
  window.handleGoogleLogin = function(response) {
    const payload = parseJwt(response.credential);
    state.user = {
      google_id: payload.sub,
      name: payload.name,
      email: payload.email,
      avatar_url: payload.picture,
    };
    state.playerName = payload.name;
    userNameEl.textContent = payload.name;
    userAvatarEl.src = payload.picture;
    userInfoEl.classList.remove('hidden');
    playerNameInput.style.display = 'none';
    const orDivider = document.querySelector('.or-divider');
    if (orDivider) orDivider.style.display = 'none';
  };

  function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  }

  logoutBtn.addEventListener('click', () => {
    state.user = null;
    state.playerName = 'ANONYMOUS';
    userInfoEl.classList.add('hidden');
    playerNameInput.style.display = 'block';
    const orDivider = document.querySelector('.or-divider');
    if (orDivider) orDivider.style.display = 'flex';
  });

  // ============ API ============
  async function submitScore() {
    submitStatus.className = 'loading';
    submitStatus.textContent = 'SUBMITTING SCORE...';

    try {
      const body = {
        name: state.playerName || 'ANONYMOUS',
        score: state.score,
        time: state.time,
        cleared: state.cleared,
        max_combo: state.maxCombo,
      };
      if (state.user) {
        body.google_id = state.user.google_id;
        body.email = state.user.email;
        body.avatar_url = state.user.avatar_url;
      }

      const res = await fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Server error');
      const data = await res.json();

      submitStatus.className = 'success';
      if (data.rank <= 3) {
        submitStatus.textContent = `NEW HIGH RANK! #${data.rank}`;
      } else {
        submitStatus.textContent = `SCORE SUBMITTED — RANK #${data.rank}`;
      }
    } catch (err) {
      submitStatus.className = 'error';
      submitStatus.textContent = 'SUBMISSION FAILED — OFFLINE SCORE';
    }
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      renderLeaderboard(data.leaderboard || []);
    } catch {
      renderLeaderboard([]);
    }
  }

  function renderLeaderboard(list) {
    const container = $('#leaderboard-list');
    if (list.length === 0) {
      container.innerHTML = '<div class="lb-empty">NO RECORDS YET — BE THE FIRST</div>';
      return;
    }
    container.innerHTML = list.map((entry, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `#${i + 1}`;
      return `
        <div class="lb-entry">
          <span class="rank ${rankClass}">${medal}</span>
          <span class="name">${escapeHtml(entry.name)}</span>
          <span class="lb-score">${entry.score}</span>
          <span class="lb-time">${formatTime(entry.time || 0)}</span>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============ EVENTS ============
  startBtn.addEventListener('click', () => {
    if (!state.user) {
      state.playerName = playerNameInput.value.trim() || 'ANONYMOUS';
    }
    startGame();
  });

  playerNameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') startBtn.click();
  });

  restartBtn.addEventListener('click', () => startGame());

  lbBtn.addEventListener('click', () => {
    gameoverScreen.classList.add('hidden');
    leaderboardScreen.classList.remove('hidden');
    loadLeaderboard();
  });

  lbCloseBtn.addEventListener('click', () => {
    leaderboardScreen.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');
  });

  updateClock();
})();
