# Fine Print

Snap any skin, hair or body product and find out if it's truly right for you.

A complete website and installable phone app: accounts, a skin and hair profile, a product scanner, a personal score with plain-English reasons, a shelf grouped by Face, Hair and Body, and a 3-week check-in that rescores everything.

## Run it

You need Node.js 22.13 or newer. There is nothing to install.

```
node --no-warnings server/index.js
```

Open http://localhost:3000. Data is saved in `data/fineprint.db`.

On a phone, open the site and choose "Add to Home Screen". It then opens full screen like an app.

## What works with no keys or accounts

- **Sign up and log in** with email + password or phone number + password. Passwords are hashed (scrypt), and sessions are secure cookies.
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
- **Clean product photos**: the background is removed in the browser. Everything inside the product's outline stays solid, and the app picks the best of several photos.
- **Shelf**: Face, Hair and Body tabs. A red dot appears 3 weeks after a product is added. Rating it rescores the whole shelf, and the Profile page shows "What I've learned about you".

## Optional extras (environment variables)

| Variable | What it turns on |
|---|---|
| `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` | AI reading of any front-of-pack photo or typed name, plus richer write-ups and a claim check. Gemini has a free tier. |
| `AI_MODEL` | Override the model name. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL` | "Continue with Google". Set the redirect URI to `PUBLIC_URL/api/auth/google/callback`. |
| `CONTACT_EMAIL` | Sent to Open Beauty Facts with requests, as they ask. |
| `PORT`, `DB_PATH` | Where it listens, and where the database lives. |

"Continue with Apple" shows a "coming soon" message. Apple sign-in needs a paid Apple Developer account.

## Putting it online

Any host that runs Node or Docker and keeps a disk will work. Examples are Render, Railway, Fly.io or a small VPS. Mount a disk at `/data` so accounts survive restarts. A `Dockerfile` is included. Use HTTPS so the live camera works on phones.

## Files

- `server/index.js`: web server and API
- `server/auth.js`: accounts, sessions and Google sign-in
- `server/db.js`: SQLite storage
- `server/engine.js`, `server/ingredients.js`: scoring and the ingredient knowledge base
- `server/obf.js`: Open Beauty Facts search, barcode lookup and photo proxy
- `server/ai.js`: optional AI
- `public/`: the app (HTML, CSS, JS, icons, manifest, service worker)

## Credits

Product data © Open Beauty Facts contributors (ODbL). Product photos are CC BY-SA and are credited on screen. Fine Print is not medical advice.
