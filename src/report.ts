/**
 * The two PDFs, made on the phone with expo-print (Pro):
 *  - supply log: a date range of daily totals, sessions per day, averages
 *    and the left/right split, for a lactation consultant or pediatrician
 *  - caregiver sheet: bags in use-next order with use-by dates and general
 *    thawing notes, for daycare, the NICU or a sitter
 * Neither asks for or prints a baby's name or birth date.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getActiveBags, getSessionsBetween, kvAll } from './db';
import { parseSettings, Settings } from './state';
import {
  addDays,
  Bag,
  bagStatus,
  dailyTotals,
  DayTotal,
  daysOfMilk,
  fmtDate,
  fmtDay,
  fmtDuration,
  fmtTime,
  fmtVol,
  isoFromMs,
  isThawed,
  LOCATION_LABEL,
  Session,
  stashOrder,
  startOfDayMs,
  summarize,
  Summary,
  todayIso,
  Unit,
  useBy,
} from './logic';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadSettings(): Promise<Settings> {
  return parseSettings(await kvAll('setting.').catch(() => ({})));
}

// Paper colors, the same in light and dark mode.
const CSS = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #33241d; margin: 32px; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; font-size: 24px; margin: 0 0 2px; }
  .sub { color: #6f5b4f; font-size: 12px; }
  .name { margin-top: 14px; font-size: 13px; }
  .summary { display: flex; gap: 10px; margin: 16px 0 8px; }
  .box { flex: 1; background: #faf3e8; border: 1px solid #eadcc9; border-radius: 12px; padding: 10px 12px; }
  .box .v { font-family: Georgia, serif; font-size: 19px; font-weight: 600; }
  .box .l { font-size: 10.5px; color: #6f5b4f; margin-top: 2px; }
  .split { display: flex; height: 10px; border-radius: 5px; overflow: hidden; margin: 10px 0 3px; background: #efe1cf; }
  .split i { display: block; height: 100%; }
  .note { font-size: 11px; color: #6f5b4f; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6f5b4f; border-bottom: 2px solid #a8503a; padding: 5px 6px; }
  td { border-bottom: 1px solid #efe4d6; padding: 6px; font-size: 11.5px; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tr.zero td { color: #a39083; }
  .totals td { border-top: 2px solid #a8503a; border-bottom: none; font-weight: 700; }
  h2 { font-family: Georgia, serif; font-weight: 600; font-size: 17px; margin: 26px 0 4px; }
  .tips { border: 1px solid #eadcc9; border-radius: 12px; padding: 12px 16px; font-size: 12px; line-height: 1.55; margin-top: 18px; }
  .tips li { margin: 3px 0; }
  .first td { background: #f8e7dd; font-weight: 700; }
  .footer { margin-top: 24px; color: #9a8678; font-size: 10px; text-align: center; }
`;

// ---------- supply log ----------

export interface SupplyData {
  unit: Unit;
  from: string;
  to: string;
  days: number;
  rows: DayTotal[];
  summary: Summary;
  /** Session rows, only for short ranges (14 days or fewer). */
  sessions: Session[] | null;
  goalMl: number;
  generated: string;
}

/** The last `days` calendar days, today included. Shared by the PDF and the SAMPLE preview. */
export async function buildSupplyData(days: number): Promise<SupplyData> {
  const settings = await loadSettings();
  const to = todayIso();
  const from = addDays(to, -(days - 1));
  const list = await getSessionsBetween(startOfDayMs(from), startOfDayMs(addDays(to, 1)));
  const rows = dailyTotals(list, from, to);
  return {
    unit: settings.unit,
    from,
    to,
    days,
    rows,
    summary: summarize(rows),
    sessions: days <= 14 ? list : null,
    goalMl: settings.dailyGoalMl,
    generated: fmtDate(to),
  };
}

export function supplyHtml(d: SupplyData): string {
  const v = (ml: number) => fmtVol(ml, d.unit);
  const s = d.summary;
  const leftPct = s.leftPct ?? 50;
  const rows = [...d.rows]
    .reverse()
    .map(
      (r) => `<tr class="${r.count === 0 ? 'zero' : ''}">
      <td>${fmtDay(r.date)}</td><td class="num">${r.count}</td>
      <td class="num">${r.count ? v(r.leftMl) : ''}</td><td class="num">${r.count ? v(r.rightMl) : ''}</td>
      <td class="num"><b>${r.count ? v(r.totalMl) : 'none logged'}</b></td></tr>`
    )
    .join('');
  const sessionTable = d.sessions?.length
    ? `<h2>Sessions</h2>
  <table><tr><th>Day</th><th>Start</th><th class="num">Length</th><th class="num">Left</th><th class="num">Right</th><th class="num">Total</th><th>Note</th></tr>
  ${[...d.sessions]
    .reverse()
    .map(
      (x) => `<tr><td>${fmtDay(isoFromMs(x.startedAt))}</td><td>${fmtTime(x.startedAt)}</td>
      <td class="num">${fmtDuration(x.durationSec)}</td><td class="num">${v(x.leftMl)}</td><td class="num">${v(x.rightMl)}</td>
      <td class="num"><b>${v(x.leftMl + x.rightMl)}</b></td><td>${esc(x.note)}</td></tr>`
    )
    .join('')}</table>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${CSS}</style></head><body>
  <h1>Pumping supply log</h1>
  <div class="sub">${fmtDate(d.from)} to ${fmtDate(d.to)} (${d.days} days) · Generated ${d.generated} · Pumping for iPhone</div>
  <div class="name">Name: ______________________________</div>
  <div class="summary">
    <div class="box"><div class="v">${v(s.avgPerDayMl)}</div><div class="l">average a day (${s.daysLogged} ${s.daysLogged === 1 ? 'day' : 'days'} logged)</div></div>
    <div class="box"><div class="v">${v(s.avgPerSessionMl)}</div><div class="l">average a session</div></div>
    <div class="box"><div class="v">${s.avgSessionsPerDay.toFixed(1)}</div><div class="l">sessions a day</div></div>
    <div class="box"><div class="v">${v(s.totalMl)}</div><div class="l">total, ${s.sessions} sessions</div></div>
  </div>
  <div class="split"><i style="width:${leftPct}%;background:#a8503a"></i><i style="width:${100 - leftPct}%;background:#7a6a96"></i></div>
  <div class="note">Left ${v(s.leftMl)} (${s.leftPct ?? 0}%) · Right ${v(s.rightMl)} (${s.leftPct == null ? 0 : 100 - s.leftPct}%)${
    s.bestDay ? ` · Highest day ${fmtDay(s.bestDay.date)}, ${v(s.bestDay.totalMl)}` : ''
  } · Daily goal set in the app: ${v(d.goalMl)}</div>
  <table>
    <tr><th>Day</th><th class="num">Sessions</th><th class="num">Left</th><th class="num">Right</th><th class="num">Total</th></tr>
    ${rows}
    <tr class="totals"><td>Totals</td><td class="num">${s.sessions}</td><td class="num">${v(s.leftMl)}</td><td class="num">${v(s.rightMl)}</td><td class="num">${v(s.totalMl)}</td></tr>
  </table>
  ${sessionTable}
  <div class="footer">A personal log recorded by the parent in Pumping for iPhone. Amounts are as entered. This is not a medical record or medical advice.</div>
  </body></html>`;
}

