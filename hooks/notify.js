// CCPet Claude Code Hook 通知脚本
// Claude Code 通过 stdin 传入 hook 事件 JSON，脚本将其映射为宠物状态并推送给 CCPet

const http = require("http");

const PORT = 31126;

// hook event_type → 宠物状态映射
const EVENT_TO_STATUS = {
  PostToolUse: "running",
  Stop: "completed",
  Notification: "waiting",
};

// 从 stdin 读取 hook 事件数据
let inputData = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (inputData += chunk));
process.stdin.on("end", () => {
  let eventType = "Stop";
  let message = "";

  try {
    const event = JSON.parse(inputData);
    eventType = event.type || event.hook_event_type || "Stop";

    // Notification 事件携带 message 字段（Claude Code 需要确认时的内容）
    if (event.message) {
      message = event.message;
    }
    // Stop 事件可能携带 stop_hook_active_reason
    if (event.stop_hook_active_reason) {
      message = event.stop_hook_active_reason;
    }
  } catch (e) {
    // stdin 无数据或非 JSON，使用默认值
  }

  const status = EVENT_TO_STATUS[eventType] || "running";
  sendStatus(status, message);
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
    (res) => {
      // 成功，静默退出
    },
  );

  req.on("error", () => {
    // CCPet 未运行时静默忽略
  });

  req.write(data, "utf8");
  req.end();
}

// 超时保护：如果 stdin 3 秒内没有关闭，直接用 argv 参数发送
setTimeout(() => {
  if (!inputData) {
    const status = process.argv[2] || "running";
    const message = process.argv[3] || "";
    sendStatus(status, message);
  }
}, 3000);
