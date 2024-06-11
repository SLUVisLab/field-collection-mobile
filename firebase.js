// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getStorage, ref } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_KEY,
  authDomain: "data-collection-44ddc.firebaseapp.com",
  projectId: "data-collection-44ddc",
  storageBucket: "data-collection-44ddc.appspot.com",
  messagingSenderId: "862929951775",
  appId: "1:862929951775:web:4e2ddbd607cee8e7b8892a"
};

// Initialize Firebase
try {
  const app = initializeApp(firebaseConfig);
} catch (error) {
  console.log("Could not initialize Firebase: ", error);
}
