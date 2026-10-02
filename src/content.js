(function initTwitterShareImage() {
  if (window.__TSI_CONTENT_READY) return;
  window.__TSI_CONTENT_READY = true;

  const core = window.TwitterShareImageCore || {};

  const MENU_ITEM_ID = "tsi-share-as-image";
  const CREATE_SELECTION_CARD_MESSAGE = "tsi:create-selection-card";
  const CREATE_POST_CARD_MESSAGE = "tsi:create-post-card";
  const SHORTCUT_MESSAGE = "tsi:shortcut";
  const FETCH_IMAGE_MESSAGE = "tsi:fetch-image";
  const IS_REDDIT =
    /(^|\.)reddit\.com$/i.test(location.hostname) || Boolean(document.querySelector("shreddit-app"));
  const IS_X = /(^|\.)(x|twitter)\.com$/i.test(location.hostname);
  const PLATFORM = (window.PaperCardPlatforms || []).find((platform) => platform.match(location.hostname)) || null;
  const TEMPLATE_ORDER = (core.TEMPLATES || ["paper"]).slice();
  const RATIO_ORDER = (core.RATIOS || ["auto"]).slice();
  const REDDIT_MENU_SELECTOR = '[role="menu"], faceplate-menu';
  const REDDIT_SHARE_MENU_PATTERN = /Copy link|Crosspost|Embed|复制链接|交叉发布|嵌入/i;
  const REDDIT_SHARE_LABEL_PATTERN = /^\s*(share|分享|共享)\b/i;
  const REDDIT_COPY_LINK_PATTERN = /^(Copy link|复制链接)$/i;
  const REDDIT_MENU_WATCH_MS = 4000;
  const REDDIT_MAX_MEDIA = 10;
  const MENU_SELECTOR = '[role="menu"]';
  const SHARE_BUTTON_SELECTOR =
    '[data-testid="share"], [aria-label*="Share"], [aria-label*="分享"], [aria-label*="共享"]';
  const SHOW_MORE_LABELS = ["Show more", "展开", "显示更多"];
  const DEFAULT_SETTINGS = core.DEFAULT_SHARE_SETTINGS || {
    theme: "light",
    footerFields: ["date", "likes", "upvotes"],
    showQrCode: false
  };
  const state = {
    lastShareArticle: null,
    lastPngBlob: null,
    lastCard: null,
    lastThread: null,
    lastTweetUrl: "",
    contextTarget: null,
    hoverTarget: null,
    redditMenuWatch: 0,
    toastTimer: 0,
    // The adjust panel stays open across re-renders once someone opens it.
    toastPanelOpen: false
  };

  // Remember what was right-clicked / hovered so the context menu item and the
  // keyboard shortcut know which post the user means.
  document.addEventListener("contextmenu", (event) => {
    state.contextTarget = event.composedPath()[0] || event.target;
  }, true);
  document.addEventListener("mouseover", (event) => {
    state.hoverTarget = event.target;
  }, true);

  document.addEventListener(
    "click",
    (event) => {
      if (IS_REDDIT) {
        rememberRedditShareClick(event);
        return;
      }
      if (!IS_X) return;

      const shareButton = event.target.closest(SHARE_BUTTON_SELECTOR);
      if (!shareButton) return;

      const article = shareButton.closest("article");
      if (article) state.lastShareArticle = article;
    },
    true
  );

  if (IS_X) {
    const observer = new MutationObserver(() => injectIntoOpenMenus());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    injectIntoOpenMenus();
  }
  registerRuntimeMessages();

  function registerRuntimeMessages() {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handlers = {
        [CREATE_SELECTION_CARD_MESSAGE]: () => handleSelectionShareCard(message.selectionText),
        [CREATE_POST_CARD_MESSAGE]: () => handlePostCard(state.contextTarget),
        [SHORTCUT_MESSAGE]: handleShortcut
      };
      const handler = message && handlers[message.type];
      if (!handler) return false;

      handler()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error("[PaperCard] Failed to create selected-text image", error);
          safeShowToast(t("toastFailed", "Couldn't create the image. Please try again."));
          sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
        });

      return true;
    });
  }

  function injectIntoOpenMenus() {
    for (const menu of document.querySelectorAll(MENU_SELECTOR)) {
      if (menu.querySelector(`#${MENU_ITEM_ID}`)) continue;
      if (!looksLikeShareMenu(menu)) continue;

      // Native rows live inside [data-testid="Dropdown"] and get their font,
      // padding and hover from X's own classes, so clone one instead of
      // appending a hand-styled button to the menu root.
      const reference = findXReferenceItem(menu);
      const item = (reference && cloneXMenuItem(reference)) || createMenuItem();
      if (reference) {
        reference.parentNode.insertBefore(item, reference.nextSibling);
      } else {
        (menu.querySelector('[data-testid="Dropdown"]') || menu).appendChild(item);
      }
    }
  }

  function findXReferenceItem(menu) {
    const items = [...menu.querySelectorAll('[role="menuitem"]')].filter((node) => node.id !== MENU_ITEM_ID);
    return items.find((node) => REDDIT_COPY_LINK_PATTERN.test(readText(node))) || items[items.length - 1] || null;
  }

  function cloneXMenuItem(reference) {
    const clone = reference.cloneNode(true);
    const label = [...clone.querySelectorAll("span")].find((node) => !node.children.length && readText(node));
    if (!label) return null;

    clone.id = MENU_ITEM_ID;
    clone.removeAttribute("data-testid");
    clone.querySelectorAll("[data-testid]").forEach((node) => node.removeAttribute("data-testid"));
    clone.classList.add("tsi-x-menu-item");
    label.textContent = tPage("menuShareAsImage", "Copy as image");

    const icon = clone.querySelector("svg");
    if (icon) {
      const replacement = createShareImageIcon();
      replacement.setAttribute("class", icon.getAttribute("class") || "");
      replacement.removeAttribute("width");
      replacement.removeAttribute("height");
      icon.replaceWith(replacement);
    }

    // X toggles its hover class from JS, which a clone doesn't get. Borrow the
    // row's text colour so the CSS hover tint works in light and dark themes.
    const textColor = window.getComputedStyle(label).color;
    if (textColor) clone.style.setProperty("--tsi-menu-fg", textColor);

    const activate = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeXMenu(clone);
      await handleShareAsImage();
    };
    clone.addEventListener("click", activate);
    clone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });
    return clone;
  }

  // X closes its dropdown when the transparent full-screen backdrop next to
  // the menu is clicked; it ignores synthetic Escape presses.
  function closeXMenu(item) {
    const menu = item && item.closest(MENU_SELECTOR);
    const backdrop =
      menu &&
      [...menu.parentElement.children].find(
        (node) => node !== menu && window.getComputedStyle(node).position === "fixed"
      );
    if (backdrop) {
      backdrop.click();
      return;
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  }

  function looksLikeShareMenu(menu) {
    const text = menu.textContent || "";
    return /Copy link|Embed|Send via|Share|复制链接|嵌入|通过私信发送|分享/.test(text);
  }

  function createMenuItem() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = MENU_ITEM_ID;
    button.className = "tsi-menu-item";
    button.setAttribute("role", "menuitem");
    const icon = document.createElement("span");
    icon.className = "tsi-menu-icon";
    icon.appendChild(createShareImageIcon());
    const label = document.createElement("span");
    label.className = "tsi-menu-label";
    label.textContent = tPage("menuShareAsImage", "Copy as image");
    button.append(icon, label);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeXMenu(button);
      await handleShareAsImage();
    });
    return button;
  }

  async function handleShareAsImage() {
    const article = state.lastShareArticle || (IS_REDDIT ? null : findFocusedArticle());
    await createCardForPost(article);
  }

  async function handlePostCard(target) {
    await createCardForPost(findPostAround(target));
  }

  async function handleShortcut() {
    if (String(window.getSelection() || "").trim()) {
      await handleSelectionShareCard("");
      return;
    }

    const post = findPostAround(state.hoverTarget);
    if (post) {
      await createCardForPost(post);
      return;
    }
    safeShowToast(t("toastShortcutHint", "Select some text, or hover over a post, then press the shortcut."));
  }

  async function createCardForPost(post) {
    try {
      if (!post) {
        safeShowToast(t("toastNoPost", "Couldn't find this post. Right-click directly on the post and retry."));
        return;
      }

      showGeneratingToast();
      const tweet = await extractPost(post);
      if (!tweet.text && !tweet.title && !tweet.media.length) {
        safeShowToast(t("toastNoPost", "Couldn't find this post. Right-click directly on the post and retry."));
        return;
      }
      state.lastThread = IS_X ? findXThread(post) : null;
      await produceCard(tweet);
    } catch (error) {
      console.error("[PaperCard] Failed to create share image", error);
      safeShowToast(t("toastFailed", "Couldn't create the image. Please try again."));
    }
  }

  function composedAncestors(node) {
    const nodes = [];
    let current = node;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) nodes.push(current);
      current = current.parentNode || (current instanceof ShadowRoot ? current.host : null);
    }
    return nodes;
  }

  function findPostAround(target) {
    if (!target) return null;
    const path = composedAncestors(target);
    if (IS_REDDIT) return path.find((node) => node.tagName === "SHREDDIT-POST") || null;
    if (IS_X) return path.find((node) => node.tagName === "ARTICLE") || null;
    return PLATFORM ? PLATFORM.findPost(path) : null;
  }

  async function extractPost(post) {
    if (IS_REDDIT) return extractRedditPostData(post);
    if (IS_X) {
      await expandTweetIfNeeded(post);
      return extractTweetData(post);
    }

    const expand = PLATFORM.expandButton && PLATFORM.expandButton(post);
    if (expand) {
      const before = readText(post).length;
      expand.click();
      await waitForCondition(() => readText(post).length > before, 2000);
    }
    return normalizeTweetData({ ...PLATFORM.extract(post), platform: PLATFORM.id });
  }

  // On a status page, an author's consecutive replies to themselves form a thread.
  function findXThread(article) {
    if (!/\/status\//.test(location.pathname)) return null;
    const handleOf = (node) => extractHandle(node.querySelector('[data-testid="User-Name"]'));
    const handle = handleOf(article);
    const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
    let start = articles.indexOf(article);
    if (!handle || start === -1) return null;

    let end = start;
    while (start > 0 && handleOf(articles[start - 1]) === handle) start -= 1;
    while (end < articles.length - 1 && handleOf(articles[end + 1]) === handle) end += 1;
    return end > start ? articles.slice(start, end + 1) : null;
  }

  async function shareLastThread() {
    const articles = state.lastThread;
    if (!articles) return;

    try {
      showGeneratingToast();
      const parts = [];
      for (const article of articles) {
        await expandTweetIfNeeded(article);
        const tweet = extractTweetData(article);
        parts.push({ text: tweet.text, media: tweet.media });
      }
      const first = extractTweetData(articles[0]);
      state.lastThread = null;
      await produceCard(normalizeTweetData({ ...first, text: "", media: [], parts }));
    } catch (error) {
      console.error("[PaperCard] Failed to create thread image", error);
      safeShowToast(t("toastFailed", "Couldn't create the image. Please try again."), state.lastPngBlob);
    }
  }

  async function handleSelectionShareCard(selectionText) {
    const tweet = extractSelectionFromPost(selectionText) || extractSelectionShareData(selectionText);
    if (!tweet.text) {
      safeShowToast(t("toastSelectText", "Select some text first, then try again."));
      return;
    }

    state.lastThread = null;
    showGeneratingToast();
    await produceCard(tweet);
  }

  // A sentence highlighted inside a post becomes a quote card that still
  // credits the post's author, date and link, with only the selection as body.
  function extractSelectionFromPost(selectionText) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !String(selection).trim()) return null;

    const post = findPostAround(selection.getRangeAt(0).commonAncestorContainer);
    if (!post) return null;

    try {
      const data = IS_X
        ? extractTweetData(post)
        : IS_REDDIT
          ? extractRedditPostData(post)
          : normalizeTweetData({ ...PLATFORM.extract(post), platform: PLATFORM.id });
      const text = normalizeWhitespace(String(selection) || selectionText);
      return normalizeTweetData({ ...data, title: "", text, media: [], parts: [] });
    } catch (error) {
      console.warn("[PaperCard] Couldn't read the post around the selection", error);
      return null;
    }
  }

  // Images are hydrated once so switching themes from the toast re-renders
  // instantly without refetching anything.
  async function produceCard(tweet) {
    const [settings, hydratedTweet] = await Promise.all([loadShareSettings(), hydrateMedia(tweet)]);
    state.lastCard = { tweet: hydratedTweet, settings };
    state.lastTweetUrl = tweet.sourceUrl || "";
    await deliverCard();
  }

  async function deliverCard() {
    const { tweet, settings } = state.lastCard;
    const pngBlob = await window.PaperCardRenderer.renderToPng(tweet, settings);
    state.lastPngBlob = pngBlob;

    try {
      await copyPngToClipboard(pngBlob);
      safeShowToast(t("toastCopied", "Copied! Paste it anywhere with Ctrl/Cmd + V"), pngBlob);
    } catch (error) {
      console.warn("[PaperCard] Clipboard copy failed", error);
      safeShowToast(t("toastCopyFailed", "Couldn't copy automatically. Download the PNG instead."), pngBlob);
    }
  }

  async function restyleLastCard(change) {
    state.lastCard = { ...state.lastCard, settings: { ...state.lastCard.settings, ...change } };
    // The last look picked becomes the default for the next card.
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) chrome.storage.sync.set(change);

    try {
      await deliverCard();
    } catch (error) {
      console.error("[PaperCard] Failed to switch theme", error);
      safeShowToast(t("toastFailed", "Couldn't create the image. Please try again."), state.lastPngBlob);
    }
  }

  function extractSelectionShareData(selectionText) {
    const pageSelection = String(window.getSelection() || "");
    const selectedText = normalizeWhitespace(pageSelection.trim() ? pageSelection : selectionText);
    const hostLabel = resolveHostLabel(location.href);

    return normalizeTweetData({
      authorName: resolveSiteName(hostLabel),
      authorHandle: "",
      avatarUrl: resolveSiteIconUrl(),
      text: selectedText,
      media: [],
      stats: [],
      createdAtLabel: formatDateLabel(new Date()),
      sourceLabel: hostLabel,
      sourceUrl: location.href
    });
  }

  function resolveSiteName(fallback) {
    const metaSelectors = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]'
    ];
    for (const selector of metaSelectors) {
      const content = normalizeWhitespace(document.querySelector(selector)?.getAttribute("content"));
      if (content) return content;
    }

    const title = normalizeWhitespace(document.title);
    if (!title) return fallback || "Web page";

    const [siteName] = title
      .split(/\s[-|—–·]\s|\s-\s|\s\|\s/)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);
    return siteName || fallback || "Web page";
  }

  function resolveSiteIconUrl() {
    const icon =
      document.querySelector("link[rel~='icon']") ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel="apple-touch-icon"]');
    const href = icon && icon.getAttribute("href");
    if (href) return new URL(href, location.href).toString();
    return new URL("/favicon.ico", location.origin).toString();
  }

  function resolveHostLabel(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (_) {
      return String(location.hostname || "").replace(/^www\./, "");
    }
  }

  function findFocusedArticle() {
    const active = document.activeElement;
    return active && active.closest ? active.closest("article") : null;
  }

  function extractTweetData(article) {
    const userName = article.querySelector('[data-testid="User-Name"]');
    const authorName =
      readText(userName && userName.querySelector("a[role='link'] span")) ||
      readText(userName && userName.querySelector("span"));
    const authorHandle = extractHandle(userName);
    const textNodes = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const text = textNodes.map((node) => node.innerText || node.textContent || "").join("\n");
    const time = article.querySelector("time");
    const sourceUrl = resolveTweetUrl(article, time);
    const avatarUrl = resolveImageSrc(article.querySelector('img[src*="profile_images"]'));
    const media = extractMedia(article);
    const stats = extractStats(article);

    return normalizeTweetData({
      authorName,
      authorHandle,
      avatarUrl,
      text,
      media,
      stats,
      createdAtLabel: resolveCreatedAtLabel(time),
      sourceUrl,
      sourceLabel: "x.com",
      platform: "x"
    });
  }

  async function expandTweetIfNeeded(article) {
    const showMoreButton = [...article.querySelectorAll("button")]
      .filter((button) => button.closest("article") === article)
      .find((button) => SHOW_MORE_LABELS.some((label) => readText(button).toLowerCase() === label.toLowerCase()));

    if (!showMoreButton) return;

    const before = readTweetText(article);
    showMoreButton.click();
    await waitForCondition(() => readTweetText(article).length > before.length, 1800);
  }

  function readTweetText(article) {
    return [...article.querySelectorAll('[data-testid="tweetText"]')]
      .map((node) => node.innerText || node.textContent || "")
      .join("\n");
  }

  function extractHandle(userName) {
    if (!userName) return "";
    const candidates = [...userName.querySelectorAll("span")]
      .map((node) => node.textContent || "")
      .filter((text) => text.trim().startsWith("@"));
    return candidates[0] || "";
  }

  function extractMedia(article) {
    const images = [...article.querySelectorAll('[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]')];
    return images.map((img) => ({
      src: resolveImageSrc(img),
      alt: img.alt || ""
    }));
  }

  // Stats come only from the post's own action bar: its role="group" carries
  // an aria-label like "12 replies, 3 reposts, 40 likes, 1 bookmarks, 900 views".
  // Scanning the whole article would also pick up numbers from the post body
  // and from quoted posts.
  function extractStats(article) {
    const parse = core.parseStatsText || (() => []);
    const ownGroups = [...article.querySelectorAll('[role="group"]')].filter(
      (group) => group.closest("article") === article
    );
    const labels = ownGroups.flatMap((group) => [
      group.getAttribute("aria-label") || "",
      ...[...group.querySelectorAll("[aria-label]")].map((node) => (node.getAttribute("aria-label") || "").split(/\.\s/)[0])
    ]);

    const stats = new Map();
    for (const label of labels) {
      for (const stat of parse(label)) if (!stats.has(stat.label)) stats.set(stat.label, stat.value);
    }
    return [...stats].map(([label, value]) => ({ label, value }));
  }

  function resolveTweetUrl(article, time) {
    const link = time && time.closest("a[href*='/status/']");
    if (link) return new URL(link.getAttribute("href"), location.origin).toString();

    const statusLink = article.querySelector("a[href*='/status/']");
    if (statusLink) return new URL(statusLink.getAttribute("href"), location.origin).toString();

    return location.href;
  }

  function resolveImageSrc(img) {
    if (!img) return "";
    return img.currentSrc || img.src || img.getAttribute("src") || "";
  }

  function readText(node) {
    return node ? (node.innerText || node.textContent || "").trim() : "";
  }

  // Reddit (shreddit) renders the share button and its dropdown inside shadow
  // roots, so a document-level MutationObserver never sees the menu. Instead we
  // remember the post when its share button is clicked and scan the nearby
  // shadow trees for the share menu for a few seconds.
  function rememberRedditShareClick(event) {
    const path = event.composedPath().filter((node) => node && node.nodeType === Node.ELEMENT_NODE);
    if (path.some((node) => node.id === MENU_ITEM_ID)) return;

    const shareIndex = path.findIndex(isRedditShareControl);
    if (shareIndex === -1) return;

    const ancestors = path.slice(shareIndex);
    if (ancestors.some((node) => node.tagName === "SHREDDIT-COMMENT")) return;

    const post = ancestors.find((node) => node.tagName === "SHREDDIT-POST");
    if (!post) return;

    state.lastShareArticle = post;
    watchRedditShareMenu(path.slice(0, shareIndex + 1));
  }

  function isRedditShareControl(node) {
    if (node.tagName === "SHREDDIT-POST-SHARE-BUTTON") return true;
    if (!node.matches || !node.matches('button, a, [role="button"]')) return false;

    const label = node.getAttribute("aria-label") || readText(node);
    return REDDIT_SHARE_LABEL_PATTERN.test(label);
  }

  function watchRedditShareMenu(nodes) {
    const roots = new Set();
    for (const node of nodes) {
      if (node.shadowRoot) roots.add(node.shadowRoot);
      const root = node.getRootNode();
      if (root && root !== document) roots.add(root);
    }

    window.clearInterval(state.redditMenuWatch);
    const start = Date.now();
    const scan = () => {
      for (const menu of findRedditShareMenus(roots)) injectRedditMenuItem(menu);
      if (Date.now() - start >= REDDIT_MENU_WATCH_MS) window.clearInterval(state.redditMenuWatch);
    };
    state.redditMenuWatch = window.setInterval(scan, 100);
    scan();
  }

  function findRedditShareMenus(roots) {
    const menus = new Set();
    for (const root of roots) deepQueryAll(root, REDDIT_MENU_SELECTOR).forEach((menu) => menus.add(menu));
    // Menus portaled to the light DOM.
    document.querySelectorAll(REDDIT_MENU_SELECTOR).forEach((menu) => menus.add(menu));

    return [...menus].filter((menu) => {
      if (menu.parentElement && menu.parentElement.closest(REDDIT_MENU_SELECTOR)) return false;
      return REDDIT_SHARE_MENU_PATTERN.test(deepText(menu));
    });
  }

  function deepQueryAll(root, selector, results = []) {
    if (!root || !root.querySelectorAll) return results;
    results.push(...root.querySelectorAll(selector));
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) deepQueryAll(element.shadowRoot, selector, results);
    }
    return results;
  }

  function deepText(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    let text = "";
    if (node.shadowRoot) text += deepText(node.shadowRoot);
    for (const child of node.childNodes) text += deepText(child);
    return text;
  }

  function injectRedditMenuItem(menu) {
    if (menu.querySelector(`#${MENU_ITEM_ID}`)) return;

    const reference = findRedditReferenceItem(menu);
    const item = (reference && cloneRedditMenuItem(reference)) || createRedditFallbackItem(menu);
    item.id = MENU_ITEM_ID;
    item.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeRedditMenu(item);
      await handleShareAsImage();
    });

    if (reference && reference.parentNode) {
      reference.parentNode.insertBefore(item, reference.nextSibling);
    } else {
      menu.appendChild(item);
    }
  }

  function findRedditReferenceItem(menu) {
    const candidates = [...menu.querySelectorAll("*")].filter(
      (node) => !node.children.length && REDDIT_COPY_LINK_PATTERN.test(readText(node))
    );
    const label = candidates[0];
    if (!label) return null;

    const row = label.closest("li") || label.closest('[role="menuitem"]');
    return row && menu.contains(row) && row !== menu ? row : null;
  }

  // Cloning the native "Copy link" row keeps Reddit's own (shadow-scoped) styling.
  function cloneRedditMenuItem(reference) {
    if (reference.tagName.includes("-")) return null;
    const clone = reference.cloneNode(true);
    unwrapCustomElements(clone);
    for (const node of [clone, ...clone.querySelectorAll("*")]) stripRedditAttributes(node);

    const label = [...clone.querySelectorAll("*")].find(
      (node) => !node.children.length && REDDIT_COPY_LINK_PATTERN.test(readText(node))
    );
    if (!label) return null;
    label.textContent = tPage("menuShareAsImage", "Copy as image");

    const icon = clone.querySelector("svg");
    if (icon) {
      const replacement = createShareImageIcon();
      replacement.setAttribute("class", icon.getAttribute("class") || "");
      icon.replaceWith(replacement);
    }

    if (clone.getAttribute("role") !== "menuitem" && !clone.querySelector('[role="menuitem"]')) {
      clone.setAttribute("role", "menuitem");
    }
    clone.style.cursor = "pointer";
    return clone;
  }

  function unwrapCustomElements(root) {
    for (const node of [...root.querySelectorAll("*")].reverse()) {
      if (!node.tagName.includes("-") || node.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
      node.replaceWith(...node.childNodes);
    }
  }

  function stripRedditAttributes(node) {
    if (node.namespaceURI === "http://www.w3.org/2000/svg") return;
    const keep = new Set(["class", "role", "style", "tabindex", "aria-hidden", "slot"]);
    for (const attribute of [...node.attributes]) {
      if (!keep.has(attribute.name)) node.removeAttribute(attribute.name);
    }
  }

  function createRedditFallbackItem(menu) {
    const item = document.createElement(menu.tagName === "UL" ? "li" : "div");
    item.setAttribute("role", "menuitem");
    item.tabIndex = -1;
    Object.assign(item.style, {
      alignItems: "center",
      boxSizing: "border-box",
      color: "inherit",
      cursor: "pointer",
      display: "flex",
      font: "inherit",
      fontSize: "14px",
      gap: "12px",
      listStyle: "none",
      minHeight: "40px",
      padding: "8px 16px"
    });
    item.addEventListener("mouseenter", () => {
      item.style.background = "rgba(128, 128, 128, 0.14)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "";
    });

    const label = document.createElement("span");
    label.textContent = tPage("menuShareAsImage", "Copy as image");
    item.append(createShareImageIcon(), label);
    return item;
  }

  function createShareImageIcon() {
    const template = document.createElement("template");
    // 2-unit strokes on a 24 grid match the line weight of X's own menu icons.
    template.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="m3.5 17.5 5.1-5.1a1.5 1.5 0 0 1 2.1 0L16 17.7m-2.7-2.7 1.8-1.8a1.5 1.5 0 0 1 2.1 0l3.3 3.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="15.5" cy="8.5" r="1.75" fill="currentColor" stroke="none"/>
    </svg>`;
    return template.content.firstElementChild;
  }

  function closeRedditMenu(item) {
    item.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, composed: true })
    );

    let node = item;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.hasAttribute("popover") && typeof node.hidePopover === "function") {
          try {
            node.hidePopover();
          } catch (_) {
            // Already hidden.
          }
        }
        if (node.tagName === "DETAILS") node.removeAttribute("open");
      }
      node = node.parentNode || (node instanceof ShadowRoot ? node.host : null);
    }
  }

  function extractRedditPostData(post) {
    const attr = (name) => normalizeWhitespace(post.getAttribute(name));
    const author = attr("author");
    const authorHandle = author ? `u/${author}` : "";
    const subreddit = attr("subreddit-prefixed-name") || (attr("subreddit-name") ? `r/${attr("subreddit-name")}` : "");
    const permalink = attr("permalink");
    const title = attr("post-title") || readText(post.querySelector('[slot="title"]'));
    const stats = [];

    const score = formatCompactNumber(attr("score"));
    if (score) stats.push({ label: "Upvotes", value: score });
    const comments = formatCompactNumber(attr("comment-count"));
    if (comments) stats.push({ label: "Comments", value: comments });

    const createdAt = new Date(attr("created-timestamp"));

    return normalizeTweetData({
      authorName: subreddit || authorHandle || "Reddit",
      authorHandle: authorHandle === subreddit ? "" : authorHandle,
      avatarUrl: findRedditCommunityIcon(post),
      title,
      text: readRedditBody(post),
      media: extractRedditMedia(post),
      stats,
      createdAtLabel: formatDateLabel(Number.isNaN(createdAt.getTime()) ? new Date() : createdAt),
      sourceLabel: "reddit.com",
      platform: "reddit",
      sourceUrl: permalink ? new URL(permalink, "https://www.reddit.com").toString() : location.href
    });
  }

  function readRedditBody(post) {
    const body =
      post.querySelector('[slot="text-body"]') ||
      post.querySelector('[id$="-post-rtjson-content"]') ||
      post.querySelector('[property="schema:articleBody"]');
    if (!body) return "";

    return String(body.innerText || body.textContent || "")
      .split("\n")
      .filter((line) => !/^\s*(Read more|See more|展开|阅读更多)\s*$/i.test(line))
      .join("\n");
  }

  function extractRedditMedia(post) {
    const sources = [];
    const images = post.querySelectorAll(
      [
        '[slot="post-media-container"] img',
        "gallery-carousel img",
        "shreddit-media-lightbox-listener img",
        "img#post-image",
        "img.media-lightbox-img"
      ].join(", ")
    );

    for (const img of images) {
      if (isBlurredRedditBackdrop(img)) continue;
      const src = img.getAttribute("src") || img.getAttribute("data-lazy-src") || img.currentSrc || "";
      if (!/^https:\/\/([a-z0-9-]+\.)*(redd\.it|redditmedia\.com|imgur\.com)\//i.test(src)) continue;
      if (/styles\.redditmedia\.com|\/avatars?\//i.test(src)) continue;
      sources.push({ src, alt: img.getAttribute("alt") || "" });
    }

    if (!sources.length) {
      const player = post.querySelector("shreddit-player[poster], shreddit-player-2[poster]");
      const poster = player && player.getAttribute("poster");
      if (poster) sources.push({ src: poster, alt: "" });
    }

    return sources.slice(0, REDDIT_MAX_MEDIA);
  }

  // Image posts render a blurred, scaled copy of the image behind the real one.
  function isBlurredRedditBackdrop(img) {
    const className = String(img.getAttribute("class") || "");
    if (/blur|background-image-filter/i.test(className)) return true;
    const filter = window.getComputedStyle(img).filter || "";
    return filter.includes("blur");
  }

  function findRedditCommunityIcon(post) {
    const icon = post.querySelector(
      [
        "shreddit-subreddit-icon img",
        "img.shreddit-subreddit-icon__icon",
        '[slot="credit-bar"] img[src*="redditmedia.com"]',
        '[slot="credit-bar"] img[src*="redditstatic.com"]',
        'faceplate-img[src*="styles.redditmedia.com"]'
      ].join(", ")
    );
    if (!icon) return "";
    return icon.getAttribute("src") || resolveImageSrc(icon);
  }

  function formatCompactNumber(value) {
    const number = Number(String(value || "").replace(/,/g, ""));
    if (!value || !Number.isFinite(number)) return "";
    if (Math.abs(number) < 1000) return String(number);
    const units = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"]
    ];
    for (const [size, suffix] of units) {
      if (Math.abs(number) >= size) {
        return `${(number / size).toFixed(1).replace(/\.0$/, "")}${suffix}`;
      }
    }
    return String(number);
  }

  function normalizeTweetData(tweet) {
    if (typeof core.normalizeTweetData === "function") return core.normalizeTweetData(tweet);

    const data = tweet || {};
    return {
      authorName: normalizeWhitespace(data.authorName) || "X / Twitter",
      authorHandle: normalizeHandle(data.authorHandle),
      avatarUrl: String(data.avatarUrl || "").trim(),
      title: normalizeWhitespace(data.title),
      text: normalizeWhitespace(data.text),
      media: Array.isArray(data.media) ? data.media.filter((item) => item && item.src) : [],
      stats: Array.isArray(data.stats) ? data.stats.filter((item) => item && item.label && item.value) : [],
      createdAtLabel: normalizeWhitespace(data.createdAtLabel),
      sourceLabel: normalizeWhitespace(data.sourceLabel),
      sourceUrl: String(data.sourceUrl || "").trim()
    };
  }

  function resolveCreatedAtLabel(time) {
    if (!time) return formatDateLabel(new Date());

    const dateTime = time.getAttribute("datetime");
    if (dateTime) {
      const parsed = new Date(dateTime);
      if (!Number.isNaN(parsed.getTime())) return formatDateLabel(parsed);
    }

    const label = normalizeWhitespace(time.getAttribute("aria-label") || time.textContent);
    return isRelativeTimeLabel(label) ? formatDateLabel(new Date()) : label;
  }

  function isRelativeTimeLabel(label) {
    return /(?:^\d+\s*[smhd]$|ago|分钟前|小时前|秒前|刚刚|昨天)/i.test(String(label || "").trim());
  }

  function formatDateLabel(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }

  function normalizeHandle(value) {
    const handle = String(value || "").trim();
    if (!handle) return "";
    if (/^[ru]\//i.test(handle)) return handle;
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  function waitForCondition(predicate, timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (predicate() || Date.now() - start >= timeout) {
          resolve();
          return;
        }
        window.setTimeout(tick, 80);
      };
      tick();
    });
  }

  async function loadShareSettings() {
    const normalize =
      typeof core.normalizeShareSettings === "function"
        ? core.normalizeShareSettings
        : (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}) });

    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
        resolve(normalize(DEFAULT_SETTINGS));
        return;
      }

      chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        resolve(normalize(settings));
      });
    });
  }

  async function hydrateMedia(tweet) {
    const [avatarUrl, media, parts] = await Promise.all([
      tweet.avatarUrl ? imageUrlToDataUrl(tweet.avatarUrl) : "",
      hydrateMediaList(tweet.media || []),
      Promise.all((tweet.parts || []).map(async (part) => ({ ...part, media: await hydrateMediaList(part.media) })))
    ]);
    return { ...tweet, avatarUrl, media, parts };
  }

  async function hydrateMediaList(items) {
    const sources = await Promise.all(items.map((item) => imageUrlToDataUrl(item.src)));
    return items.map((item, index) => ({ ...item, src: sources[index] })).filter((item) => item.src);
  }

  async function imageUrlToDataUrl(url) {
    if (!url || url.startsWith("data:")) return url;

    try {
      const response = await fetch(url, {
        credentials: "omit",
        cache: "force-cache"
      });
      if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch (error) {
      const dataUrl = await fetchImageViaBackground(url);
      if (dataUrl) return dataUrl;
      console.warn("[PaperCard] Image hydration failed", url, error);
      return "";
    }
  }

  // Page CORS rules apply to content-script fetches; the service worker can
  // fetch media hosts listed in host_permissions without them.
  async function fetchImageViaBackground(url) {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return "";

    try {
      const response = await chrome.runtime.sendMessage({ type: FETCH_IMAGE_MESSAGE, url });
      return response && response.ok ? response.dataUrl : "";
    } catch (_) {
      return "";
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function copyPngToClipboard(blob) {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      throw new Error("Clipboard image write is not available");
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob
      })
    ]);
  }

  function t(key, fallback) {
    try {
      return (chrome.i18n && chrome.i18n.getMessage(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  // The menu row sits among X's / Reddit's own items, so it should speak the
  // page's language rather than the browser's (chrome.i18n only knows the latter).
  const PAGE_LABELS = {
    menuShareAsImage: { en: "Copy as image", "zh-Hans": "复制为图片", "zh-Hant": "複製為圖片" }
  };

  function tPage(key, fallback) {
    const labels = PAGE_LABELS[key];
    const lang = String(document.documentElement.lang || "").toLowerCase();
    if (labels && lang.startsWith("zh")) return /hant|tw|hk|mo/.test(lang) ? labels["zh-Hant"] : labels["zh-Hans"];
    if (labels && lang.startsWith("en")) return labels.en;
    return t(key, fallback);
  }

  function showGeneratingToast() {
    safeShowToast(t("toastGenerating", "Creating image…"), null, { timeout: 20000, busy: true });
  }

  function safeShowToast(message, pngBlob = null, options = {}) {
    try {
      showToast(message, pngBlob, options);
    } catch (error) {
      console.warn("[PaperCard] Toast render failed", error);
    }
  }

  function showToast(message, pngBlob, { timeout = pngBlob ? 8000 : 4000, busy = false } = {}) {
    if (!document.body) return;
    document.querySelectorAll(".tsi-toast").forEach((node) => removeToast(node));
    window.clearTimeout(state.toastTimer);

    const toast = document.createElement("div");
    toast.className = "tsi-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "tsi-toast-close";
    close.setAttribute("aria-label", t("toastClose", "Close"));
    close.textContent = "×";
    close.addEventListener("click", () => removeToast(toast));
    toast.appendChild(close);

    if (pngBlob) {
      const previewUrl = URL.createObjectURL(pngBlob);
      const preview = document.createElement("img");
      preview.className = "tsi-toast-preview";
      preview.alt = t("toastPreviewAlt", "Share card preview");
      preview.src = previewUrl;
      toast.dataset.previewUrl = previewUrl;
      toast.appendChild(preview);
    }

    const actions = document.createElement("div");
    actions.className = "tsi-toast-actions";

    const label = document.createElement("span");
    label.className = busy ? "tsi-toast-label tsi-toast-busy" : "tsi-toast-label";
    label.textContent = message;
    actions.appendChild(label);

    if (pngBlob) {
      const buttons = document.createElement("div");
      buttons.className = "tsi-toast-buttons";
      const panel = state.lastCard ? createAdjustPanel() : null;

      if (panel) {
        const adjust = document.createElement("button");
        adjust.type = "button";
        adjust.className = "tsi-toast-secondary";
        adjust.textContent = t("toastAdjust", "Adjust");
        adjust.setAttribute("aria-expanded", String(state.toastPanelOpen));
        adjust.addEventListener("click", () => {
          state.toastPanelOpen = !state.toastPanelOpen;
          panel.hidden = !state.toastPanelOpen;
          adjust.setAttribute("aria-expanded", String(state.toastPanelOpen));
        });
        buttons.appendChild(adjust);
      }

      const download = document.createElement("button");
      download.type = "button";
      download.textContent = t("toastDownload", "Download");
      download.addEventListener("click", () => downloadBlob(pngBlob));
      buttons.appendChild(download);
      actions.appendChild(buttons);
      if (panel) actions.appendChild(panel);
    }

    toast.appendChild(actions);
    document.body.appendChild(toast);

    // Pause auto-dismiss while the pointer is over the toast so people can act on it.
    const schedule = () => {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = window.setTimeout(() => removeToast(toast), timeout);
    };
    toast.addEventListener("mouseenter", () => window.clearTimeout(state.toastTimer));
    toast.addEventListener("mouseleave", schedule);
    schedule();
  }

  // Every change re-renders, re-copies and becomes the default for next time.
  function createAdjustPanel() {
    const { settings } = state.lastCard;
    const panel = document.createElement("div");
    panel.className = "tsi-toast-panel";
    panel.hidden = !state.toastPanelOpen;

    const lock = () => panel.querySelectorAll("button").forEach((button) => (button.disabled = true));
    const addRow = (title, options, current, onPick) => {
      const row = document.createElement("div");
      row.className = "tsi-toast-row";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", title);
      const heading = document.createElement("span");
      heading.className = "tsi-toast-row-title";
      heading.textContent = title;
      const chips = document.createElement("div");
      chips.className = "tsi-toast-chips";
      for (const [value, label] of options) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tsi-toast-chip";
        chip.textContent = label;
        chip.setAttribute("aria-pressed", String(value === current));
        chip.addEventListener("click", () => {
          if (value === current) return;
          lock();
          onPick(value);
        });
        chips.appendChild(chip);
      }
      row.append(heading, chips);
      panel.appendChild(row);
    };

    addRow(
      t("toastStyle", "Style"),
      TEMPLATE_ORDER.map((name) => [name, t(`template_${name}`, name)]),
      settings.template || "paper",
      (template) => restyleLastCard({ template })
    );
    addRow(
      t("optionsTheme", "Theme"),
      [["light", t("themeLight", "Light")], ["dark", t("themeDark", "Dark")]],
      settings.theme === "dark" ? "dark" : "light",
      (theme) => restyleLastCard({ theme })
    );
    addRow(
      t("toastSize", "Size"),
      RATIO_ORDER.map((ratio) => [ratio, ratio === "auto" ? t("ratio_auto", "Auto") : ratio]),
      settings.ratio || "auto",
      (ratio) => restyleLastCard({ ratio })
    );

    if (state.lastThread) {
      addRow(
        t("toastContent", "Content"),
        [["post", t("toastThisPost", "This post")], ["thread", t("toastWholeThread", "Whole thread ({count})").replace("{count}", state.lastThread.length)]],
        "post",
        () => shareLastThread()
      );
    }
    return panel;
  }

  function removeToast(toast) {
    if (!toast) return;
    const previewUrl = toast.dataset && toast.dataset.previewUrl;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    toast.remove();
  }

  function downloadBlob(blob) {
    const link = document.createElement("a");
    const filename = makeFilename();
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function makeFilename() {
    const match = state.lastTweetUrl.match(/status\/(\d+)/);
    if (match) return `papercard-x-${match[1]}.png`;
    const redditMatch = state.lastTweetUrl.match(/\/comments\/([a-z0-9]+)/i);
    if (redditMatch) return `papercard-reddit-${redditMatch[1]}.png`;
    return `papercard-${Date.now()}.png`;
  }
})();
