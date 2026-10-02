// Renders promo.html frame by frame through the Chrome DevTools Protocol.
// Usage: node capture.mjs <outDir> [fps=30] [duration=15]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] || path.join(here, "frames"));
const fps = Number(process.argv[3] || 30);
const duration = Number(process.argv[4] || 15);
const port = 9400 + Math.floor(Math.random() * 400);
const profile = path.join(here, ".chrome-capture");

mkdirSync(outDir, { recursive: true });
rmSync(profile, { recursive: true, force: true });

const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    "--allow-file-access-from-files",
    "about:blank"
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await pageWsUrl());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + " " + JSON.stringify(res.exceptionDetails.exception));
  return res.result.value;
};

try {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: pathToFileURL(path.join(here, "promo.html")).href });
  await sleep(800);
  await evaluate(`Promise.all([...document.images].map((i) => i.decode().catch(() => null))).then(() => document.fonts.ready).then(() => true)`);

  const total = Math.round(fps * duration);
  for (let frame = 0; frame < total; frame++) {
    const t = frame / fps;
    await evaluate(`window.render(${t}); true`);
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(path.join(outDir, `f${String(frame).padStart(4, "0")}.png`), Buffer.from(data, "base64"));
    if (frame % 60 === 0) console.log(`frame ${frame}/${total}`);
  }
  console.log("done");
} finally {
  ws.close();
  chrome.kill("SIGKILL");
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
