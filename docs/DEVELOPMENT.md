# Development notes

How PaperCard is put together, how to work on it, and what to watch out for when a site changes its markup.

## Setup

1. Clone the repo and open `chrome://extensions`.
2. Turn on **Developer mode**, click **Load unpacked**, and pick the repo folder.
3. After editing, click the reload icon on the extension card, then refresh the site you're testing.

No build step is needed to run the extension. Node is only used for tests and packaging.

## Project structure

- `manifest.json`: Chrome extension manifest.
- `_locales/`: English and Simplified Chinese strings for the manifest and all UI.
- `src/background.js`: Selection context menu registration, page script injection, and a CORS-free image fetch for allowed media hosts.
- `src/content.js`: X/Twitter and Reddit DOM integration, image hydration, clipboard copy, and the result toast.
- `src/renderer.js`: Canvas card renderer (all templates) shared by the content script and the options-page live preview.
- `src/platforms.js`: Post extractors for Bluesky, Threads, Instagram, Weibo, Zhihu and Xiaohongshu.
- `src/core.js`: Pure tweet normalization and card HTML helpers.
- `src/styles.css`: Injected menu, toast, and card styles.
- `tests/core.test.js`: Node tests for the pure helpers.

## Development

Run tests:

```bash
npm test
```

Run syntax checks:

```bash
npm run check:syntax
```

## Chrome Web Store release

- Release version: `1.3.0`.
- Store listing copy, privacy answers, screenshots, icons, and promotional images are prepared in `store/listing.md` and `store/images/`.
- The upload ZIP contains only `manifest.json`, `src/`, and `icons/`. Upload the listing images separately in the Chrome Web Store dashboard.
- Content scripts run automatically on the supported social sites (X, Reddit, Bluesky, Threads, Instagram, Weibo, Zhihu, Xiaohongshu). On any other page, the scripts are injected only after `Copy selection as image` or the keyboard shortcut is used.
- Every permission and host permission is justified in `store/listing.md` (Privacy practices tab). Keep that table in sync with `manifest.json`.
- X/Twitter changes its DOM often. If the share menu or tweet layout changes, `src/content.js` selectors may need adjustment.
- Selectors in `src/platforms.js` were checked against each site's live DOM in September 2026. LinkedIn, Jike and Douban were left out because their content is behind a login wall and couldn't be verified.
- Weibo's image CDN requires a weibo.com Referer, so the background worker adds one to its own requests to `sinaimg.cn` via a session `declarativeNetRequest` rule scoped to non-tab requests.
- Reddit support targets the current reddit.com ("shreddit") UI. Its share menu lives in shadow DOM, so the extension records the post when its Share button is clicked and scans nearby shadow roots for the menu. old.reddit.com is not supported.

Build the 1.3.0 upload package for the Web Store:

```bash
npm run package
```
