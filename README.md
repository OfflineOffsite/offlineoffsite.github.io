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
<position> <Primary|Secondary|Hide>[(Nav name)] [Top|Bottom]
```

- **position** — controls order and layout:
  - `NN` — a normal full-width section (e.g. `01`, `05`). `NN` is a two-digit number; **lower numbers appear higher up the page.**
  - `LNN` / `RNN` — a **side-by-side** pair. `L05` is the left column and `R05` is the right column of the same row (same number = same row). On phones they stack into one column.
- **Primary / Secondary / Hide** — where the section appears in navigation:
  - `Primary` — a link in the top navigation bar.
  - `Secondary` — a link in the hamburger (☰) menu only. On phones, Secondary links are listed after the Primary ones.
  - `Hide` — no navigation link at all; the section still shows on the page.
- **(Nav name)** *(optional)* — a short label for the nav/menu link, in parentheses right after the level, e.g. `Primary(Pricing)` or `Secondary(Time Capsule)`. If you leave it off, the section's first `HEADER` is used. Keep these short so the navbar stays on one line.
- **Top / Bottom** *(optional, only for `L`/`R` sections)* — when a side-by-side pair stacks on a phone, `Top` shows first and `Bottom` shows second. If you leave it off, the left one is on top.

The navbar always stays on one line: if there are too many Primary links to fit, they all move into the ☰ menu automatically.

Examples:
```
03 Primary(Pricing)          → 3rd section, full width, navbar link labelled "Pricing"
09 Hide                      → 9th section, full width, not in any menu
L04 Secondary(Send) Top      → 4th row, left column, in the ☰ menu, shows first on phones
R04 Secondary(Packaging) Bottom → 4th row, right column, in the ☰ menu, shows second on phones
```

### The rest of the file

Every following line starts with a keyword that sets how it looks:

| Keyword | Renders as |
|---------|-----------|
| `HEADER `   | large section heading (also becomes the section's nav-bar label) |
| `SUBHEADER ` | smaller heading |
| `BODY `     | a paragraph of normal text (use one `BODY` line per paragraph) |
| `NOTE `     | small italic text, e.g. a caption under an image |
| `IMAGE name.png` | an image — put the image file in the `pages/` folder and give its filename |

Example section file:
```
02 Primary(How It Works)
HEADER How It Works
SUBHEADER Entirely by mail
BODY First, encrypt your drive.
BODY Then print the form and mail everything to us.
IMAGE flatrate-box.jpg
NOTE A USPS Small Flat-Rate Box.
```

### Tips
- The **nav label** is the `(Nav name)` on the first line, or the section's first `HEADER` if you omit it. Keep it short so the navbar stays on one line.
- Use a **different two-digit number** for each section (or L/R pair) so the order is never ambiguous.
- Text is shown exactly as typed — there is no Markdown or HTML formatting, which also keeps it safe.
- To **remove** a section, delete its `.txt` file. To **add** one, create a new `.txt` file with a first line as above.
- Images: commit them into `pages/` and reference them by filename with `IMAGE`. Keep them reasonably small so the page stays fast.

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
