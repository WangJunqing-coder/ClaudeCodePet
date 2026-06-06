// ── CCPet 桌面宠物引擎 ────────────────────────────────────
// 兼容 Codex Pet Standard 精灵图格式（8列×9行，192×208/格）

// ── 精灵图配置 ──

const CODEX_ATLAS = {
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
  animations: {
    idle: { row: 0, frames: 6, frameDurations: [280, 110, 110, 140, 140, 320] },
    "running-right": {
      row: 1,
      frames: 8,
      frameDurations: [120, 120, 120, 120, 120, 120, 120, 220],
    },
    "running-left": {
      row: 2,
      frames: 8,
      frameDurations: [120, 120, 120, 120, 120, 120, 120, 220],
    },
    waving: { row: 3, frames: 4, frameDurations: [140, 140, 140, 280] },
    jumping: { row: 4, frames: 5, frameDurations: [140, 140, 140, 140, 280] },
    failed: {
      row: 5,
      frames: 8,
      frameDurations: [140, 140, 140, 140, 140, 140, 140, 240],
    },
    waiting: {
      row: 6,
      frames: 6,
      frameDurations: [150, 150, 150, 150, 150, 260],
    },
    running: {
      row: 7,
      frames: 6,
      frameDurations: [120, 120, 120, 120, 120, 220],
    },
    review: {
      row: 8,
      frames: 6,
      frameDurations: [150, 150, 150, 150, 150, 280],
    },
  },
};

// Claude Code 状态 → 宠物动画映射
const STATUS_TO_ANIMATION = {
  idle: "idle",
  running: "running",
  waiting: "waiting",
  completed: "jumping",
  error: "failed",
};

const STATUS_MESSAGES = {
  idle: "等待 Claude Code 启动",
  running: "正在处理...",
  waiting: "等待中...",
  completed: "任务完成！🎄",
  error: "出现错误 😩",
};

// ── PetEngine 类 ──────────────────────────────────────────

class PetEngine {
  constructor(spriteEl, atlas) {
    this.spriteEl = spriteEl;
    this.atlas = atlas;
    this.currentState = "idle";
    this.currentFrame = 0;
    this.timerHandle = null;
    this.applyState("idle");
  }

  applyState(state) {
    const anim = this.atlas.animations[state];
    if (!anim) {
      console.warn(`Unknown state: ${state}, falling back to idle`);
      this.applyState("idle");
      return;
    }
    this.stop();
    this.currentState = state;
    this.currentFrame = 0;
    this.showFrame(0);
    this.startLoop();
  }

  showFrame(index) {
    const anim = this.atlas.animations[this.currentState];
    const x = index * this.atlas.cellWidth;
    const y = anim.row * this.atlas.cellHeight;
    this.spriteEl.style.backgroundPosition = `-${x}px -${y}px`;
  }

  startLoop() {
    const anim = this.atlas.animations[this.currentState];
    const advance = () => {
      this.currentFrame = (this.currentFrame + 1) % anim.frames;
      this.showFrame(this.currentFrame);
      const delay = anim.frameDurations[this.currentFrame];
      this.timerHandle = window.setTimeout(advance, delay);
    };
    const firstDelay = anim.frameDurations[0];
    this.timerHandle = window.setTimeout(advance, firstDelay);
  }

  stop() {
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }

  destroy() {
    this.stop();
  }

  setSpritesheet(url) {
    this.spriteEl.style.backgroundImage = `url("${url}")`;
    this.applyState("idle");
  }
}

// ── SVG 粒子 ─────────────────────────────────────────────

const PARTICLE_SVGS = [
  // 爱心
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='%23EE6363'/%3E%3C/svg%3E",
  // 笑脸
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23FFD93D'/%3E%3Ccircle cx='8' cy='10' r='1.5' fill='%23333'/%3E%3Ccircle cx='16' cy='10' r='1.5' fill='%23333'/%3E%3Cpath d='M8 14s1.5 3 4 3 4-3 4-3' stroke='%23333' stroke-width='1.5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E",
  // 星星
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z' fill='%23FFD93D' stroke='%23F9A825' stroke-width='0.5'/%3E%3C/svg%3E",
  // 眨眼
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23FFD93D'/%3E%3Cpath d='M7 10h2v1H7zM15 10h2v1h-2z' fill='%23333'/%3E%3Cpath d='M8 14s1.5 3 4 3 4-3 4-3' stroke='%23333' stroke-width='1.5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E",
];

