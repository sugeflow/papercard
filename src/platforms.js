// Post extractors for platforms beyond X and Reddit. Each adapter finds the
// post around a clicked/hovered element and returns raw card data; content.js
// normalizes and renders it. Selectors were checked against each site's live
// DOM (2026-09); sites change often, so every field degrades gracefully.
(function initPlatforms(root) {
  const COUNT_PATTERN = /^[\d.,]+\s*[KMBkmbw万千亿]?\+?$/;
  const MAX_MEDIA = 4;

  function readText(node) {
    return node ? String(node.innerText || node.textContent || "").trim() : "";
  }

  function isCount(text) {
    return COUNT_PATTERN.test(String(text || "").trim());
  }

  function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function absoluteUrl(href) {
    try {
      return href ? new URL(href, location.href).toString() : "";
    } catch (_) {
      return "";
    }
  }

  function imageSrc(img) {
    if (!img) return "";
    const src = img.currentSrc || img.getAttribute("src") || "";
    return src.startsWith("data:") ? "" : src;
  }

  function uniqueMedia(sources) {
    const seen = new Set();
    const media = [];
    for (const src of sources) {
      if (!src || seen.has(src)) continue;
      seen.add(src);
      media.push({ src });
    }
    return media.slice(0, MAX_MEDIA);
  }

  function stat(label, value) {
    const text = String(value || "").trim();
    return isCount(text) ? { label, value: text } : null;
  }

  function closestFromPath(path, selector) {
    return path.find((node) => node.matches && node.matches(selector)) || null;
  }

  const bluesky = {
    id: "bluesky",
    match: (host) => /(^|\.)bsky\.app$/.test(host),
    urlPatterns: ["https://bsky.app/*"],
    findPost: (path) => closestFromPath(path, '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"]'),
    extract(post) {
      const profileTexts = [...post.querySelectorAll('a[href^="/profile/"]')]
        .filter((link) => !link.getAttribute("href").includes("/post/"))
        .map(readText)
        .filter(Boolean);
      const postLink = post.querySelector('a[href*="/post/"][aria-label], a[href*="/post/"][data-tooltip]');
      const dateLabel = postLink && (postLink.getAttribute("data-tooltip") || postLink.getAttribute("aria-label"));
      const byTestId = (id) => readText(post.querySelector(`[data-testid="${id}"]`));

      return {
        authorName: profileTexts.find((text) => !text.startsWith("@")) || "",
        authorHandle: profileTexts.find((text) => text.startsWith("@")) || "",
        avatarUrl: imageSrc(post.querySelector('[data-testid="userAvatarImage"] img')),
        // Mentions render as block-level links, so innerText splits them onto
        // their own lines; the raw text already carries the real line breaks.
        text: String((post.querySelector('[data-testid="postText"]') || {}).textContent || ""),
        media: uniqueMedia(
          [...post.querySelectorAll('img[src*="/feed_thumbnail/"], img[src*="/feed_fullsize/"]')].map((img) =>
            imageSrc(img).replace("/feed_thumbnail/", "/feed_fullsize/")
          )
        ),
        stats: [
          stat("Replies", byTestId("replyBtn")),
          stat("Reposts", byTestId("repostCount")),
          stat("Likes", byTestId("likeCount"))
        ].filter(Boolean),
        createdAtLabel: dateLabel ? formatDate(new Date(dateLabel.replace(/\sat\s/, " "))) : "",
        sourceLabel: "bsky.app",
        sourceUrl: absoluteUrl(postLink && postLink.getAttribute("href"))
      };
    }
  };

  const threads = {
    id: "threads",
    match: (host) => /(^|\.)threads\.(com|net)$/.test(host),
    urlPatterns: ["https://www.threads.com/*", "https://www.threads.net/*", "https://threads.com/*"],
    findPost: (path) => closestFromPath(path, "[data-pressable-container]"),
    extract(post) {
      const username = [...post.querySelectorAll('a[href^="/@"]')]
        .filter((link) => !link.getAttribute("href").includes("/post/"))
        .map(readText)
        .find(Boolean);
      const avatar = post.querySelector('img[alt*="profile picture"], img[alt*="头像"], img[alt*="個人檔案"]');
      const textSpans = [...post.querySelectorAll('span[dir="auto"]')].filter(
        (span) =>
          !span.closest('a, [role="button"], time') &&
          !span.querySelector("time") &&
          !span.parentElement.closest('span[dir="auto"]') &&
          !isCount(readText(span)) &&
          !/^(Pinned|置顶|已置顶|Translate|翻译|Author|作者)$/i.test(readText(span))
      );
      const time = post.querySelector("time[datetime]");
      const postLink = post.querySelector('a[href*="/post/"]');
      const stats = [];
      for (const button of post.querySelectorAll('[role="button"]')) {
        const svg = button.querySelector("svg");
        const label = svg && (svg.getAttribute("aria-label") || readText(svg.querySelector("title")));
        const value = readText(button);
        if (!label || !isCount(value)) continue;
        if (/like|赞|讚/i.test(label)) stats.push({ label: "Likes", value });
        else if (/comment|reply|评论|回复|留言/i.test(label)) stats.push({ label: "Replies", value });
        else if (/repost|转发|轉發/i.test(label)) stats.push({ label: "Reposts", value });
      }

      return {
        authorName: username || "Threads",
        authorHandle: "",
        avatarUrl: imageSrc(avatar),
        text: textSpans.map(readText).filter(Boolean).join("\n"),
        media: uniqueMedia(
          [...post.querySelectorAll("img")]
            .filter((img) => img !== avatar && img.naturalWidth >= 200 && !/profile picture|头像/i.test(img.alt))
            .map(imageSrc)
        ),
        stats,
        createdAtLabel: time ? formatDate(new Date(time.getAttribute("datetime"))) : "",
        sourceLabel: "threads.com",
        sourceUrl: absoluteUrl(postLink && postLink.getAttribute("href"))
      };
    }
  };

  const instagram = {
    id: "instagram",
    match: (host) => /(^|\.)instagram\.com$/.test(host),
    urlPatterns: ["https://www.instagram.com/*"],
    findPost(path) {
      const article = closestFromPath(path, "article");
      if (article) return article;
      return /\/(p|reel)\//.test(location.pathname) ? document.querySelector("main") : null;
    },
    extract(post) {
      // Post URLs look like /<author>/p/<id>/ (collab posts list several people
      // in the header, so the URL is the reliable source for the owner).
      const postLink = post.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      const urlAuthor = [location.pathname, postLink && postLink.getAttribute("href")]
        .map((path) => String(path || "").match(/^\/([\w.]+)\/(?:p|reel)\//))
        .find(Boolean);
      const author =
        (urlAuthor && urlAuthor[1]) ||
        [...post.querySelectorAll("header a")]
          .map(readText)
          .find((text) => text && !/\s/.test(text) && !/^(Follow|关注|追蹤)$/i.test(text));
      const avatars = [...post.querySelectorAll('img[alt*="profile picture"], img[alt*="头像"], img[alt*="大頭貼照"]')];
      const avatar = avatars.find((img) => author && img.alt.startsWith(`${author}'s`)) || avatars[0] || null;
      const caption =
        readText(post.querySelector("h1")) ||
        [...post.querySelectorAll("span")]
          .filter((span) => !span.closest('a, button, [role="button"], time'))
          .map(readText)
          .filter((text) => text.length > 1 && !/likes?$|comments?$|次赞|条评论/i.test(text))
          .sort((a, b) => b.length - a.length)[0] ||
        "";
      const pageText = readText(post).replace(/\s+/g, " ");
      const likes = pageText.match(/([\d,.]+[KMB万]?)\s*(?:likes|次赞|个赞)/i);
      const comments = pageText.match(/([\d,.]+[KMB万]?)\s*(?:comments|条评论)/i);
      const time = post.querySelector("time[datetime]");

      return {
        authorName: author || "Instagram",
        authorHandle: "",
        avatarUrl: imageSrc(avatar),
        text: author && caption.startsWith(`${author} `) ? caption.slice(author.length + 1) : caption,
        media: uniqueMedia(
          [...post.querySelectorAll("img")]
            .filter((img) => !avatars.includes(img) && img.naturalWidth >= 300)
            .map(imageSrc)
        ),
        stats: [likes && { label: "Likes", value: likes[1] }, comments && { label: "Comments", value: comments[1] }].filter(
          Boolean
        ),
        createdAtLabel: time ? formatDate(new Date(time.getAttribute("datetime"))) : "",
        sourceLabel: "instagram.com",
        sourceUrl: postLink ? absoluteUrl(postLink.getAttribute("href")) : location.href
      };
    }
  };

  const weibo = {
    id: "weibo",
    match: (host) => /(^|\.)weibo\.com$/.test(host),
    urlPatterns: ["https://weibo.com/*", "https://www.weibo.com/*"],
    findPost: (path) => closestFromPath(path, "article"),
    // Long posts are truncated with a 展开 link that loads the full text in place.
    expandButton: (post) =>
      [...post.querySelectorAll(".wbpro-feed-ogText span, .wbpro-feed-ogText a")].find((node) =>
        /^展开$/.test(readText(node))
      ),
    extract(post) {
      // The name link's class is _name_ (plain users) or _link_ (super-topic posts).
      const nameLink = post.querySelector('header a[class*="_name_"]') || post.querySelector('header a[class*="_link_"]');
      const time = post.querySelector('a[class*="_time_"]');
      const text = readText(post.querySelector(".wbpro-feed-ogText")) || readText(post.querySelector(".wbpro-feed-reText"));
      const counts = [...post.querySelectorAll('footer [class*="_item_"]')].map(readText);

      return {
        authorName: readText(nameLink) || "微博",
        authorHandle: "",
        avatarUrl: imageSrc(post.querySelector("header .woo-avatar-img")),
        text: text.replace(/\s*收起$/, ""),
        media: uniqueMedia(
          [...post.querySelectorAll("img.woo-picture-img")].map((img) =>
            imageSrc(img).replace(/\/(orj\d+|mw\d+|thumb\d+|bmiddle|thumbnail)\//, "/mw2000/")
          )
        ),
        stats: [stat("Reposts", counts[0]), stat("Comments", counts[1]), stat("Likes", counts[2])].filter(Boolean),
        createdAtLabel: String((time && time.getAttribute("title")) || "").split(" ")[0],
        sourceLabel: "weibo.com",
        sourceUrl: absoluteUrl(time && time.getAttribute("href"))
      };
    }
  };

  const zhihu = {
    id: "zhihu",
    match: (host) => /(^|\.)zhihu\.com$/.test(host),
    urlPatterns: ["https://www.zhihu.com/*", "https://zhuanlan.zhihu.com/*"],
    findPost: (path) => closestFromPath(path, ".ContentItem, .Post-Main"),
    expandButton: (post) => post.querySelector(".ContentItem-more, .ContentItem-expandButton"),
    extract(post) {
      const meta = (name) => {
        const node = post.querySelector(`meta[itemprop="${name}"]`);
        return node ? node.getAttribute("content") || "" : "";
      };
      const title =
        readText(post.querySelector(".ContentItem-title, .Post-Title")) ||
        (post.closest(".Question-main, .QuestionPage") || document).querySelector(".QuestionHeader-title");
      const answerLink = post.querySelector('.ContentItem-time a, a[href*="/answer/"]');
      const created = meta("dateCreated");

      return {
        authorName: meta("name") || readText(post.querySelector(".AuthorInfo-name")) || "知乎",
        authorHandle: readText(post.querySelector(".AuthorInfo-badgeText")),
        avatarUrl: meta("image") || imageSrc(post.querySelector(".AuthorInfo img")),
        title: typeof title === "string" ? title : readText(title),
        text: readText(post.querySelector(".RichText")),
        media: uniqueMedia(
          [...post.querySelectorAll(".RichText img")].map(
            (img) => img.getAttribute("data-original") || img.getAttribute("data-actualsrc") || imageSrc(img)
          )
        ).slice(0, 3),
        stats: [stat("Upvotes", meta("upvoteCount")), stat("Comments", meta("commentCount"))].filter(Boolean),
        createdAtLabel: created ? formatDate(new Date(created)) : readText(post.querySelector(".ContentItem-time")),
        sourceLabel: "zhihu.com",
        sourceUrl: answerLink ? absoluteUrl(answerLink.getAttribute("href")) : location.href
      };
    }
  };

  const xiaohongshu = {
    id: "xiaohongshu",
    match: (host) => /(^|\.)xiaohongshu\.com$/.test(host),
    urlPatterns: ["https://www.xiaohongshu.com/*"],
    findPost(path) {
      return closestFromPath(path, "#noteContainer, section.note-item") || document.querySelector("#noteContainer");
    },
    extract(post) {
      // Feed tiles only carry the cover, title, author and like count.
      if (post.matches("section.note-item")) {
        const link = post.querySelector("a.cover");
        return {
          authorName: readText(post.querySelector(".author .name")) || "小红书",
          avatarUrl: imageSrc(post.querySelector(".author-avatar")),
          text: readText(post.querySelector(".title")),
          media: uniqueMedia([imageSrc(post.querySelector("a.cover img"))]),
          stats: [stat("Likes", readText(post.querySelector(".like-wrapper .count")))].filter(Boolean),
          sourceLabel: "xiaohongshu.com",
          sourceUrl: absoluteUrl(link && link.getAttribute("href"))
        };
      }

      const count = (selector) => readText(post.querySelector(`.engage-bar-container ${selector} .count`));
      return {
        authorName: readText(post.querySelector(".author .username, .author-wrapper .username")) || "小红书",
        avatarUrl: imageSrc(post.querySelector(".author img, .author-wrapper img")),
        title: readText(post.querySelector("#detail-title")),
        text: readText(post.querySelector("#detail-desc")),
        media: uniqueMedia(
          [...post.querySelectorAll(".note-slider-img img")]
            .filter((img) => !img.closest(".swiper-slide-duplicate"))
            .map(imageSrc)
        ),
        stats: [
          stat("Likes", count(".like-wrapper")),
          stat("Bookmarks", count(".collect-wrapper")),
          stat("Comments", count(".chat-wrapper"))
        ].filter(Boolean),
        createdAtLabel: readText(post.querySelector(".date")),
        sourceLabel: "xiaohongshu.com",
        sourceUrl: location.href
      };
    }
  };

  root.PaperCardPlatforms = [bluesky, threads, instagram, weibo, zhihu, xiaohongshu];
})(typeof globalThis !== "undefined" ? globalThis : this);
