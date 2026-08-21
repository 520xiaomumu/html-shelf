# 页架（html-shelf）

把本地 HTML 文件当应用来分类、启动；顺带一个够用的 Chromium 浏览器（打开网页、播视频、页面里的 WebRTC）。

**产品合同**见 [GOALS.md](GOALS.md)。实现、分期、演示验收都以该文档为准；代码与合同冲突时改代码。

## 这是什么

主界面是 HTML **应用库**，不是浏览器新标签页的附件。单击卡片像打开 App：独立应用窗（地址栏默认收起，可展开）或普通浏览器标签。分类轻量（最多一层子分类 + 标签 + 搜索），支持菜单添加和拖入文件/文件夹。

## v1 范围（桌面）

当前交付的是桌面 v1：Electron（嵌入 Chromium）。Linux / Windows / macOS 能构建；云电脑 **Ubuntu + X11** 必须能跑起来验收。

做：

- 本地 HTML 库：添加文件、添加文件夹（扫描 `.html` / `.htm` 成独立条目）、分类、标签、搜索、按最近打开或名称排序、封面、重命名、从库移除（不删磁盘文件）、打开方式（应用窗 / 标签）
- 每个条目独立 persist 分区，localStorage / cookie 不串
- 相对 CSS/JS 能加载；页面只能读已加入库的那个文件及其目录
- 多标签浏览：地址栏、后退/前进/刷新、**主页始终回库**、缩放、新标签打开 URL、窗口全屏
- HTML5 音视频（含全屏）；`getUserMedia` 权限提示可走通，无设备时页面给出明确失败，不白屏
- 设置页加载本机 **unpacked** 扩展；若本 Electron 允许则导入 `.crx`；启用/停用/卸载

明确不做：自研渲染引擎或 fork Chromium、Chrome 账号同步、密码管理器、自研广告拦截、iOS Chrome 插件、把第三方网站打包上架、把本地服务绑到 `0.0.0.0`、对外远程调试。

**Chrome 网上应用店一键安装属于 v2。** 当前 Electron 无法从商店直接安装扩展，v1 不会假装已支持。请用本机 unpacked 目录或导入 `.crx`。iOS 永久无 Chrome 插件。

## 在 Linux（Ubuntu / X11）上运行

需要 **Node.js 20+**（建议 20 或 22）和 npm。桌面会话需要 X11（或兼容的显示服务）。缺图形库时按 Electron 官方 Linux 依赖补齐，例如：

```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
  xdg-utils libatspi2.0-0 libsecret-1-0 libgbm1 libasound2
```

在仓库根目录：

```bash
npm install
npm test
npm start
```

`npm test` 必须全绿（文件夹扫描、一层分类约束、persist 键按条目 id 隔离）。`npm start` 应弹出页架窗口。第一次启动若尚未缓存 Electron 二进制，会先下载再出窗。

库 JSON 写在 Electron **userData**（Linux 上一般是 `~/.config/html-shelf/library.json`），重启后还在。不要把 userData 或密钥提交进 git。

## 建议演示路径

1. 「添加文件夹」扫入仓库里的 `examples/`（或把该文件夹拖进窗口），再按「工具 / 游戏 / 实验」分成至少两类。文件名会尽量自动归类，也可在卡片「编辑」里改。
2. 搜索一个标题，单击卡片：约 1 秒内打开**应用窗**；相对 `common.css` / 同目录 JS 应能加载。
3. 关掉应用再 `npm start`，库还在。再开另一个条目，确认便签等 localStorage 不串。
4. 用顶栏「新标签打开网址」或浏览窗地址栏打开可播视频页，例如  
   `https://interactive-examples.mdn.mozilla.net/pages/tabbed/video.html`
5. 打开「媒体实验」，申请摄像头/麦克风：有权限对话框；无设备或拒绝时页面显示失败原因，不是白屏。
6. 设置 → 扩展 → 加载 unpacked，选 `fixtures/sample-extension`。再到普通网页标签：角标「页架示例扩展已加载」，或设置里显示已启用。

## 安全

- 任何本地 HTTP/WS（若以后需要）只绑 `127.0.0.1`，禁止 `0.0.0.0`
- 本地 HTML：`nodeIntegration: false`，不向页面暴露 Node / 文件系统 / shell
- 自定义协议只映射已批准条目的目录，拒绝路径穿越

## 许可

MIT，版权 2026 520xiaomumu。
