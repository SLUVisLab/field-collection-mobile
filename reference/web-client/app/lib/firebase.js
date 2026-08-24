import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "data-collection-44ddc.firebaseapp.com",
  projectId: "data-collection-44ddc",
  storageBucket: "data-collection-44ddc.appspot.com",
  messagingSenderId: "862929951775",
  appId: "1:862929951775:web:4e2ddbd607cee8e7b8892a",
};

export function initFirebaseApp() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApp();
}

export function getFirebaseAuth() {
  const app = initFirebaseApp();
  return getAuth(app);
}
