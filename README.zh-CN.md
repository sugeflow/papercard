<div align="center">

<img src="store/images/icon-512.png" alt="PaperCard 图标" width="96" height="96">

# PaperCard

**一键把推文、Reddit 帖子和任意网页文字，变成好看的图片卡片。**

免费开源的 Chrome 扩展：把 X（推特）、Reddit、Threads、Instagram、Bluesky、微博、知乎、小红书上的帖子，生成书页风格的 PNG 卡片，直接复制到剪贴板。无水印、无需注册，所有内容都在本地生成。

[![License: MIT](https://img.shields.io/badge/License-MIT-d9480f.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-1c1917.svg)](manifest.json)
[![最新版本](https://img.shields.io/github/v/release/sugeflow/papercard?color=1c1917&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC)](https://github.com/sugeflow/papercard/releases/latest)
[![GitHub stars](https://img.shields.io/github/stars/sugeflow/papercard?style=social)](https://github.com/sugeflow/papercard/stargazers)

[English](README.md) · 简体中文

<img src="store/images/screenshot-1-hero.png" alt="PaperCard 把 X 帖子、Reddit 帖子和网页金句变成图片卡片" width="820">

</div>

## PaperCard 是什么？

PaperCard 是一个把社交媒体帖子转成分享图的 Chrome 扩展。它会在 X 和 Reddit 的「分享」菜单里加一个「复制为图片」，在另外六个网站的右键菜单里加一个「将帖子复制为图片」。点一下，帖子的作者、正文、配图、日期和点赞数会在你的浏览器里排成一张精美卡片，并自动复制到剪贴板——直接粘贴到微信、飞书、PPT、公众号或朋友圈。

比「截图 + 裁剪」干净，也比在线「推文转图片」网站更私密：帖子内容从不离开你的浏览器。

## 功能亮点

- **点一下就在剪贴板里**：<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>V</kbd> 直接粘贴，也可以下载 PNG。
- **8 个平台 + 任意网页**：X / 推特、Reddit、Threads、Instagram、Bluesky、微博、知乎、小红书；其他网站选中文字右键即可生成金句卡。
- **只摘一句话**：在帖子里划选一句，生成保留作者、日期和链接的金句卡。
- **整串推文**：把同一作者的推文串合成一张卡片。
- **4 种风格 × 深浅色**：纸张、极简、杂志、渐变。
- **适配各平台尺寸**：自适应、1:1、4:5（小红书、Instagram）、9:16（快拍）。
- **底部信息自己选**：日期、点赞、转发、回复、浏览、收藏、赞同、评论，可选二维码直达原帖，作者旁可显示平台 Logo。
- **高清导出**：统一 2 倍图（1440 px 宽），手机上看也清晰。
- **中文排版优化**：标点避头尾，中英混排自然。
- **隐私优先**：没有服务器、没有统计、没有账号；MIT 开源，每一行代码都可以检查。

## 截图

| 分享菜单 | Reddit |
| --- | --- |
| <img src="store/images/screenshot-2-share-menu.png" alt="X 分享菜单里的复制为图片" width="420"> | <img src="store/images/screenshot-3-reddit.png" alt="Reddit 帖子生成的书页风格卡片" width="420"> |
| **任意网页** | **自定义** |
| <img src="store/images/screenshot-4-any-webpage.png" alt="在网页上选中文字生成金句卡" width="420"> | <img src="store/images/screenshot-5-customize.png" alt="深浅色主题、底部信息和二维码设置" width="420"> |

## 支持的网站

| 网站 | 分享菜单 | 帖子右键 | 卡片内容 |
| --- | :---: | :---: | --- |
| X / 推特 | ✅ | ✅ | 作者、正文、图片、推文串、回复 / 转发 / 点赞 / 书签 / 浏览 |
| Reddit | ✅ | ✅ | 版块、作者、标题、正文、图片、赞数、评论数 |
| Threads | | ✅ | 作者、正文、图片、点赞 / 回复 / 转发 |
| Instagram | | ✅ | 作者、文案、图片、点赞 / 评论 |
| Bluesky | | ✅ | 作者、正文、图片、回复 / 转发 / 点赞 |
| 微博 | | ✅ | 作者、正文、图片、转发 / 评论 / 点赞 |
| 知乎 | | ✅ | 问题标题、回答、赞同、评论 |
| 小红书 | | ✅ | 作者、标题、笔记正文、图片、点赞 / 收藏 / 评论 |
| 其他任意网站 | | 选中文字 → 右键 | 选中的文字、网站名、日期和链接 |

## 安装

**从 GitHub 安装（现在就能用）：**

1. 在 [最新版本](https://github.com/sugeflow/papercard/releases/latest) 下载 `papercard.zip` 并解压。
2. 打开 `chrome://extensions`，打开右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择解压后的文件夹。

支持 Chrome、Edge、Brave、Arc 等 Chromium 内核浏览器。

## 使用方法

1. **X / Reddit**：点帖子的「分享」→「复制为图片」。
2. **其他支持的网站**：在帖子上点右键 →「将帖子复制为图片」。
3. **任意网页**：选中文字 → 右键 →「将选中文字复制为图片」。
4. **快捷键**：选中文字或把鼠标停在帖子上，按 <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>。

图片会立刻复制好。弹出的提示里点「调整」可以换风格、主题和尺寸（改完自动重新复制），点「下载」保存 PNG。默认设置在扩展的设置页里修改。

## 常见问题

**怎么把推文转成图片？**
安装 PaperCard 后，在 x.com 打开推文的「分享」菜单，选择「复制为图片」，卡片就复制到剪贴板了，直接粘贴即可。

**怎么给 Reddit 帖子截一张干净的图？**
在 reddit.com 点帖子的「分享」→「复制为图片」。卡片只保留版块、作者、标题、正文、图片和赞数，没有侧边栏、广告和评论框。

**免费吗？有水印吗？**
免费，MIT 开源，没有水印。「Made with PaperCard」署名默认关闭。

**会上传我的数据吗？**
不会。卡片在浏览器里用 Canvas 绘制；扩展只会从平台的图片服务器下载这条帖子的图片和头像，用来画进卡片。详见 [隐私政策](store/privacy.html)。

**能把文章里的一段话做成金句卡吗？**
可以。在任意网页选中文字，右键选择「将选中文字复制为图片」，卡片会带上网站名、日期，还可以加上回到原页面的二维码。

**支持哪些尺寸？**
自适应（按内容高度）、1:1、4:5、9:16，统一导出 1440 px 宽。

**支持旧版 Reddit、LinkedIn 或 Facebook 吗？**
暂时不支持，目前适配的是新版 reddit.com。想要支持别的网站？[提一个网站需求](https://github.com/sugeflow/papercard/issues/new?template=site_request.yml)。

## 参与贡献

欢迎提 Bug、网站需求和 Pull Request。各个网站经常改版，带截图的「今天在 X 上失效了」反馈特别有帮助。详见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [开发说明](docs/DEVELOPMENT.md)。

```bash
git clone https://github.com/sugeflow/papercard.git
cd papercard
npm test
```

## 支持这个项目

如果 PaperCard 帮你省了几次截图：

- ⭐ **给仓库点个 Star**，这是让更多人发现它最简单的方式。
- 👤 **关注 [@sugeflow](https://github.com/sugeflow)**，获取更多小而好用的工具。
- 🗣️ 分享你做的卡片时顺手提一句 PaperCard。

## 开源协议

[MIT](LICENSE) © Suge（[sugeflow.com](https://sugeflow.com)）

PaperCard 是独立项目，与 X Corp.、Reddit, Inc.、Meta、Bluesky、新浪微博、知乎、小红书均无关联。平台 Logo 来自 [Simple Icons](https://simpleicons.org)（CC0），商标归各自所有者。
