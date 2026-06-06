// CCPet Claude Code Hook 通知脚本
// 参考 clawd-on-desk 的状态映射逻辑
// Claude Code 通过 argv[2] 传入事件名，stdin 传入 JSON payload

const http = require("http");

const PORT = 31126;

// ── 事件 → 状态映射（参考 clawd-on-desk） ──
const EVENT_TO_STATUS = {
  SessionStart: "idle",
  SessionEnd: "idle",
  UserPromptSubmit: "running",
  PreToolUse: "running",
  PostToolUse: "running",
  PostToolUseFailure: "error",
  Stop: "waiting",
  StopFailure: "error",
  Notification: "running",
  Elicitation: "waiting",
  SubagentStart: "running",
  SubagentStop: "running",
  PreCompact: "running",
  PostCompact: "running",
  WorktreeCreate: "running",
};

// 旧格式兼容：直接传了 status 而非事件名
const LEGACY_STATUS = new Set(["idle", "running", "waiting", "completed", "error"]);

let done = false;
let inputData = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (inputData += chunk));
process.stdin.on("end", () => {
  if (done) return;
  done = true;
  processEvent();
});

// 超时回退：stdin 2 秒内没关闭就直接处理
setTimeout(() => {
  if (done) return;
  done = true;
  processEvent();
}, 2000);

function processEvent() {
  const argv2 = process.argv[2] || "";

  let payload = {};
  try {
    payload = JSON.parse(inputData);
  } catch (e) {}

  // ── 旧格式兼容：argv[2] 直接是 status（running/completed/error） ──
  if (LEGACY_STATUS.has(argv2)) {
    const message = process.argv[3] || "";
    sendStatus(argv2, message);
    return;
  }

  // ── 新格式：argv[2] 是事件名 ──
  let event = argv2;
  if (!event) {
    event = payload.type || payload.hook_event_type || "";
  }

  const baseStatus = EVENT_TO_STATUS[event];

  // 未知事件 → 默认 running（兜底）
  if (!baseStatus) {
    sendStatus("running", "");
    return;
  }

  // ── Stop 事件：判断是否真正完成 ──
  if (event === "Stop") {
    // 有后台任务或 cron → Claude 还在继续，不判定为完成
    const bgCount = Array.isArray(payload.background_tasks) ? payload.background_tasks.length : 0;
    const cronCount = Array.isArray(payload.session_crons) ? payload.session_crons.length : 0;
    if (bgCount > 0 || cronCount > 0) {
      sendStatus("running", "");
      return;
    }
    // 没有后续工作 → 任务完成
    sendStatus("completed", "");
    return;
  }

  // ── 其他事件（含 Notification）──
  sendStatus(baseStatus, "");
}

function sendStatus(status, message) {
  const data = JSON.stringify({ status, message });

  const req = http.request(
    {
      hostname: "127.0.0.1",
      port: PORT,
      path: "/status",
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(data, "utf8"),
      },
    },
    () => {},
  );

  req.on("error", () => {});
  req.write(data, "utf8");
  req.end();
}
