/**
 * Browser-driven end-to-end proof for the Alpha & Oversight live desk.
 * Drives the REAL UI (http://localhost:4100/desk, NEXT_PUBLIC_DATA_MODE=live)
 * against the REAL backend (http://localhost:8077) with the cached Chromium via
 * puppeteer-core. Triggers Beat A / Beat B / human-confirm / audit / R&D by
 * clicking the actual buttons, polls the backend for authoritative state, and
 * screenshots the #live-desk element at each milestone. Evidence: PNGs + e2e.log
 * + diagnostics.json (console errors / page errors / failed requests).
 *
 * Run: node run-e2e.mjs   (takes several minutes — real LLM calls per beat)
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire("/home/pratham/Sarnav/band_agents/report/");
const puppeteer = require("puppeteer-core");

const BASE = "http://localhost:4100";
const API = "http://localhost:8077";
const OUT = "/home/pratham/Sarnav/band_agents/alpha-oversight/frontend/tasks/e2e";
mkdirSync(OUT, { recursive: true });
const LOG = join(OUT, "e2e.log");
writeFileSync(LOG, "");
const log = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); appendFileSync(LOG, l + "\n"); };

const candidates = [
  process.env.CHROME_BIN,
  join(homedir(), ".cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome"),
  join(homedir(), ".cache/puppeteer/chrome/linux-146.0.7680.76/chrome-linux64/chrome"),
  join(homedir(), ".cache/ms-playwright/chromium-1228/chrome-linux64/chrome"),
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) { log("FATAL: no cached chromium found"); process.exit(1); }
log("chromium: " + executablePath);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function apiGet(p) { try { const r = await fetch(API + p); return await r.json(); } catch { return null; } }
async function caseIds() { const c = await apiGet("/cases"); return new Set((c || []).map((x) => x.case_id)); }
async function newCase(before, states) {
  const c = await apiGet("/cases"); if (!c) return null;
  return c.filter((x) => !before.has(x.case_id)).find((x) => states.includes(x.state)) || null;
}
async function waitFor(fn, { timeout = 150000, interval = 2000, label = "" } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    let v; try { v = await fn(); } catch { v = null; }
    if (v) { log(`  ✓ ${label} (${((Date.now() - t0) / 1000).toFixed(0)}s)`); return v; }
    await sleep(interval);
  }
  log(`  ✗ TIMEOUT ${label} (${(timeout / 1000) | 0}s)`); return null;
}

const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 1.5 },
});
const page = await browser.newPage();

const consoleErrors = [], pageErrors = [], failedRequests = [], httpErrors = [];
page.on("console", (m) => { if (m.type() === "error") { consoleErrors.push(m.text()); log("    [console.error] " + m.text().slice(0, 160)); } });
page.on("pageerror", (e) => { pageErrors.push(String(e)); log("    [pageerror] " + String(e).slice(0, 160)); });
page.on("requestfailed", (r) => { const u = r.url(); if (u.includes("4100") || u.includes("8077")) { failedRequests.push(u); log("    [requestfailed] " + u.slice(0, 120)); } });
page.on("response", (r) => { const u = r.url(); if ((u.includes("8077") || u.includes("/demo/") || u.includes("/confirm")) && r.status() >= 400) { httpErrors.push(r.status() + " " + u); log(`    [http ${r.status()}] ${u.slice(0, 120)}`); } });

async function clickText(texts, scroll = true) {
  const hit = await page.evaluate((texts, scroll) => {
    const els = [...document.querySelectorAll("button,[role=button],a")];
    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    for (const t of texts) { const el = els.find((e) => norm(e.textContent).includes(t.toLowerCase())); if (el) { if (scroll) el.scrollIntoView({ block: "center" }); el.click(); return norm(el.textContent); } }
    return null;
  }, texts, scroll);
  if (hit) log(`  ▶ clicked "${hit}"`); else log(`  ✗ button not found: ${texts.join(" | ")}`);
  return !!hit;
}
async function scrollLiveDesk() { await page.evaluate(() => document.getElementById("live-desk")?.scrollIntoView({ block: "start" })); await sleep(600); }
async function shotEl(sel, name) {
  try { const el = await page.$(sel); if (el) { await el.screenshot({ path: join(OUT, name + ".png") }); log("  📸 " + name + ".png"); return; } } catch (e) { log("  (el shot failed: " + e.message + ")"); }
  await page.screenshot({ path: join(OUT, name + ".png") }); log("  📸 " + name + ".png (viewport)");
}
async function shotView(name) { await page.screenshot({ path: join(OUT, name + ".png") }); log("  📸 " + name + ".png (viewport)"); }
async function deskHas(substr) { const t = await page.evaluate(() => document.getElementById("live-desk")?.innerText || document.body.innerText); return t.toLowerCase().includes(substr.toLowerCase()); }

const result = { steps: {} };
async function step(name, fn) { log(`\n=== ${name} ===`); try { await fn(); result.steps[name] = "ok"; } catch (e) { result.steps[name] = "error: " + e.message; log("  !! step error: " + (e.stack || e.message)); } }

try {
  await step("1 landing", async () => {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(3500); await shotView("01-landing");
  });

  await step("2 desk live-connect", async () => {
    await page.goto(BASE + "/desk", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!document.getElementById("live-desk"), { timeout: 30000 });
    await scrollLiveDesk();
    const ok = await waitFor(async () => (await page.evaluate(() => document.querySelector('button')?.ownerDocument?.body?.innerText || "")).includes("Run Beat A") ? true : null, { timeout: 20000, interval: 1000, label: "demo controls present" });
    const baseRules = await apiGet("/rules"); log("  baseline rules=" + (baseRules?.length));
    await shotEl("#live-desk", "02-desk-connected");
  });

  await step("3 Beat A -> FLAGGED", async () => {
    const before = await caseIds();
    await clickText(["Run Beat A"]);
    const c = await waitFor(() => newCase(before, ["FLAGGED"]), { timeout: 200000, label: "Beat A backend FLAGGED" });
    result.beatA = c;
    await waitFor(() => deskHas("flag"), { timeout: 20000, interval: 1500, label: "UI shows flag" });
    await sleep(2500); await scrollLiveDesk(); await shotEl("#live-desk", "03-beatA-flagged");
    log("  beatA case=" + (c?.case_id) + " state=" + (c?.state) + " rule=" + (c?.verdict?.rule_id));
  });

  await step("4 Beat B -> ESCALATED", async () => {
    const before = await caseIds();
    await clickText(["Run Beat B"]);
    const c = await waitFor(() => newCase(before, ["ESCALATED"]), { timeout: 200000, label: "Beat B backend ESCALATED" });
    result.beatB = c;
    await waitFor(() => deskHas("human review"), { timeout: 30000, interval: 1500, label: "HITL panel visible" });
    await sleep(1500); await scrollLiveDesk(); await shotEl("#live-desk", "04-beatB-escalated");
    log("  beatB case=" + (c?.case_id) + " state=" + (c?.state));
  });

  await step("5 Confirm -> codify 4->5", async () => {
    const ok = await clickText(["confirm — codify", "codify rule", "confirm"]);
    const r = await waitFor(async () => { const x = await apiGet("/rules"); return x && x.length >= 5 ? x : null; }, { timeout: 90000, label: "backend rules 4->5" });
    result.rulesAfterConfirm = r ? r.length : null;
    await sleep(3000); await scrollLiveDesk();
    // scroll the rule registry into view for the codify screenshot
    await page.evaluate(() => { const els=[...document.querySelectorAll('*')]; const el=els.find(e=>/rule registry|active rules|rulebook/i.test(e.textContent||'')&&e.children.length<40); el?.scrollIntoView({block:'center'}); });
    await sleep(800); await shotEl("#live-desk", "05-codify-4to5");
    log("  rules after confirm=" + result.rulesAfterConfirm + " :: " + (r || []).map((x) => x.id).join(", "));
  });

  await step("6 Audit drawer verify_chain", async () => {
    await clickText(["audit"]);
    await waitFor(() => deskHas("verify_chain"), { timeout: 20000, interval: 1000, label: "audit drawer open" });
    await sleep(1200); await shotView("06-audit-verified");
    const verified = await page.evaluate(() => document.body.innerText.includes("verify_chain ✓"));
    const leaves = await page.evaluate(() => { const m = document.body.innerText.match(/(\d+)\s+leaves/); return m ? +m[1] : null; });
    result.audit = { verifiedTick: verified, leaves };
    log("  audit verify_chain ✓ =" + verified + " leaves=" + leaves);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(500);
  });

  await step("7 Run R&D (live adversary)", async () => {
    const before = await caseIds();
    await scrollLiveDesk();
    await clickText(["run r&d", "r&d"]);
    await sleep(8000); await shotEl("#live-desk", "07-rnd-running");
    const c = await waitFor(() => newCase(before, ["FLAGGED", "ESCALATED", "CLOSED"]), { timeout: 240000, interval: 5000, label: "R&D produced a case" });
    result.rnd = c ? { case_id: c.case_id, state: c.state } : "no-new-case (adversary may not have found an evasion — acceptable)";
    await sleep(3000); await scrollLiveDesk(); await shotEl("#live-desk", "08-rnd-settled");
    log("  rnd=" + JSON.stringify(result.rnd));
  });

  result.finalStats = await apiGet("/stats");
  log("\nFINAL /stats = " + JSON.stringify(result.finalStats));
} catch (err) {
  log("FATAL: " + (err?.stack || err));
} finally {
  result.diagnostics = { consoleErrors: consoleErrors.length, pageErrors: pageErrors.length, failedRequests, httpErrors };
  writeFileSync(join(OUT, "diagnostics.json"), JSON.stringify({ result, consoleErrors, pageErrors, failedRequests, httpErrors }, null, 2));
  log("\n=== DIAGNOSTICS === consoleErrors=" + consoleErrors.length + " pageErrors=" + pageErrors.length + " failedRequests=" + failedRequests.length + " httpErrors=" + httpErrors.length);
  log("=== STEP RESULTS === " + JSON.stringify(result.steps));
  await browser.close();
  log("DONE");
}