function spawnParticles(clientX, clientY) {
  const count = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 20;
    particle.style.left = clientX + offsetX + "px";
    particle.style.top = clientY + offsetY + "px";
    const svg = PARTICLE_SVGS[Math.floor(Math.random() * PARTICLE_SVGS.length)];
    particle.style.backgroundImage = `url("${svg}")`;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 700);
  }
}

// ── 气泡显示 ─────────────────────────────────────────────

let speechTimer = null;

function showSpeech(text, durationMs) {
  const bubble = document.getElementById("pet-speech-bubble");
  const bubbleText = bubble ? bubble.querySelector(".bubble-text") : null;
  if (!bubble || !bubbleText || !text) return;

  if (speechTimer) {
    clearTimeout(speechTimer);
    speechTimer = null;
  }

  bubbleText.textContent = text;
  bubble.classList.add("show-bubble");

  speechTimer = setTimeout(() => {
    bubble.classList.remove("show-bubble");
    speechTimer = null;
  }, durationMs);
}

// ── 窗口位置缓存 ─────────────────────────────────────────

let windowPosX = 0;
let windowPosY = 0;

async function initWindowPos() {
  try {
    if (window.ccPet) {
      const pos = await window.ccPet.getWindowPosition();
      windowPosX = pos[0];
      windowPosY = pos[1];
    }
  } catch (e) {
    // ignore
  }
}

// ── 右键菜单状态管理 ─────────────────────────────────────

let menuOpen = false;

function setMenuOpen(open) {
  menuOpen = open;
}

// ── 拖拽 + 穿透 + 右键菜单 ───────────────────────────────

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let winStartX = 0;
let winStartY = 0;
let lastDragX = 0;

function setupDrag(engine) {
  const hitbox = document.getElementById("pet-hitbox");
  const container = document.getElementById("pet-container");
  if (!hitbox) return;

  hitbox.addEventListener("mousedown", (e) => {
    if (e.button === 2) return;
    isDragging = true;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    lastDragX = e.screenX;
    winStartX = windowPosX;
    winStartY = windowPosY;
    document.body.style.cursor = "grabbing";
    e.preventDefault();

    // 拾起动画
    engine.applyState("running-right");
    if (container) {
      container.classList.remove("is-dropping");
      container.classList.add("is-lifting");
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.screenX - dragStartX;
    const dy = e.screenY - dragStartY;
    const newX = winStartX + dx;
    const newY = winStartY + dy;
    windowPosX = newX;
    windowPosY = newY;
    if (window.ccPet) {
      window.ccPet.setWindowPosition(newX, newY);
    }

    // 根据当前移动方向切换跑步动画
    const moveDx = e.screenX - lastDragX;
    if (moveDx > 1 && engine.currentState !== "running-right") {
      engine.applyState("running-right");
    } else if (moveDx < -1 && engine.currentState !== "running-left") {
      engine.applyState("running-left");
    }
    lastDragX = e.screenX;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "";

      // 落地动画
      if (container) {
        container.classList.remove("is-lifting");
        container.classList.add("is-dropping");
      }
      engine.applyState("jumping");
      setTimeout(() => {
        if (container) container.classList.remove("is-dropping");
        engine.applyState("idle");
      }, 500);
    }
  });

  // 点击宠物触发气泡
  hitbox.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    if (isDragging) return;
    spawnParticles(e.clientX, e.clientY);
    triggerSmartSpeech(engine);
  });

  // 右键菜单（自动调整位置，不超出窗口边界）
  hitbox.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (isDragging) return;

    const menu = document.getElementById("context-menu");
    if (!menu) return;

    // 先显示菜单以获取实际尺寸
    menu.style.visibility = "hidden";
    menu.style.display = "block";

    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let left = e.clientX;
    let top = e.clientY;

    // 防止超出右边界和下边界
    if (left + menuW > vpW) left = vpW - menuW;
    if (top + menuH > vpH) top = vpH - menuH;
    if (left < 0) left = 0;
    if (top < 0) top = 0;

    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.visibility = "visible";
    setMenuOpen(true);
  });

  // 其他区域 mousedown 时不处理
  document.addEventListener("mousedown", (e) => {
    if (isDragging) return;
  });
}

// ── 导入宠物对话框 ────────────────────────────────────

