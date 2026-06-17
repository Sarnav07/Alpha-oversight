/**
 * Regenerates public/stair.png — a static render of the #audit AuditChainSection
 * in its NEW 3×3 grid (tic-tac-toe) layout, replacing the old diagonal-staircase
 * screenshot used as the Features card-02 art. Mirrors the live component exactly
 * (same BLOCKS, grid geometry, snake connectors, dark tokens). HTML → weasyprint.
 */
import { writeFileSync } from "node:fs";

// dark-theme tokens (app/globals.css :root)
const T = {
  page: "#020202", card: "#0f1011", subtle: "#2a2a2a", def: "#3a3a3a", hair: "#1c1d1f",
  primary: "#fefefe", body: "#c7ccd1", muted: "#888888", faint: "#5f5f5f",
  band: "#3b82f6", pass: "#34d399", complete: "#10b981",
};

const GEIST = "/home/pratham/Sarnav/band_agents/alpha-oversight-frontend/frontend/node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf";
const GEIST_MONO = "/home/pratham/Sarnav/band_agents/alpha-oversight-frontend/frontend/node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2";

const BLOCKS = [
  { i: 0, agent: "adversary", title: "Order flow crossed", band: true, hash: "0x8b1e…a3f9" },
  { i: 1, agent: "anomaly_detector", title: "Anomaly flagged", hash: "0x2c4a…11de" },
  { i: 2, agent: "investigator", title: "Recruited specialist", band: true, hash: "0x4d77…7c10" },
  { i: 3, agent: "specialist", title: "Evidence assembled", hash: "0x7a02…9b3c" },
  { i: 4, agent: "prosecution vs defense", title: "Case argued", hash: "0xb5e1…42aa" },
  { i: 5, agent: "adjudicator", title: "Verdict reached", hash: "0xc0aa…e904" },
  { i: 6, agent: "escalation_mgr", title: "Escalated to human", band: true, hash: "0x9f31…b27d" },
  { i: 7, agent: "human", title: "Human confirmed", hash: "0x3e88…1f60" },
  { i: 8, agent: "rule_engine", title: "New rule codified", hash: "0x1ed2…0f5c" },
];

// 3×3 grid geometry (tic-tac-toe), snaked in chain order — matches the component.
const W = 212, H = 50, COLS = 3, COL = 266, ROW = 110, PAD = 10;
const VB_W = 764, VB_H = 290;
const cell = (i) => { const row = Math.floor(i / COLS); const w = i % COLS; return { row, col: row % 2 === 0 ? w : COLS - 1 - w }; };
const gx = (col) => PAD + col * COL;
const gy = (row) => PAD + row * ROW;

function block(b) {
  const c = cell(b.i), x = gx(c.col), y = gy(c.row);
  const idx = String(b.i).padStart(2, "0");
  return `
    <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="11" fill="${T.card}" stroke="${T.subtle}" stroke-width="1"/>
    <text x="${x + 14}" y="${y + 19}" font-family="Geist Mono,monospace" font-size="12"><tspan fill="${T.faint}">${idx} </tspan><tspan fill="${T.primary}">${b.agent}</tspan></text>
    ${b.band ? `<circle cx="${x + W - 16}" cy="${y + 15}" r="3" fill="${T.band}"/>` : ""}
    <text x="${x + 14}" y="${y + 37}" font-family="Geist,sans-serif" font-size="10" fill="${T.muted}">${b.title}</text>
    <text x="${x + W - 14}" y="${y + 37}" text-anchor="end" font-family="Geist Mono,monospace" font-size="9.5" font-weight="500" fill="${T.pass}">${b.hash}</text>`;
}

