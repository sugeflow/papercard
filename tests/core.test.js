const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core.js");

test("normalizeHandle adds @ for X handles but keeps Reddit prefixes", () => {
  assert.equal(core.normalizeHandle("jack"), "@jack");
  assert.equal(core.normalizeHandle("@jack"), "@jack");
  assert.equal(core.normalizeHandle("u/spez"), "u/spez");
  assert.equal(core.normalizeHandle("r/pics"), "r/pics");
});

test("normalizeMedia upgrades twimg images and dedupes by canonical source", () => {
  const media = core.normalizeMedia([
    { src: "https://pbs.twimg.com/media/abc?format=jpg&name=small" },
    { src: "https://pbs.twimg.com/media/abc?format=jpg&name=medium" }
  ]);
  assert.equal(media.length, 1);
  assert.match(media[0].src, /name=large/);
});

test("normalizeMedia dedupes Reddit preview and i.redd.it copies of one image", () => {
  const media = core.normalizeMedia([
    "https://preview.redd.it/xyz.jpg?width=640&auto=webp",
    "https://preview.redd.it/xyz.jpg?width=1080&auto=webp",
    "https://i.redd.it/xyz.jpg"
  ]);
  assert.equal(media.length, 1);
});

test("normalizeMedia dedupes slugged preview.redd.it URLs against the i.redd.it original", () => {
  const media = core.normalizeMedia([
    "https://preview.redd.it/opus-5-5-is-amazing-v0-k3j9x2abcd1f1.png?width=1080&format=png&auto=webp&s=abc",
    "https://i.redd.it/k3j9x2abcd1f1.png",
    "https://preview.redd.it/another-image-v0-zz99yy88xx7w1.png?width=640"
  ]);
  assert.equal(media.length, 2);
});

test("normalizeStats understands X and Reddit stat labels", () => {
  const stats = core.normalizeStats([
    { label: "Likes", value: "12" },
    { label: "Upvotes", value: "3.4K" },
    { label: "comment", value: "56" },
    { label: "Unknown", value: "1" }
  ]);
  assert.deepEqual(stats, [
    { label: "Likes", value: "12" },
    { label: "Upvotes", value: "3.4K" },
    { label: "Comments", value: "56" }
  ]);
});

test("normalizeShareSettings falls back to defaults and filters unknown fields", () => {
  assert.deepEqual(core.normalizeShareSettings({}), core.DEFAULT_SHARE_SETTINGS);
  assert.deepEqual(
    core.normalizeShareSettings({ template: "magazine", theme: "dark", footerFields: ["comments", "nope"], showQrCode: 1 }),
    {
      template: "magazine",
      theme: "dark",
      footerFields: ["comments"],
      ratio: "auto",
      showQrCode: true,
      showBranding: false,
      showPlatformIcon: true
    }
  );
  assert.equal(core.normalizeShareSettings({ template: "nope" }).template, "paper");
});

test("formatTweetStats only includes selected footer fields", () => {
  const stats = [
    { label: "Upvotes", value: "10" },
    { label: "Comments", value: "2" }
  ];
  assert.equal(core.formatTweetStats(stats, { footerFields: ["comments"] }), "2 Comments");
});

