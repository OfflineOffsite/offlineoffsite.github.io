/*
 * OfflineOffsite site engine.
 * All business copy lives in /pages/*.txt — NONE in this file.
 * This file only: reads the pages folder, parses the section format, renders,
 * and wires the nav / hamburger / back-to-top. Edit CONFIG below if the repo
 * name, branch, or brand text ever change.
 */

// ======================= CONFIG =======================
const CONFIG = {
  OWNER: "OfflineOffsite",              // GitHub username/org
  REPO: "OfflineOffsite.github.io",     // repository name
  BRANCH: "main",                       // branch serving GitHub Pages
  PAGES_DIR: "pages",                   // folder holding the .txt sections + images
  PDF_FILE: "OfflineOffsite-Form.pdf",  // static PDF the Download button links to
  SITE_NAME: "OfflineOffsite",          // nav brand (site chrome, not a content section)
  PDF_LABEL: "Download PDF",            // nav button label
  USE_MANIFEST_FALLBACK: true           // fall back to pages/manifest.json if the API is unavailable
};
// ======================================================

const KEYWORDS = { HEADER: "h2", SUBHEADER: "h3", BODY: "p", NOTE: "note", IMAGE: "img" };
const POS_RE = /^([LR]?)(\d{2,})$/;
const IMG_NAME_RE = /^[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp|svg|avif)$/i;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setChrome();
  wireHamburger();
  wireBackToTop();

  try {
    const files = await listTxtFiles();
    if (!files.length) {
      showStatus("No content has been published yet. Add .txt files to the “" + CONFIG.PAGES_DIR + "” folder.");
      return;
    }
    const parsed = (await Promise.all(files.map(loadSection))).filter(Boolean);
    if (!parsed.length) {
      showStatus("Content files were found but none could be read. Check the section format in the “" + CONFIG.PAGES_DIR + "” folder.");
      return;
    }
    render(parsed);
    buildNav(parsed);
    observeFirstSection();
  } catch (err) {
    console.error("[OfflineOffsite] load failed:", err);
    showStatus("Content is temporarily unavailable. Please refresh in a little while.");
  }
}

/* ---------- Site chrome (nav brand + PDF button) ---------- */
function setChrome() {
  const brand = document.getElementById("brand");
  brand.textContent = CONFIG.SITE_NAME;

  const pdf = document.getElementById("pdfBtn");
  pdf.textContent = CONFIG.PDF_LABEL;
  pdf.setAttribute("href", CONFIG.PDF_FILE); // relative → works on root or project hosting
}

/* ---------- Discover the .txt files ---------- */
async function listTxtFiles() {
  if (CONFIG.OWNER.startsWith("REPLACE") || CONFIG.REPO.startsWith("REPLACE")) {
    showStatus("Site not configured yet: set OWNER and REPO in app.js.");
    return [];
  }

  const api = `https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/${CONFIG.PAGES_DIR}?ref=${CONFIG.BRANCH}`;
  try {
    const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 403 && res.headers.get("X-RateLimit-Remaining") === "0") {
      throw new Error("rate-limited");
    }
    if (!res.ok) throw new Error("api " + res.status);
    const entries = await res.json();
    return entries
      .filter((e) => e.type === "file" && /\.txt$/i.test(e.name))
      .map((e) => e.name);
  } catch (err) {
    console.warn("[OfflineOffsite] API listing failed, trying manifest fallback:", err);
    if (CONFIG.USE_MANIFEST_FALLBACK) {
      const list = await tryManifest();
      if (list) return list;
    }
    throw err;
  }
}

