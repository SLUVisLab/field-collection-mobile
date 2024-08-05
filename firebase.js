import NetInfo from "@react-native-community/netinfo";
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { Alert } from "react-native";


//TODO: Persist fb auth state using async storage
// You are initializing Firebase Auth for React Native without providing
// AsyncStorage. Auth state will default to memory persistence and will not
// persist between sessions. In order to persist auth state, install the package
// "@react-native-async-storage/async-storage" and provide it to
// initializeAuth:

// // import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
// // import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// // const auth = initializeAuth(app, {
// //   persistence: getReactNativePersistence(ReactNativeAsyncStorage)
// // });

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_KEY,
  authDomain: "data-collection-44ddc.firebaseapp.com",
  projectId: "data-collection-44ddc",
  storageBucket: "data-collection-44ddc.appspot.com",
  messagingSenderId: "862929951775",
  appId: "1:862929951775:web:4e2ddbd607cee8e7b8892a"
};

let storage;
let auth;

let isSigningIn = false;

try {

const app = initializeApp(firebaseConfig);
storage = getStorage(app);
auth = getAuth(app);

} catch(error) {
  console.error("Could not initialize Firebase: ", error);
  throw error;

}

const tryAnonymousSignIn = () => {
  onAuthStateChanged(auth, (user) => {
    if (!user && !isSigningIn) { // Check if user is not signed in and no sign-in attempt is in progress
      isSigningIn = true; // Indicate that a sign-in attempt is starting
      signInAnonymously(auth)
        .then(() => {
          console.log("User signed in anonymously");
        })
        .catch((error) => {
          console.error("Error during anonymous sign-in:", error);
          throw error;
        })
        .finally(() => {
          isSigningIn = false; // Reset the flag once sign-in attempt is completed
        });
    } else if (user) {
      // User is already signed in, no action needed
      console.log("User is already signed in.");
    }
  });
};

const handleNetworkChange = (state) => {
  if (state.isConnected) {
    console.log("Network connection detected, checking sign-in status");
    tryAnonymousSignIn();
  } else {
    console.log("No network connection detected");
  }
};

// Initial network status check and continuous monitoring
NetInfo.fetch().then(handleNetworkChange);
NetInfo.addEventListener(handleNetworkChange);


export {storage, auth};
