# Journable

A private food, exercise and water journal for one phone. Everything you log stays in your browser on that phone. There is no account and no server of ours.

Journable is a static web app (a PWA): a folder of files that any simple web host can serve. Once you have opened it and installed it, it works without internet. This folder (`dist`) is the whole app.

## 1. Put it on the web

**You need a computer for this step** (desktop Chrome, Edge or Firefox). The upload pages of GitHub and Cloudflare need a computer: a phone's file picker cannot upload a whole folder, and the app is a folder (it contains sub-folders). You only do this once, and again for updates. Afterwards everything is on the phone.

Two free ways. **Which is easier?** Cloudflare Pages is easier: you drag in one `.zip` (or the folder) and it is live at once, with no repository to create. GitHub Pages works too but has more steps.

### Option A (easier): Cloudflare Pages, direct upload

1. On a computer, open dash.cloudflare.com (free account) > **Workers & Pages > Create > Pages > Upload assets**.
2. Name the project, then drag in `journable-site.zip` (or the unzipped `dist` folder) and **Deploy**. Cloudflare reads the zip and puts `index.html` at the top.
3. Open the `https://<project>.pages.dev` address in Chrome on your phone.

### Option B: GitHub Pages

You need a free GitHub account. The repository must be **public** (private repositories need a paid plan for Pages). Your journal is never in the repository: it lives in your phone's browser, not in these files.

1. On github.com (on a computer), create a **public** repository (for example `journable`). When it is empty, GitHub shows a page with a link **"uploading an existing file"**: click it. (On a repository that already has files, use **Add file > Upload files**.)
2. Unzip `journable-site.zip` on the computer. Open the unzipped folder, select **everything inside it** (including the `icons` and `vendor` folders and the hidden `.nojekyll` file) and drag it onto the GitHub upload page, so that `index.html` is at the top of the repository and not inside another folder. Wait until all files are listed, then **Commit changes**. (If your system hides `.nojekyll`, the app still works; it only stops GitHub from re-processing the files.)
3. Open **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and Save. After a minute the page shows your address.
4. On your phone, open `https://<your-user>.github.io/<repo>/` in **Chrome**. You should see the Journable welcome screen.

All file paths in the app are relative, so it works from a sub-folder address like `https://user.github.io/repo/`. The upload is about 7 MB zipped (38 MB unzipped), mostly the optional AI engine files.

## 2. Install it on Android (Chrome)

1. Open the address in **Chrome** (not inside WhatsApp, Gmail or another app's built-in browser).
2. Tap the **three-dot menu > Add to Home screen > Install**.
3. Open Journable from the home screen icon. It opens full screen like an app.

## 3. First-run checklist

1. Open **menu > Check my phone** first. Rows should read PASS for: secure context, offline support (after one reload), and storage. WebGPU, GPU adapter, shader-f16 and device memory only matter for the optional on-device AI; FAIL there just means you will use the Basic parser.
2. Create your profile (Daily goals), or restore a backup (see section 5).
3. Open **Backup & restore** and look at "Storage protection". Chrome decides whether to promise to keep your data; install the app and use it for a few days and it usually does.
4. Log something: type "2 roti and dal for lunch" in the box at the bottom, check the list, Save.
5. Make a backup now (Backup & restore > Export), and keep the file somewhere safe (Drive, email to yourself).
6. Turn on airplane mode, close the app and reopen it. It should still open and show your journal.

## 4. On-device AI (optional)

The Basic parser (built-in rules) understands most sentences on its own and always works. The on-device AI is an extra for long or unusual sentences. It never replaces your confirmation: every result goes to the same "Check before saving" list, and calories always come from the built-in food list, never from the AI.

1. Connect to **Wi-Fi** and plug in the charger if you can.
2. Open **menu > On-device AI**. Pick the card marked **Recommended** (usually Qwen3 0.6B, about 335 MB) and tap **Download**. If your phone's GPU lacks a feature the fast models need, the app says so and offers a compatible version instead (it needs more GPU memory, about 1.9 GB). A progress bar shows the download. You can Cancel; a later Download carries on from where it stopped.
3. Wait until the card says "Ready to use". The header chip then says **AI ready**. After that the model is loaded only when a sentence needs it (the chip says "AI ready (loads on first use)"), the first read can take longer, and it is let go again after 5 idle minutes.
4. The model files come from huggingface.co once. After that the AI works offline. **Delete** on the same screen frees the space.
5. If the phone runs out of memory or the download fails, the screen says so in plain words; try the smaller model, or keep using the Basic parser.

The AI needs WebGPU and a phone with roughly 6 GB of RAM or more. If Check my phone says WebGPU or shader-f16 is missing, the AI cannot run on that phone.

**Honest status:** in the build environment the AI was tested only with a simulated model (a stand-in that returns prepared answers), and the WebLLM files were loaded but no real WebGPU, no real model download and no real phone were available. Whether the real models run well on your phone has to be checked on the phone: use Check my phone > Run test sentence and look at the tokens per second.

## 5. Moving over from the old single-file Diet Tracker

The browser keeps data per web address, so the old file's data does not appear here by itself.

1. In the **old file**: Profile > **Export backup** (all people). Save the file.
2. In **Journable**: Welcome screen (or menu > **Backup & restore**) > choose the file > **Restore** (or Merge).
3. People, meals, weights, foods and entries come across. Old profiles stay on their old activity setting until you accept the "Count workouts separately?" card.

## 6. Updating later

1. Upload all files from the new `dist` again (same repository, **Add file > Upload files**, replace the old ones, Commit).
2. Open the app. After a moment it shows **Update ready**; tap **Reload to update**. Your journal is not touched by updates.

## 7. Important warnings

- **Clear site data deletes your journal.** In Chrome, "Clear browsing data", "Clear storage" or "Site settings > Clear & reset" for this address removes everything. Uninstalling the app and clearing data does the same. Export a backup regularly; the app reminds you every 7 days.
- A different address is a different journal. If you move the app to another address, restore a backup there.
- Browsers may remove data from sites they think you no longer use when the phone is very low on space. Installing the app and the "Storage protection" setting reduce this, backups remove the risk.

## 8. Voice typing privacy

The microphone button uses your browser's speech recognition, which on Chrome **sends your audio to Google** to turn it into text. Journable asks before the first use. For a private option, tap the text box and use your keyboard's own microphone (for example Gboard), or just type. Text from voice is only put into the box; you always press Send yourself.

## 9. What is in this folder

- `index.html`, `app.js`, `app.css`: the app (the food list is inside `index.html`).
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and installation.
- `llm-worker.js`, `vendor/web-llm/`: the optional AI engine (WebLLM 0.2.87, Apache-2.0) and the model programs for the three models. Model **weights** are not here; they are downloaded from huggingface.co only when you tap Download. `vendor/web-llm/VERSION.txt` records the exact version and checksums.
- `.nojekyll`: tells GitHub Pages to serve the files as they are.
- Open Food Facts (openfoodfacts.org) is contacted only when you choose "Search online" for a missing food.
