# Principes d'Économie — site Quarto (IPM1)

Course site with chapter notes, interactive simulators (Observable JS) and a self-assessment quiz (201 questions, AMC scoring +1 / −0.5).

## Project structure

```
eco-ipm1/
├── _quarto.yml               # site settings: title, menus, theme
├── index.qmd                 # home page
├── cours/ch1 … ch9.qmd       # one file per chapter (Markdown + LaTeX)
├── simulateurs.qmd           # Keynesian cross, multipliers, CPI, GDP (OJS)
├── quiz.qmd                  # quiz page (loads assets/quiz.js)
├── assets/
│   ├── questions.json        # ← the question bank (edit this to add questions)
│   ├── quiz.js / quiz.css    # quiz engine and styling
│   └── custom.scss           # colours and layout
└── .github/workflows/publish.yml   # automatic publishing to GitHub Pages
```

---

## Step 1 — Install the tools (once)

1. **Quarto**: download the installer from <https://quarto.org/docs/get-started/> and run it.
2. **An editor**: VS Code (with the *Quarto* extension) or Positron. RStudio also works.
3. **Git**: <https://git-scm.com/downloads>, or use **GitHub Desktop** if you prefer buttons to commands.

Check in a terminal: `quarto --version` should print a version number.

## Step 2 — Preview the site on your computer

1. Unzip `eco-ipm1.zip` and open the `eco-ipm1` folder in your editor.
2. In the terminal, inside that folder, run:

   ```bash
   quarto preview
   ```

3. Your browser opens the site. Every time you save a `.qmd` file, the page reloads automatically.

> The quiz needs a local server to load `questions.json`, so always use `quarto preview`, not a double-click on an `.html` file.

## Step 3 — Edit the content

- **Chapter notes**: open `cours/chX-….qmd`. Write normal text; formulas go between `$…$` (inline) or `$$…$$` (display). Boxes:

  ```markdown
  ::: {.callout-tip title="Exemple corrigé"}
  Avec $c = 0{,}8$ : $K_I = 5$.
  :::
  ```

- **Questions**: open `assets/questions.json`. Each question is one line:

  ```json
  {"t":14,"q":"Énoncé…","o":["A","B","C","D"],"a":[2],"e":"Explication…"}
  ```

  - `t` = theme number (1–20), `o` = the 4 options, `a` = index of the correct option(s) **counting from 0** (`[0,2]` = several answers), `e` = explanation shown after answering.
  - Formulas: `\\(K_I = \\frac{1}{1-c}\\)` (double backslashes inside JSON).
  - Separate questions with commas; no comma after the last one.

## Step 4 — Put the project on GitHub

Use a **new** repository so your current version stays online until the new one is ready.

**With GitHub Desktop**: *File → Add local repository →* choose the `eco-ipm1` folder → *Publish repository* (name it `eco-ipm1`, untick "Keep this code private" if your plan requires public repos for Pages).

**With the terminal**:

```bash
git init
git add .
git commit -m "Première version du site Quarto"
git branch -M main
git remote add origin https://github.com/VOTRE-NOM/eco-ipm1.git
git push -u origin main
```

## Step 5 — Turn on GitHub Pages

1. On GitHub, open the repository → **Settings → Actions → General** → *Workflow permissions* → select **Read and write permissions** → Save.
2. Go to the **Actions** tab: the workflow "Publier le site Quarto" runs (about 1–2 minutes). Wait for the green tick.
3. **Settings → Pages** → *Source: Deploy from a branch* → Branch **gh-pages**, folder **/ (root)** → Save.
4. After a minute, the site is live at `https://VOTRE-NOM.github.io/eco-ipm1/`.
5. In `_quarto.yml`, replace `VOTRE-NOM` in `site-url` with your GitHub username, then commit and push.

From now on, **every push to `main` republishes the site automatically**.

*(Alternative without the workflow: run `quarto publish gh-pages` in the terminal.)*

## Step 6 — Show it in Google Sites

In Google Sites: **Insert → Embed → By URL** → paste `https://VOTRE-NOM.github.io/eco-ipm1/` → choose *Whole page*. Enlarge the frame so it fills the page.
A simple **button** linking to the site also works well on phones.

## Useful links for students

| Purpose | Link |
|---|---|
| Mock exam (20 questions) | `…/quiz.html?mode=exam20` |
| Long mock exam (40 questions) | `…/quiz.html?mode=exam40` |
| Practise one theme (e.g. theme 14) | `…/quiz.html?theme=14` |
