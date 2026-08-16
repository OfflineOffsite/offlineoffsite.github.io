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

const BLOCKS = {
  HEADER: { tag: "h2", defAlign: "c" },
  SUBHEADER: { tag: "h3", defAlign: "c" },
  BODY: { tag: "p", defAlign: "j" },
  NOTE: { tag: "p", defAlign: "c" },
  IMAGE: { tag: "img", defAlign: null },
  BL: { tag: "ul", defAlign: "l" },
  NL: { tag: "ol", defAlign: "l" }
};
const KW_SET = new Set([...Object.keys(BLOCKS), "BACKGROUND", "DEFAULT"]);
const POS_RE = /^(\d{2,})([LR]?)$/;
const DIR_RE = /^(?:\(([^)]*)\)\s*)?(Primary|Secondary|Hide)(?:\s+(Top|Bottom))?$/;
const KW_RE = /^([A-Z]+)(?:\(([CJLR])\))?$/;
const COLOR_RE = /^#[0-9A-Fa-f]{3,8}$/;
const PCT_RE = /^(\d{1,3})%$/;
const IMG_NAME_RE = /^[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp|svg|avif)$/i;
const NARROW = 760;
const FALLBACK_BG = "#0d1117";

let DEFAULTS = {};
let LINK_TARGETS = new Map();
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
    for (const s of parsed) if (s.defaults) DEFAULTS = Object.assign(DEFAULTS, s.defaults);
    if (DEFAULTS.background) document.body.style.background = DEFAULTS.background;
    render(parsed);
    buildNav(parsed);
    observeFirstSection();
  } catch (err) {
    console.error("[OfflineOffsite] load failed:", err);
    showStatus("Content is temporarily unavailable. Please refresh in a little while.");
  }
}

function setChrome() {
  document.getElementById("brand").textContent = CONFIG.SITE_NAME;
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
  const dsp = directive.indexOf(" ");
  const posTok = dsp === -1 ? directive : directive.slice(0, dsp);
  const rest = dsp === -1 ? "" : directive.slice(dsp + 1).trim();
  const pm = posTok.match(POS_RE);
  if (!pm) { console.warn(`[OfflineOffsite] ${filename}: bad position token “${posTok}”, skipped`); return null; }
  const dm = rest.match(DIR_RE);
  if (!dm) { console.warn(`[OfflineOffsite] ${filename}: bad directive “${rest}”, skipped`); return null; }

  const orderNum = parseInt(pm[1], 10);
  const column = pm[2];
  const navLabel = dm[1] != null ? dm[1].trim() : null;
  const visibility = dm[2];
  let stack = dm[3];
  if (stack !== "Top" && stack !== "Bottom") stack = column === "R" ? "Bottom" : "Top";

  const blocks = [];
  let firstHeader = null;
  let sectionBg = null;
  let sectionDefaults = null;
  let current = null;

  const finalize = () => {
    if (!current) return;
    while (current.lines.length && current.lines[0].trim() === "") current.lines.shift();
    while (current.lines.length && current.lines[current.lines.length - 1].trim() === "") current.lines.pop();
    if (current.kw === "HEADER" && firstHeader === null && current.lines.length) firstHeader = current.lines[0].trim();
    blocks.push(current);
    current = null;
  };

  for (let j = i + 1; j < lines.length; j++) {
    const rawLine = lines[j];
    const trimmed = rawLine.trim();
    const tokens = trimmed === "" ? [] : trimmed.split(/\s+/);
    const m0 = tokens.length ? tokens[0].match(KW_RE) : null;
    const base = m0 && KW_SET.has(m0[1]) ? m0[1] : null;

    if (base) {
      finalize();
      const align = m0[2] ? m0[2].toLowerCase() : null;
      const args = tokens.slice(1);
      if (base === "DEFAULT") {
        sectionDefaults = parseDefaults(args, filename);
      } else if (base === "BACKGROUND") {
        const bg = parseBackground(args, filename);
        if (bg) sectionBg = bg;
      } else if (base === "IMAGE") {
        current = { kw: "IMAGE", align: null, lines: [] };
      } else if (base === "BL" || base === "NL") {
        const cols = args.filter((t) => COLOR_RE.test(t));
        current = { kw: base, align, markerColor: cols[0] || null, textColor: cols[1] || cols[0] || null, lines: [] };
      } else {
        current = { kw: base, align, color: args.find((t) => COLOR_RE.test(t)) || null, lines: [] };
      }
    } else if (current) {
      current.lines.push(rawLine.replace(/\s+$/, ""));
    } else if (trimmed !== "") {
      console.warn(`[OfflineOffsite] ${filename}:${j + 1}: content before first keyword, ignored`);
    }
  }
  finalize();

  return {
    filename, orderNum, column, visibility, stack,
    bg: sectionBg, defaults: sectionDefaults, blocks,
    id: slug(stripOrderPrefix(filename)),
    label: navLabel || firstHeader || titleFromFilename(filename)
  };
}