async function openImportDialog(engine) {
  try {
    if (!window.ccPet || !window.ccPet.importPetZip) {
      showSpeech("导入功能不可用", 2000);
      return;
    }

    showSpeech("正在导入宠物...", 3000);
    const manifest = await window.ccPet.importPetZip();
    if (!manifest) return; // 用户取消了对话框

    // 获取宠物目录并切换精灵图
    const petDir = await window.ccPet.getPetDir(manifest.id);
    const spritesheetPath = petDir + "/" + manifest.spritesheetPath;
    const fileUrl = "file:///" + spritesheetPath.replace(/\\/g, "/");
    engine.setSpritesheet(fileUrl);

    // 保存当前宠物 ID
    window.ccPet.setCurrentPetId(manifest.id);

    engine.applyState("waving");
    showSpeech(`已切换到: ${manifest.displayName} 🎉`, 3000);
    setTimeout(() => engine.applyState("idle"), 3000);
  } catch (e) {
    console.error("Import failed:", e);
    showSpeech("导入失败 😩", 3000);
  }
}

// ── 右键菜单交互（contextmenu 事件已在 setupDrag 中注册）──

let isAlwaysOnTop = true;

function setupMenuActions(engine) {
  const menu = document.getElementById("context-menu");
  if (!menu) return;

  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".menu-item");
    if (!item) return;

    const action = item.dataset.action;
    switch (action) {
      case "wave":
        engine.applyState("waving");
        showSpeech("你好呀！👋", 2500);
        setTimeout(() => engine.applyState("idle"), 2500);
        break;
      case "jump":
        engine.applyState("jumping");
        showSpeech("耶！🎉", 2000);
        setTimeout(() => engine.applyState("idle"), 2000);
        break;
      case "think":
        engine.applyState("review");
        showSpeech("让我想想...🤙", 3000);
        setTimeout(() => engine.applyState("idle"), 3000);
        break;
      case "import-pet":
        openImportDialog(engine);
        break;
      case "toggle-top":
        isAlwaysOnTop = !isAlwaysOnTop;
        window.ccPet.toggleAlwaysOnTop(isAlwaysOnTop);
        showSpeech(isAlwaysOnTop ? "已置顶" : "已取消置顶", 1500);
        break;
      case "quit":
        engine.applyState("failed");
        showSpeech("拜拜...😩", 2000);
        setTimeout(() => window.close(), 2000);
        break;
    }

    menu.style.display = "none";
    setMenuOpen(false);
  });

  // 点击其他地方关闭菜单
  document.addEventListener("mousedown", (e) => {
    if (!menu.contains(e.target) && menu.style.display === "block") {
      menu.style.display = "none";
      setMenuOpen(false);
    }
  });
}

// ── Claude Code 状态处理 ──────────────────────────────

let currentCCStatus = "idle";
let waitingBlinkTimer = null;

function handleStatusUpdate(engine, { status, message }) {
  currentCCStatus = status;

  // 清除闪烁
  if (waitingBlinkTimer) {
    clearInterval(waitingBlinkTimer);
    waitingBlinkTimer = null;
  }
  const container = document.getElementById("pet-container");
  if (container) container.classList.remove("waiting-blink");

  // 切换宠物动画
  const animState = STATUS_TO_ANIMATION[status] || "idle";
  engine.applyState(animState);

  // 显示气泡
  if (status === "waiting") {
    // waiting + 有消息 = Claude Code 需要确认（Notification 事件）
    // waiting + 无消息 = Claude 本轮响应结束，可能还会继续（Stop 事件）
    const msg = message || STATUS_MESSAGES[status];
    showSpeech(msg, message ? 999999 : 3000);
    if (message && container) {
      // 只有真正需要确认时才闪烁
      container.classList.add("waiting-blink");
    }
  } else {
    const msg = message || STATUS_MESSAGES[status] || "";
    if (msg) {
      showSpeech(msg, status === "completed" ? 5000 : 4000);
    }
  }

  // completed 状态跳一下后恢复
  if (status === "completed") {
    setTimeout(() => {
      if (currentCCStatus === "completed") {
        engine.applyState("idle");
      }
    }, 5000);
  }

  // error 状态抖一下后恢复
  if (status === "error") {
    setTimeout(() => {
      if (currentCCStatus === "error") {
        engine.applyState("idle");
      }
    }, 5000);
  }
}

// ── 智能气泡 ─────────────────────────────────────────

