(function initOptionsPage() {
  const core = window.TwitterShareImageCore;
  const renderer = window.PaperCardRenderer;
  const DEFAULT_SETTINGS = core.DEFAULT_SHARE_SETTINGS;
  const hasChrome = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

  const form = document.getElementById("settings");
  const fieldInputs = [...document.querySelectorAll('input[name="footerFields"]')];
  const themeInputs = [...document.querySelectorAll('input[name="theme"]')];
  const templateInputs = [...document.querySelectorAll('input[name="template"]')];
  const ratioInputs = [...document.querySelectorAll('input[name="ratio"]')];
  const qrInput = document.getElementById("showQrCode");
  const brandingInput = document.getElementById("showBranding");
  const platformIconInput = document.getElementById("showPlatformIcon");
  const status = document.getElementById("status");
  const preview = document.getElementById("preview");
  const sampleTabs = [...document.querySelectorAll("[data-sample]")];
  let sample = "x";
  let statusTimer = 0;
  let renderToken = 0;

  localize();
  showShortcut();
  loadSettings();
  form.addEventListener("change", saveSettings);
  for (const tab of sampleTabs) {
    tab.addEventListener("click", () => {
      sample = tab.dataset.sample;
      renderPreview(readForm());
    });
  }

  function t(key, fallback) {
    return (hasChrome && chrome.i18n.getMessage(key)) || fallback;
  }

  function localize() {
    document.documentElement.lang = t("@@ui_locale", "en").replace("_", "-");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.dataset.i18n, node.textContent);
    }
    document.title = `PaperCard · ${t("optionsTitle", "Settings")}`;
  }

  async function showShortcut() {
    const shortcutNode = document.getElementById("shortcut");
    const editButton = document.getElementById("editShortcut");
    if (!hasChrome) return;

    const commands = await chrome.commands.getAll();
    const command = commands.find((item) => item.name === "create-selection-card");
    shortcutNode.textContent = (command && command.shortcut) || t("shortcutNotSet", "Not set");
    editButton.addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
  }

  async function loadSettings() {
    const settings = hasChrome ? await chrome.storage.sync.get(DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
    applySettings(core.normalizeShareSettings(settings));
  }

  function applySettings(settings) {
    for (const input of fieldInputs) input.checked = settings.footerFields.includes(input.value);
    for (const input of themeInputs) input.checked = input.value === settings.theme;
    for (const input of templateInputs) input.checked = input.value === settings.template;
    for (const input of ratioInputs) input.checked = input.value === settings.ratio;
    qrInput.checked = settings.showQrCode;
    brandingInput.checked = settings.showBranding;
    platformIconInput.checked = settings.showPlatformIcon;
    renderPreview(settings);
    renderTemplateThumbnails(settings);
  }

  function readForm() {
    return core.normalizeShareSettings({
      footerFields: fieldInputs.filter((input) => input.checked).map((input) => input.value),
      template: (templateInputs.find((input) => input.checked) || {}).value,
      theme: (themeInputs.find((input) => input.checked) || {}).value,
      ratio: (ratioInputs.find((input) => input.checked) || {}).value,
      showQrCode: qrInput.checked,
      showBranding: brandingInput.checked,
      showPlatformIcon: platformIconInput.checked
    });
  }

  async function saveSettings(event) {
    const settings = readForm();
    renderPreview(settings);
    if (event && event.target && event.target.name === "theme") renderTemplateThumbnails(settings);
    if (hasChrome) await chrome.storage.sync.set(settings);

    status.textContent = t("optionsSaved", "Saved");
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 1600);
  }

  async function renderPreview(settings) {
    const token = ++renderToken;
    for (const tab of sampleTabs) tab.setAttribute("aria-selected", String(tab.dataset.sample === sample));

    const canvas = await renderer.renderToCanvas(sampleCard(sample), settings);
    if (token !== renderToken) return;
    preview.src = canvas.toDataURL("image/png");
    preview.alt = t("toastPreviewAlt", "Share card preview");
  }

  // Thumbnails show each style in the current theme with a short sample.
  async function renderTemplateThumbnails(settings) {
    const sampleData = core.normalizeTweetData({
      authorName: "Paper Reader",
      authorHandle: "paper_reader",
      text: t("sampleThumbBody", "Keep what moves you.")
    });
    for (const input of templateInputs) {
      const canvas = await renderer.renderToCanvas(sampleData, {
        ...settings,
        template: input.value,
        ratio: "auto",
        footerFields: ["date"],
        showQrCode: false,
        showBranding: false
      });
      input.nextElementSibling.src = canvas.toDataURL("image/png");
    }
  }

  // Fictional sample content so the preview reflects every footer option.
  function sampleCard(kind) {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    if (kind === "reddit") {
      return core.normalizeTweetData({
        authorName: "r/books",
        authorHandle: "u/paper_reader",
        title: t("sampleRedditTitle", "What's a sentence you still think about years later?"),
        text: t("sampleRedditBody", "My grandmother wrote “Be kind to your future self” inside every book she gave me. I still hear it."),
        stats: [
          { label: "Upvotes", value: "4.2K" },
          { label: "Comments", value: "318" }
        ],
        createdAtLabel: date,
        sourceLabel: "reddit.com",
        platform: "reddit",
        sourceUrl: "https://www.reddit.com/r/books/"
      });
    }

    if (kind === "quote") {
      return core.normalizeTweetData({
        authorName: t("sampleQuoteSite", "The Reading Room"),
        text: t(
          "sampleQuoteBody",
          "Good writing is clear thinking made visible. Say the thing, then stop."
        ),
        createdAtLabel: date,
        sourceLabel: "example.com",
        sourceUrl: "https://example.com/"
      });
    }

    return core.normalizeTweetData({
      authorName: "Paper Reader",
      authorHandle: "paper_reader",
      text: t(
        "sampleXBody",
        "Read slowly. Keep what moves you. Share it so it can move someone else, too."
      ),
      stats: [
        { label: "Replies", value: "86" },
        { label: "Reposts", value: "1.2K" },
        { label: "Likes", value: "9.8K" },
        { label: "Bookmarks", value: "640" },
        { label: "Views", value: "210K" }
      ],
      createdAtLabel: date,
      platform: "x",
      sourceLabel: "x.com",
      sourceUrl: "https://x.com/"
    });
  }
})();
