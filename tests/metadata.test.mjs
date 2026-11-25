// Checks for store/metadata.md: the English (U.S.) keyword field and the
// "Extra listings indexed for US search" table. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const md = readFileSync(new URL('../store/metadata.md', import.meta.url), 'utf8');

/** The body of a "## " section, up to the next one. */
function section(title) {
  const start = md.indexOf(`\n## ${title}`);
  assert.ok(start >= 0, `missing section: ${title}`);
  const rest = md.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end < 0 ? rest : rest.slice(0, end);
}

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

const rows = section('Extra listings indexed for US search')
  .split('\n')
  .filter((l) => l.startsWith('|'))
  .slice(2) // header and separator
  .map((l) => {
    const [locale, name, subtitle, keywords, nameLen, subLen, kwBytes] = cells(l);
    // A name or subtitle in parentheses is left as it is in App Store Connect.
    const known = (v) => (v.startsWith('(') ? null : v);
    return { locale, name: known(name), subtitle: known(subtitle), keywords, nameLen, subLen, kwBytes };
  });

const LOCALES = ['en-US', 'es-MX', 'ar-SA', 'fr-FR', 'ko', 'pt-BR', 'ru', 'vi', 'zh-Hans', 'zh-Hant'];
const words = (text) => (text ?? '').toLowerCase().match(/[a-zÀ-ɏ]+/g) ?? [];

test('listings: every locale is in the table once', () => {
  assert.deepEqual(rows.map((r) => r.locale), LOCALES);
});

test('listings: name and subtitle at most 30 characters, keywords at most 100 bytes, counts as recorded', () => {
  for (const r of rows) {
    for (const [field, value, recorded] of [
      ['name', r.name, r.nameLen],
      ['subtitle', r.subtitle, r.subLen],
    ]) {
      if (value == null) continue;
      assert.ok([...value].length <= 30, `${r.locale} ${field} is ${[...value].length} characters: ${value}`);
      assert.equal(String([...value].length), recorded, `${r.locale} ${field} length column`);
    }
    const bytes = Buffer.byteLength(r.keywords, 'utf8');
    assert.ok(bytes <= 100, `${r.locale} keywords are ${bytes} bytes`);
    assert.equal(String(bytes), r.kwBytes, `${r.locale} keyword bytes column`);
  }
});

test('listings: keywords have no spaces, no repeats, nothing from the name or subtitle', () => {
  for (const r of rows) {
    assert.ok(!/\s/.test(r.keywords), `${r.locale} keywords contain a space`);
    const list = r.keywords.split(',');
    assert.ok(list.every((k) => k.length > 0), `${r.locale} has an empty keyword`);
    const seen = new Set();
    for (const k of list) {
      assert.ok(!seen.has(k), `${r.locale} repeats the keyword "${k}"`);
      seen.add(k);
    }
    const taken = new Set([...words(r.name), ...words(r.subtitle)]);
    for (const k of list) assert.ok(!taken.has(k), `${r.locale} keyword "${k}" is already in its name or subtitle`);
  }
});

test('listings: never the word log, never "Pump Log", in any name, subtitle or keyword', () => {
  for (const r of rows) {
    for (const [field, value] of [
      ['name', r.name],
      ['subtitle', r.subtitle],
    ]) {
      if (value == null) continue;
      assert.ok(!/\blog/i.test(value), `${r.locale} ${field} uses the word log: ${value}`);
      assert.ok(!/pump\s*log/i.test(value), `${r.locale} ${field} says Pump Log`);
    }
    for (const k of r.keywords.split(',')) assert.ok(!/log/i.test(k), `${r.locale} keyword "${k}" contains log`);
  }
});

test('listings: no keyword promises baby, feeding or nursing tracking the app does not have', () => {
  const lacks = new Set(['baby', 'feeding', 'feed', 'newborn', 'nursing', 'bottle']);
  for (const r of rows) {
    if (r.locale === 'es-MX') continue; // kept as it is in App Store Connect, by Brian's call
    for (const k of r.keywords.split(',')) assert.ok(!lacks.has(k), `${r.locale} keyword "${k}"`);
    for (const w of [...words(r.name), ...words(r.subtitle)]) assert.ok(!lacks.has(w), `${r.locale} name or subtitle "${w}"`);
  }
});

test('listings: the English (U.S.) keyword field matches the en-US row', () => {
  const body = section('Keywords').split('\n');
  const field = body[1].trim();
  const en = rows.find((r) => r.locale === 'en-US');
  assert.equal(field, en.keywords);
  assert.match(body[0], new RegExp(`\\(${Buffer.byteLength(field, 'utf8')}/100\\)`), 'heading count');
  assert.equal(section('Name').split('\n')[1].trim(), en.name);
  assert.equal(section('Subtitle').split('\n')[1].trim(), en.subtitle);
});
