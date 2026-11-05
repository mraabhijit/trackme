"""Helpers shared by the phase 2 UI tests (file:// only)."""
import sys, json, os, re, datetime
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *

D = '/home/arch/projects/trackme'
OLD = 'file:///home/arch/projects/trackme/tests/fixtures/diet-tracker.html'
import dbdata
UNITS = {f['name']: f for f in dbdata.dishes()}
def kcal_of(food, g): return UNITS[food]['per_100g']['kcal'] * g / 100.0
ROTI = 'Roti / phulka (whole wheat, no ghee)'; DAL = 'Dal (toor), cooked, light tadka'

def today_of(page):
    return page.evaluate("()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}")
def addd(ds, n): return (datetime.date.fromisoformat(ds) + datetime.timedelta(days=n)).isoformat()
def age_on(dob, today):
    y, m, d = map(int, dob.split('-')); t = datetime.date.fromisoformat(today)
    return t.year - y - ((t.month, t.day) < (m, d))
def bmr(sex, kg, cm, age): return 10 * kg + 6.25 * cm - 5 * age + (5 if sex == 'm' else -161)
def num(s): return float(re.sub(r'[^\d.\-]', '', s.split()[0].replace('−', '-')))

def new_page(b, w=360, h=740, scheme='light', errs=None, init=None, url=None, ctx_kw=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme, accept_downloads=True, **(ctx_kw or {}))
    if init: ctx.add_init_script(init)
    p = ctx.new_page()
    if errs is not None:
        p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        p.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    p.on('dialog', lambda d: (errs.append('dialog: ' + d.message) if errs is not None else None, d.dismiss()))
    p.goto(url or URL)
    return p

def make_profile(p, name='Asha', kcal=2000, kg=70, cm=170, dob='1990-01-01', sex='m', level=None, goal=None):
    p.fill('#f-name', name); p.select_option('#f-sex', sex); p.fill('#f-dob', dob); p.fill('#f-height', str(cm)); p.fill('#f-weight', str(kg))
    if level: p.select_option('#f-activity', str(level))
    if goal: p.select_option('#f-goal', goal)
    if kcal:
        p.evaluate("()=>{document.querySelector('#advanced').open=true}")
        p.fill('#f-ovkcal', str(kcal))
    p.click('#save-profile'); p.wait_for_selector('#qbar')

def quick(p, text, save=True):
    p.fill('#ql', text); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    if save:
        p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')

def hscroll(p):
    return p.evaluate("()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1||document.body.scrollWidth>window.innerWidth+1")

def small_targets(p, scope='body', minw=44, minh=44):
    return p.evaluate("""([scope,mw,mh])=>{const out=[];document.querySelectorAll(scope+' button, '+scope+' input:not([type=hidden]), '+scope+' select, '+scope+' a[href], '+scope+' textarea, '+scope+' summary').forEach(e=>{
      const r=e.getBoundingClientRect();if(r.width===0||r.height===0)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden')return;
      if(e.closest('[hidden]')||e.closest('[inert]'))return;
      if(r.height<mh-0.5||r.width<mw-0.5)out.push((e.id||e.className||e.tagName)+':'+Math.round(r.width)+'x'+Math.round(r.height)+':'+(e.textContent||e.getAttribute('aria-label')||'').slice(0,20))});return out}""", [scope, minw, minh])

PROF = {'id': 'p_test1', 'name': 'Imported', 'sex': 'm', 'dob': '1990-01-01', 'heightCm': 170, 'startKg': 70, 'activity': 1.3,
        'activityModel': 3, 'exerciseAdds': True, 'goal': 'maintain', 'rateKgWk': 0.5, 'proteinGPerKg': 1.6, 'fatPct': 25, 'override': {'kcal': 2000}, 'updatedAt': 10, 'createdAt': 1}
OLDPROF = {'id': 'p_old1', 'name': 'OldTimer', 'sex': 'm', 'dob': '1990-01-01', 'heightCm': 170, 'startKg': 70, 'activity': 1.55, 'activityModel': 2,
           'goal': 'lose', 'rateKgWk': 0.5, 'proteinGPerKg': 1.6, 'fatPct': 25, 'override': {}, 'createdAt': 1, 'updatedAt': 10}

def ent(i, date, kcal, name='Test food', time='12:00', slot='s_lunch', slotName='Lunch', **kw):
    e = {'id': 'e_%s' % i, 'date': date, 'time': time, 'slot': slot, 'slotName': slotName, 'foodId': 'x_test', 'foodName': name,
         'qty': kcal, 'unit': 'g', 'unitLabel': 'g', 'unitG': 1, 'grams': kcal, 'per100': {'kcal': 100, 'p': 10, 'c': 10, 'f': 5, 'fib': 1},
         'updatedAt': 1, 'createdAt': 1}
    e.update(kw); return e

def exe(i, date, kcal, minutes=30, key='walk', label='Walking', met=3.5, kg=70, time='07:00', **kw):
    x = {'id': 'x_%s' % i, 'date': date, 'time': time, 'actKey': key, 'label': label, 'minutes': minutes, 'met': met, 'kgUsed': kg, 'kcal': kcal, 'updatedAt': 1, 'createdAt': 1}
    x.update(kw); return x

def backup_file(path, profile, entries=None, logs=None, weights=None, exercise=None, water=None, saved=None):
    pr = {'profile': dict(profile), 'entries': entries or {}, 'weights': weights or [], 'foods': []}
    if logs is not None: pr['logs'] = logs
    if exercise is not None: pr['exercise'] = exercise
    if water is not None: pr['water'] = water
    if saved is not None: pr['saved'] = saved
    json.dump({'app': 'diet-tracker', 'schema': 1, 'exportedAt': '2026-01-01T00:00:00Z', 'sharedFoods': [], 'lastPackImport': None, 'profiles': [pr]}, open(path, 'w'))

def import_file(p, path, mode=None):
    goto(p, 'backup'); p.set_input_files('#import-file', path); p.wait_for_selector('#import-apply')
    if mode: p.check('input[value=%s]' % mode)
    p.click('#import-apply'); p.wait_for_selector('#import-summary')

def pick_person(p, name):
    p.click('#menu-btn'); p.wait_for_timeout(300); p.select_option('#p-switch', label=name); p.wait_for_selector('#qbar')

def stored(p, suffix):
    """parsed JSON of the active profile's key (profile, water, saved ...)"""
    return p.evaluate("""s=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const k='dt:v1:p:'+m.activeProfileId+':'+s;const v=localStorage.getItem(k);return v?JSON.parse(v):null}""", suffix)

def inject_profiles(p, profiles):
    p.evaluate("""([ps])=>{localStorage.clear();localStorage.setItem('dt:v1:meta',JSON.stringify({schema:1,activeProfileId:ps[0].id,profileIds:ps.map(x=>x.id),lastExport:null}));ps.forEach(x=>localStorage.setItem('dt:v1:p:'+x.id+':profile',JSON.stringify(x)))}""", [profiles])
