/**
 * Removes the push entitlement (aps-environment) that expo-notifications'
 * config plugin adds. Pumping only schedules local notifications (the
 * next-pump reminder and the trial reminder), which do not need it, and an
 * App Store provisioning profile without the Push Notifications capability
 * fails the build when it is there.
 *
 * Listed last in app.json "plugins". Expo applies the expo-notifications
 * plugin after the app.json plugins, and mods run newest first, so this one
 * runs after it and has the last word. Same fix as Attend 1.0.5 and Odo 1.0.6.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
