// Gather app config (Expo SDK 57 shell).
//
// This preserves the project's DEPLOYMENT IDENTITY carried over from the legacy
// app (EAS projectId, Updates URL, bundle identifiers, Google Services / Maps
// wiring, runtimeVersion, permissions) so existing EAS builds, channels and OTA
// updates keep working.
//
// The old app also declared config plugins for native modules that are NOT yet
// installed in this fresh shell (Firebase, camera, av, location, maps,
// permissions, build-properties). Those plugins are intentionally omitted for
// now so `expo prebuild` / builds succeed. Re-add each one together with its
// dependency as the corresponding capability lands in a later milestone. The
// full original plugin list is preserved verbatim in
// archive/legacy-app/config-reference/app.config.js.

module.exports = {
  expo: {
    name: "Gather",
    slug: "BII-Manual-Phenotyper",
    owner: "slu-vislab",
    version: "1.2.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/icons/ios-light.png",
    jsEngine: "hermes",
    splash: {
      image: "./assets/icons/splash-icon-dark.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    updates: {
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/85d34a0b-4af9-4431-8099-ba589933002a",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "org.imagingforgood.gather",
      // Injected at build time via env; undefined is a no-op until re-enabled.
      googleServicesFile: process.env.GOOGLE_SERVICES_IOS,
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
      infoPlist: {
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access camera.",
        NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
        NSLocationWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to access your location while using the app.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
      googleServicesFile: process.env.GOOGLE_SERVICES_ANDROID,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
      ],
      package: "com.sluvislab.BIIManualPhenotyper",
    },
    extra: {
      eas: {
        projectId: "85d34a0b-4af9-4431-8099-ba589933002a",
      },
    },
    // MapLibre's config plugin configures its native SDK dependencies. Camera
    // permissions are declared above per VisionCamera's Expo integration.
    plugins: [
      "expo-sqlite",
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to access your location while using the app.",
        },
      ],
      "@maplibre/maplibre-react-native",
      "onnxruntime-react-native",
      "expo-video",
    ],
    runtimeVersion: {
      policy: "appVersion",
    },
  },
};
