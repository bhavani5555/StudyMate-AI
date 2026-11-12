
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAjrW0NMYWd9AtfYspKiomrFI5gX3ELCwM",
  authDomain: "studymate-ai-32855.firebaseapp.com",
  projectId: "studymate-ai-32855",
  messagingSenderId: "458626869736",
  appId: "1:458626869736:web:9bfec563bac1dc3fe90d7d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