async function tryManifest() {
  try {
    const res = await fetch(`${CONFIG.PAGES_DIR}/manifest.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const arr = await res.json();
    if (Array.isArray(arr)) return arr.filter((n) => typeof n === "string" && /\.txt$/i.test(n));
  } catch (_) { /* ignore */ }
  return null;
}

/* ---------- Fetch + parse one section ---------- */
async function loadSection(name) {
  try {
    const res = await fetch(`${CONFIG.PAGES_DIR}/${encodeURIComponent(name)}`, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch " + res.status);
    return parseSection(name, await res.text());
  } catch (err) {
    console.warn(`[OfflineOffsite] could not load ${name}:`, err);
    return null;
  }
}

function parseSection(filename, raw) {
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) { console.warn(`[OfflineOffsite] ${filename}: empty file, skipped`); return null; }

  const tokens = lines[i].trim().split(/\s+/);
  const m = tokens[0] && tokens[0].match(POS_RE);
  if (!m) { console.warn(`[OfflineOffsite] ${filename}: bad position token “${tokens[0]}”, skipped`); return null; }

  const column = m[1];                 // '', 'L', 'R'
  const orderNum = parseInt(m[2], 10); // sort key
  const kind = tokens[1];              // Primary | Secondary
  if (kind !== "Primary" && kind !== "Secondary") {
    console.warn(`[OfflineOffsite] ${filename}: token 2 must be Primary or Secondary, skipped`);
    return null;
  }
  let stack = tokens[2];
  if (stack !== "Top" && stack !== "Bottom") stack = column === "R" ? "Bottom" : "Top";

  const blocks = [];
  let firstHeader = null;
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (t === "") continue;
    const sp = t.indexOf(" ");
    const kw = (sp === -1 ? t : t.slice(0, sp)).toUpperCase();
    const val = (sp === -1 ? "" : t.slice(sp + 1)).trim();
    const tag = KEYWORDS[kw];
    if (!tag) { console.warn(`[OfflineOffsite] ${filename}:${j + 1}: unknown keyword “${kw}”, skipped`); continue; }
    if (tag === "h2" && firstHeader === null) firstHeader = val;
    blocks.push({ tag, val });
  }

  return {
    filename,
    orderNum,
    column,
    kind,
    stack,
    id: slug(stripOrderPrefix(filename)),
    label: firstHeader || titleFromFilename(filename),
    blocks
  };
}

/* ---------- Render ---------- */
function render(sections) {
  sections.sort(compareSections);
  const main = document.getElementById("content");
  main.textContent = "";
  const usedIds = new Set();

  let k = 0;
  while (k < sections.length) {
    const s = sections[k];
    if (s.column === "") {
      main.appendChild(buildSectionEl(s, usedIds, false));
      k++;
    } else {
      // Gather L/R sharing this orderNum into one row.
      const group = [];
      while (k < sections.length && sections[k].column !== "" && sections[k].orderNum === s.orderNum) {
        group.push(sections[k]); k++;
      }
      const row = document.createElement("div");
      row.className = "row";
      // Keep desktop L-left / R-right by column, then append.
      group.sort((a, b) => rank(a.column) - rank(b.column));
      for (const g of group) row.appendChild(buildSectionEl(g, usedIds, true));
      main.appendChild(row);
    }
  }
}

function buildSectionEl(s, usedIds, inRow) {
  const el = document.createElement("section");
  el.className = "section";
  if (inRow) el.classList.add(s.stack === "Bottom" ? "stack-bottom" : "stack-top");
  el.id = uniqueId(s.id, usedIds);

  const inner = inRow ? document.createElement("div") : el;
  if (inRow) { inner.className = "body-card"; el.appendChild(inner); }

  for (const b of s.blocks) {
    if (b.tag === "img") {
      if (!IMG_NAME_RE.test(b.val)) { console.warn(`[OfflineOffsite] ${s.filename}: unsafe/invalid image name “${b.val}”, skipped`); continue; }
      const img = document.createElement("img");
      img.src = `${CONFIG.PAGES_DIR}/${b.val}`;
      img.loading = "lazy";
      img.alt = "";
      img.addEventListener("error", () => img.remove());
      inner.appendChild(img);
    } else if (b.tag === "note") {
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = b.val;
      inner.appendChild(p);
    } else {
      const node = document.createElement(b.tag); // h2 | h3 | p
      node.textContent = b.val;
      inner.appendChild(node);
    }
  }
  return el;
}

/* ---------- Nav ---------- */
function buildNav(sections) {
  const nav = document.getElementById("navlinks");
  nav.textContent = "";
  sections
    .filter((s) => s.kind === "Primary")
    .sort(compareSections)
    .forEach((s) => {
      const a = document.createElement("a");
      a.href = "#" + s.id;
      a.textContent = s.label;
      a.addEventListener("click", closeMenu);
      nav.appendChild(a);
    });
}

/* ---------- Hamburger ---------- */
function wireHamburger() {
  const btn = document.getElementById("hamburger");
  btn.addEventListener("click", () => {
    const open = document.getElementById("navlinks").classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
}
function closeMenu() {
  document.getElementById("navlinks").classList.remove("open");
  document.getElementById("hamburger").setAttribute("aria-expanded", "false");
}

/* ---------- Back to top ---------- */
function wireBackToTop() {
  const btn = document.getElementById("toTop");
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}
function observeFirstSection() {
  const btn = document.getElementById("toTop");
  const first = document.querySelector("#content .section");
  if (!first || !("IntersectionObserver" in window)) return;
  btn.hidden = false;
  const io = new IntersectionObserver(
    ([entry]) => {
      const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      btn.classList.toggle("show", past);
    },
    { threshold: 0 }
  );
  io.observe(first);
}

/* ---------- Helpers ---------- */
function compareSections(a, b) {
  return a.orderNum - b.orderNum || rank(a.column) - rank(b.column) || a.filename.localeCompare(b.filename);
}
function rank(col) { return col === "" ? 0 : col === "L" ? 1 : 2; }

function stripOrderPrefix(filename) {
  return filename.replace(/\.txt$/i, "").replace(/^[LR]?\d{2,}[-_ ]*/i, "");
}
function slug(str) {
  const s = str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "section";
}
function uniqueId(base, used) {
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}
function titleFromFilename(filename) {
  return stripOrderPrefix(filename)
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Section";
}
function showStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.hidden = false;
}
