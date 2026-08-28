import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

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

try {

const app = initializeApp(firebaseConfig);
storage = getStorage(app);
// Persist auth across sessions with AsyncStorage so users stay logged in.
auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

} catch(error) {
  console.error("Could not initialize Firebase: ", error);
  throw error;

}

export {storage, auth};
