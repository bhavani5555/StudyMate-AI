
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
  } from "firebase/firestore";
  
  import { db } from "../firebase";
  
  const getSettingsRef = (userId) => {
    if (!userId) {
      throw new Error("Please login to access your settings.");
    }
  
    return doc(
      db,
      "users",
      userId,
      "settings",
      "preferences"
    );
  };
  
  export const getCloudSettings = async (userId) => {
    const settingsRef = getSettingsRef(userId);
    const snapshot = await getDoc(settingsRef);
  
    if (!snapshot.exists()) {
      return {};
    }
  
    return snapshot.data();
  };
  
  export const saveSettingsToCloud = async (userId, settings) => {
    const settingsRef = getSettingsRef(userId);
  
    await setDoc(
      settingsRef,
      {
        ...settings,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  
    return settings;
  };
  