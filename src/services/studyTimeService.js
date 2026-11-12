
import {
  doc,
  getDoc,
  setDoc,
  increment,
  serverTimestamp
} from "firebase/firestore";

import { db } from "../firebase";

/* =====================================
   DATE HELPER
===================================== */

const getTodayKey = () => {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
};

/* =====================================
   STUDY TIME DOCUMENT REFERENCE
===================================== */

const getStudyTimeRef = (userId) => {
  if (!userId) {
    throw new Error("Please login to access study time.");
  }

  return doc(
    db,
    "users",
    userId,
    "studyTime",
    "state"
  );
};

/* =====================================
   SAVE STUDY TIME TO FIRESTORE
===================================== */

export const saveStudyTime = async (userId, seconds) => {
  if (
    !userId ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    throw new Error("Invalid user or study time.");
  }

  const studyTimeRef = getStudyTimeRef(userId);
  const todayKey = getTodayKey();

  await setDoc(
    studyTimeRef,
    {
      dailySeconds: {
        [todayKey]: increment(seconds)
      },
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  // Notify Dashboard and Achievements after saving.
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("studymate-study-time-updated")
    );
  }
};

/* =====================================
   GET ALL STUDY TIME RECORDS
===================================== */

export const getCloudStudyTime = async (userId) => {
  const studyTimeRef = getStudyTimeRef(userId);

  const snapshot = await getDoc(studyTimeRef);

  if (!snapshot.exists()) {
    return {};
  }

  const data = snapshot.data();

  return data.dailySeconds || {};
};

/* =====================================
   GET TODAY'S STUDY TIME
===================================== */

export const getTodayStudyTime = async (userId) => {
  const dailySeconds = await getCloudStudyTime(userId);

  const todayKey = getTodayKey();

  return Number(dailySeconds[todayKey]) || 0;
};

/* =====================================
   FORMAT STUDY TIME
===================================== */

export const formatStudyTime = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${Math.floor(totalSeconds)}s`;
};
