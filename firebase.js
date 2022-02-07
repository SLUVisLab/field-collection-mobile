// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = initializeApp({
  apiKey: "AIzaSyCYrdDMfQ9yaf6OkT7gLLgnsRg1yJoF-2Y",
  authDomain: "capstone-fire-c5203.firebaseapp.com",
  projectId: "capstone-fire-c5203",
  storageBucket: "capstone-fire-c5203.appspot.com",
  messagingSenderId: "352112241862",
  appId: "1:352112241862:web:ab47b00cbc34953a6dfbc7",
  measurementId: "G-YE03EG7Z0Q"
});

// Initialize Firebase

var db = getFirestore();
export default db