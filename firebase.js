// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getDatabase} from 'firebase/database';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCSTFxbunGzBmoscvRD75zvX5VJY49Hls8",
  authDomain: "capstone-bc791.firebaseapp.com",
  databaseURL: "https://capstone-bc791-default-rtdb.firebaseio.com",
  projectId: "capstone-bc791",
  storageBucket: "capstone-bc791.appspot.com",
  messagingSenderId: "1036524557531",
  appId: "1:1036524557531:web:b480d679fa5dab2840e8fe",
  measurementId: "G-6L8SVRL689"
};

const app = initializeApp(firebaseConfig)
export default getDatabase();