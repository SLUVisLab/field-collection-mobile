
module.exports = {
    expo: {
      name: "Gather",
      slug: "BII-Manual-Phenotyper",
      owner: "slu-vislab",
      version: "1.2.0",
      orientation: "portrait",
      icon: "./assets/icons/ios-light.png",
      jsEngine: "hermes",
      splash: {
        image: "./assets/icons/splash-icon-dark.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      },
      updates: {
        fallbackToCacheTimeout: 0,
        url: "https://u.expo.dev/85d34a0b-4af9-4431-8099-ba589933002a"
      },
      assetBundlePatterns: [
        "**/*"
      ],
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.astylianou.bii-phenotyper",
        googleServicesFile: process.env.GOOGLE_SERVICES_IOS,
        config: {
          // Here we can directly use process.env
          googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY
        },
        infoPlist: {
          NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access camera.",
          NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
          NSLocationWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to access your location while using the app.",
          ITSAppUsesNonExemptEncryption: false
        }
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/icons/adaptive-icon.png",
          backgroundColor: "#FFFFFF"
        },
        googleServicesFile: process.env.GOOGLE_SERVICES_ANDROID,
        config: {
          googleMaps: {
            // Direct environment variable usage
            apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY
          }
        },
        permissions: [
          "android.permission.CAMERA",
          "android.permission.RECORD_AUDIO",
          "android.permission.ACCESS_FINE_LOCATION",
          "android.permission.ACCESS_COARSE_LOCATION"
        ],
        package: "com.sluvislab.BIIManualPhenotyper"
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      extra: {
        eas: {
          projectId: "85d34a0b-4af9-4431-8099-ba589933002a"
        }
      },
      plugins: [
        "@react-native-firebase/app",
        "@react-native-firebase/crashlytics",
        [
          "expo-build-properties",
          {
            ios: {
              useFrameworks: "static"
            }
          }
        ],
        [
          "expo-location",
          {
            locationWhenInUsePermission: "Allow $(PRODUCT_NAME) to access your location while using the app"
          }
        ],
        [
          "expo-camera",
          {
            cameraPermission: "Allow $(PRODUCT_NAME) to access your camera",
            microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone",
            recordAudioAndroid: true
          }
        ],
        [
          "expo-av",
          {
            microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone."
          }
        ],
        [
          "react-native-permissions",
          {
            iosPermissions: [
              "Camera"
            ]
          }
        ]
      ],
      runtimeVersion: {
        policy: "appVersion"
      }
    }
  };