// ---------- caregiver sheet ----------

export interface CaregiverData {
  unit: Unit;
  bags: Bag[];
  settings: Settings;
  totalMl: number;
  days: number | null;
  generated: string;
}

export async function buildCaregiverData(): Promise<CaregiverData> {
  const settings = await loadSettings();
  const today = todayIso();
  const bags = stashOrder(await getActiveBags(), settings).filter((b) => bagStatus(b, settings, today) !== 'expired');
  const totalMl = bags.reduce((s, b) => s + b.volumeMl, 0) + settings.startingStashMl;
  return {
    unit: settings.unit,
    bags,
    settings,
    totalMl,
    days: daysOfMilk(totalMl, settings.babyNeedMl),
    generated: fmtDate(today),
  };
}

export function caregiverHtml(d: CaregiverData): string {
  const v = (ml: number) => fmtVol(ml, d.unit);
  const rows = d.bags
    .map(
      (b, i) => `<tr class="${i === 0 ? 'first' : ''}">
      <td>${i === 0 ? 'Next' : i + 1}</td><td><b>#${b.labelNo}</b></td><td>${fmtDate(b.pumpedOn)}</td>
      <td class="num">${v(b.volumeMl)}</td><td>${isThawed(b) ? 'Fridge (thawing)' : LOCATION_LABEL[b.location]}</td>
      <td><b>${fmtDate(useBy(b, d.settings))}</b></td><td></td></tr>`
    )
    .join('');
  const other =
    d.settings.startingStashMl > 0
      ? `<tr><td></td><td colspan="2">Other stored milk, no dates entered</td><td class="num">${v(d.settings.startingStashMl)}</td><td colspan="3">Ask the parent which to use first.</td></tr>`
      : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${CSS}</style></head><body>
  <h1>Milk stash, caregiver sheet</h1>
  <div class="sub">Generated ${d.generated} · Pumping for iPhone</div>
  <div class="name">Baby: ______________________ &nbsp; Parent phone: ______________________</div>
  <div class="summary">
    <div class="box"><div class="v">${v(d.totalMl)}</div><div class="l">stored milk, ${d.bags.length} ${d.bags.length === 1 ? 'bag' : 'bags'}</div></div>
    ${d.days != null ? `<div class="box"><div class="v">${d.days} days</div><div class="l">at ${v(d.settings.babyNeedMl ?? 0)} a day</div></div>` : ''}
  </div>
  <div class="note">Use the bags from the top of the list down. The first one is the next to use. Each bag has its number written on it.</div>
  <table>
    <tr><th>Order</th><th>Bag</th><th>Pumped</th><th class="num">Amount</th><th>Where</th><th>Use by</th><th>Used (initial)</th></tr>
    ${rows}${other}
  </table>
  <div class="tips">
    <b>Thawing and handling</b>
    <ul>
      <li>Thaw in the fridge overnight, in a bowl of warm water, or under lukewarm running water.</li>
      <li>Never thaw or warm milk in a microwave.</li>
      <li>Once thawed, use within 24 hours if kept in the fridge, or within 1 to 2 hours at room temperature.</li>
      <li>Do not refreeze milk that has thawed.</li>
      <li>Swirl gently to mix. Leftover milk from a feeding should be used within 2 hours, then thrown away.</li>
    </ul>
    General guidance based on CDC breast milk storage advice, not medical advice. Follow the parent's and the baby's care team's instructions first.
  </div>
  <div class="footer">Storage times used for these dates: fridge ${d.settings.fridgeDays} days, freezer ${d.settings.freezerMonths} months, deep freezer ${d.settings.deepFreezerMonths} months.</div>
  </body></html>`;
}

// ---------- share ----------

async function shareHtml(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
  }
}

export async function shareSupplyLog(days: number): Promise<void> {
  await shareHtml(supplyHtml(await buildSupplyData(days)), 'Your supply log');
}

export async function shareCaregiverSheet(): Promise<void> {
  await shareHtml(caregiverHtml(await buildCaregiverData()), 'Caregiver sheet');
}
