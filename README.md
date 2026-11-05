# TrackMe

A private food, exercise and water journal for one phone. Everything you log stays in your browser on that phone. There is no account and no server of ours.

TrackMe is a static web app (a PWA): a folder of files that any simple web host can serve. Once you have opened it and installed it, it works without internet. This repository's top folder is the whole app (the build writes it there; `trackme-site.zip` holds the same site files).

## 1. Put it on the web

**You need a computer for this step** (desktop Chrome, Edge or Firefox). The upload pages of GitHub and Cloudflare need a computer: a phone's file picker cannot upload a whole folder, and the app is a folder (it contains sub-folders). You only do this once, and again for updates. Afterwards everything is on the phone.

Two free ways. **Which is easier?** Cloudflare Pages is easier: you drag in one `.zip` (or the folder) and it is live at once, with no repository to create. GitHub Pages works too but has more steps.

### Option A (easier): Cloudflare Pages, direct upload

1. On a computer, open dash.cloudflare.com (free account) > **Workers & Pages > Create > Pages > Upload assets**.
2. Name the project, then drag in `trackme-site.zip` (or the unzipped folder) and **Deploy**. Cloudflare reads the zip and puts `index.html` at the top.
3. Open the `https://<project>.pages.dev` address in Chrome on your phone.

### Option B: GitHub Pages

You need a free GitHub account. The repository must be **public** (private repositories need a paid plan for Pages). Your journal is never in the repository: it lives in your phone's browser, not in these files.

1. On github.com (on a computer), create a **public** repository (for example `trackme`). When it is empty, GitHub shows a page with a link **"uploading an existing file"**: click it. (On a repository that already has files, use **Add file > Upload files**.)
2. Unzip `trackme-site.zip` on the computer. Open the unzipped folder, select **everything inside it** (including the `icons` and `vendor` folders and the hidden `.nojekyll` file) and drag it onto the GitHub upload page, so that `index.html` is at the top of the repository and not inside another folder. Wait until all files are listed, then **Commit changes**. (If your system hides `.nojekyll`, the app still works; it only stops GitHub from re-processing the files.)
3. Open **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and Save. After a minute the page shows your address.
4. On your phone, open `https://<your-user>.github.io/<repo>/` in **Chrome**. You should see the TrackMe welcome screen.

All file paths in the app are relative, so it works from a sub-folder address like `https://user.github.io/repo/`. The upload is about 7 MB zipped (39 MB unzipped), mostly the optional AI engine files.

## 2. Install it on Android (Chrome)

