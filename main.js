// ─── 环境检查 ───────────────────────────────────────
// 如果 ELECTRON_RUN_AS_NODE=1，Electron 会以 Node.js 模式运行，需要清除该变量后重新启动
if (process.env.ELECTRON_RUN_AS_NODE === "1") {
  delete process.env.ELECTRON_RUN_AS_NODE;
  const { spawn } = require("child_process");
  const child = spawn(process.execPath, [__dirname], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
  child.on("exit", (code) => process.exit(code));
  // 保持进程存活直到子进程退出
  setInterval(() => {}, 1000);
} else {
  startApp();
}

function startApp() {
  const {
    app,
    BrowserWindow,
    screen,
    ipcMain,
    Notification,
    dialog,
  } = require("electron");
  const http = require("http");
  const path = require("path");
  const fs = require("fs");
  const os = require("os");
  const AdmZip = require("adm-zip");

  let mainWindow = null;
  let httpServer = null;
  const PORT = 31126;

  const STATUS = {
    IDLE: "idle",
    RUNNING: "running",
    WAITING: "waiting",
    COMPLETED: "completed",
    ERROR: "error",
  };

  let currentStatus = STATUS.IDLE;
  let statusMessage = "";
  let prevStatus = STATUS.IDLE;
  let completedTimer = null;

  // ─── 宠物存储目录 ────────────────────────────────
  function getPetsDir() {
    const dir = path.join(app.getPath("userData"), "pets");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getCurrentPetId() {
    try {
      const configPath = path.join(app.getPath("userData"), "pet-config.json");
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
        return cfg.currentPetId || "";
      }
    } catch (e) { /* ignore */ }
    return "";
  }

  function setCurrentPetId(petId) {
    try {
      const configPath = path.join(app.getPath("userData"), "pet-config.json");
      let cfg = {};
      try {
        cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch (e) { /* ignore */ }
      cfg.currentPetId = petId;
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf8");
    } catch (e) { /* ignore */ }
  }

  const WIN_W = 220;
  const WIN_H = 200;
  // ─── 创建桌面宠物窗口 ────────────────────────────
  function createWindow() {
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
      width: WIN_W,
      height: WIN_H,
      minWidth: WIN_W,
      maxWidth: WIN_W,
      minHeight: WIN_H,
      maxHeight: WIN_H,
      x: Math.round(screenWidth - WIN_W),
      y: Math.round(screenHeight - WIN_H - 20),

      title: " ",
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,

      skipTaskbar: true,
      hasShadow: false,

      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.setTitle(" ");
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setBackgroundColor('#00000000');

    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
    mainWindow.webContents.on("did-finish-load", () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(" ");
    });

    mainWindow.setIgnoreMouseEvents(false);

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  // ─── 状态推送 ─────────────────────────────────────
  function pushStatus(status, message = "") {
    if (status === currentStatus && message === statusMessage) return;

    prevStatus = currentStatus;
    currentStatus = status;
    statusMessage = message;

    if (completedTimer) {
      clearTimeout(completedTimer);
      completedTimer = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("status-update", { status, message });
    }

    // waiting + 有消息 = 真正需要用户确认（Notification 事件）→ 弹通知
    // waiting + 无消息 = Stop 事件，Claude 本轮结束但可能继续 → 不弹通知
    if (status === STATUS.WAITING && message && prevStatus !== STATUS.WAITING) {
      sendNotification("⚠️ Claude Code 需要确认", message);
    }

    if (status === STATUS.COMPLETED && prevStatus !== STATUS.COMPLETED) {
      sendNotification("✅ Claude Code 任务完成", message || "任务已完成");
      completedTimer = setTimeout(() => {
        if (currentStatus === STATUS.COMPLETED) {
          pushStatus(STATUS.IDLE, "");
        }
      }, 10000);
    }
    if (status === STATUS.ERROR && prevStatus !== STATUS.ERROR) {
      sendNotification("❌ Claude Code 错误", message || "出现错误");
      completedTimer = setTimeout(() => {
        if (currentStatus === STATUS.ERROR) {
          pushStatus(STATUS.IDLE, "");
        }
      }, 10000);
    }
  }

  function sendNotification(title, body) {
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      }
    } catch (e) {
      // ignore
    }
  }

  // ─── 自动配置 Claude Code hooks ───────────────────
  function autoConfigHooks() {
    let claudeDir;
    if (process.platform === "win32") {
      claudeDir = path.join(os.homedir(), ".claude");
    } else {
      claudeDir = path.join(os.homedir(), ".claude");
    }

    const settingsPath = path.join(claudeDir, "settings.local.json");
    let settings;
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (e) {
      settings = {};
    }

    if (!settings.hooks) settings.hooks = {};

    const hooksDir = path.join(__dirname, "hooks");
    const notifyScript = process.platform === "win32"
      ? `cmd /c "${path.join(hooksDir, "setup.cmd")}"`
      : path.join(hooksDir, "setup.sh");

    const hookList = [
      {
        hooks: [
          {
            type: "command",
            command: `node "${path.join(hooksDir, "notify.js")}"`,
          },
        ],
      },
    ];

    let changed = false;
    const events = ["PreToolUse", "PostToolUse", "Stop", "Notification"];

    for (const event of events) {
      if (!settings.hooks[event]) {
        settings.hooks[event] = hookList;
        changed = true;
      } else {
        const hasHook = settings.hooks[event].some(
          (h) =>
            h.hooks &&
            h.hooks.some(
              (hh) => hh.command && hh.command.includes("notify.js"),
            ),
        );
        if (!hasHook) {
          settings.hooks[event].push(...hookList);
          changed = true;
        }
      }
    }

    if (changed) {
      try {
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2),
          "utf8",
        );
        console.log("[CCPet] 已自动配置 Claude Code hooks");
      } catch (e) {
        console.error("[CCPet] 配置 hooks 失败:", e.message);
      }
    }
  }

  // ─── HTTP 状态接收服务器 ─────────────────────────
  function startHttpServer() {
    httpServer = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === "GET" && req.url === "/status") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({ status: currentStatus, message: statusMessage }),
        );
        return;
      }

      if (req.method === "POST" && req.url === "/status") {
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const { status, message } = data;
            if (Object.values(STATUS).includes(status)) {
              pushStatus(status, message || "");
              res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ ok: true }));
            } else {
              res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ error: "Invalid status" }));
            }
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    httpServer.listen(PORT, "127.0.0.1", () => {
      console.log(`[CCPet] 状态服务已启动: http://127.0.0.1:${PORT}`);
    });
  }

  // ─── IPC 事件 ────────────────────────────────────

  ipcMain.on("set-ignore-mouse", (event, ignore) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(ignore ? false : false);
    }
  });

  ipcMain.handle("get-window-position", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.getPosition();
    }
    return [0, 0];
  });

  ipcMain.on("set-window-position", (event, { x, y }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds({ x, y, width: WIN_W, height: WIN_H }, false);
    }
  });

  ipcMain.on("toggle-always-on-top", (event, flag) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(flag, "screen-saver");
    }
  });

  // ─── 宠物导入与管理 ───────────────────────────────

  ipcMain.handle("import-pet-zip", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "导入宠物包",
      filters: [{ name: "宠物包", extensions: ["zip"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const zipPath = result.filePaths[0];
    try {
      const zip = new AdmZip(zipPath);

      let petJsonEntry = zip.getEntry("pet.json");
      let entries = zip.getEntries();

      if (!petJsonEntry) {
        for (const entry of entries) {
          if (entry.entryName.endsWith("pet.json") && !entry.entryName.startsWith("__MACOSX")) {
            petJsonEntry = entry;
            break;
          }
        }
      }

      if (!petJsonEntry) {
        throw new Error("zip 中未找到 pet.json");
      }

      const manifest = JSON.parse(petJsonEntry.getData().toString("utf8"));
      const destDir = path.join(getPetsDir(), manifest.id);

      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
      fs.mkdirSync(destDir, { recursive: true });

      for (const entry of entries) {
        if (entry.isDirectory || entry.entryName.startsWith("__MACOSX")) continue;
        const name = entry.entryName;
        const slashIdx = name.indexOf("/");
        const relative = slashIdx >= 0 ? name.substring(slashIdx + 1) : name;
        if (!relative) continue;
        const outPath = path.join(destDir, relative);
        const parent = path.dirname(outPath);
        fs.mkdirSync(parent, { recursive: true });
        fs.writeFileSync(outPath, entry.getData());
      }

      setCurrentPetId(manifest.id);
      console.log(`[CCPet] 导入宠物: ${manifest.displayName} (${manifest.id})`);
      return manifest;
    } catch (e) {
      console.error("[CCPet] 导入宠物失败:", e.message);
      throw e;
    }
  });

  ipcMain.handle("list-pets", () => {
    try {
      const dir = getPetsDir();
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const pets = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const petJson = path.join(dir, entry.name, "pet.json");
        if (fs.existsSync(petJson)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(petJson, "utf8"));
            pets.push(manifest);
          } catch (e) {
            console.warn(`[CCPet] 跳过无效宠物: ${entry.name}`);
          }
        }
      }
      return pets;
    } catch (e) {
      console.error("[CCPet] 列出宠物失败:", e.message);
      return [];
    }
  });

  ipcMain.handle("get-pet-dir", (event, petId) => {
    const dir = path.join(getPetsDir(), petId);
    if (!fs.existsSync(dir)) {
      throw new Error(`宠物不存在: ${petId}`);
    }
    return dir;
  });

  ipcMain.handle("get-current-pet-id", () => {
    return getCurrentPetId();
  });

  ipcMain.on("set-current-pet-id", (event, petId) => {
    setCurrentPetId(petId);
  });

  // ─── 应用生命周期 ────────────────────────────────
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration();

  app.whenReady().then(() => {
    createWindow();
    startHttpServer();
    autoConfigHooks();
  });

  app.on("window-all-closed", () => {
    if (httpServer) httpServer.close();
    if (completedTimer) clearTimeout(completedTimer);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
} // end startApp
