// CONFIG
const CONFIG = {
  OWNER: "OfflineOffsite",
  REPO: "OfflineOffsite.github.io",
  BRANCH: "main",
  PAGES_DIR: "pages",
  PDF_FILE: "OfflineOffsite-Form.pdf",
  SITE_NAME: "OfflineOffsite",
  PDF_LABEL: "Download PDF",
  USE_MANIFEST_FALLBACK: true
};

const KEYWORDS = { HEADER: "h2", SUBHEADER: "h3", BODY: "p", NOTE: "note", IMAGE: "img" };
const POS_RE = /^([LR]?)(\d{2,})$/;
const DIR_RE = /^(Primary|Secondary|Hide)(?:\(([^)]*)\))?(?:\s+(Top|Bottom))?$/;
const IMG_NAME_RE = /^[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp|svg|avif)$/i;
const NARROW = 760;

let primaryItems = [];
let secondaryItems = [];

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

function setChrome() {
  const brand = document.getElementById("brand");
  brand.textContent = CONFIG.SITE_NAME;
  const pdf = document.getElementById("pdfBtn");
  pdf.textContent = CONFIG.PDF_LABEL;
  pdf.setAttribute("href", CONFIG.PDF_FILE);
}

// Discover the .txt files
async function listTxtFiles() {
  if (CONFIG.OWNER.startsWith("REPLACE") || CONFIG.REPO.startsWith("REPLACE")) {
    showStatus("Site not configured yet: set OWNER and REPO in app.js.");
    return [];
  }
  const api = `https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}/contents/${CONFIG.PAGES_DIR}?ref=${CONFIG.BRANCH}`;
  try {
    const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 403 && res.headers.get("X-RateLimit-Remaining") === "0") throw new Error("rate-limited");
    if (!res.ok) throw new Error("api " + res.status);
    const entries = await res.json();
    return entries.filter((e) => e.type === "file" && /\.txt$/i.test(e.name)).map((e) => e.name);
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

  const directive = lines[i].trim();
  const sp = directive.indexOf(" ");
  const posTok = sp === -1 ? directive : directive.slice(0, sp);
  const rest = sp === -1 ? "" : directive.slice(sp + 1).trim();

  const pm = posTok.match(POS_RE);
  if (!pm) { console.warn(`[OfflineOffsite] ${filename}: bad position token “${posTok}”, skipped`); return null; }
  const dm = rest.match(DIR_RE);
  if (!dm) { console.warn(`[OfflineOffsite] ${filename}: bad directive “${rest}”, skipped`); return null; }

  const column = pm[1];
  const orderNum = parseInt(pm[2], 10);
  const visibility = dm[1];
  const navLabel = dm[2] != null ? dm[2].trim() : null;
  let stack = dm[3];
  if (stack !== "Top" && stack !== "Bottom") stack = column === "R" ? "Bottom" : "Top";

  const blocks = [];
  let firstHeader = null;
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (t === "") continue;
    const s = t.indexOf(" ");
    const kw = (s === -1 ? t : t.slice(0, s)).toUpperCase();
    const val = (s === -1 ? "" : t.slice(s + 1)).trim();
    const tag = KEYWORDS[kw];
    if (!tag) { console.warn(`[OfflineOffsite] ${filename}:${j + 1}: unknown keyword “${kw}”, skipped`); continue; }
    if (tag === "h2" && firstHeader === null) firstHeader = val;
    blocks.push({ tag, val });
  }

  return {
    filename, orderNum, column, visibility, stack,
    id: slug(stripOrderPrefix(filename)),
    label: navLabel || firstHeader || titleFromFilename(filename),
    blocks
  };
}

// Render sections
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
      const group = [];
      while (k < sections.length && sections[k].column !== "" && sections[k].orderNum === s.orderNum) {
        group.push(sections[k]); k++;
      }
      const row = document.createElement("div");
      row.className = "row";
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
      const node = document.createElement(b.tag);
      node.textContent = b.val;
      inner.appendChild(node);
    }
  }
  return el;
}

// Navigation
function buildNav(sections) {
  primaryItems = sections.filter((s) => s.visibility === "Primary").sort(compareSections);
  secondaryItems = sections.filter((s) => s.visibility === "Secondary").sort(compareSections);

  const nav = document.getElementById("navlinks");
  nav.textContent = "";
  for (const s of primaryItems) nav.appendChild(navLink(s));

  layoutNav();
  window.addEventListener("resize", () => {
    if (layoutNav._raf) cancelAnimationFrame(layoutNav._raf);
    layoutNav._raf = requestAnimationFrame(layoutNav);
  });
}

function navLink(s) {
  const a = document.createElement("a");
  a.href = "#" + s.id;
  a.textContent = s.label;
  a.addEventListener("click", closeMenu);
  return a;
}

function layoutNav() {
  const header = document.getElementById("nav");
  const navlinks = document.getElementById("navlinks");
  const menu = document.getElementById("menu");
  const burger = document.getElementById("hamburger");

  header.classList.remove("collapsed");
  const overflow = navlinks.scrollWidth > navlinks.clientWidth + 1;
  const collapsed = window.innerWidth <= NARROW || overflow;
  header.classList.toggle("collapsed", collapsed);

  menu.textContent = "";
  if (collapsed) for (const s of primaryItems) menu.appendChild(navLink(s));
  for (const s of secondaryItems) menu.appendChild(navLink(s));

  burger.hidden = menu.children.length === 0;
  if (burger.hidden) closeMenu();
}

function wireHamburger() {
  const btn = document.getElementById("hamburger");
  btn.addEventListener("click", () => {
    const open = document.getElementById("menu").classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
}
function closeMenu() {
  document.getElementById("menu").classList.remove("open");
  document.getElementById("hamburger").setAttribute("aria-expanded", "false");
}

// Back to top
function wireBackToTop() {
  document.getElementById("toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}
function observeFirstSection() {
  const btn = document.getElementById("toTop");
  const first = document.querySelector("#content .section");
  if (!first || !("IntersectionObserver" in window)) return;
  btn.hidden = false;
  new IntersectionObserver(
    ([entry]) => btn.classList.toggle("show", !entry.isIntersecting && entry.boundingClientRect.top < 0),
    { threshold: 0 }
  ).observe(first);
}

// Helpers
function compareSections(a, b) {
  return a.orderNum - b.orderNum || rank(a.column) - rank(b.column) || a.filename.localeCompare(b.filename);
}
function rank(col) { return col === "" ? 0 : col === "L" ? 1 : 2; }
function stripOrderPrefix(filename) {
  return filename.replace(/\.txt$/i, "").replace(/^[LR]?\d{2,}[-_ ]*/i, "");
}
function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}
function uniqueId(base, used) {
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}
function titleFromFilename(filename) {
  return stripOrderPrefix(filename).replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || "Section";
}
function showStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.hidden = false;
}
