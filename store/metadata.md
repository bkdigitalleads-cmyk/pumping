# Pumping Tracker, App Store metadata (1.0.0)

Everything here is pasted into App Store Connect by Brian and Cowork. No em dashes anywhere. Never write "Pump Log" (another app's registered trademark).

## Name (27/30)
Pumping Tracker: Milk Stash

Home screen name (app.json `name`): Pumping

## Subtitle (29/30)
Milk Stash, Timer & Reminders

## Keywords

Brian's list is 114 characters, over Apple's 100 limit:
`pump,breastfeeding,lactation,exclusive,supply,breastmilk,bag,frozen,storage,schedule,nicu,oz,session,expressed,mom`

Proposed (96/100), drops "session" (mostly searched as "pumping session", and "pumping" is in the title) and "expressed" (lowest volume of the list). Brian to confirm or pick two others:
`pump,breastfeeding,lactation,exclusive,supply,breastmilk,bag,frozen,storage,schedule,nicu,oz,mom`

Rules: no repeats of title or subtitle words (pumping, tracker, milk, stash, timer, reminders), never "pump log".

## Promotional text (154/170)
Log a session in seconds, see today's ounces at a glance, and get your next-pump reminder counted from the start or the end. Your freezer stash, in order.

## Description
Pumping Tracker is a calm, simple log for parents who pump: exclusive pumpers, NICU parents, and anyone heading back to work with a freezer stash to build.

SEE WHERE YOUR DAY STANDS
• A big ring fills with today's total against your daily goal
• One tick for each planned pump, filled in as you go
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
Start free with 3 sessions and up to 5 bags in your stash, and preview your supply log any time. Pumping Pro unlocks unlimited sessions, your whole stash, 30 and 90 day trends, both PDFs and CSV export. Choose a weekly subscription with a free trial, or the Pumping Pass, a one-time purchase that is yours to keep.

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
- RevenueCat: entitlement `pro`; offering `default` with `$rc_weekly` → pumping_pro_weekly and `$rc_lifetime` → pumping_pro_lifetime. Put the RevenueCat public iOS key (starts with `appl_`) in app.json `extra.revenueCatApiKeyIos`, replacing the TODO. Until then the app runs with purchases switched off.
- Prices and trial length shown in the app always come from StoreKit.

## App Review note (paste into ASC, Notes)
Pumping Tracker is an offline log for parents who pump breast milk. There is no account or sign-in, and everything is stored on the device.

On first launch you see three short intro screens and a few setup questions (what matters most, pumps a day and a daily goal, reminder style, any milk already stored, and where you heard about us). The reminder screen can ask for notification permission; it is used only for local reminders on the device (the next-pump reminder, and one reminder 1 day before a free trial ends). If the Apple ID can still get the free trial, two screens explain the trial and the reminder. Then the paywall opens. The close button (X, top right) appears after 3 seconds. Tap it to keep using the app for free.

The app is free up to 3 logged sessions and 5 bags in the stash. After that, Start pumping and Add a bag open the paywall. The supply log PDF, the caregiver sheet PDF, CSV export and the 30 and 90 day trends are part of Pro. Free users can open a preview of the supply log from the Trends tab; it is marked SAMPLE, and its Share and Print buttons open the paywall. Restore purchases is on the paywall and in Settings.

The app does not give medical advice. Storage times are editable defaults with a link to the CDC's breast milk storage page.

## Screenshot plan (iPhone 6.9" and 6.5", light mode unless noted; Brian captures from a TestFlight build)
1. Today with the ring two thirds full and the countdown card: "See your day at a glance"
2. Settings reminder card with "From the start / From the end" and the worked example: "Reminders from the start or the end. Your call."
3. Live session with the big timer and left and right steppers: "Log a session with one thumb"
4. Stash with the totals card, location tiles and the USE NEXT bag: "Your freezer stash, oldest first"
5. Label card ("Write this on the bag"): "Every bag labeled and dated"
6. Trends 7 days with the left and right split: "Watch your supply over time"
7. Supply log PDF (Pro, shared to Files): "A clean log for your lactation consultant"
8. Today in night mode (dark): "Easy on the eyes at 3am"