const HITOKOTO_URL = "https://v1.hitokoto.cn";

function triggerSmartSpeech(engine) {
  // 优先显示 CC 状态信息
  if (currentCCStatus !== "idle") {
    const msg = STATUS_MESSAGES[currentCCStatus];
    if (msg) {
      showSpeech(msg, 3000);
      return;
    }
  }

  // 随机一言
  fetch(HITOKOTO_URL)
    .then((r) => r.json())
    .then((data) => {
      if (data.hitokoto) showSpeech(data.hitokoto, 4000);
    })
    .catch(() => {
      showSpeech("你好呀！🥒", 2000);
    });
}

// ── 眼睛追踪（简化版） ───────────────────────────────────

function setupEyeTracking() {
  // 简化版：不做复杂的眼睛追踪
  // 原项目的 eye tracking 依赖 Tauri 的全局鼠标位置
  // Electron 中可以通过 screen.getCursorScreenPoint() 实现，这里简化
}

// ── 生物钟 ───────────────────────────────────────────────

function setupBioClock(engine) {
  // 每 30 分钟检查一次时间
  setInterval(() => {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 6) {
      if (engine.currentState === "idle") {
        showSpeech("夜深了，早点休息吧 🌙", 4000);
      }
    }
  }, 30 * 60 * 1000);
}

// ── 唤醒机制 ─────────────────────────────────────────────

let lastActivityTime = Date.now();

function setupWakeUp(engine) {
  document.addEventListener("mousemove", () => {
    lastActivityTime = Date.now();
    if (engine.currentState === "review") {
      engine.applyState("idle");
    }
  });

  // 每 60 秒检查一次是否需要发呆
  setInterval(() => {
    const elapsed = Date.now() - lastActivityTime;
    if (elapsed > 60000 && engine.currentState === "idle") {
      // 60秒无操作，显示思考
      engine.applyState("review");
      showSpeech("嗯？🤔", 3000);
    }
  }, 60000);
}

// ── 加载已保存的宠物 ────────────────────────────────────

async function loadSavedPet(engine) {
  try {
    if (!window.ccPet) return;
    const petId = await window.ccPet.getCurrentPetId();
    if (!petId) return;

    const pets = await window.ccPet.listPets();
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;

    const petDir = await window.ccPet.getPetDir(petId);
    const spritesheetPath = petDir + "/" + pet.spritesheetPath;
    const fileUrl = "file:///" + spritesheetPath.replace(/\\/g, "/");

    // 验证文件可访问
    try {
      const resp = await fetch(fileUrl, { method: "HEAD" });
      if (!resp.ok) return;
    } catch (e) {
      return;
    }

    engine.setSpritesheet(fileUrl);
    console.log(`[CCPet] 已加载保存的宠物: ${pet.displayName}`);
  } catch (e) {
    console.warn("[CCPet] 加载保存的宠物失败:", e);
  }
}

// ── 初始化 ───────────────────────────────────────────

function main() {
  const spriteEl = document.getElementById("pet-sprite");
  if (!spriteEl) {
    console.error("Pet sprite element not found");
    return;
  }

  const engine = new PetEngine(spriteEl, CODEX_ATLAS);

  // 加载已保存的宠物精灵图
  loadSavedPet(engine).catch(e => console.warn("加载保存的宠物失败:", e));

  // 入场动画：一次性添加 class，动画结束后立即移除，防止 Chromium 因后续 class 变化重播
  const petContainer = document.getElementById("pet-container");
  if (petContainer) {
    petContainer.classList.add("pet-entering");
    setTimeout(() => petContainer.classList.remove("pet-entering"), 700);
  }

  // 开场动画
  engine.applyState("waving");
  showSpeech("你好呀 🐥", 3000);

  setTimeout(() => {
    engine.applyState("idle");
  }, 4000);

  // 初始化窗口位置缓存（异步，必须在 setupDrag 前调用）
  initWindowPos();

  // 设置各系统
  setupDrag(engine); // 包含穿透控制 + 拖拽 + 右键菜单触发
  setupMenuActions(engine); // 菜单项点击处理
  setupEyeTracking();
  setupBioClock(engine);
  setupWakeUp(engine);

  // 接收 Claude Code 状态更新
  if (window.ccPet) {
    window.ccPet.onStatusUpdate((data) => {
      handleStatusUpdate(engine, data);
    });
  }

  console.log("CCPet engine initialized");
}

// 启动
main();