function parseDefaults(tokens, filename) {
  const d = {};
  const single = { BACKGROUND: "background", HEADER: "header", SUBHEADER: "subheader", BODY: "body", NOTE: "note" };
  let i = 0;
  while (i < tokens.length) {
    const key = tokens[i++];
    if (key in single) {
      const c = tokens[i];
      if (c && COLOR_RE.test(c)) { d[single[key]] = c; i++; }
      else console.warn(`[OfflineOffsite] ${filename}: DEFAULT ${key} missing color`);
    } else if (key === "BL" || key === "NL") {
      const b = key.toLowerCase();
      const c1 = tokens[i];
      if (c1 && COLOR_RE.test(c1)) {
        i++;
        let c2 = tokens[i];
        if (c2 && COLOR_RE.test(c2)) i++; else c2 = c1;
        d[b + "Marker"] = c1; d[b + "Text"] = c2;
      } else console.warn(`[OfflineOffsite] ${filename}: DEFAULT ${key} missing color`);
    } else {
      console.warn(`[OfflineOffsite] ${filename}: DEFAULT unknown key “${key}”`);
    }
  }
  return d;
}

function parseBackground(args, filename) {
  if (args[0] === "IMAGE") {
    const f = args[1];
    if (f && IMG_NAME_RE.test(f)) return { bgType: "image", bg: f, percent: 0 };
    console.warn(`[OfflineOffsite] ${filename}: BACKGROUND IMAGE invalid/missing filename`);
    return null;
  }
  const c = args[0];
  if (c && COLOR_RE.test(c)) {
    let pct = 0;
    if (args[1]) { const pm = args[1].match(PCT_RE); if (pm) pct = Math.min(100, parseInt(pm[1], 10)); }
    return { bgType: "color", bg: c, percent: pct };
  }
  console.warn(`[OfflineOffsite] ${filename}: BACKGROUND invalid color`);
  return null;
}

// Render
function render(sections) {
  sections.sort(compareSections);
  const main = document.getElementById("content");
  main.textContent = "";
  const fallback = DEFAULTS.background || null;

  const used = new Set();
  LINK_TARGETS = new Map();
  for (const s of sections) {
    s.finalId = uniqueId(s.id, used);
    const key = (s.label || "").trim().toLowerCase();
    if (key && !LINK_TARGETS.has(key)) LINK_TARGETS.set(key, s.finalId);
  }

  const bands = [];
  let k = 0;
  while (k < sections.length) {
    const s = sections[k];
    if (s.column === "") { bands.push({ kind: "full", secs: [s] }); k++; }
    else {
      const group = [];
      while (k < sections.length && sections[k].column !== "" && sections[k].orderNum === s.orderNum) { group.push(sections[k]); k++; }
      bands.push({ kind: "row", secs: group });
    }
  }

  for (const b of bands) {
    b.bg = b.kind === "full" ? b.secs[0].bg : (b.secs.find((x) => x.stack === "Top") || b.secs[0]).bg;
    b.color = b.bg && b.bg.bgType === "color" ? b.bg.bg : fallback;
  }

  bands.forEach((b, idx) => {
    const bandEl = document.createElement("div");
    bandEl.className = "band";
    if (b.bg && b.bg.bgType === "image") {
      bandEl.style.background = `${fallback || FALLBACK_BG} center/cover no-repeat url("${CONFIG.PAGES_DIR}/${b.bg.bg}")`;
    } else if (b.color) {
      const pct = b.bg && b.bg.bgType === "color" ? b.bg.percent : 0;
      if (pct > 0) {
        const next = bands[idx + 1] ? bands[idx + 1].color : fallback;
        bandEl.style.background = `linear-gradient(to bottom, ${b.color} 0%, ${b.color} ${100 - pct}%, ${next || b.color} 100%)`;
      } else {
        bandEl.style.background = b.color;
      }
    }

    const innerWrap = document.createElement("div");
    innerWrap.className = "band-inner";
    if (b.kind === "full") {
      innerWrap.appendChild(buildSectionEl(b.secs[0], false));
    } else {
      const row = document.createElement("div");
      row.className = "row";
      for (const g of b.secs.slice().sort((a, c) => rank(a.column) - rank(c.column))) row.appendChild(buildSectionEl(g, true));
      innerWrap.appendChild(row);
    }
    bandEl.appendChild(innerWrap);
    main.appendChild(bandEl);
  });
}

