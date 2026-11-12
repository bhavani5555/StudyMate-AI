
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";

import { auth } from "../firebase";

const SESSION_EXPIRY_KEY = "studymate-session-expiry";
const SESSION_DURATION = 12 * 60 * 60 * 1000;

// Start a 12-hour session
const startSession = () => {
  const expiryTime = Date.now() + SESSION_DURATION;

  localStorage.setItem(
    SESSION_EXPIRY_KEY,
    String(expiryTime)
  );
};

// Register new user and save their display name
export const registerUser = async (email, password, name = "") => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    if (name.trim()) {
      await updateProfile(user, {
        displayName: name.trim()
      });
    }

    startSession();

    return user;
  } catch (error) {
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    throw error;
  }
};

// Login existing user
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    startSession();

    return userCredential.user;
  } catch (error) {
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    throw error;
  }
};

// Logout user
export const logoutUser = async () => {
  localStorage.removeItem(SESSION_EXPIRY_KEY);
  await signOut(auth);
};

// Reset password
export const resetPassword = async (email) => {
  await sendPasswordResetEmail(auth, email);
};
