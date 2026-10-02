(function initCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.TwitterShareImageCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  const DEFAULT_AUTHOR = "X / Twitter";
  const TEMPLATES = ["paper", "minimal", "magazine", "gradient"];
  // Output sizes: "auto" fits the content; the rest are fixed width:height
  // ratios for feeds that crop (Instagram/Xiaohongshu 4:5, stories 9:16).
  const RATIOS = ["auto", "1:1", "4:5", "9:16"];
  const MAX_TEXT_CHARS = 1200;
  const DEFAULT_SHARE_SETTINGS = {
    template: "paper",
    theme: "light",
    footerFields: ["date", "likes", "upvotes"],
    ratio: "auto",
    showQrCode: false,
    showBranding: false,
    showPlatformIcon: true
  };
  const STAT_LABELS = {
    replies: "Replies",
    reposts: "Reposts",
    likes: "Likes",
    bookmarks: "Bookmarks",
    views: "Views",
    upvotes: "Upvotes",
    comments: "Comments"
  };
  const STAT_KEYS = Object.keys(STAT_LABELS);

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

  function canonicalMediaSrc(src) {
    try {
      const url = new URL(src);
      if (url.hostname.endsWith("twimg.com")) {
        url.searchParams.delete("name");
        return url.toString();
      }
      if (url.hostname.endsWith("redd.it")) {
        // preview.redd.it/<title-slug>-v0-<id>.png and i.redd.it/<id>.png are the same image.
        const filename = url.pathname.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
        const idMatch = filename.match(/-v\d+-([a-z0-9]+)$/i);
        return `redd.it/${(idMatch ? idMatch[1] : filename).toLowerCase()}`;
      }
      return url.toString();
    } catch (_) {
      return String(src || "");
    }
  }

  function preferLargeTwitterImage(src) {
    try {
      const url = new URL(src);
      if (url.hostname.endsWith("twimg.com") && url.searchParams.has("name")) {
        url.searchParams.set("name", "large");
        return url.toString();
      }
      return url.toString();
    } catch (_) {
      return String(src || "");
    }
  }

  function normalizeMedia(media) {
    const seen = new Set();
    const items = [];

    for (const item of Array.isArray(media) ? media : []) {
      const rawSrc = typeof item === "string" ? item : item && item.src;
      const src = preferLargeTwitterImage(rawSrc);
      const key = canonicalMediaSrc(src);

      if (!src || seen.has(key)) continue;
      seen.add(key);

      items.push({
        src,
        alt: normalizeWhitespace(item && item.alt)
      });
    }

    return items;
  }

  function normalizeStats(stats) {
    const items = [];
    const seen = new Set();

    for (const item of Array.isArray(stats) ? stats : []) {
      const label = normalizeWhitespace(item && item.label);
      const value = normalizeWhitespace(item && item.value);
      const key = statKeyFromLabel(label);

      if (!key || !value || seen.has(key)) continue;
      seen.add(key);
      items.push({ label: STAT_LABELS[key], value });
    }

    return items;
  }

  function statKeyFromLabel(label) {
    const key = normalizeWhitespace(label).toLowerCase();
    if (STAT_KEYS.includes(key)) return key;
    if (key === "reply") return "replies";
    if (key === "repost") return "reposts";
    if (key === "like") return "likes";
    if (key === "bookmark") return "bookmarks";
    if (key === "view") return "views";
    if (key === "upvote" || key === "points" || key === "score") return "upvotes";
    if (key === "comment") return "comments";
    if (key === "save" || key === "saves" || key === "collect" || key === "collects") return "bookmarks";
    return "";
  }

  function formatCompactNumber(value) {
    const raw = String(value || "").trim();
    const number = Number(raw.replace(/,/g, ""));
    if (!raw || !Number.isFinite(number)) return raw;
    if (Math.abs(number) < 1000) return String(number);
    for (const [size, suffix] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
      if (Math.abs(number) >= size) return `${(number / size).toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
    return String(number);
  }

  // Parses X's accessible stats summary, e.g. "167481 replies, 744280 reposts,
  // 4188675 likes, 22504 bookmarks, 1.2M views" or the zh-CN equivalent
  // ("167481 条回复、744280 次转帖、4188675 次喜欢…"). Only feed it the post's
  // action bar labels — never the post body, where "500 likes" is just text.
  const STAT_PATTERNS = [
    ["Replies", /(?:repl(?:y|ies)|回复|回覆)/i],
    ["Reposts", /(?:reposts?|retweets?|转帖|转推|转发|轉貼|轉推)/i],
    ["Likes", /(?:likes?|喜欢|點讚|点赞|喜歡)/i],
    ["Bookmarks", /(?:bookmarks?|书签|書籤)/i],
    ["Views", /(?:views?|查看|浏览|观看|瀏覽|觀看)/i]
  ];

  function parseStatsText(text) {
    const found = new Map();
    const chunks = String(text || "").split(/,\s+|[，、;；。]\s*/);
    for (const chunk of chunks) {
      const match = chunk.match(/(\d[\d,.]*(?:\s*[KMB](?![a-z])|[万千亿萬億])?)/i);
      if (!match) continue;
      const rest = chunk.slice(match.index + match[0].length);
      const pattern = STAT_PATTERNS.find(([, regex]) => regex.test(rest));
      if (!pattern || found.has(pattern[0])) continue;
      const value = match[1].replace(/\s+/g, "");
      found.set(pattern[0], /^[\d,]+$/.test(value) ? formatCompactNumber(value) : value);
    }
    return STAT_PATTERNS.filter(([label]) => found.has(label)).map(([label]) => ({ label, value: found.get(label) }));
  }

  // Long answers/articles would otherwise produce a card taller than any
  // chat app will display, so cut at a sentence-ish boundary.
  function clampText(value, max = MAX_TEXT_CHARS) {
    const text = String(value || "");
    const chars = [...text];
    if (chars.length <= max) return text;
    const head = chars.slice(0, max).join("");
    const cut = Math.max(head.lastIndexOf("\n"), head.search(/[。！？.!?][^。！？.!?]*$/));
    return `${(cut > max * 0.6 ? head.slice(0, cut + 1) : head).trimEnd()}…`;
  }

  function normalizeParts(parts) {
    return (Array.isArray(parts) ? parts : [])
      .map((part) => ({
        text: clampText(normalizeWhitespace(part && part.text)),
        media: normalizeMedia(part && part.media)
      }))
      .filter((part) => part.text || part.media.length);
  }

  function normalizeTweetData(tweet) {
    const data = tweet || {};
    return {
      authorName: normalizeWhitespace(data.authorName) || DEFAULT_AUTHOR,
      authorHandle: normalizeHandle(data.authorHandle),
      avatarUrl: String(data.avatarUrl || "").trim(),
      title: normalizeWhitespace(data.title),
      text: clampText(normalizeWhitespace(data.text)),
      media: normalizeMedia(data.media),
      parts: normalizeParts(data.parts),
      stats: normalizeStats(data.stats),
      createdAtLabel: normalizeWhitespace(data.createdAtLabel),
      sourceLabel: normalizeWhitespace(data.sourceLabel),
      sourceUrl: String(data.sourceUrl || "").trim(),
      platform: String(data.platform || "").toLowerCase().replace(/[^a-z]/g, "")
    };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderText(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function wrapCardText(ctx, text, maxWidth) {
    if (!text) return [];

    const tokens = tokenizeForWrapping(String(text));
    const lines = [];
    let line = "";

    for (const token of tokens) {
      if (!token) continue;
      const candidate = line + token;

      if (!line || ctx.measureText(candidate).width <= maxWidth || isLeadingForbiddenPunctuation(token)) {
        line = candidate;
        continue;
      }

      lines.push(line.trimEnd());
      line = token.trimStart();

      if (ctx.measureText(line).width > maxWidth && isBreakableLongToken(line)) {
        const broken = breakLongToken(ctx, line, maxWidth);
        lines.push(...broken.slice(0, -1));
        line = broken[broken.length - 1] || "";
      }
    }

    if (line) lines.push(line.trimEnd());
    return lines;
  }

  function tokenizeForWrapping(text) {
    const tokens = [];
    let buffer = "";
    let mode = "";

    for (const char of text) {
      const nextMode = tokenMode(char);
      if (buffer && nextMode !== mode) {
        tokens.push(buffer);
        buffer = "";
      }
      buffer += char;
      mode = nextMode;
    }

    if (buffer) tokens.push(buffer);
    return tokens;
  }

  function tokenMode(char) {
    if (/\s/.test(char)) return "space";
    if (/[A-Za-z0-9_@#:/.-]/.test(char)) return "latin";
    if (isLeadingForbiddenPunctuation(char)) return "punctuation";
    return "cjk";
  }

  function isLeadingForbiddenPunctuation(value) {
    return /^[,.;:!?，。！？、；：）】》〉」』”’%]+$/.test(String(value || ""));
  }

  function isBreakableLongToken(value) {
    return !/[A-Za-z]/.test(value);
  }

  function breakLongToken(ctx, token, maxWidth) {
    const lines = [];
    let line = "";

    for (const char of token) {
      const candidate = line + char;
      if (line && ctx.measureText(candidate).width > maxWidth && !isLeadingForbiddenPunctuation(char)) {
        lines.push(line);
        line = char;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  function normalizeShareSettings(settings) {
    const data = settings || {};
    const footerFields = Array.isArray(data.footerFields)
      ? data.footerFields.filter((field) => field === "date" || STAT_KEYS.includes(field))
      : DEFAULT_SHARE_SETTINGS.footerFields;

    return {
      template: TEMPLATES.includes(data.template) ? data.template : DEFAULT_SHARE_SETTINGS.template,
      theme: data.theme === "dark" ? "dark" : "light",
      footerFields: footerFields.length ? [...new Set(footerFields)] : DEFAULT_SHARE_SETTINGS.footerFields,
      ratio: RATIOS.includes(data.ratio) ? data.ratio : DEFAULT_SHARE_SETTINGS.ratio,
      showQrCode: Boolean(data.showQrCode),
      showBranding: Boolean(data.showBranding),
      showPlatformIcon: data.showPlatformIcon !== false
    };
  }

  function formatTweetStats(stats, settings) {
    const normalizedSettings = normalizeShareSettings(settings);
    const selected = new Set(normalizedSettings.footerFields);
    return normalizeStats(stats)
      .filter((item) => selected.has(statKeyFromLabel(item.label)))
      .map((item) => `${item.value} ${item.label}`)
      .join(" · ");
  }

  function buildShareCardHtml(tweet, settings) {
    const data = normalizeTweetData(tweet);
    const normalizedSettings = normalizeShareSettings(settings);
    const mediaHtml = data.media.length
      ? `<div class="twitter-share-media">${data.media
          .map(
            (item) =>
              `<img class="twitter-share-media-item" src="${escapeHtml(item.src)}" alt="${escapeHtml(
                item.alt
              )}" style="width: 100%; height: auto;">`
          )
          .join("")}</div>`
      : "";
    const handleHtml = data.authorHandle
      ? `<span class="twitter-share-handle">${escapeHtml(data.authorHandle)}</span>`
      : "";
    const meta = [
      normalizedSettings.footerFields.includes("date") ? data.createdAtLabel : "",
      formatTweetStats(data.stats, normalizedSettings),
      data.sourceLabel
    ]
      .filter(Boolean)
      .join(" · ");
    const avatarHtml = data.avatarUrl
      ? `<img class="twitter-share-avatar" src="${escapeHtml(data.avatarUrl)}" alt="">`
      : `<div class="twitter-share-avatar twitter-share-avatar-fallback">${escapeHtml(
          data.authorName.slice(0, 1).toUpperCase()
        )}</div>`;

    return `<article class="twitter-share-card twitter-share-card-${escapeHtml(normalizedSettings.theme)}">
  <header class="twitter-share-header">
    ${avatarHtml}
    <div class="twitter-share-author">
      <div class="twitter-share-name">${escapeHtml(data.authorName)}</div>
      ${handleHtml}
    </div>
  </header>
  ${data.title ? `<div class="twitter-share-title">${renderText(data.title)}</div>` : ""}
  ${data.text ? `<div class="twitter-share-text">${renderText(data.text)}</div>` : ""}
  ${mediaHtml}
  <footer class="twitter-share-footer">
    <span>${escapeHtml(meta || "Share card")}</span>
  </footer>
</article>`;
  }

  return {
    DEFAULT_SHARE_SETTINGS,
    TEMPLATES,
    RATIOS,
    clampText,
    formatCompactNumber,
    parseStatsText,
    buildShareCardHtml,
    escapeHtml,
    formatTweetStats,
    normalizeHandle,
    normalizeShareSettings,
    normalizeMedia,
    normalizeStats,
    normalizeTweetData,
    normalizeWhitespace,
    wrapCardText
  };
});
