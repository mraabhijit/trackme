"""Food data for the tests, read from data/trackme.db (replaces the old data/*.json)."""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'trackme.db')

def _r1(x): return round(x) if x >= 10 else round(x * 10) / 10

def _per100(f, c):  # the DB stores per 1 g (liquids per 1 ml); the tests want per 100 g like the old columns
    return float('%.12g' % (f[c + '_1'] * 100 / (f['density'] if f['base_unit'] == 'ml' else 1)))

def _unit(c, f, m):  # same label/grams rule as scripts/build.mjs unitOf
    if m['kind'] != 'volume': return {'label': m['label'], 'grams': m['grams']}
    ml = c.execute('SELECT ml FROM household_sizes WHERE key=?', (m['size'],)).fetchone()[0] if m['size'] else m['ml']
    g = _r1(ml * f['density'])
    amt = ('%g ml' % ml) if (f['base_unit'] == 'ml' or 'glass' in m['label']) else ('' if f['density_src'] == 'sourced' and m['size'] not in ('katori', 'bowl') else '~') + '%g g' % g
    return {'label': m['label'] + ' (' + amt + (', ' + m['qual'] if m['qual'] else '') + ')', 'grams': g}

def _rows(where):
    c = sqlite3.connect('file:' + DB + '?mode=ro', uri=True); c.row_factory = sqlite3.Row
    out = []
    for f in c.execute('SELECT * FROM foods WHERE ' + where + ' ORDER BY ord'):
        out.append({'id': f['id'], 'name': f['name'], 'category': f['grp'], 'group': f['grp'],
                    'per_100g': {k: _per100(f, k) for k in ('kcal', 'protein', 'carbs', 'fat', 'fibre')},
                    **{k: _per100(f, k) for k in ('kcal', 'protein', 'carbs', 'fat', 'fibre')},
                    'measures': [_unit(c, f, m) for m in c.execute('SELECT * FROM measures WHERE food_id=? ORDER BY ord', (f['id'],))],
                    'source': f['origin'], 'basis': f['basis']})
    return out

def dishes(): return _rows("source='dish'")        # what household_units.json held (74 rows)
def ifct(): return _rows("source='ifct'")          # what ifct_foods.json held (524 rows)
