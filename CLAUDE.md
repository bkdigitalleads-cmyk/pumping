@AGENTS.md

# Pumping Tracker (pumping)

Part of Brian's iOS app portfolio (seller bkdigitalleads-cmyk). Expo SDK 57, React Native, TypeScript, expo-sqlite, RevenueCat, expo-notifications (local only). Engine forked from Odo 1.0.6.

- App Store name: "Pumping Tracker: Breast Milk" (the first choice, "Pumping Tracker: Milk Stash", was taken). Home screen name: "Pumping". Bundle ID: com.bwk.pumping. Expo slug and scheme: pumping. GitHub: bkdigitalleads-cmyk/pumping.
- App Store app ID: 6825142604 (eas.json `ascAppId`). Expo projectId: TODO in app.json. RevenueCat public key: TODO in app.json `extra.revenueCatApiKeyIos`; the app runs with purchases off until a real `appl_` key is there.
- Not in the store yet. First version 1.0.0, build 1. Brian approved the app on Oct 20, 2026.
- What it is: an offline log for parents who pump breast milk. Sessions with a timer and left/right amounts, today's total against a goal, a next-pump reminder from the START or the END of the last session, a freezer stash in use-by order, trends, and two Pro PDFs (supply log, caregiver sheet). Log only: no medical advice or claims. Never collect a baby's name, birth date or photos.
- Never write "Pump Log" anywhere (a registered trademark of another app): not in the app, store text, keywords or the website.

## How shipping works (read before every push)

- A push to `main` that touches app.json, eas.json, package*.json, App.tsx, index.ts, src/ or assets/ starts an EAS workflow (.eas/workflows/deploy.yml) once the Expo project is connected. It builds iOS in the cloud and uploads the build to App Store Connect / TestFlight. Every such push costs a paid build credit.
- Never merge to `main` without Brian. Work on a branch and open a PR.
- Pushes that only change Markdown files (CLAUDE.md, NOTES.md, README.md, store/metadata.md) or docs/ do not build.
- Version numbers are local (`appVersionSource: local`, no auto-increment). Before any push that builds: raise `ios.buildNumber` in app.json by 1, and raise `version` (for example 1.0.0 to 1.0.1) when it will become a new App Store release. A build number that was already used makes the upload fail.
- Before every commit: run `npx tsc --noEmit` and `npm test`, and fix every error.
- Batch the changes for one app into one push. Ask Brian before any push that builds, and say what is in it.
- Submitting for App Review, release dates, prices, In-App Events, the subtitle, keywords and screenshots all happen in App Store Connect. Brian and his Cowork session handle that side. Do not try to do it from here.

## Rules

- Brian handles every credential and sign-in. Never type, paste, print or store passwords, tokens or API keys. If git push asks for credentials, stop and tell Brian. The RevenueCat public key and the Expo projectId are filled in by Brian or Cowork.
- No spending (paid services, extra builds beyond what Brian approved) without Brian saying go.
- Never change the RevenueCat entitlement id `pro`, the product ids (pumping_pro_weekly, pumping_pro_lifetime), the offering packages ($rc_weekly, $rc_lifetime) or the logic in src/purchases.ts without Brian asking. Paying users must never lose Pro.
- After launch the SQLite schema must stay backward compatible: never drop or rename columns or tables. New columns go in through a new step in `migrate()` in src/db.ts (guarded by PRAGMA user_version), so they run on existing installs. Settings live as key/value rows; a new setting just gets a default in `parseSettings`. Existing user data must survive every update.
- Do not change the app name, subtitle, keywords or the rating-prompt triggers without asking.
- Keep changes small. Fix what the task needs and tidy only the files you already touch. List anything else you notice in NOTES.md under "Noticed, not changed" instead of fixing it. No broad refactors, dependency upgrades or Expo SDK upgrades unless Brian asks.
- No em dashes in any user-facing text (app, PDFs, notifications, store text, website), and none in text Brian sends to other people. Plain, warm, human wording.
- Storage times and thawing notes are general guidance based on the CDC page linked in Settings. Do not add feeding amounts, supply advice or anything that reads as medical advice.
- plugins/withoutPushEntitlement.js stays last in app.json plugins. After touching plugins, check `npx expo config --type introspect` still shows `ios.entitlements` as `{}`.

## Logging (so Brian's Cowork session can follow along)

- With every commit, add an entry at the top of NOTES.md in the same commit: date, version/build, what changed and why, and how it was checked.

## Testing

- Type check: `npx tsc --noEmit`. Unit checks (use-by dates, stash order, totals, reminder times): `npm test`. Health check: `npx expo-doctor`. Bundle check: `npx expo export --platform ios`.
- Simulator (needs Xcode): `npx expo start --ios`. Purchases do not complete in the simulator; check paywall layout and flows only.
- Real-device check: TestFlight build from the EAS workflow, on Brian's iPhone.