1. Open the address in **Chrome** (not inside WhatsApp, Gmail or another app's built-in browser).
2. Tap the **three-dot menu > Add to Home screen > Install**.
3. Open TrackMe from the home screen icon. It opens full screen like an app.

## 3. First-run checklist

1. Open **menu > Check my phone** first. Rows should read PASS for: secure context, offline support (after one reload), and storage. WebGPU, GPU adapter, shader-f16 and device memory only matter for the optional on-device AI; FAIL there just means you will use the Basic parser.
2. Create your profile (Daily goals), or restore a backup (see section 5).
3. Open **Backup & restore** and look at "Storage protection". Chrome decides whether to promise to keep your data; install the app and use it for a few days and it usually does.
4. Log something: type "2 roti and dal for lunch" in the box at the bottom, check the list, Save.
5. Make a backup now (Backup & restore > Export), and keep the file somewhere safe (Drive, email to yourself).
6. Turn on airplane mode, close the app and reopen it. It should still open and show your journal.

## 4. On-device AI (optional)

The Basic parser (built-in rules) understands most sentences on its own and always works. With the on-device AI downloaded and switched on, the AI reads everything you type first (foods, amounts, units, time, meal, exercise) and the Basic rules are only the fallback. Calories come from the built-in food list; for foods that are not in it the AI gives an estimate, tagged AI. It never replaces your confirmation: every result goes to the same "Check before saving" list, and calories always come from the built-in food list, never from the AI.

1. Connect to **Wi-Fi** and plug in the charger if you can.
2. Open **menu > On-device AI**. Pick the card marked **Recommended** (usually Qwen3 0.6B, about 335 MB) and tap **Download**. If your phone's GPU lacks a feature the fast models need, the app says so and offers a compatible version instead (it needs more GPU memory, about 1.9 GB). A progress bar shows the download. You can Cancel; a later Download carries on from where it stopped.
3. Wait until the card says "Ready to use". The header chip then says **AI ready**. After that the model is loaded only when a sentence needs it (the chip still says "AI ready"), the first read can take longer, and it is let go again after 5 idle minutes.
4. The model files come from huggingface.co once. After that the AI works offline. **Delete** on the same screen frees the space.
5. If the phone runs out of memory or the download fails, the screen says so in plain words; try the smaller model, or keep using the Basic parser.

The AI needs WebGPU and a phone with roughly 6 GB of RAM or more. If Check my phone says WebGPU or shader-f16 is missing, the AI cannot run on that phone.

**Honest status:** in the build environment the AI was tested only with a simulated model (a stand-in that returns prepared answers), and the WebLLM files were loaded but no real WebGPU, no real model download and no real phone were available. Whether the real models run well on your phone has to be checked on the phone: use Check my phone > Run test sentence and look at the tokens per second.

## 5. Moving over from the old single-file Diet Tracker

The browser keeps data per web address, so the old file's data does not appear here by itself.

1. In the **old file**: Profile > **Export backup** (all people). Save the file.
2. In **TrackMe**: Welcome screen (or menu > **Backup & restore**) > choose the file > **Restore** (or Merge).
3. People, meals, weights, foods and entries come across. Old profiles stay on their old activity setting until you accept the "Count workouts separately?" card.

## 6. Updating later

1. Upload all files from the new zip (or the repository's top folder) again (same repository, **Add file > Upload files**, replace the old ones, Commit).
2. Open the app. After a moment it shows **Update ready**; tap **Reload to update**. Your journal is not touched by updates.

## 7. Important warnings

- **Clear site data deletes your journal.** In Chrome, "Clear browsing data", "Clear storage" or "Site settings > Clear & reset" for this address removes everything. Uninstalling the app and clearing data does the same. Export a backup regularly; the app reminds you every 7 days.
- A different address is a different journal. If you move the app to another address, restore a backup there.
- Browsers may remove data from sites they think you no longer use when the phone is very low on space. Installing the app and the "Storage protection" setting reduce this, backups remove the risk.

## 8. Voice typing privacy

The microphone button uses your browser's speech recognition, which on Chrome **sends your audio to Google** to turn it into text. TrackMe asks before the first use. For a private option, tap the text box and use your keyboard's own microphone (for example Gboard), or just type. Text from voice is only put into the box; you always press Send yourself.

## 9. What is in this folder

- `index.html`, `app.js`, `app.css`: the app (the food list is inside `index.html`).
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and installation.
- `report.js`, `vendor/pdfjs/`: PDF export (own writer) and PDF import (pdf.js 4.10.38, Apache-2.0, loaded only when used).
- `llm-worker.js`, `vendor/web-llm/`: the optional AI engine (WebLLM 0.2.87, Apache-2.0) and the model programs for the three models. Model **weights** are not here; they are downloaded from huggingface.co only when you tap Download. `vendor/web-llm/VERSION.txt` records the exact version and checksums.
- `.nojekyll`: tells GitHub Pages to serve the files as they are.
- Open Food Facts (openfoodfacts.org) is contacted only when you choose "Search online" for a missing food.


## What changed

See [CHANGELOG.md](CHANGELOG.md) for every change by version (1.1.0 is the current one).

## Renamed (was "Journable")

The app is called TrackMe from version 1.1. The folder you may have received it in (`journable/`) keeps its old name; the app inside does not. Your journal, backups and downloaded AI model are not affected: the storage keys (`dt:v1:*`), the backup file format and the AI model cache keep their old internal names on purpose, so nothing is lost and old backup files still import. **Android note:** an app already installed on your home screen keeps its old name and icon until you remove it and install it again (make a backup first).

## Reports (PDF)

**Weekly summary > Export report (PDF)** makes a PDF of food, macros, weight and water for a period (up to 92 days), named `trackme-report-<from>-to-<to>.pdf`. It is made on the phone by a small writer inside `report.js` (no library, no internet). **Backup & restore > Import a report (PDF)** reads such a PDF (also similar reports from other apps) with pdf.js (`vendor/pdfjs/`, Apache-2.0, Mozilla), shows everything for checking, and adds new days only by default. Reading a PDF needs the installed web app (an https address), not a file opened from disk. The PDF files are cached in the same lasting cache as the AI library (`journable-lib`) after first use.

## Credits

- Food data: IFCT 2017, ICMR-National Institute of Nutrition (via npm ifct2017-compositions). Cooked-dish values and household portion weights are estimates.
- Cooked vegetables: **USDA FoodData Central**, SR Legacy (April 2018), records "cooked, boiled, drained, without salt" (a few are the closest boiled record). USDA FoodData Central data are in the public domain, published under CC0 1.0 Universal (https://fdc.nal.usda.gov/, "Licensing"). Citation: U.S. Department of Agriculture, Agricultural Research Service, Beltsville Human Nutrition Research Center. FoodData Central. https://fdc.nal.usda.gov. Carbohydrate is shown as "by difference minus fibre" so that it matches the IFCT figures. Indian vegetables with no USDA record (tinda, parwal, kundru, ridge gourd / turai, snake gourd, cluster beans, methi, bathua) have a cooked value derived from the IFCT raw value; they are labelled "estimate".
- Drinks and liquids (group "Beverages and liquids", 28 rows, v1.1.5): water, honey, orange juice, beer, whisky, wine, green tea and soda water are **USDA FoodData Central** SR Legacy records (same licence as above; the fdcId of each row is in its basis note); cola, packaged juices, soups, kheer and milkshake use a USDA record as the basis and are marked estimate; home drinks and dishes (nimbu pani, sharbat, filter and cold coffee, badam milk, smoothie, protein shakes, kadhi, dal soup) are estimate recipes built from rows of the food table, with the recipe stated in the row. Liquids are stored per 1 ml with a density; a glass is 250 ml, a cup 150 ml, a bottle 500 ml, a can 330 ml, a shot 30 ml.
- Open Food Facts (ODbL), pdf.js (Apache-2.0), WebLLM (Apache-2.0) and the Qwen3 / Llama 3.2 models: see About inside the app.

## Household sizes (1.1.4)

Small katori 100 ml, katori 150 ml, large katori 200 ml, bowl 275 ml, cup 150 ml, glass 250 ml, tbsp 15 ml, tsp 5 ml. The weight of a spoonful, katori or cup of a food is the size times that food's density (g per ml), so liquids typed in ml also use their density (200 ml milk is about 206 g). Entries you saved earlier keep their own numbers.
