# Pumping Tracker, App Store metadata (1.0.2)

Everything here is pasted into App Store Connect by Brian and Cowork. No em dashes anywhere. Never write "Pump Log" (another app's registered trademark).

## Name (28/30)
Pumping Tracker: Breast Milk

(Changed Oct 21: "Pumping Tracker: Milk Stash" was taken in App Store Connect. App record: ASC app id 6825142604, bundle id com.bwk.pumping.)

Home screen name (app.json `name`): Pumping

## Subtitle (26/30)
Breastfeeding & Pump Timer

(Changed Oct 21 with the new name, Brian approved. Earlier drafts: "Milk Stash, Timer & Reminders", then "Breastfeeding Timer & Reminder".)

## Keywords (99/100)
stash,schedule,storage,reminder,lactation,freezer,nicu,mom,exclusive,supply,expressed,frozen,bag,oz

(1.0.2. Planned by Cowork as baby,feeding,newborn,nursing,feed,stash,schedule,storage,reminder,lactation,bottle,freezer,nicu,mom; baby, feeding, newborn, nursing, feed and bottle were swapped for exclusive, supply, expressed, frozen, bag and oz because the app logs pumping only, not feeds, nursing or a baby; see "Extra listings indexed for US search". 1.0.0 and 1.0.1, Brian approved Oct 21: stash,reminder,lactation,exclusive,supply,bag,frozen,freezer,storage,schedule,nicu,oz,session,mom.) Rules: no word from the name or subtitle (pumping, tracker, breast, milk, breastfeeding, pump, timer), never "log" and never "pump log". tests/metadata.test.mjs checks this field against the en-US row below.

## What's New in 1.0.2
Small fixes and improvements.

(1.0.1: Start logging right away: the first pump comes before any setup. Reminders are offered when your first session ends. The free plan now covers every session for your first three days. Small fixes.)

## Extra listings indexed for US search
Apple indexes these localizations for US App Store search as well as English (U.S.) and Spanish (Mexico). Each gets its own English name, subtitle and keyword field, and the English (U.S.) description, promotional text and What's New, pasted into App Store Connect by Brian and Cowork (Visual Timer and Chores already ship this way). Spanish (Mexico) stays as it is in App Store Connect; its name and subtitle are not recorded here.

Rules, checked by `npm test` (tests/metadata.test.mjs): name and subtitle at most 30 characters, keywords at most 100 bytes, no spaces in keywords, no keyword repeated in a field or taken from that listing's name or subtitle, no brand names, never "Pump Log" and never the word "log" in any name, subtitle or keyword. Every word must match what the app does: pumping sessions with a timer and left and right amounts, today's total against a goal, the next-pump reminder from the start or the end, the freezer stash with use-by dates and thawing, trends, the supply log and caregiver sheet PDFs. It does not log nursing, bottle feeds or anything else about a baby, so no baby, feeding, feed, newborn, nursing or bottle, and no breastfeeding or nursing timer.

| locale | name | subtitle | keywords | name | subtitle | keyword bytes |
|---|---|---|---|---|---|---|
| en-US | Pumping Tracker: Breast Milk | Breastfeeding & Pump Timer | stash,schedule,storage,reminder,lactation,freezer,nicu,mom,exclusive,supply,expressed,frozen,bag,oz | 28 | 26 | 99 |
| es-MX | (unchanged in ASC) | (unchanged in ASC) | lactancia,sacaleches,materna,congelador,bolsa,onzas,ml,recordatorio,banco,exclusiva,bebe,mama,nicu | | | 98 |
| ar-SA | Breast Milk Tracker: Pumping | Session Timer & Freezer Stash | storage,supply,exclusive,mom,caregiver,daycare,fridge,thawing,output,ounces,work,interval,rotation | 28 | 29 | 98 |
| fr-FR | Breast Pump Tracker & Stash | Pumping Timer, Milk Storage | breastfeeding,exclusive,freezer,supply,lactation,app,frozen,bag,label,expiration,daycare,thaw,oz,ml | 27 | 27 | 99 |
| ko | Lactation Tracker: Pump Output | Breast Milk & Pumping Timer | stash,supply,schedule,reminder,mom,storage,freezer,session,countdown,interval,daily,goal,ounces,ml | 30 | 27 | 98 |
| pt-BR | Exclusive Pumping Tracker | Breast Milk Stash & Timer | breastfeeding,freezer,storage,supply,mom,session,pump,app,work,fridge,thawing,caregiver,label,nicu | 25 | 25 | 98 |
| ru | Milk Stash: Freezer Inventory | Breast Milk Storage Tracker | pumping,pump,breastfeeding,bag,frozen,oz,supply,lactation,timer,rotation,label,daycare,ml,expressed | 29 | 27 | 99 |
| vi | Pumping Timer: Breast Pump | Milk Supply & Session Tracker | breastfeeding,stash,freezer,storage,exclusive,lactation,reminder,countdown,ounces,nicu,work,daily | 26 | 29 | 97 |
| zh-Hans | Breast Pumping Tracker & Timer | Pump Sessions, Milk Stash | breastfeeding,freezer,storage,schedule,reminder,mom,exclusive,supply,frozen,thaw,caregiver,bag,nicu | 30 | 25 | 99 |
| zh-Hant | Pumping Schedule: Milk Tracker | Breast Pump Timer & Reminders | breastfeeding,stash,freezer,storage,supply,session,nicu,exclusive,output,lactation,mom,fridge,label | 30 | 29 | 99 |

Changed from Cowork's draft (Nov 25):
- Keywords baby, feeding, feed, newborn, nursing and bottle removed everywhere (English (U.S.) and all eight). Apple pairs keywords with the name, so they search as "baby tracker", "feeding tracker", "nursing timer" and "bottle feeding", features the app does not have. Replaced with words for what it does: exclusive, supply, expressed, frozen, bag, oz, ml, ounces, fridge, thaw or thawing, caregiver, daycare, label, rotation, expiration (use-by dates), countdown, interval, daily, goal, output, session, work (back-to-work pumping).
- ar-SA subtitle "Breastfeeding & Pumping Timer" reads as a breastfeeding (nursing) timer: now "Session Timer & Freezer Stash". stash, freezer and session left its keywords as a result.
- ko name "Breastfeeding Tracker: Pump" promises a breastfeeding tracker: now "Lactation Tracker: Pump Output". lactation left its keywords.
- Kept as drafted: every other name and subtitle, and breastfeeding as a keyword (it is in the live English subtitle). No field reads as a medical claim: lactation, supply and nicu describe who the app is for and what the PDFs show, not an effect on supply or health.

## Promotional text (154/170)
Log a session in seconds, see today's ounces at a glance, and get your next-pump reminder counted from the start or the end. Your freezer stash, in order.

## Description
Pumping Tracker is a calm, simple log for parents who pump: exclusive pumpers, NICU parents, and anyone heading back to work with a freezer stash to build.

SEE WHERE YOUR DAY STANDS
• A bottle on the home screen fills with today's total, with printed marks up to your daily goal
• Left and right totals beside it, and the next pump as a plain line of type
• Ounces or milliliters, your choice

THE NEXT PUMP, TIMED YOUR WAY
• A countdown to your next pump, right on the home screen
• Reminders count from the START or the END of your last session. You choose, and you can switch any time
• Set the interval that fits your day

LOG A SESSION WITH ONE THUMB
• Tap Start pumping and the timer runs, even if you switch apps or your phone restarts
• Big left and right buttons in half ounce or 10 mL steps
• Forgot to log? Add a past session in a few taps

A FREEZER STASH YOU CAN TRUST
• Every bag lined up oldest first, with a use-by date
• Fridge, freezer and deep freezer totals, and the bag to use next
• Optional "days of milk" from a daily amount you choose
• A label card for each bag: number, date, amount and use-by, ready to write on the bag
• Storage times you can edit, with a link to the CDC's guidance

TRENDS
• Daily totals for the last 7 days, or 30 and 90 days with Pro
• Average per session and your left and right split

SHARE WHEN YOU NEED TO (PRO)
• Supply log PDF for your lactation consultant or pediatrician: daily totals, sessions per day, averages and the left and right split
• Caregiver sheet PDF for daycare, the NICU or a sitter: bags in use-next order with use-by dates and thawing notes
• CSV export of every session

PUMPING PRO
Start free: every session for your first 3 days, up to 5 bags in your stash, and a preview of your supply log any time. Pumping Pro keeps every session, holds your whole stash, opens 30 and 90 day trends, and makes both PDFs and the CSV. Choose a weekly subscription with a free trial, or the Pumping Pass, a one-time purchase that is yours to keep.

Pumping Tracker is a personal log. It does not give medical advice. Storage times are general guidance; follow your care team's advice for your baby.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bkdigitalleads-cmyk.github.io/pumping/privacy.html

## Category
Primary: Health & Fitness. Secondary: Medical is NOT suggested (log only, no medical claims); use Lifestyle or leave empty.

## Age rating
Expect 4+. Answer the questionnaire with no medical or treatment information (the app is a personal log).

## App Privacy (nutrition label)
Same answers as Odo: Data Not Collected for app content. Sessions, bags and settings stay in the on-device database. RevenueCat validates purchases with an anonymous app user id and purchase history; answer the purchase questions the same way they were answered for Odo.

## Pricing and RevenueCat (to set up in ASC and RevenueCat)
- `pumping_pro_weekly`: auto-renewing weekly subscription with a 3-day free trial (introductory offer). Preselected on the onboarding paywall.
- `pumping_pro_lifetime`: non-consumable, $29.99, shown in the app as "Pumping Pass", "One-time, yours to keep". Preselected on the in-app paywall.
- No yearly plan.
- RevenueCat: entitlement `pro`; offering `default` with `$rc_weekly` → pumping_pro_weekly and `$rc_lifetime` → pumping_pro_lifetime. Set up by Cowork on Oct 21: RevenueCat project Pumping for App Store app com.bwk.pumping, both products attached, public iOS key in app.json `extra.revenueCatApiKeyIos`.
- Prices and trial length shown in the app always come from StoreKit.

## App Review note (paste into ASC, Notes)
Pumping Tracker is an offline log for parents who pump breast milk. There is no account or sign-in, and everything is stored on the device.

On first launch you see one intro screen and two setup questions (what matters most, then pumps a day and a daily goal), then the Today screen. Tap Start pumping, then Done to save the session. When the first session is saved, one screen offers the next-pump reminder; "Turn on reminders" asks for notification permission, which is used only for local reminders on the device (the next-pump reminder, and one reminder 1 day before a free trial ends). "Not now" skips it. If the Apple ID can still get the free trial, two screens then explain the trial and the reminder. Then the paywall opens. The close button (X, top right) appears after 3 seconds. Tap it to keep using the app for free.

The app is free for every session in the first 3 days after the first one, and for 5 bags in the stash. After that, Start pumping, Log a past session and Add a bag open the paywall; a session already running can always be saved, and everything logged stays viewable. The supply log PDF, the caregiver sheet PDF, CSV export and the 30 and 90 day trends are part of Pro. Free users can open a preview of the supply log from the Trends tab; it is marked SAMPLE, and its Share and Print buttons open the paywall. Restore purchases is on the paywall and in Settings.

The app does not give medical advice. Storage times are editable defaults with a link to the CDC's breast milk storage page.

## Screenshot plan (iPhone 6.9" and 6.5", light mode unless noted; Brian captures from a TestFlight build)
1. Today with the bottle two thirds full and "Next pump in 1 h 20 m": "See your day at a glance"
2. The reminder question after the first session, with the start-or-end drawing: "Reminders from the start or the end. Your call." (since 1.0.1 it is no longer an onboarding screen)
3. Live session with the big timer and the left and right halves: "Log a session with one thumb"
4. Stash with bags on the fridge and freezer shelves and the "use next" tape: "Your freezer stash, oldest first"
5. The masking-tape label ("Write this on the bag"): "Every bag labeled and dated"
6. Trends 7 days with the left and right split: "Ounces by day, left and right"
7. Supply log PDF (Pro, shared to Files): "A clean log for your lactation consultant"
8. Today in night mode (dark): "Easy on the eyes at 3am"
