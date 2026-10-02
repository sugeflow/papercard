const CONTEXT_MENU_ID = "tsi-create-selection-card";
const POST_MENU_ID = "tsi-create-post-card";
const CREATE_SELECTION_CARD_MESSAGE = "tsi:create-selection-card";
const CREATE_POST_CARD_MESSAGE = "tsi:create-post-card";
const SHORTCUT_MESSAGE = "tsi:shortcut";
// Sites with a post extractor (content.js for X/Reddit, platforms.js for the rest).
const POST_SITE_PATTERNS = [
  "https://x.com/*",
  "https://twitter.com/*",
  "https://www.reddit.com/*",
  "https://reddit.com/*",
  "https://bsky.app/*",
  "https://www.threads.com/*",
  "https://www.threads.net/*",
  "https://www.instagram.com/*",
  "https://weibo.com/*",
  "https://www.weibo.com/*",
  "https://www.zhihu.com/*",
  "https://zhuanlan.zhihu.com/*",
  "https://www.xiaohongshu.com/*"
];
const FETCH_IMAGE_MESSAGE = "tsi:fetch-image";
const INJECTED_FILES = ["src/core.js", "src/qrcode.js", "src/renderer.js", "src/platforms.js", "src/content.js"];
const INJECTED_CSS = ["src/styles.css"];
// Keep in sync with the media hosts in manifest.json host_permissions.
const FETCHABLE_IMAGE_HOSTS = [
  /(^|\.)twimg\.com$/,
  /(^|\.)redd\.it$/,
  /(^|\.)redditmedia\.com$/,
  /(^|\.)redditstatic\.com$/,
  /(^|\.)bsky\.app$/,
  /(^|\.)cdninstagram\.com$/,
  /(^|\.)fbcdn\.net$/,
  /(^|\.)sinaimg\.cn$/,
  /(^|\.)zhimg\.com$/,
  /(^|\.)xhscdn\.com$/
];

const SELECTION_COMMAND = "create-selection-card";

// Weibo's image CDN only serves pictures to requests that come from weibo.com
// and sends no CORS headers, so the page can't read them either. Add the
// Referer to the extension's own background fetches (tabId -1) only.
const REFERER_RULES = [{ id: 1, domain: "sinaimg.cn", referer: "https://weibo.com/" }];

function installRefererRules() {
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: REFERER_RULES.map((rule) => rule.id),
    addRules: REFERER_RULES.map((rule) => ({
      id: rule.id,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "referer", operation: "set", value: rule.referer }]
      },
      condition: {
        requestDomains: [rule.domain],
        tabIds: [chrome.tabs.TAB_ID_NONE],
        resourceTypes: ["xmlhttprequest", "other"]
      }
    }))
  });
}

installRefererRules();

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: chrome.i18n.getMessage("contextMenuCreateCard") || "Copy selection as image",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: POST_MENU_ID,
      title: chrome.i18n.getMessage("contextMenuPostCard") || "Copy post as image",
      contexts: ["page", "image", "link", "video"],
      documentUrlPatterns: POST_SITE_PATTERNS
    });
  });

  // First run lands on the options page, which doubles as a quick-start guide.
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === CONTEXT_MENU_ID) {
    sendToPage(tab.id, { type: CREATE_SELECTION_CARD_MESSAGE, selectionText: info.selectionText || "" });
  } else if (info.menuItemId === POST_MENU_ID) {
    sendToPage(tab.id, { type: CREATE_POST_CARD_MESSAGE });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== SELECTION_COMMAND) return;
  const target = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (target && target.id) sendToPage(target.id, { type: SHORTCUT_MESSAGE });
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function sendToPage(tabId, message) {
  try {
    await ensureContentScript(tabId);
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // chrome://, the Web Store and PDF viewers block injection. Tell the user
    // through the badge instead of failing silently.
    console.warn("[PaperCard] Can't create a card on this page", error);
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#b42318" });
    chrome.action.setBadgeText({ tabId, text: "!" });
    chrome.action.setTitle({
      tabId,
      title: chrome.i18n.getMessage("unsupportedPage") || "PaperCard can't run on this page."
    });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 4000);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== FETCH_IMAGE_MESSAGE) return false;

  fetchImageAsDataUrl(message.url)
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((error) => sendResponse({ ok: false, error: String(error && error.message ? error.message : error) }));

  return true;
});

async function ensureContentScript(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: INJECTED_CSS
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: INJECTED_FILES
  });
}

async function fetchImageAsDataUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !FETCHABLE_IMAGE_HOSTS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new Error(`Image host not allowed: ${parsed.hostname}`);
  }

  // No referrer by default; Weibo's CDN gets its Referer from REFERER_RULES.
  const response = await fetch(parsed.toString(), { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);

  const contentType = response.headers.get("content-type") || "image/png";
  if (!contentType.startsWith("image/")) throw new Error(`Not an image: ${contentType}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
