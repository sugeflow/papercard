# Chrome Web Store listing — PaperCard

## Store listing (English, default)

**Name** (manifest `name`, 41 chars)
PaperCard — Tweet & Reddit Post to Image

**Summary** (manifest `description`, 125/132 chars)
Turn X/Twitter posts, Reddit posts and any web text into beautiful image cards. One click, copied to clipboard. No watermark.

**Category**: Social & Communication
**Language**: English (add Chinese (Simplified) as a second localized listing, see below)

**Description**

```
Turn any post into a beautiful image — in one click.

PaperCard adds a "Copy as image" button to the share menu on X (Twitter) and Reddit. Click it and a clean, book-style image card of the post is copied straight to your clipboard. Paste it into a chat, a slide deck, your notes, or a new post. No screenshots, no cropping, no editing.

★ WORKS WHERE YOU READ
• X / Twitter — tweets with text, photos and stats
• Reddit — subreddit, author, title, body text, images, upvotes and comments
• Any website — select text, right-click, "Copy selection as image" to make a quote card with the site name and date

★ DESIGNED TO BE SHARED
• Warm, paper-like layout inspired by reading apps, with elegant serif typography
• Full-width photos; multiple images stacked cleanly
• Light and Dark themes
• Choose what goes in the footer: date, likes, reposts, views, upvotes, comments…
• Optional QR code that links back to the original post
• Great typography for English, Chinese and other CJK languages

★ FAST AND PRIVATE
• One click: the PNG is already in your clipboard, with a Download button if you'd rather save it
• No watermark, no account, no sign-up
• Cards are rendered locally in your browser. Nothing is uploaded to our servers, because we don't have any
• No tracking, no analytics, no ads

HOW TO USE
1. On X or Reddit, click the Share button on any post
2. Choose "Copy as image"
3. Paste anywhere (Ctrl/Cmd + V)

On any other website: select some text → right-click → "Copy selection as image".

Customize themes, footer stats and the QR code from the extension's Options page.

Perfect for tweet screenshots, Reddit screenshots, quote cards, social media posts, newsletters, presentations and saving the best things you read.

PaperCard is an independent project and is not affiliated with X Corp. or Reddit, Inc.
```

**Images** (in `store/images/`)

| Slot                        | File                           |
| --------------------------- | ------------------------------ |
| Store icon 128×128          | `store-icon-128.png`           |
| Screenshot 1                | `screenshot-1-hero.png`        |
| Screenshot 2                | `screenshot-2-share-menu.png`  |
| Screenshot 3                | `screenshot-3-reddit.png`      |
| Screenshot 4                | `screenshot-4-any-webpage.png` |
| Screenshot 5                | `screenshot-5-customize.png`   |
| Small promo tile 440×280    | `promo-small-440x280.png`      |
| Marquee promo tile 1400×560 | `promo-marquee-1400x560.png`   |

All sample posts in the images are fictional. Keep it that way: real people, logos or brand
marks in store images are a common reason for rejection.

---

## Localized listing — 中文（简体）

**名称**：PaperCard — 推文 & Reddit 帖子一键转图片

**简介**（≤132 字符）：把 X/推特、Reddit 帖子和任意网页文字，一键变成精美的图片卡片，自动复制到剪贴板，无水印。

**详细描述**

```
一键把好内容，变成一张好看的图片。

PaperCard 在 X（推特）和 Reddit 的「分享」菜单里加了一个「复制为图片」按钮。点一下，帖子就会生成一张书页风格的精美卡片，并自动复制到剪贴板——直接粘贴到微信、飞书、PPT、笔记或朋友圈。不用截图，不用裁剪，不用修图。

★ 支持的地方
• X / 推特：文字、图片、点赞/转发/浏览数
• Reddit：版块、作者、标题、正文、图片、赞数和评论数
• 任意网页：选中文字 → 右键「将选中文字复制为图片」，生成带网站名和日期的金句卡片

★ 为分享而设计
• 温暖的纸张质感 + 衬线字体，灵感来自读书 App 的书摘卡片
• 图片通栏展示，多图自动纵向排列
• 浅色 / 深色两种主题
• 底部信息自由选择：日期、点赞、转发、浏览、赞数、评论数……
• 可选二维码，扫码直达原帖
• 中文排版优化：标点避头尾，中英混排自然

★ 快速、私密
• 点一下就已在剪贴板，也可以一键下载 PNG
• 无水印、无需注册、无需登录
• 卡片完全在本地浏览器中生成，不上传任何数据
• 无追踪、无统计、无广告

使用方法
1. 在 X 或 Reddit 任意帖子上点击「分享」
2. 选择「复制为图片」
3. 在任意地方粘贴（Ctrl/Cmd + V）

在其他网站：选中文字 → 右键 →「将选中文字复制为图片」。

可在扩展的「选项」页面设置主题、底部信息和二维码。

PaperCard 为独立项目，与 X Corp. 及 Reddit, Inc. 无关联。
```

---

## Privacy practices tab (review form)

**Single purpose**
Turn a social post (X/Twitter, Reddit, Threads, Instagram, Bluesky, Weibo, Zhihu, Xiaohongshu) or text the user selects on any web page into a PNG image card, and copy it to the clipboard.

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `clipboardWrite` | Copies the generated PNG card to the clipboard when the user clicks "Copy as image", "Copy post as image" or "Copy selection as image", or presses the keyboard shortcut. |
| `contextMenus` | Adds "Copy post as image" (on supported social sites) and "Copy selection as image" (when text is selected) to the right-click menu. |
| `activeTab` | Lets the extension read the selected text on the current tab only after the user clicks the context menu item or presses the shortcut. |
| `scripting` | Injects the card renderer into the current tab after the user clicks "Copy selection as image" or presses the shortcut on a site that is not one of the supported social sites. |
| `storage` | Saves the user's card preferences (style, theme, size, footer fields, QR code, credit line) with `chrome.storage.sync`. |
| `declarativeNetRequestWithHostAccess` | Weibo's image CDN (`sinaimg.cn`) only serves images to requests with a weibo.com Referer. One session rule adds that Referer to the extension's own background image requests (tab ID -1). It never touches requests made by web pages. |
| Host permissions: post sites (x.com, twitter.com, reddit.com) | The content script adds the "Copy as image" item to the site's own Share menu and reads the post the user chose (author, text, images, date, like/reply counts). The social sites listed under Content scripts below are covered by the same content-script matches. |
| Host permissions: image CDNs (pbs.twimg.com, redd.it, redditmedia.com, redditstatic.com, cdn.bsky.app, cdninstagram.com, fbcdn.net, sinaimg.cn, zhimg.com, xhscdn.com) | Downloads the images and avatars of the post the user chose so they can be drawn into the card. These CDNs don't allow cross-origin reads from the page, so the extension's background worker fetches them. Requests go only to these hosts and only for the post being turned into a card. |

**Content scripts** run on x.com, twitter.com, reddit.com, bsky.app, threads.com / threads.net, instagram.com, weibo.com, zhihu.com and xiaohongshu.com. Their only job is to add the menu item and read the post the user acts on. Nothing is sent anywhere.

**Remote code**: No, the extension does not use remote code.

**Data usage**: Does not collect or transmit any user data. Tick none of the data categories, then tick all three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).
