# Live TV — Shared, Multi-Device Edition

## What changed

- Data no longer lives in browser `localStorage` (which was per-device only).
  It now lives in **Firebase Firestore** (free tier), so an edit made on
  your phone shows up on your laptop, and on anyone else's device, live —
  no manual refresh needed.
- The site is gated behind **one shared password**. Anyone with the
  password can view and edit. Wrong password → no access.
- Everything is still a static site (HTML/CSS/JS) — no server to run,
  no monthly cost, hosted for free on GitHub Pages.

## One-time setup (~10 minutes)

### 1. Create a free Firebase project
1. Go to https://console.firebase.google.com and sign in with any Google account.
2. Click **Add project**, give it a name, and finish the wizard (you can
   skip Google Analytics). This uses the free **Spark** plan — no credit
   card required.

### 2. Turn on Firestore
1. In the left sidebar: **Build → Firestore Database → Create database**.
2. Choose **Start in production mode**, pick any region close to you.
3. Once created, go to the **Rules** tab and replace the contents with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   This means: only people who made it past the site's password screen
   (and therefore got signed in anonymously) can read or write data.
4. Click **Publish**.

### 3. Turn on Anonymous sign-in
1. **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous**.

### 4. Get your web app config
1. Project settings (gear icon) → scroll to **Your apps** → click the
   `</>` (web) icon → register an app (nickname doesn't matter).
2. Copy the `firebaseConfig` object it shows you.
3. Open `firebase-config.js` in this folder and paste your values into
   the `firebaseConfig` object at the top.

### 5. Set your shared password
1. Pick a password only you and the people you're sharing this with will know.
2. Deploy the site first (step 6 below), then open it once, open your
   browser's DevTools console (F12), and run:
   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("yourPasswordHere"))
     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")))
   ```
3. Copy the printed hash into `SITE_PASSWORD_HASH` in `firebase-config.js`,
   commit, and push — the live site updates automatically.

   > Password hashing needs a secure context (`https://` or `localhost`) —
   > it won't work if you just double-click `index.html` on your computer.

### 6. Put it on GitHub Pages (free hosting)
1. Create a new GitHub repository and upload all the files in this folder
   (`index.html`, `style.css`, `script.js`, `firebase-config.js`, `assets/`).
2. Repo → **Settings → Pages** → under "Build and deployment", set
   **Source: Deploy from a branch**, branch `main`, folder `/ (root)` → Save.
3. GitHub gives you a URL like `https://yourname.github.io/repo-name/` —
   that's the link you share with people, alongside the password.

That's it — first person to open the site (after entering the password)
automatically seeds it with the starter channels/serials/episodes; from
then on every device just syncs.

## How data is organized (for the bot, later)

Firestore has three flat collections instead of one nested blob, so any
external process can read/write a single item without touching the rest:

- `channels/{id}` → `{ name, image, order }`
- `serials/{id}` → `{ channelId, name, image, order }`
- `episodes/{id}` → `{ serialId, number, title, date, duration, image, video }`

Once you share your bot's workflow, it can write directly into these
collections (e.g. adding a new `episodes` doc when a new episode airs)
and it'll show up on every device instantly, same as a manual edit.

## Notes & limits

- **Security level**: the password gate is a lightweight barrier suited
  to sharing with people you trust (family/friends), not a login system.
  Firestore rules only require *some* anonymous sign-in, not the correct
  password specifically — the real gate is the UI check before sign-in.
- **Image size**: uploaded images are auto-resized/compressed in the
  browser before saving (max ~900px, JPEG) to stay well under Firestore's
  1MB-per-document limit. For very large images, prefer "Or image link"
  over "Choose image".
- **Firebase free tier**: Spark plan includes 50K document reads and
  20K writes per day, 1GB stored — plenty for personal/family use.

## Local testing

Firebase's auth and crypto features require a secure context, so you
can't just open `index.html` from disk. Use a local server instead,
e.g. VS Code's **Live Server** extension, or:
```
python3 -m http.server 8000
```
then visit `http://localhost:8000`.
