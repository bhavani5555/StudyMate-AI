
import {
    doc,
    getDoc,
    setDoc
  } from "firebase/firestore";
  
  import { auth, db } from "../firebase";
  
  const getAchievementDocument = () => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to access achievement history.");
    }
  
    return doc(
      db,
      "users",
      user.uid,
      "achievementData",
      "state"
    );
  };
  
  // Get achievement history from Firestore
  export const getCloudAchievementState = async () => {
    const achievementRef = getAchievementDocument();
  
    const snapshot = await getDoc(achievementRef);
  
    if (!snapshot.exists()) {
      return {
        celebratedIds: [],
        unlockHistory: []
      };
    }
  
    return snapshot.data();
  };
  
  // Save achievement history to Firestore
  export const saveCloudAchievementState = async (data) => {
    const achievementRef = getAchievementDocument();
  
    await setDoc(
      achievementRef,
      {
        celebratedIds: data.celebratedIds || [],
        unlockHistory: data.unlockHistory || [],
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  };
  