function buildSectionEl(s, inRow) {
  const el = document.createElement("section");
  el.className = "section";
  if (inRow) el.classList.add(s.stack === "Bottom" ? "stack-bottom" : "stack-top");
  el.id = s.finalId;
  const inner = inRow ? document.createElement("div") : el;
  if (inRow) { inner.className = "body-card"; el.appendChild(inner); }

  for (const block of s.blocks) {
    if (block.kw === "IMAGE") {
      const name = (block.lines.find((l) => l.trim() !== "") || "").trim();
      if (!name) { console.warn(`[OfflineOffsite] ${s.filename}: IMAGE with no filename, skipped`); continue; }
      if (!IMG_NAME_RE.test(name)) { console.warn(`[OfflineOffsite] ${s.filename}: unsafe/invalid image name “${name}”, skipped`); continue; }
      const img = document.createElement("img");
      img.src = `${CONFIG.PAGES_DIR}/${name}`;
      img.loading = "lazy";
      img.alt = "";
      img.addEventListener("error", () => img.remove());
      inner.appendChild(img);
    } else if (block.kw === "BL" || block.kw === "NL") {
      const items = [];
      for (const ln of block.lines) {
        const t = ln.trim();
        if (t === "") continue;
        if (t.startsWith("-")) items.push(t.replace(/^-\s*/, ""));
        else if (items.length) items[items.length - 1] += " " + t;
        else console.warn(`[OfflineOffsite] ${s.filename}: list line before first “- ” item, ignored`);
      }
      if (!items.length) { console.warn(`[OfflineOffsite] ${s.filename}: empty list, skipped`); continue; }
      const wrap = document.createElement("div");
      wrap.className = "list-wrap";
      const cls = alignClass(block); if (cls) wrap.classList.add(cls);
      const list = document.createElement(block.kw === "BL" ? "ul" : "ol");
      const key = block.kw.toLowerCase();
      const marker = block.markerColor || DEFAULTS[key + "Marker"];
      const text = block.textColor || DEFAULTS[key + "Text"];
      if (marker) list.style.setProperty("--marker", marker);
      for (const it of items) {
        const li = document.createElement("li");
        appendRich(li, it, text);
        if (text) li.style.color = text;
        list.appendChild(li);
      }
      wrap.appendChild(list);
      inner.appendChild(wrap);
    } else {
      const tag = BLOCKS[block.kw].tag;
      const cls = alignClass(block);
      const color = block.color || DEFAULTS[block.kw.toLowerCase()];
      for (const para of paragraphs(block.lines)) {
        const node = document.createElement(tag);
        if (block.kw === "NOTE") node.className = "note";
        if (cls) node.classList.add(cls);
        if (color) node.style.color = color;
        appendBr(node, para, color);
        inner.appendChild(node);
      }
    }
  }
  return el;
}

function alignClass(block) {
  let a = block.align || BLOCKS[block.kw].defAlign;
  if (!a) return null;
  if ((block.kw === "BL" || block.kw === "NL") && a === "j") a = "l";
  return "align-" + a;
}
function paragraphs(lines) {
  const out = [], cur = [];
  for (const ln of lines) {
    if (ln.trim() === "") { if (cur.length) { out.push(cur.slice()); cur.length = 0; } }
    else cur.push(ln);
  }
  if (cur.length) out.push(cur);
  return out;
}
function appendBr(el, para, color) {
  para.forEach((ln, idx) => {
    if (idx) el.appendChild(document.createElement("br"));
    appendRich(el, ln, color);
  });
}

