
import { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import { saveStudyTime } from "../services/studyTimeService";

const SAVE_INTERVAL = 30;

const StudyTimeTracker = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    let pendingSeconds = 0;
    let isSaving = false;

    const flushStudyTime = async () => {
      if (isSaving || pendingSeconds === 0) return;

      const secondsToSave = pendingSeconds;

      pendingSeconds = 0;
      isSaving = true;

      try {
        await saveStudyTime(user.uid, secondsToSave);
      } catch (error) {
        pendingSeconds += secondsToSave;
        console.error("Study time save failed:", error);
      } finally {
        isSaving = false;

        if (pendingSeconds >= SAVE_INTERVAL) {
          flushStudyTime();
        }
      }
    };

    const trackStudyTime = () => {
      if (document.visibilityState !== "visible") return;

      pendingSeconds += 1;

      if (pendingSeconds >= SAVE_INTERVAL) {
        flushStudyTime();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushStudyTime();
      }
    };

    const handlePageHide = () => {
      flushStudyTime();
    };

    const intervalId = setInterval(trackStudyTime, 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener("pagehide", handlePageHide);

      flushStudyTime();
    };
  }, [user?.uid]);

  return null;
};

export default StudyTimeTracker;