function connector(i) {
  const a = cell(i), z = cell(i + 1);
  const ax = gx(a.col), ay = gy(a.row), zx = gx(z.col), zy = gy(z.row);
  let d, mx, my;
  if (a.row === z.row) {
    const right = z.col > a.col;
    const sx = right ? ax + W : ax, ex = right ? zx : zx + W, yy = ay + H / 2;
    d = `M ${sx} ${yy} H ${ex}`; mx = (sx + ex) / 2; my = yy;
  } else {
    const sx = ax + W / 2; d = `M ${sx} ${ay + H} V ${zy}`; mx = sx; my = (ay + H + zy) / 2;
  }
  return `
    <path d="${d}" fill="none" stroke="${T.pass}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <circle cx="${mx}" cy="${my}" r="7" fill="${T.page}" stroke="${T.subtle}" stroke-width="1"/>
    <g stroke="${T.pass}" stroke-width="1.3" fill="none" stroke-linecap="round" transform="translate(${mx - 4.5} ${my - 4.5}) scale(0.38)">
      <path d="M9 12h6"/><path d="M10 8.5h-1a3.5 3.5 0 0 0 0 7h1"/><path d="M14 8.5h1a3.5 3.5 0 0 1 0 7h-1"/>
    </g>`;
}

const SVG_W = 1040, SVG_H = Math.round((SVG_W * VB_H) / VB_W);
// weasyprint won't render inline <svg>; emit a standalone SVG that cairosvg
// rasterizes to /tmp/grid.png, then embed that PNG as an <img>.
const gridSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${VB_W} ${VB_H}" width="${SVG_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg">
  ${BLOCKS.slice(0, -1).map((b) => connector(b.i)).join("")}
  ${BLOCKS.map(block).join("")}
</svg>`;
writeFileSync("/tmp/grid.svg", gridSvg);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Geist';src:url('file://${GEIST}') format('truetype');}
@font-face{font-family:'GeistMono';src:url('file://${GEIST_MONO}') format('woff2');}
@page{size:1280px 760px;margin:0;}
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1280px;height:760px;background:${T.page};color:${T.primary};font-family:'Geist',sans-serif;overflow:hidden;}
.wrap{padding:52px 72px;}
.eyebrow{display:flex;justify-content:space-between;align-items:center;font-family:'GeistMono';font-size:13px;letter-spacing:.2em;text-transform:uppercase;}
.h2{margin-top:18px;font-size:46px;font-weight:600;letter-spacing:-.02em;line-height:1.04;}
.intro{margin-top:14px;font-size:18px;line-height:1.5;color:${T.body};max-width:1020px;}
.bar{margin-top:24px;display:flex;justify-content:space-between;align-items:center;border:1px solid ${T.subtle};border-radius:14px;padding:14px 18px;}
.btn{border:1px solid ${T.def};border-radius:9999px;padding:9px 18px;font-family:'GeistMono';font-size:14px;color:${T.primary};}
.vc{display:flex;align-items:center;gap:9px;font-family:'GeistMono';font-size:15px;color:${T.complete};}
.dot{width:10px;height:10px;border-radius:50%;background:${T.complete};display:inline-block;}
.res{margin-top:13px;font-size:14px;color:${T.muted};}
.grid{margin-top:22px;max-width:1000px;margin-left:auto;margin-right:auto;}
</style></head>
<body><div class="wrap">
  <div class="eyebrow"><span style="color:${T.muted}">Audit</span><span style="color:${T.faint}">tamper-evident · append-only</span></div>
  <div class="h2"><span style="color:${T.primary}">Every step,</span> <span style="color:${T.muted}">hash-chained.</span></div>
  <div class="intro">The same nine steps from the loop above, sealed into a logbook — each block stamped with a <span style="color:${T.primary}">fingerprint</span> of the one before it. Change any record and every fingerprint below it stops matching.</div>
  <div class="bar">
    <span class="btn">▶&nbsp;&nbsp;Simulate editing block #03</span>
    <span class="vc"><span class="dot"></span>verify_chain ✓&nbsp;&nbsp;intact</span>
  </div>
  <div class="res">All 9 blocks re-hashed end to end — nothing has been altered. Try the button to see a tamper get caught.</div>
  <div class="grid"><img src="file:///tmp/grid.png" style="display:block;width:920px;height:auto;"/></div>
</div></body></html>`;

writeFileSync("/tmp/stair.html", html);
console.log("wrote /tmp/stair.html");
