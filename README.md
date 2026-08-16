# OfflineOffsite

The OfflineOffsite website. It is a single static page hosted free on GitHub Pages.
**All of the site's text lives in plain `.txt` files in the [`pages/`](pages/) folder.**
You can add, edit, or remove sections by editing those files directly on GitHub —
you never need to touch the HTML, CSS, or JavaScript.

---

## Editing the website text

Each `.txt` file in `pages/` is one **section** of the page. The site reads the folder
every time it loads and shows the sections in the order you choose.

### The first line of every file

The first line tells the site **where** the section goes:

```
<position> [(Nav name)] <Primary|Secondary|Hide> [Top|Bottom]
```

- **position** — controls order and layout:
  - `NN` — a normal full-width section (e.g. `01`, `05`). `NN` is a two-digit number; **lower numbers appear higher up the page.**
  - `NNL` / `NNR` — a **side-by-side** pair: the number first, then `L` (left column) or `R` (right column). `05L` and `05R` share one row (same number = same row). On phones they stack into one column. Name the files the same way, e.g. `05L-payment.txt`.
- **(Nav name)** *(optional)* — a short label for the nav/menu link, in parentheses **right after the position**, e.g. `(Pricing)` or `(Time Capsule)`. If you leave it off, the section's first `HEADER` is used. Keep these short so the navbar stays on one line.
- **Primary / Secondary / Hide** — where the section appears in navigation:
  - `Primary` — a link in the top navigation bar.
  - `Secondary` — a link in the hamburger (☰) menu only. On phones, Secondary links are listed after the Primary ones.
  - `Hide` — no navigation link at all; the section still shows on the page.
- **Top / Bottom** *(optional, only for `L`/`R` sections)* — when a side-by-side pair stacks on a phone, `Top` shows first and `Bottom` shows second. If you leave it off, the left one is on top.

The navbar always stays on one line: if there are too many Primary links to fit, they all move into the ☰ menu automatically.

Examples:
```
03 (Pricing) Primary            → 3rd section, full width, navbar link labelled "Pricing"
09 Hide                         → 9th section, full width, not in any menu
04L (Send) Secondary Top        → 4th row, left column, in the ☰ menu, shows first on phones
04R (Packaging) Secondary Bottom → 4th row, right column, in the ☰ menu, shows second on phones
```

### The rest of the file

> **Breaking change:** each keyword now goes **on its own line**, and the text follows **on the line(s) below it** — until the next keyword. (Old `KEYWORD text` one-liners no longer work.)

| Keyword | Renders as |
|---------|-----------|
| `HEADER`    | large section heading (its text also becomes the nav label if you didn't set one) |
| `SUBHEADER` | smaller heading |
| `BODY`      | normal paragraph text |
| `NOTE`      | small italic text, e.g. an image caption |
| `IMAGE`     | an image — the **filename goes on the next line**; put the image in `pages/` |
| `BL`        | bulleted list — each item is a line starting with `-` |
| `NL`        | numbered list — each item is a line starting with `-` |

**Line breaks:** inside a block, every line break you type is kept; a blank line starts a new paragraph.

**Alignment** — add a letter in parentheses after the keyword: `(C)` center, `(J)` justify, `(L)` left, `(R)` right. Example: `HEADER(C)`, `BODY(J)`. Defaults if you don't specify: headers, subheaders and notes are **centered**, body is **justified**, lists are **left**. `BL(C)`/`NL(C)` centers the whole list while keeping the bullets/numbers aligned.

**Color** — add a `#hex` color after the keyword (and after any alignment): `HEADER(C) #E6E9F0`. Lists take **two** colors — bullet/number then text — `BL #E6E9F0 #9FA1A6` (give one to use it for both).

**Section background** — a `BACKGROUND` line sets the whole section's background:
- `BACKGROUND #0B1D47 8%` — a color; the `%` is the size of the gradient that fades it into the next section below.
- `BACKGROUND IMAGE faq.png` — an image (centered, fills the width, cropped top/bottom). Put the image in `pages/`.
- For a side-by-side `L`/`R` row, the **Top** side's background is used.

**Site-wide defaults** — put one `DEFAULT` line in the `00` file to set the palette. Keys: `BACKGROUND`, `HEADER`, `SUBHEADER`, `BODY`, `NOTE` (one color each), and `BL`/`NL` (two colors: markers then text). Any per-block color overrides it. Example:
```
DEFAULT BACKGROUND #0B1D47 HEADER #B4C0DE SUBHEADER #ADB4C4 BODY #9FA1A6 BL #E6E9F0 #9FA1A6 NL #E6E9F0 #9FA1A6
```

Example section file:
```
02 (How It Works) Primary
BACKGROUND #0E2352 10%
HEADER
How It Works
BODY
First, encrypt your drive.
Then print the form and mail everything to us.
BL
- Your device
- The printed form
- Cash and a USPS return label
IMAGE
flatrate-box.jpg
NOTE
A USPS Small Flat-Rate Box.
```

### Tips
- Keywords and the letters `C/J/L/R` are **uppercase and case-sensitive**.
- The **nav label** is the `(Nav name)` on the first line, or the section's first `HEADER` if omitted. Keep it short.
- Use a **different two-digit number** for each section (or L/R pair) so the order is unambiguous.
- Text is inserted exactly as typed (no Markdown/HTML), which keeps it safe.
- To **remove** a section delete its `.txt`; to **add** one, create a new `.txt` with a first line as above.
- Keep images reasonably small so the page stays fast.

### `pages/manifest.json` (optional)
This is a simple backup list of the section filenames. The site normally discovers files
automatically, and only falls back to this list if GitHub's file listing is briefly
unavailable. If you add or rename sections you can update it to match, or simply delete it —
the site works either way.

---

## The Download PDF button

The **Download PDF** button links to the file [`OfflineOffsite-Form.pdf`](OfflineOffsite-Form.pdf)
in the project root. The one committed now is a **placeholder** — replace it with your real
mail-in form, keeping the **same filename**, and the button will serve the new file. (You can
also change the button label and the site name at the top of `app.js`.)

---

## Site settings (`app.js`)

The only settings live in the `CONFIG` block at the very top of `app.js`:

```js
const CONFIG = {
  OWNER: "OfflineOffsite",
  REPO:  "OfflineOffsite.github.io",
  BRANCH: "main",
  ...
};
```

These are already set for this repository. Only change them if you rename the repo or brand.

---

## First-time deployment

> These are the only steps that must be done from your own GitHub account.

1. **Create the repository** on GitHub named exactly **`OfflineOffsite.github.io`**
   (a repo named `USERNAME.github.io` publishes at `https://username.github.io/`).
   Create it empty — no README, license, or `.gitignore`.
2. From this folder, connect and push (the local commits are already made):
   ```
   git remote add origin https://github.com/OfflineOffsite/OfflineOffsite.github.io.git
   git branch -M main
   git push -u origin main
   ```
   GitHub will ask you to sign in the first time — that authenticates the push as you.
3. **Enable Pages:** repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / root → Save.**
4. Wait a minute, then open **https://offlineoffsite.github.io/**.

### Updating later
Edit files on github.com (or locally and `git push`). The live site updates within a minute or two.

---

## Privacy notes
- Turn on **Settings → Emails → “Keep my email addresses private”** so your real email is
  never embedded in commits. Commits here are configured to use your GitHub no-reply address.
- **Custom domain (optional):** add a file named `CNAME` containing just your domain, then set
  the domain under Settings → Pages.
- The site makes one request to GitHub's public file-listing API when it loads; all page text
  and images are served from your own GitHub Pages site.
