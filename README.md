# 🐾 CCPet - Claude Code 桌面宠物

一个可爱的桌面宠物，实时感知 Claude Code 的工作状态，用生动的动画告诉你一切。

**认真摸鱼，工作交给CC，宠物帮你盯着**

无需任何配置，启动即用。当 Claude Code 需要确认时，宠物会闪烁提醒并发送系统通知，再也不用担心错过确认提示。

## ✨ 功能特性

- 🎮 **精灵图动画** — 基于 Codex Pet Standard 格式，9种动画状态
- 📡 **Claude Code 状态感知** — 实时显示 idle/running/waiting/completed/error 状态
- 🖱️ **拖拽移动** — 按住宠物拖到屏幕任意位置
- 💬 **气泡对话** — 点击宠物弹出随机语录或状态信息
- ✨ **粒子特效** — 点击时弹出爱心、星星、笑脸粒子
- 📌 **窗口置顶** — 始终在最上层，随时可见
- 🕐 **生物钟** — 长时间不操作会发呆、睡觉，鼠标移入自动唤醒
- 🎯 **右键菜单** — 快速切换动作、置顶、退出
- 🔔 **系统通知** — 关键状态变化时弹出系统通知

## 📸 状态展示

| Claude Code 状态 | 宠物动画 | 说明 |
|-----------------|---------|------|
| `idle` | 待机 | 等待中 |
| `running` | 奔跑 | 正在执行 |
| `waiting` | 等待 + 闪烁 | 需要确认 |
| `completed` | 跳跃 | 任务完成 |
| `error` | 失败 | 出现错误 |

## 🚀 快速开始

### 方式一：从源码运行

```bash
# 克隆项目
git clone <repo-url>
cd CCIsland

# 安装依赖
npm install

# 运行
npm start
```

### 方式二：打包为可执行文件

```bash
npm run build
```

打包产物在 `dist/` 目录。

## 📡 Claude Code 集成

### 自动配置（推荐）

启动 CCPet 后，会自动在 `~/.claude/settings.json` 中配置 hooks，无需手动设置。

### 手动调用 API

```bash
# 查看当前状态
curl http://127.0.0.1:31126/status

# 更新状态
curl -X POST http://127.0.0.1:31126/status \
  -H "Content-Type: application/json" \
  -d '{"status":"running","message":"正在处理..."}'
```

### 使用 Hook 脚本推送

```bash
node hooks/notify.js running "正在编译..."
node hooks/notify.js waiting "需要确认"
node hooks/notify.js completed "任务完成"
node hooks/notify.js error "出错了"
```

## 🎨 自定义宠物

支持替换精灵图，使用 Codex Pet Standard 格式：

```
spritesheet.webp  （8列×9行，每格 192×208 像素）
├── Row 0: idle（待机）
├── Row 1: running-right
├── Row 2: running-left
├── Row 3: waving（打招呼）
├── Row 4: jumping（跳跃）
├── Row 5: failed（失败）
├── Row 6: waiting（等待）
├── Row 7: running（奔跑）
└── Row 8: review（思考）
```

替换 `renderer/spritesheet.webp` 即可更换宠物形象。

下载更多宠物：[codexpet.xyz](https://codexpet.xyz/zh)

## 🎮 操作说明

| 操作 | 效果 |
|------|------|
| 左键点击 | 宠物打招呼，弹出粒子特效 |
| 按住拖拽 | 宠物跟着鼠标跑 |
| 右键菜单 | 打开功能菜单 |
| 长时间不操作 | 宠物发呆、思考、最后睡着 |
| 移动鼠标唤醒 | 宠物惊喜跳起 |

## 📁 项目结构

```
CCPet/
├── main.js              # Electron 主进程 + hooks 配置 + HTTP 服务
├── preload.js           # 安全 IPC 桥接
├── hooks/
│   └── notify.js        # Claude Code hooks 通知脚本
├── renderer/
│   ├── index.html       # 桌宠页面
│   ├── style.css        # 样式
│   ├── pet.js           # 宠物引擎
│   └── spritesheet.webp # 精灵图
├── assets/
│   └── create-icon.js   # 图标生成脚本
└── package.json
```

## ⚙️ 配置说明

### 开机自启动

将 CCPet 的快捷方式放入启动文件夹：

```
Win+R 输入: shell:startup
将快捷方式拖入打开的文件夹
```

### 修改端口

编辑 `main.js` 中的 `PORT` 常量：

```javascript
const PORT = 31126; // 修改为你想要的端口
```

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 开发模式
npm start

# 手动测试状态推送
curl -X POST http://127.0.0.1:31126/status -H "Content-Type: application/json" -d '{"status":"running"}'

# 打包
npm run build
```

## 📋 系统要求

- Windows 10/11 (64-bit)
- macOS / Linux（需自行构建）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [DesktopPet](https://github.com/Muxinlucky/DesktopPet) — 精灵图动画方案参考
- [Codex Pet Standard](https://codexpet.xyz) — 宠物精灵图格式标准
