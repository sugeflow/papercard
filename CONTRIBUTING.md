# Contributing to PaperCard

Thanks for helping! PaperCard is small on purpose, so the most useful contributions are focused ones.

## Reporting a bug

Sites change their markup often, and that's the most common reason PaperCard stops working on a site. When you [open a bug report](https://github.com/sugeflow/papercard/issues/new?template=bug_report.yml), please include:

- the site and a link to a public post that fails,
- what you clicked (Share menu, right-click, shortcut),
- a screenshot of the card or the error toast,
- your browser and PaperCard version.

## Asking for a new site

Use the [site request form](https://github.com/sugeflow/papercard/issues/new?template=site_request.yml). Sites whose posts are readable without logging in are the easiest to support and test.

## Pull requests

1. Fork the repo and create a branch.
2. Load the folder in `chrome://extensions` with **Load unpacked** and test on the real site.
3. Run the checks:

   ```bash
   npm test
   npm run check:syntax
   ```

4. Keep the change focused and describe how you tested it.

Where things live:

- **New site:** add an adapter to `src/platforms.js`, its URL to `manifest.json` (`content_scripts.matches`) and `src/background.js` (`POST_SITE_PATTERNS`), and its image CDN to `host_permissions` and `FETCHABLE_IMAGE_HOSTS`.
- **Card layout and styles:** `src/renderer.js`.
- **Text:** both `_locales/en/messages.json` and `_locales/zh_CN/messages.json`.

More detail is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Privacy

PaperCard never sends post content anywhere. Please keep it that way: no analytics, remote code or third-party requests beyond fetching a post's own images.
