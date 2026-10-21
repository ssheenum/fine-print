# Fine Print

Snap any skin, hair or body product and find out if it's truly right for you.

A complete website and installable phone app: accounts, a skin and hair profile, a product scanner, a personal score with plain-English reasons, a shelf grouped by Face, Hair and Body, and a 3-week check-in that rescores everything.

## Two ways to run it

The same app runs in two modes. It picks one by itself when it loads.

| | **GitHub Pages** (no server) | **Full server** (Node) |
|---|---|---|
| Where | Free on `https://<you>.github.io/<repo>/` | Your computer, Render, Railway, Fly.io, a VPS, Docker |
| Accounts | Email or phone + password, saved **in that browser** | Email or phone + password, plus Google sign-in, saved on the server |
| Your shelf | IndexedDB in the browser. Profile → Backup moves it between devices | SQLite on the server, the same on every device |
| AI reading | Each person can add their own Claude or Gemini key on the Profile page. It stays in their browser | One key for everyone, set on the server |
| Everything else | Same: search, barcode, label photo, scoring, clean photos, ratings, rescoring | Same |

When the page loads, it asks `api/config`. If a server answers, the app uses it. If not (GitHub Pages is static), the back end in `public/local-api.js` runs inside the browser, answers the same `/api` routes, and calls Open Beauty Facts directly. To force the browser-only mode on a server, add `?local` to the address.

## Publish on GitHub Pages

1. Create a new repository on GitHub and push this folder to its `main` branch:
   ```
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the repository, open **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. The **Deploy to GitHub Pages** workflow runs the tests and then publishes `public/`. It runs on every push to `main`, and you can also start it from the Actions tab. The site address appears in the workflow summary.

Pages serves the site over HTTPS, so the live camera and "Add to Home Screen" work on phones.

## Run the full server

You need Node.js 22.13 or newer. There is nothing to install.

```
npm start
```

Open http://localhost:3000. Data is saved in `data/fineprint.db`. `npm run dev` restarts the server on every change, and `npm test` runs the tests.

### Put the server online

- **Render**: Dashboard → New → Blueprint, then pick this repo. `render.yaml` sets up the service, a disk at `/data` and a health check. Fill in `PUBLIC_URL` (your Render address) and any keys you want.
- **Anything with Docker**: a `Dockerfile` is included. Mount a disk at `/data` so accounts survive restarts.

Use HTTPS so the live camera works on phones. Behind a hosting proxy, set `TRUST_PROXY=1` (already set in `render.yaml` and the Dockerfile) so login rate limits apply to each visitor rather than to the proxy.

## What works with no keys or accounts

- **Sign up and log in** with email + password or phone number + password.
  - On the server, passwords are hashed with scrypt and sessions are HttpOnly cookies.
  - On Pages, passwords are hashed with PBKDF2 in the browser.
- **Profile**: skin type, hair type, up to 3 things to fix, an avoid list, and a fragrance setting. Each row can be edited.
- **Finding a product**:
  - Search by name. Results come from Open Beauty Facts, a free, open product database.
  - Barcode, read live from the camera in browsers that support it (Chrome on Android).
  - A photo of the ingredient list, read in the browser.
- **Scoring**: a built-in engine knows about 70 common ingredients. It checks each product against:
  - your profile
  - your avoid list
  - products you loved
  - products your skin reacted to

  It also flags ingredients that are restricted in the EU, Japan and elsewhere.
- **Clean product photos**: the background is removed in the browser.
- **Shelf**: Face, Hair and Body tabs. A red dot appears 3 weeks after a product is added. Rating it rescores the whole shelf, and the Profile page shows "What I've learned about you".

## Server settings (environment variables)

| Variable | What it turns on |
|---|---|
| `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` | AI reading of any front-of-pack photo or typed name, plus richer write-ups and a claim check. Gemini has a free tier. |
| `AI_MODEL` | Override the model name. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL` | "Continue with Google". Set the redirect URI to `PUBLIC_URL/api/auth/google/callback`. |
| `CONTACT_EMAIL` | Sent to Open Beauty Facts with requests, as they ask. |
| `PORT`, `DB_PATH` | Where it listens, and where the database lives. |
| `TRUST_PROXY` | `1` when running behind a hosting proxy. |

"Continue with Apple" shows a "coming soon" message, because Apple sign-in needs a paid Apple Developer account. On GitHub Pages, both the Google and Apple buttons are hidden, since sign-in there needs a server.

## Files

- `server/index.js`: web server and API
- `server/auth.js`: accounts, sessions and Google sign-in
- `server/db.js`: SQLite storage
- `server/obf.js`, `server/ai.js`: server wrappers for Open Beauty Facts (with a photo proxy) and the AI
- `public/`: the app (HTML, CSS, JS, icons, manifest, service worker)
- `public/local-api.js`: the in-browser back end used on GitHub Pages
- `public/shared/`: shared by the server and the browser, so both score the same way:
  - `engine.js`, `ingredients.js`: scoring and the ingredient knowledge base
  - `brain.js`: AI prompt and clean-up
  - `obf.js`: Open Beauty Facts search
- `test/`: engine and API tests (`npm test`)
- `.github/workflows/`: tests on every push, and the Pages deploy
- `render.yaml`, `Dockerfile`: hosting for the full server

## Credits

Product data © Open Beauty Facts contributors (ODbL). Product photos are CC BY-SA and are credited on screen. Fine Print is not medical advice.
