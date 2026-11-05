// v1.1.3 data fixes on data/trackme.db (re-runnable): ranking hints and missing Hindi / common names.
// Usage: node --no-warnings scripts/data_v113.mjs   then   node --no-warnings scripts/db_check.mjs && node --no-warnings scripts/build.mjs
// A raw-alias key with a space ("water melon") matches that phrase in the IFCT name (see rawAliasFor in build.mjs).
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const db = new DatabaseSync(join(dirname(dirname(fileURLToPath(import.meta.url))), 'data', 'trackme.db'));
// popular = ranks first among the raw rows of one name: "mango" is a ripe mango (not Mangosteen), "sesame" is the white seed
for (const id of ['i_mango_ripe_paheri', 'i_gingelly_seeds_white']) db.prepare('UPDATE foods SET popular=1 WHERE id=?').run(id);
const A = [
  ['cumin', 'jeera zeera'], ['sapota', 'chikoo chiku sapodilla'], ['goosberry', 'amla gooseberry'],
  ['lime sweet', 'mosambi mosumbi musambi'], ['gingelly', 'sesame til'], ['ground nut', 'groundnut peanut peanuts moongphali mungfali'],
  ['water melon', 'watermelon tarbooz tarbuj'], ['ladies', 'bhindi okra ladyfinger bhendi'],
];
db.prepare("DELETE FROM aliases WHERE kind='raw' AND src='v1.1.3'").run();
let ord = db.prepare("SELECT max(ord) m FROM aliases WHERE kind='raw'").get().m + 1;
for (const [w, x] of A) db.prepare("INSERT INTO aliases(kind, ord, word, extra, src) VALUES ('raw', ?, ?, ?, 'v1.1.3')").run(ord++, w, x);
db.close();
