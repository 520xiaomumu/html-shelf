# 页架（html-shelf）

把本地 HTML 文件当应用来分类、启动；顺带一个够用的 Chromium 浏览器（打开网页、播视频、语音通话）。

产品合同见 [GOALS.md](GOALS.md)。实现与验收以该文档为准。

## 这是什么

页架的主界面是 HTML 应用库，不是浏览器新标签页的附件。单击卡片像打开 App：独立窗或专注视图，地址栏默认可收起。分类要轻（一层嵌套 + 标签 + 搜索），支持拖入文件或文件夹。

## v1 范围（桌面）

当前必须交付的是桌面 v1：Electron（嵌入 Chromium），Linux / Windows / macOS 能构建，云电脑 Ubuntu + X11 能验收。

做：本地 HTML 库（扫描、分类、搜索、独立 persist）、够用的多标签浏览、HTML5 音视频、页面内 WebRTC、本机 unpacked / .crx 扩展加载。

不做：自研渲染引擎、Chrome 账号同步、密码管理器、自研广告拦截、iOS Chrome 插件、把第三方网站打包上架、对外监听。

Chrome 网上应用店一键安装属于 **v2**，v1 不假装已支持。iOS 永久无 Chrome 插件。

## 在 Linux 上运行

需要较新的 Node 运行时（建议 20 及以上）和包管理器。
Linux 桌面还需常见图形库；云电脑 Ubuntu + X11 一般已具备。缺库时按 Electron 官方 Linux 依赖列表补齐。

在仓库根目录：

    npm install
    npm start

云电脑验收要求窗口能出来。应用尚未实现时，上述命令会随桌面 v1 代码一并补齐。

## 演示素材

`examples/` 里有 3 个小 HTML（工具、游戏占位、实验页），供扫库、分类、搜索演示。不要用它们当成品应用。

## 许可

MIT，版权 2026 520xiaomumu。
