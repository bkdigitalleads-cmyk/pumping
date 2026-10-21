# Pumping design notes (design pass, Oct 21, 2026)

## Concept: the freezer door at 3am

Real pumping gear is plain and handled: clear storage bags with a zip top and a white write-on stripe, bottles with ounce marks printed up the side, a strip of masking tape and a Sharpie, a wire shelf in the freezer. The app is drawn from those objects instead of from app-kit parts. Today is a bottle that fills to your goal. The stash is bags standing on fridge and freezer shelves with what you wrote on them in marker, frost on the frozen ones and a piece of tape on the one to use next. Labels are masking tape. Everything else is quiet type on cream paper (black at night) with hairlines between rows, so the drawings carry the personality and the screens stay easy to read with one eye open.

Before and after: `before/` and `after/` hold the same screens at 393x852 @3x, light and dark. They come from a throwaway web copy of the app (in-memory database, stubbed RevenueCat with a $4.99 weekly and a $29.99 Pumping Pass, clock at 2:20 pm), so fonts and layout match the app; native-only details (haptics, keep-awake, Dynamic Type, the iOS switch) are not visible in them.

## The system

- Type: Fraunces for headlines and numbers; Caveat Brush (OFL, `assets/fonts/OFL-CaveatBrush.txt`) only for what a parent would write with a marker (bag stripes, tape); the system font for everything else. Fraunces has no tabular figures, so changing numbers go through `src/ui/Figures.tsx`, which sets each digit in a fixed-width cell.
- Radius, used on purpose (`radius` in `src/theme.ts`): pills for thumb actions, soft rounded shapes for drawn bags and bottles, near-square tape and paper, and no radius at all on lists, sections and the tab bar.
- Components, all new in `src/ui/` (Odo's Card, PillButton and IconTile are gone, `src/components.tsx` deleted): Bottle, BagDrawing, Tape and Marker, Shelf and SlideOff, MiniSheet, ReminderDiagram, Figures, Press, PillAction, TextAction, RoundButton, SheetHeader, Section, Entry, Nudge, ToggleEntry, Tabs (words with a marker underline instead of a segmented control), ThumbBar, and motion helpers (useReduceMotion, useRepeat, haptics).
- Color tokens describe materials: milk, milkLine, plastic, plasticEdge, stripe, tape, tapeEdge, marker, frost, shelf, plus ink and paper. Night mode is true black; nothing is brighter than the cream text (#D9CCB4), milk is #BFB194, the switch thumb is cream, the SAMPLE page is dimmed, and there is no pure white.

## Icon

Three options in `icon-options.png` (big, and at 60x60 on light and dark wallpaper): 1 bag, 2 bottle, 3 bag with tape. Picked 1, the storage bag. The bottle reads fastest, but it is what every feeding and baby app already uses, so on a home screen full of baby apps it says "baby app", not "pumping". The bag is the object only pumping parents handle every day, it is the thing the stash is built around, and its silhouette (sealed strip, tear notches, tilted pouch, white stripe with two marker strokes) still reads at 60 px on the clay field. Option 3 adds tape, but at 60 px the tape turns into a smudge across the bag. Drawn in `store/icon.js` (`node icon.js options` redraws the comparison, `node icon.js` writes the assets).

## Checklist

0. Before screens
- [x] `before/*.png` committed first, in its own commit, before any design change: Today empty and with data, session running, Stash empty and with bags, Trends, Settings, every onboarding step (3 value screens, focus, plan, reminder, stash, source, trial, trial reminder), onboarding paywall, in-app paywall, SAMPLE preview. 393x852 @3x, light and dark.

1. Concept
- [x] Today: a large bottle (`ui/Bottle.tsx`) whose milk level is today's total against the goal, with printed graduations on the side in oz or mL (the top mark is the goal). The milk rises with a 700 ms ease-out when a session is saved.
- [x] Stash: bags drawn as storage bags (`ui/BagDrawing.tsx`: zip top, tear notches, write-on stripe, printed side marks), standing on wire shelves grouped by fridge, freezer and deep freezer (`ui/Shelf.tsx`).
- [x] The stripe shows number, date and amount in Caveat Brush (bundled, OFL), used only for bag stripes and tape.
- [x] Frozen bags get a faint frost texture (haze plus a scatter of small crystals, the same for a given bag every time).
- [x] "Use next" is a piece of tape stuck across the bag's corner; a bag past its date gets a "past date" tape instead of a badge.
- [x] "Write this on the bag" is a strip of masking tape with torn ends (`LabelTape` in `screens/Bag.tsx`, `ui/Tape.tsx`).

2. No card-for-everything
- [x] Today reads like a page: a Fraunces sentence header ("Wednesday. 5 sessions, 20½ oz."), the bottle with left, right and goal beside it, the countdown as a big line of type ("Next pump / in 1 h 40 m / around 4:00, 3 h from the start of the last one."), then the day as a timeline: times on the left in fixed-width figures, a dot on a line, hairline dividers, no cards.
- [x] "Start pumping" is a tall pill pinned in a bottom bar just above the tab bar, with "Log a past session" as a round button beside it. Stash pins "Add a bag" the same way; the session pins "Done, save it".
- [x] Trends and Settings: no stacked cards. Full-bleed sections with Fraunces headings and hairlines; Trends' numbers are a dotted-leader ledger; Settings is a grouped list in the app's voice ("How long milk keeps", "How much baby takes a day").
- [x] New component set with its own names (above). One radius system, used deliberately.

3. Session screen
- [x] Huge Fraunces timer (92 pt) with fixed-width digit cells, so it never jitters.
- [x] Left and right as two large halves filling the lower part of the screen. Tap anywhere on a half to add ½ oz (or 10 mL); hold to repeat, accelerating from 300 ms to 60 ms between steps; a small minus in each half's corner, also hold-to-repeat. VoiceOver can increment and decrement each half.
- [x] Haptics: a light tick on every step, a success tap on save, a soft tap at 15 and 20 minutes (from App.tsx, so they come even with the session hidden).
- [x] Keep-awake (expo-keep-awake) while a session runs, on Today as well as in the session.
- [x] Night: dim amber bottom bar, cream digits, nothing brighter than the cream text, no pure white.

4. Copy voice
- [x] Every user-facing string rewritten: screens, alerts, buttons, onboarding, paywall, notices, store description. Short, plain, a little dry, with pumping words where they fit (stash, thawing, and "flange size, slow letdown, power pumping" as the note prompt), never as advice.
- [x] Grep-checked: no Welcome, Get started, Unlock, Premium, Seamless, Effortless, Journey, Let's, Oops, "No X yet", exclamation marks, em dashes or "Track your progress" in user-facing text. (`Welcome` survives only as a component name.)
- [x] After saving: "Logged. 4½ oz, left side did more today." (or "both sides about even today"). Empty stash: one ghost bag and "Your first bag goes here. Write the date on it before it goes in the freezer."
- [x] Numbers read like a person: 4½ oz (ounces to the nearest half everywhere, including averages), "in 1 h 40 m", "around 4:00", "1 session" and "3 sessions". Covered by unit checks.

5. Empty states
- [x] No icon-title-line blocks. Today: a dashed ghost bottle and a dotted timeline slot ("Your first session of the day lands here."). Stash: a ghost bag on an empty freezer shelf. Trends: the empty chart with its marks and goal line, and one sentence in the header.

6. Paywalls
- [x] No feature grid, no "Most popular" or "Best value" pill, no crown.
- [x] The hero is a small taped-down copy of a Pro PDF (`ui/MiniSheet.tsx`): the caregiver sheet or the supply log with the parent's own numbers, or clearly marked "example" rows when there are none.
- [x] One line personalized by the onboarding answer (NICU or daycare: "The caregiver sheet is ready to print for the daycare." Building a stash: "Every bag, oldest first, with use-by dates.").
- [x] Unchanged logic: Weekly preselected on the onboarding paywall, Pumping Pass preselected and first in-app, the X after 3 seconds, trial wording and "No payment now" only when eligible, the 3.1.2(c) disclosure and links always visible.

7. Onboarding value screens
- [x] The app's own drawings: the bottle filling, two labeled bags with the "use next" tape, the start-or-end reminder diagram. One short headline each, no paragraph. The trial screens use tape ("3 days free") and three marked days.

8. Motion
- [x] The bottle fills; a used or tossed bag slides off its shelf (with Undo); timer digits do not jitter. Reduce Motion makes both jump to the end.

9. Icon
- [x] Drop-in-a-ring retired. Three options drawn in `icon-options.png`; the storage bag is picked (reasons above) and written to `assets/`.

10. Craft
- [x] Fixed-width figures on every number that changes in place (timer, side amounts, countdown, nudges, timeline times, ledger).
- [x] Pressed states on everything tappable (`ui/Press.tsx` is the only way the app makes something tappable, apart from the iOS switch and the paywall's legal links).
- [x] VoiceOver labels on drawings, rows, halves, plans and the countdown; the bottle and bags are labeled as a whole.
- [x] Dynamic Type: body text scales freely; big display numbers cap at 1.15 to 1.6x so they cannot clip; drawn text (bag stripes, bottle marks) scales with the drawing, not the font size; rows grow in height. Designed for xxxLarge, not yet checked on a device (it cannot be shown in the web renders).
- [x] Status bar follows light and dark (`StatusBar style="auto"`).
- [x] Keyboard: every scroll view with an input adjusts for the keyboard (`automaticallyAdjustKeyboardInsets`), and the session and onboarding inputs sit in keyboard-avoiding views.

11. Store metadata
- [x] Subtitle "Breastfeeding Timer & Reminder" (30/30). Keywords `pump,lactation,exclusive,supply,breast,bag,frozen,storage,schedule,nicu,oz,session,expressed,mom` (96/100). Screenshot plan and description updated for the bottle and bags.

12. Done
- [x] `after/*.png`, the same screens as `before/` plus the bag sheet, the past-session form and scrolled Trends and Settings.
- [x] `npx tsc --noEmit` clean, `npm test` passing, `npx expo export --platform ios` bundling.
