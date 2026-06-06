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
  Notification: "waiting",
  Elicitation: "waiting",
  SubagentStart: "running",
  SubagentStop: "running",
  PreCompact: "running",
  PostCompact: "running",
  WorktreeCreate: "running",
};

let done = false;

// 从 stdin 读取 JSON payload
let inputData = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (inputData += chunk));
process.stdin.on("end", () => {
  if (done) return;
  done = true;
  processEvent();
});

// 超时回退：stdin 2秒内没关闭就直接处理（防止 Claude Code 不关闭 stdin 导致卡住）
setTimeout(() => {
  if (done) return;
  done = true;
  processEvent();
}, 2000);

function processEvent() {
  // 事件名从 argv[2] 获取，没有则尝试从 stdin JSON 的 type 字段获取
  let event = process.argv[2] || "";
  let payload = {};

  try {
    payload = JSON.parse(inputData);
  } catch (e) {
    // stdin 无数据或非 JSON
  }

  // 如果 argv 没有事件名，从 payload 里取
  if (!event) {
    event = payload.type || payload.hook_event_type || "";
  }

  const baseStatus = EVENT_TO_STATUS[event];

  // 未知事件 → 默认 running（安全兜底，避免什么都不显示）
  if (!baseStatus) {
    sendStatus("running", "");
    return;
  }

  // ── Stop 事件特殊处理 ──
  if (event === "Stop") {
    if (payload.stop_hook_active === true) {
      sendStatus("running", "");
      return;
    }
    const bgCount = Array.isArray(payload.background_tasks) ? payload.background_tasks.length : 0;
    const cronCount = Array.isArray(payload.session_crons) ? payload.session_crons.length : 0;
    if (bgCount > 0 || cronCount > 0) {
      sendStatus("running", "");
      return;
    }
    sendStatus("completed", "");
    return;
  }

  // ── Notification 事件 ──
  if (event === "Notification") {
    const message = payload.message || "有操作需要你的确认";
    sendStatus("waiting", message);
    return;
  }

  // ── 其他事件 ──
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
