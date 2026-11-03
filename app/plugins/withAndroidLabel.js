const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

/**
 * The name under the icon on Android. Expo derives it only from the app's `name` (the long brand name), so this
 * sets the short home-screen name over it, like `ios.infoPlist.CFBundleDisplayName` does on iPhone. If the
 * home-screen name ever changes, change both (the default below and that key in app.json).
 */
module.exports = function withAndroidLabel(config, label = 'Bellie') {
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: label })],
      config.modResults,
    );
    return config;
  });
};
