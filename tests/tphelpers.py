"""Shared helpers for the Journable tests."""
import re
import os
URL = os.environ.get('JOURNABLE_URL', 'file:///home/arch/projects/trackme/index.html')
LOCALP = () if URL.startswith('file:') else ('http://localhost:8765/',)   # requests to our own test server are not 'network'

def set_time(page, hhmm, pre='atime'):
    """Drive the 12-hour time component by its parts (hour, minute, AM/PM)."""
    h, m = map(int, hhmm.split(':'))
    ap = 'pm' if h >= 12 else 'am'
    h12 = h % 12 or 12
    page.fill(f'#{pre}-h', str(h12)); page.fill(f'#{pre}-m', '%02d' % m); page.click(f'#{pre}-{ap}')

def goto(page, view):
    """Navigate like a user. Views: today, goals, weekly, weight, water, saved, myfoods, history, backup, settings, about
    (all via the drawer) and 'add' (the + button of the quick-log bar on Today)."""
    if view == 'add':
        goto(page, 'today')
        page.click('#ql-plus')
        return
    if page.locator('#sheets .sheet').count():
        page.keyboard.press('Escape')
    page.click('#menu-btn')
    page.click(f'#drawer [data-view={view}]')

def switch_person(page, label):
    page.click('#menu-btn')
    page.select_option('#p-switch', label=label)

def add_person(page):
    page.click('#menu-btn')
    page.click('#add-person')

def entry_menu(page, scope, item):
    """Open the options sheet of the entry row matched by `scope` (a locator string for the li) and pick an item
    (edit, adjust, datetime, delete)."""
    page.locator(scope).locator('.menu-btn').first.click()
    page.click({'edit': '#em-edit', 'adjust': '#em-adjust', 'datetime': '#em-datetime', 'delete': '#em-delete'}[item])

def edit_entry(page, name_prefix):
    """Edit entry whose food name starts with name_prefix (opens the add form prefilled)."""
    page.locator('li.entry', has=page.locator('b', has_text=re.compile('^' + re.escape(name_prefix)))).first.locator('.menu-btn').click()
    page.click('#em-edit')

def delete_entry(page, name_prefix):
    page.locator('li.entry', has=page.locator('b', has_text=re.compile('^' + re.escape(name_prefix)))).first.locator('.menu-btn').click()
    page.click('#em-delete')

def quick_edit(page, scope, hhmm):
    """Change the time of one Today row through Change date & time."""
    entry_menu(page, scope, 'datetime')
    set_time(page, hhmm, 'q'); page.click('#q-done')

def tn(page, sel):
    """text of one of the 'today so far' numbers, which now live on the Daily goals screen (they used to be on Today); returns to Today afterwards"""
    goto(page, 'goals'); page.wait_for_selector(sel); t = page.inner_text(sel)
    goto(page, 'today'); page.wait_for_selector('#qbar')
    return t
