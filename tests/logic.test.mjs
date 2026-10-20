// Unit checks for src/logic.ts: use-by dates, totals and reminder times.
// Run with `npm test` (Node 22+ strips the TypeScript types itself).
// New York time on purpose, so the checks cross a daylight saving change.
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = await import('../src/logic.ts');

const STORAGE = L.DEFAULT_STORAGE;
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const bag = (over) => ({
  id: 1,
  labelNo: 1,
  pumpedOn: '2026-10-20',
  volumeMl: 120,
  location: 'freezer',
  movedAt: null,
  usedAt: null,
  discardedAt: null,
  ...over,
});
const session = (over) => ({
  id: 1,
  startedAt: at(2026, 10, 20, 9, 0),
  endedAt: at(2026, 10, 20, 9, 20),
  durationSec: 1200,
  leftMl: 60,
  rightMl: 70,
  note: '',
  ...over,
});

test('dates: addDays, addMonths clamps to month end, daysBetween across DST', () => {
  assert.equal(L.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(L.addDays('2026-12-30', 4), '2027-01-03');
  assert.equal(L.addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(L.addMonths('2027-08-31', 6), '2028-02-29');
  assert.equal(L.addMonths('2026-10-20', 12), '2027-10-20');
  assert.equal(L.daysBetween('2026-10-31', '2026-11-02'), 2); // DST ends Nov 1
  assert.equal(L.daysBetween('2026-11-02', '2026-10-31'), -2);
});

test('use-by: fridge 4 days, freezer 6 months, deep freezer 12 months', () => {
  assert.equal(L.useBy(bag({ location: 'fridge' }), STORAGE), '2026-10-24');
  assert.equal(L.useBy(bag({ location: 'freezer' }), STORAGE), '2027-04-20');
  assert.equal(L.useBy(bag({ location: 'deep_freezer' }), STORAGE), '2027-10-20');
});

test('use-by: follows edited storage times', () => {
  const s = { fridgeDays: 3, freezerMonths: 9, deepFreezerMonths: 12 };
  assert.equal(L.useBy(bag({ location: 'fridge' }), s), '2026-10-23');
  assert.equal(L.useBy(bag({ location: 'freezer' }), s), '2027-07-20');
});

test('use-by: a frozen bag moved to the fridge is thawing, use by the next day', () => {
  const b = bag({ location: 'fridge', pumpedOn: '2026-06-01', movedAt: at(2026, 10, 20, 21, 30) });
  assert.equal(L.isThawed(b), true);
  assert.equal(L.useBy(b, STORAGE), '2026-10-21');
  // Moved from fridge to freezer: the freezer rule from the pumped day.
  const frozenLater = bag({ location: 'freezer', pumpedOn: '2026-10-18', movedAt: at(2026, 10, 20) });
  assert.equal(L.useBy(frozenLater, STORAGE), '2027-04-18');
});

test('status: ok, soon, expired', () => {
  const fridge = bag({ location: 'fridge', pumpedOn: '2026-10-20' }); // use by Oct 24
  assert.equal(L.bagStatus(fridge, STORAGE, '2026-10-21'), 'ok');
  assert.equal(L.bagStatus(fridge, STORAGE, '2026-10-23'), 'soon');
  assert.equal(L.bagStatus(fridge, STORAGE, '2026-10-24'), 'soon'); // the use-by day itself is fine
  assert.equal(L.bagStatus(fridge, STORAGE, '2026-10-25'), 'expired');
  const frozen = bag({ pumpedOn: '2026-04-25' }); // use by Oct 25
  assert.equal(L.bagStatus(frozen, STORAGE, '2026-10-20'), 'soon');
  assert.equal(L.bagStatus(frozen, STORAGE, '2026-09-01'), 'ok');
});

test('stash order: first in, first out, thawing bag first, used and discarded left out', () => {
  const bags = [
    bag({ id: 1, labelNo: 1, pumpedOn: '2026-09-01', location: 'freezer' }),
    bag({ id: 2, labelNo: 2, pumpedOn: '2026-08-15', location: 'deep_freezer' }),
    bag({ id: 3, labelNo: 3, pumpedOn: '2026-08-20', location: 'freezer' }),
    bag({ id: 4, labelNo: 4, pumpedOn: '2026-10-19', location: 'fridge' }),
    bag({ id: 5, labelNo: 5, pumpedOn: '2026-07-01', location: 'fridge', movedAt: at(2026, 10, 20, 8) }),
    bag({ id: 6, labelNo: 6, pumpedOn: '2026-07-02', location: 'freezer', usedAt: at(2026, 10, 1) }),
    bag({ id: 7, labelNo: 7, pumpedOn: '2026-07-03', location: 'freezer', discardedAt: at(2026, 10, 1) }),
    bag({ id: 8, labelNo: 8, pumpedOn: '2026-08-20', location: 'freezer' }),
  ];
  const order = L.stashOrder(bags, STORAGE).map((b) => b.labelNo);
  // thawing #5 (Oct 21), fresh #4 (Oct 23), freezer #3 and #8 (Feb 20, by number), #1 (Mar 1), deep #2 (Aug 15)
  assert.deepEqual(order, [5, 4, 3, 8, 1, 2]);
  assert.equal(L.useNext(bags, STORAGE, '2026-10-20').labelNo, 5);
  // Once the thawed bag is past its day, the next good one is "use next".
  assert.equal(L.useNext(bags, STORAGE, '2026-10-22').labelNo, 4);
});

test('stash totals by location, expired milk not counted, days of milk', () => {
  const bags = [
    bag({ id: 1, volumeMl: 100, location: 'fridge', pumpedOn: '2026-10-19' }),
    bag({ id: 2, volumeMl: 150, location: 'freezer' }),
    bag({ id: 3, volumeMl: 200, location: 'freezer' }),
    bag({ id: 4, volumeMl: 250, location: 'deep_freezer' }),
    bag({ id: 5, volumeMl: 90, location: 'fridge', pumpedOn: '2026-10-01' }), // expired
    bag({ id: 6, volumeMl: 500, location: 'freezer', usedAt: 1 }),
  ];
  const t = L.stashTotals(bags, STORAGE, '2026-10-20');
  assert.equal(t.totalMl, 700);
  assert.equal(t.count, 4);
  assert.equal(t.expiredCount, 1);
  assert.deepEqual(t.byLocation.fridge, { ml: 100, count: 1 });
  assert.deepEqual(t.byLocation.freezer, { ml: 350, count: 2 });
  assert.deepEqual(t.byLocation.deep_freezer, { ml: 250, count: 1 });
  assert.equal(L.daysOfMilk(700, 600), 1.1);
  assert.equal(L.daysOfMilk(1800, 600), 3);
  assert.equal(L.daysOfMilk(700, null), null);
  assert.equal(L.nextLabelNo(bags.map((b, i) => ({ ...b, labelNo: i * 3 }))), 16);
  assert.equal(L.nextLabelNo([]), 1);
});

test('daily totals: per calendar day, left and right, summary', () => {
  const sessions = [
    session({ id: 1, startedAt: at(2026, 10, 19, 23, 50), leftMl: 50, rightMl: 50 }),
    session({ id: 2, startedAt: at(2026, 10, 20, 0, 10), leftMl: 40, rightMl: 60 }),
    session({ id: 3, startedAt: at(2026, 10, 20, 6, 0), leftMl: 80, rightMl: 100 }),
    session({ id: 4, startedAt: at(2026, 10, 10, 6, 0), leftMl: 999, rightMl: 999 }), // out of range
  ];
  const rows = L.dailyTotals(sessions, '2026-10-18', '2026-10-20');
  assert.deepEqual(
    rows.map((r) => [r.date, r.totalMl, r.count]),
    [
      ['2026-10-18', 0, 0],
      ['2026-10-19', 100, 1],
      ['2026-10-20', 280, 2],
    ]
  );
  const s = L.summarize(rows);
  assert.equal(s.totalMl, 380);
  assert.equal(s.sessions, 3);
  assert.equal(s.daysLogged, 2);
  assert.equal(s.avgPerDayMl, 190);
  assert.ok(Math.abs(s.avgPerSessionMl - 126.667) < 0.01);
  assert.equal(s.leftMl, 170);
  assert.equal(s.rightMl, 210);
  assert.equal(s.leftPct, 45);
  assert.equal(s.bestDay.date, '2026-10-20');
  // Across the end of daylight saving time, still one row per day.
  assert.equal(L.dailyTotals([], '2026-10-31', '2026-11-02').length, 3);
  assert.equal(L.summarize([]).leftPct, null);
});

test('next pump: from the start or from the end of the last session', () => {
  const last = { startedAt: at(2026, 10, 20, 9, 0), endedAt: at(2026, 10, 20, 9, 25) };
  assert.equal(L.nextPumpAt(last, 180, 'start'), at(2026, 10, 20, 12, 0));
  assert.equal(L.nextPumpAt(last, 180, 'end'), at(2026, 10, 20, 12, 25));
  assert.equal(L.nextPumpAt(null, 180, 'start'), null);
  // Across midnight and the DST change: elapsed time, not wall-clock hours.
  const late = { startedAt: at(2026, 10, 31, 23, 0), endedAt: at(2026, 10, 31, 23, 30) };
  assert.equal(L.nextPumpAt(late, 180, 'end') - late.endedAt, 3 * 3600_000);
});

test('reminder fire time: none when already due', () => {
  const now = at(2026, 10, 20, 11, 0);
  assert.equal(L.reminderFireAt(at(2026, 10, 20, 12, 0), now), at(2026, 10, 20, 12, 0));
  assert.equal(L.reminderFireAt(at(2026, 10, 20, 10, 59), now), null);
  assert.equal(L.reminderFireAt(now + 10_000, now), null);
  assert.equal(L.reminderFireAt(null, now), null);
  assert.equal(L.suggestedIntervalMin(8), 180);
  assert.equal(L.suggestedIntervalMin(7), 210);
  assert.equal(L.suggestedIntervalMin(30), 60);
  assert.equal(L.suggestedIntervalMin(1), 720);
});

test('volumes: oz and mL, stepper lands on the grid', () => {
  assert.equal(L.fmtVol(L.fromUnit(4.5, 'oz'), 'oz'), '4.5 oz');
  assert.equal(L.fmtVol(L.fromUnit(12, 'oz'), 'oz'), '12 oz');
  assert.equal(L.fmtVol(133.4, 'ml'), '133 mL');
  assert.equal(L.volNumber(L.stepVolume(0, 1, 'oz'), 'oz'), '0.5');
  assert.equal(L.volNumber(L.stepVolume(L.fromUnit(2.3, 'oz'), 1, 'oz'), 'oz'), '2.5');
  assert.equal(L.volNumber(L.stepVolume(L.fromUnit(2.3, 'oz'), -1, 'oz'), 'oz'), '2');
  assert.equal(L.volNumber(L.stepVolume(L.fromUnit(2.5, 'oz'), 1, 'oz'), 'oz'), '3');
  assert.equal(L.stepVolume(0, -1, 'oz'), 0);
  assert.equal(L.stepVolume(125, 1, 'ml'), 130);
  assert.equal(L.stepVolume(130, -1, 'ml'), 120);
  assert.equal(L.parseVolume('4,5', 'oz'), 4.5 * L.ML_PER_OZ);
  assert.equal(L.parseVolume('abc', 'ml'), null);
  // Totals of 0.5 oz steps add up cleanly when shown in oz.
  const sum = [2.5, 3, 3.5].map((o) => L.fromUnit(o, 'oz')).reduce((a, b) => a + b, 0);
  assert.equal(L.fmtVol(sum, 'oz'), '9 oz');
});

test('formatting and CSV', () => {
  assert.equal(L.fmtClock(492), '08:12');
  assert.equal(L.fmtClock(3725), '1:02:05');
  assert.equal(L.fmtDuration(1080), '18 min');
  assert.equal(L.fmtInterval(165), '2h 45m');
  assert.equal(L.fmtIntervalWords(165), '2 hours and 45 minutes');
  assert.equal(L.fmtIntervalWords(180), '3 hours');
  assert.equal(L.fmtCountdown(102 * 60_000), '1h 42m');
  const csv = L.sessionsCsv([session({ note: 'said "hi"' })]).split('\r\n');
  assert.equal(csv.length, 2);
  assert.equal(csv[1], '2026-10-20 09:00,2026-10-20 09:20,20,60,70,130,2.03,2.37,4.40,"said ""hi"""');
});