test("buildShareCardHtml escapes content and renders the title", () => {
  const html = core.buildShareCardHtml({
    authorName: "r/test",
    authorHandle: "u/someone",
    title: "Hello <b>",
    text: "line 1\nline 2"
  });
  assert.match(html, /twitter-share-title">Hello &lt;b&gt;/);
  assert.match(html, /line 1<br>line 2/);
  assert.match(html, /u\/someone/);
});

test("wrapCardText wraps CJK text and keeps punctuation off line starts", () => {
  const ctx = { measureText: (text) => ({ width: [...text].length * 10 }) };
  const lines = core.wrapCardText(ctx, "这是一个测试，用来检查换行。", 50);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(!/^[，。]/.test(line));
});

test("normalizeStats maps Xiaohongshu collects to bookmarks", () => {
  assert.deepEqual(core.normalizeStats([{ label: "collect", value: "41" }]), [{ label: "Bookmarks", value: "41" }]);
});

test("clampText leaves short text alone and cuts long text at a sentence end", () => {
  assert.equal(core.clampText("短文本。"), "短文本。");
  const long = "第一句话很长。".repeat(300);
  const clamped = core.clampText(long, 100);
  assert.ok([...clamped].length <= 101);
  assert.match(clamped, /。…$/);
});

test("normalizeTweetData keeps thread parts and drops empty ones", () => {
  const data = core.normalizeTweetData({
    authorName: "a",
    parts: [{ text: "one" }, { text: "  " }, { text: "", media: ["https://pbs.twimg.com/media/x?name=small"] }]
  });
  assert.equal(data.parts.length, 2);
  assert.equal(data.parts[0].text, "one");
  assert.match(data.parts[1].media[0].src, /name=large/);
});

test("normalizeShareSettings keeps known ratios only", () => {
  assert.equal(core.normalizeShareSettings({ ratio: "4:5" }).ratio, "4:5");
  assert.equal(core.normalizeShareSettings({ ratio: "3:2" }).ratio, "auto");
});

test("parseStatsText reads X's action bar summary and compacts raw counts", () => {
  assert.deepEqual(core.parseStatsText("167481 replies, 744280 reposts, 4188675 likes, 22504 bookmarks, 1.2M views"), [
    { label: "Replies", value: "167.5K" },
    { label: "Reposts", value: "744.3K" },
    { label: "Likes", value: "4.2M" },
    { label: "Bookmarks", value: "22.5K" },
    { label: "Views", value: "1.2M" }
  ]);
  assert.deepEqual(core.parseStatsText("12 条回复、3 次转帖、1,024 次喜欢"), [
    { label: "Replies", value: "12" },
    { label: "Reposts", value: "3" },
    { label: "Likes", value: "1K" }
  ]);
});

test("parseStatsText ignores labels without counts", () => {
  assert.deepEqual(core.parseStatsText("Reply, Repost, Like"), []);
});

test("normalizeShareSettings shows the platform icon unless it is turned off", () => {
  assert.equal(core.normalizeShareSettings({}).showPlatformIcon, true);
  assert.equal(core.normalizeShareSettings({ showPlatformIcon: false }).showPlatformIcon, false);
});

test("normalizeTweetData keeps a quoted post separate from the outer text", () => {
  const data = core.normalizeTweetData({
    authorName: "a",
    text: "outer",
    quote: { authorName: "b", authorHandle: "b", text: " inner ", media: [{ src: "https://pbs.twimg.com/media/q?name=small", video: true }] }
  });
  assert.equal(data.text, "outer");
  assert.equal(data.quote.text, "inner");
  assert.equal(data.quote.authorHandle, "@b");
  assert.equal(data.quote.media[0].video, true);
  assert.equal(core.normalizeTweetData({ quote: { text: "  " } }).quote, null);
});

test("normalizeTweetData keeps one blank line between paragraphs", () => {
  const data = core.normalizeTweetData({ text: "one\n\n\n two \n\nthree\nfour" });
  assert.equal(data.text, "one\n\ntwo\n\nthree\nfour");
});

test("normalizeTweetData keeps a link preview with a title or image", () => {
  const data = core.normalizeTweetData({ text: "x", link: { domain: "apate.ai", title: "Apate\n| AI", image: "https://pbs.twimg.com/card_img/1/a" } });
  assert.deepEqual(data.link, { domain: "apate.ai", title: "Apate | AI", description: "", image: "https://pbs.twimg.com/card_img/1/a" });
  assert.equal(core.normalizeTweetData({ link: { domain: "a.com" } }).link, null);
});

test("wrapCardText breaks CJK after any character, even right after a Latin word", () => {
  const ctx = { measureText: (text) => ({ width: [...text].length * 10 }) };
  const lines = core.wrapCardText(ctx, "这些AI会假装成各种人", 60);
  assert.equal(lines[0], "这些AI会假");
});
