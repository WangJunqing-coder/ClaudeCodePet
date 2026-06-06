// CCPet Claude Code Hook 通知脚本
// 参考 clawd-on-desk 的状态映射逻辑
// Claude Code 通过 argv[2] 传入事件名，stdin 传入 JSON payload

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 31126;

// ── 事件 → 状态映射（参考 clawd-on-desk） ──
// Stop ≠ 完成！Stop 只是"本轮响应结束"，Claude 可能还在继续工作
const EVENT_TO_STATUS = {
  SessionStart: "idle",
  SessionEnd: "idle",
  UserPromptSubmit: "running",    // 用户发消息 → 开始思考
  PreToolUse: "running",          // 工具调用前 → 正在工作
  PostToolUse: "running",         // 工具调用后 → 正在工作
  PostToolUseFailure: "error",
  Stop: "waiting",                // 本轮结束 ≠ 任务完成，只是"需要注意"
  StopFailure: "error",
  Notification: "waiting",        // 需要用户确认
  Elicitation: "waiting",
  SubagentStart: "running",
  SubagentStop: "running",
  PreCompact: "running",
  PostCompact: "running",
  WorktreeCreate: "running",
};

// 从 stdin 读取 JSON payload
let inputData = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (inputData += chunk));
process.stdin.on("end", () => {
  // 事件名从 argv[2] 获取（Claude Code hook 规范）
  const event = process.argv[2] || "Stop";

  let payload = {};
  try {
    payload = JSON.parse(inputData);
  } catch (e) {
    // stdin 无数据或非 JSON
  }

  const baseStatus = EVENT_TO_STATUS[event];
  if (!baseStatus) return; // 未知事件，忽略

  // ── Stop 事件特殊处理：判断是否真正完成 ──
  if (event === "Stop") {
    // 有 stop_hook_active → Claude 还在继续，不是真正完成
    if (payload.stop_hook_active === true) {
      sendStatus("running", "");
      return;
    }
    // 有后台任务或 cron → 还没完成
    const bgCount = Array.isArray(payload.background_tasks) ? payload.background_tasks.length : 0;
    const cronCount = Array.isArray(payload.session_crons) ? payload.session_crons.length : 0;
    if (bgCount > 0 || cronCount > 0) {
      sendStatus("running", "");
      return;
    }
    // 真正完成
    sendStatus("completed", "");
    return;
  }

  // ── Notification 事件：带消息内容 ──
  if (event === "Notification") {
    const message = payload.message || "有操作需要你的确认";
    sendStatus("waiting", message);
    return;
  }

  // ── 其他事件 ──
  sendStatus(baseStatus, "");
});

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

  req.on("error", () => {
    // CCPet 未运行时静默忽略
  });

  req.write(data, "utf8");
  req.end();
}