// Insert text that may contain link tokens: {"Display", local(NavName)} or {"Display", url(https://...)}
// A backslash escapes the next character (\{ \} \\ \" ...), so braces/quotes can appear literally.
function appendRich(el, text, color) {
  let buf = "";
  const flush = () => { if (buf) { el.appendChild(document.createTextNode(buf)); buf = ""; } };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      buf += i + 1 < text.length ? text[i + 1] : "\\";
      i += i + 1 < text.length ? 2 : 1;
    } else if (ch === "{") {
      const link = parseLink(text, i);
      if (link) { flush(); appendLink(el, link, color); i = link.end; }
      else { buf += "{"; i++; }
    } else {
      buf += ch; i++;
    }
  }
  flush();
}

// Parse a link token starting at `text[start] === "{"`. Returns {display, type, target, end} or null.
function parseLink(text, start) {
  let i = start + 1;
  if (text[i] !== '"') return null;
  i++;
  let display = "", closed = false;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") { if (i + 1 >= text.length) return null; display += text[i + 1]; i += 2; }
    else if (c === '"') { i++; closed = true; break; }
    else { display += c; i++; }
  }
  if (!closed) return null;
  while (text[i] === " " || text[i] === "\t") i++;
  if (text[i] !== ",") return null;
  i++;
  while (text[i] === " " || text[i] === "\t") i++;
  const kw = /^(local|url)/i.exec(text.slice(i));
  if (!kw) return null;
  const type = kw[1].toLowerCase();
  i += kw[1].length;
  while (text[i] === " " || text[i] === "\t") i++;
  if (text[i] !== "(") return null;
  i++;
  let target = "";
  closed = false;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") { if (i + 1 >= text.length) return null; target += text[i + 1]; i += 2; }
    else if (c === ")") { i++; closed = true; break; }
    else { target += c; i++; }
  }
  if (!closed || text[i] !== "}") return null;
  return { display, type, target: target.trim(), end: i + 1 };
}

function appendLink(el, link, color) {
  let a = null;
  if (link.type === "local") {
    const id = LINK_TARGETS.get(link.target.toLowerCase());
    if (id) { a = document.createElement("a"); a.href = "#" + id; a.addEventListener("click", closeMenu); }
    else console.warn(`[OfflineOffsite] link to unknown section “${link.target}”, shown as text`);
  } else if (/^(https?:|mailto:)/i.test(link.target)) {
    a = document.createElement("a");
    a.href = link.target;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    console.warn(`[OfflineOffsite] blocked link URL “${link.target}”, shown as text`);
  }
  if (a) {
    a.textContent = link.display;
    const shade = shadeForLink(color);
    if (shade) a.style.color = shade;
    el.appendChild(a);
  } else {
    el.appendChild(document.createTextNode(link.display));
  }
}

// A link shade: same hue as the surrounding text, nudged darker if the text is light, lighter if dark.
function shadeForLink(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  const amt = 0.24;
  const f = lum > 0.5 ? (c) => c * (1 - amt) : (c) => c + (255 - c) * amt;
  const to2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + to2(f(rgb.r)) + to2(f(rgb.g)) + to2(f(rgb.b));
}
function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return [r, g, b].some(Number.isNaN) ? null : { r, g, b };
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
  document.getElementById("hamburger").addEventListener("click", toggleMenu);
  document.getElementById("backdrop").addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
}
function toggleMenu() {
  const open = document.getElementById("menu").classList.toggle("open");
  document.getElementById("backdrop").classList.toggle("show", open);
  document.getElementById("hamburger").setAttribute("aria-expanded", String(open));
}
function closeMenu() {
  document.getElementById("menu").classList.remove("open");
  document.getElementById("backdrop").classList.remove("show");
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
  return filename.replace(/\.txt$/i, "").replace(/^\d{2,}[LR]?[-_ ]*/i, "");
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
