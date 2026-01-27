import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyAZ62d-7q8LYljSPX0w4QOD0MxCyU9XJ1s",
  authDomain: "secu-lyrics.firebaseapp.com",
  projectId: "secu-lyrics",
  storageBucket: "secu-lyrics.firebasestorage.app",
  messagingSenderId: "512413380430",
  appId: "1:512413380430:web:806f3fa9c33ea11ee6b81f",
  measurementId: "G-GQ9Y56C1BF"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);f