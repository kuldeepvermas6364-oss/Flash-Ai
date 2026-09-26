import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB2VTr8W-19ZjWQFAEGgPxbE4IsehqEEG4",
  authDomain: "studyhub-870f8.firebaseapp.com",
  databaseURL: "https://studyhub-870f8-default-rtdb.firebaseio.com",
  projectId: "studyhub-870f8",
  storageBucket: "studyhub-870f8.firebasestorage.app",
  messagingSenderId: "297530541373",
  appId: "1:297530541373:web:ca897c91e0244343aff154"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
