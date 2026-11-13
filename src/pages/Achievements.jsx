
import { useEffect, useRef, useState } from "react";

import {
  Award,
  BookOpen,
  Trophy,
  Layers,
  GraduationCap,
  Flame,
  Lock,
  CheckCircle2,
  Sparkles,
  X,
  Info,
  Filter
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import { getCloudNotes } from "../services/notesService";
import { getCloudQuizzes } from "../services/quizService";
import { getCloudFlashcards } from "../services/flashcardService";
import { getCloudInterviews } from "../services/interviewService";
import { getCloudStudyTime } from "../services/studyTimeService";

import {
  getCloudAchievementState,
  saveCloudAchievementState
} from "../services/achievementService";

import "./Achievements.css";

const CELEBRATED_KEY = "studymate-celebrated-achievements";
const UNLOCK_HISTORY_KEY = "studymate-achievement-history";

/* STORAGE HELPERS */

function readLocalArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function readLegacyCelebratedIds() {
  return readLocalArray(CELEBRATED_KEY);
}

function readLegacyUnlockHistory() {
  return readLocalArray(UNLOCK_HISTORY_KEY) || [];
}

/*  DATE HELPERS */

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getValidTimestamp(value) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatUnlockDate(date) {
  if (!date) return "Date unavailable";

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  const parsedDate = dateMatch
    ? new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3])
      )
    : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function calculateStreak(daily = {}) {
  let streak = 0;
  const date = new Date();

  if (!daily[getDateKey(date)]) {
    date.setDate(date.getDate() - 1);
  }

  while (daily[getDateKey(date)] > 0) {
    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function getSortedCreationDates(items = []) {
  return items
    .map((item) => getValidTimestamp(item?.createdAt))
    .filter((timestamp) => timestamp !== null)
    .sort((a, b) => a - b);
}

/* ACHIEVEMENT DATA */

function getAchievementData(cloudData, studyData) {
  const notes = Array.isArray(cloudData.notes)
    ? cloudData.notes
    : [];

  const quizzes = Array.isArray(cloudData.quizzes)
    ? cloudData.quizzes
    : [];

  const flashcards = Array.isArray(cloudData.flashcards)
    ? cloudData.flashcards
    : [];

  const interviews = Array.isArray(cloudData.interviews)
    ? cloudData.interviews
    : [];

  const completedInterviewQuestions = interviews.reduce(
    (total, session) =>
      total + (Number(session?.completedQuestions) || 0),
    0
  );

  const streak = calculateStreak(studyData.daily || {});

  return [
    {
      id: "first-notes",
      title: "First Notes",
      description: "Generate your first set of AI notes.",
      requirement: "Generate and save at least one set of AI notes.",
      reward: "You're officially on your StudyMate learning journey!",
      icon: BookOpen,
      color: "blue",
      current: Math.min(notes.length, 1),
      target: 1,
      unlocked: notes.length >= 1
    },
    {
      id: "quiz-master",
      title: "Quiz Master",
      description: "Complete 10 AI-generated quizzes.",
      requirement: "Complete and save 10 quizzes.",
      reward: "You've built a strong habit of testing your knowledge!",
      icon: Trophy,
      color: "orange",
      current: Math.min(quizzes.length, 10),
      target: 10,
      unlocked: quizzes.length >= 10
    },
    {
      id: "flashcard-learner",
      title: "Flashcard Learner",
      description: "Create 5 flashcard sets.",
      requirement: "Generate and save 5 flashcard sets.",
      reward: "Your active-recall learning journey is growing!",
      icon: Layers,
      color: "purple",
      current: Math.min(flashcards.length, 5),
      target: 5,
      unlocked: flashcards.length >= 5
    },
    {
      id: "interview-ready",
      title: "Interview Ready",
      description: "Complete 25 interview practice questions.",
      requirement: "Mark 25 interview practice questions as completed.",
      reward: "You're making progress towards interview confidence!",
      icon: GraduationCap,
      color: "green",
      current: Math.min(completedInterviewQuestions, 25),
      target: 25,
      unlocked: completedInterviewQuestions >= 25
    },
    {
      id: "seven-day-streak",
      title: "7-Day Streak",
      description: "Study for 7 consecutive days.",
      requirement: "Record study activity on 7 consecutive days.",
      reward: "Consistency is your superpower. Keep the streak alive!",
      icon: Flame,
      color: "pink",
      current: Math.min(streak, 7),
      target: 7,
      unlocked: streak >= 7
    }
  ];
}

/*  INFER UNLOCK DATES */

function inferAchievementUnlockDate(id, cloudData, studyData) {
  const notes = cloudData.notes || [];
  const quizzes = cloudData.quizzes || [];
  const flashcards = cloudData.flashcards || [];
  const interviews = cloudData.interviews || [];

  if (id === "first-notes") {
    const dates = getSortedCreationDates(notes);

    return dates.length >= 1
      ? new Date(dates[0]).toISOString()
      : null;
  }

  if (id === "quiz-master") {
    const dates = getSortedCreationDates(quizzes);

    return dates.length >= 10
      ? new Date(dates[9]).toISOString()
      : null;
  }

  if (id === "flashcard-learner") {
    const dates = getSortedCreationDates(flashcards);

    return dates.length >= 5
      ? new Date(dates[4]).toISOString()
      : null;
  }

  if (id === "interview-ready") {
    const sessions = interviews
      .map((session) => ({
        timestamp: getValidTimestamp(session?.createdAt),
        completed: Number(session?.completedQuestions) || 0
      }))
      .filter((session) => session.timestamp !== null)
      .sort((a, b) => a.timestamp - b.timestamp);

    let totalCompleted = 0;

    for (const session of sessions) {
      totalCompleted += session.completed;

      if (totalCompleted >= 25) {
        return new Date(session.timestamp).toISOString();
      }
    }

    return null;
  }

  if (id === "seven-day-streak") {
    const daily = studyData.daily || {};

    const studyDates = Object.keys(daily)
      .filter((date) => daily[date] > 0)
      .sort();

    let consecutiveDays = 0;
    let previousDate = null;

    for (const dateKey of studyDates) {
      const [year, month, day] = dateKey.split("-").map(Number);

      const currentDate = Date.UTC(year, month - 1, day);

      const isConsecutive =
        previousDate !== null &&
        currentDate - previousDate === 86400000;

      consecutiveDays = isConsecutive
        ? consecutiveDays + 1
        : 1;

      if (consecutiveDays === 7) {
        return dateKey;
      }

      previousDate = currentDate;
    }
  }

  return null;
}

/*  COMPONENT */

function Achievements() {
  const { user } = useAuth();

  const [cloudData, setCloudData] = useState({
    notes: [],
    quizzes: [],
    flashcards: [],
    interviews: []
  });

  const [studyData, setStudyData] = useState({
    daily: {}
  });

  const [achievements, setAchievements] = useState(() =>
    getAchievementData(
      {
        notes: [],
        quizzes: [],
        flashcards: [],
        interviews: []
      },
      { daily: {} }
    )
  );

  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");

  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const [celebratedIds, setCelebratedIds] = useState(null);
  const [unlockHistory, setUnlockHistory] = useState([]);

  const [achievementStateReady, setAchievementStateReady] =
    useState(false);

  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [activeCelebration, setActiveCelebration] = useState(null);

  const saveQueueRef = useRef(Promise.resolve());

  /*  LOAD FIRESTORE DATA */

  const loadCloudData = async (loadAchievementState = false) => {
    if (!user?.uid) {
      setCloudError("Please log in to access your achievements.");
      setCloudLoading(false);
      return;
    }

    try {
      setCloudError("");
      setCloudLoading(true);

      const requests = [
        getCloudNotes(),
        getCloudQuizzes(),
        getCloudFlashcards(),
        getCloudInterviews(),
        getCloudStudyTime(user.uid)
      ];

      if (loadAchievementState) {
        requests.push(getCloudAchievementState());
      }

      const results = await Promise.all(requests);

      const [
        notes,
        quizzes,
        flashcards,
        interviews,
        dailySeconds
      ] = results;

      const safeCloudData = {
        notes: Array.isArray(notes) ? notes : [],
        quizzes: Array.isArray(quizzes) ? quizzes : [],
        flashcards: Array.isArray(flashcards) ? flashcards : [],
        interviews: Array.isArray(interviews) ? interviews : []
      };

      setCloudData(safeCloudData);

      setStudyData({
        daily: dailySeconds || {}
      });

      if (loadAchievementState) {
        const cloudState = results[5] || {};

        const cloudCelebratedIds = Array.isArray(
          cloudState.celebratedIds
        )
          ? cloudState.celebratedIds
          : [];

        const cloudUnlockHistory = Array.isArray(
          cloudState.unlockHistory
        )
          ? cloudState.unlockHistory
          : [];

        const legacyCelebratedIds = readLegacyCelebratedIds();
        const legacyUnlockHistory = readLegacyUnlockHistory();

        setCelebratedIds(
          cloudCelebratedIds.length > 0
            ? cloudCelebratedIds
            : legacyCelebratedIds
        );

        setUnlockHistory(
          cloudUnlockHistory.length > 0
            ? cloudUnlockHistory
            : legacyUnlockHistory
        );

        setAchievementStateReady(true);
      }
    } catch (error) {
      console.error("Achievement data loading error:", error);

      setCloudError(
        "Unable to load your learning achievements. Please try again."
      );
    } finally {
      setCloudLoading(false);
    }
  };

  /*  INITIAL LOAD AND REFRESH */

  useEffect(() => {
    if (!user?.uid) return;

    loadCloudData(true);

    const handleCloudRefresh = () => {
      loadCloudData(false);
    };

    const handleFocus = () => {
      loadCloudData(false);
    };

    const handleStudyTimeUpdate = () => {
      loadCloudData(false);
    };

    window.addEventListener(
      "studymate-achievements-updated",
      handleCloudRefresh
    );

    window.addEventListener(
      "studymate-study-time-updated",
      handleStudyTimeUpdate
    );

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(
        "studymate-achievements-updated",
        handleCloudRefresh
      );

      window.removeEventListener(
        "studymate-study-time-updated",
        handleStudyTimeUpdate
      );

      window.removeEventListener("focus", handleFocus);
    };
  }, [user?.uid]);

  /*  UPDATE ACHIEVEMENT COUNTS  */

  useEffect(() => {
    setAchievements(getAchievementData(cloudData, studyData));
  }, [cloudData, studyData]);

  /*   INITIALIZE CELEBRATION HISTORY */

  useEffect(() => {
    if (cloudLoading || cloudError) return;
    if (!achievementStateReady || celebratedIds !== null) return;

    const alreadyUnlocked = achievements
      .filter((item) => item.unlocked)
      .map((item) => item.id);

    setCelebratedIds(alreadyUnlocked);
  }, [
    cloudLoading,
    cloudError,
    achievementStateReady,
    achievements,
    celebratedIds
  ]);

  /*   SAVE NEW UNLOCK HISTORY */

  useEffect(() => {
    if (cloudLoading || cloudError) return;
    if (!achievementStateReady || celebratedIds === null) return;

    const updatedHistory = [...unlockHistory];
    let hasChanges = false;

    achievements.forEach((achievement) => {
      if (!achievement.unlocked) return;

      const index = updatedHistory.findIndex(
        (item) => item.id === achievement.id
      );

      const inferredDate = inferAchievementUnlockDate(
        achievement.id,
        cloudData,
        studyData
      );

      if (index !== -1) {
        const existingEntry = updatedHistory[index];

        if (!existingEntry.unlockedAt && inferredDate) {
          updatedHistory[index] = {
            ...existingEntry,
            unlockedAt: inferredDate
          };

          hasChanges = true;
        }

        return;
      }

      const unlockedAt =
        inferredDate ||
        (!celebratedIds.includes(achievement.id)
          ? new Date().toISOString()
          : null);

      updatedHistory.push({
        id: achievement.id,
        unlockedAt
      });

      hasChanges = true;
    });

    if (hasChanges) {
      setUnlockHistory(updatedHistory);
    }
  }, [
    achievements,
    cloudData,
    studyData,
    unlockHistory,
    celebratedIds,
    cloudLoading,
    cloudError,
    achievementStateReady
  ]);

  /*  DETECT NEW ACHIEVEMENTS */

  useEffect(() => {
    if (cloudLoading || cloudError) return;
    if (!achievementStateReady || celebratedIds === null) return;

    const newlyUnlocked = achievements.filter(
      (item) =>
        item.unlocked &&
        !celebratedIds.includes(item.id)
    );

    if (newlyUnlocked.length === 0) return;

    setCelebratedIds((previous) => [
      ...new Set([
        ...(previous || []),
        ...newlyUnlocked.map((item) => item.id)
      ])
    ]);

    setCelebrationQueue((previous) => [
      ...previous,
      ...newlyUnlocked
    ]);
  }, [
    achievements,
    celebratedIds,
    cloudLoading,
    cloudError,
    achievementStateReady
  ]);

  /* SAVE ACHIEVEMENT STATE */

  useEffect(() => {
    if (!achievementStateReady || celebratedIds === null) return;

    const stateToSave = {
      celebratedIds,
      unlockHistory
    };

    saveQueueRef.current = saveQueueRef.current
      .then(() => saveCloudAchievementState(stateToSave))
      .catch((error) => {
        console.error(
          "Could not save achievement state to Firestore:",
          error
        );
      });
  }, [
    celebratedIds,
    unlockHistory,
    achievementStateReady
  ]);

  /*  CELEBRATION QUEUE */

  useEffect(() => {
    if (activeCelebration || celebrationQueue.length === 0) {
      return;
    }

    setActiveCelebration(celebrationQueue[0]);

    setCelebrationQueue((previous) => previous.slice(1));
  }, [activeCelebration, celebrationQueue]);

  /*  AUTO HIDE CELEBRATION  */

  useEffect(() => {
    if (!activeCelebration) return;

    const timeout = setTimeout(() => {
      setActiveCelebration(null);
    }, 4500);

    return () => clearTimeout(timeout);
  }, [activeCelebration]);

  /*  CLOSE MODAL WITH ESCAPE */

  useEffect(() => {
    if (!selectedAchievement) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedAchievement(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedAchievement]);

  /*  PROGRESS AND FILTERS  */

  const unlockedCount = achievements.filter(
    (item) => item.unlocked
  ).length;

  const lockedCount = achievements.length - unlockedCount;

  const totalProgress = achievements.length
    ? Math.round((unlockedCount / achievements.length) * 100)
    : 0;

  const filterOptions = [
    { id: "all", label: "All", count: achievements.length },
    { id: "unlocked", label: "Unlocked", count: unlockedCount },
    { id: "locked", label: "Locked", count: lockedCount },
    { id: "recent", label: "Recently Unlocked", count: unlockedCount }
  ];

  const getUnlockTimestamp = (id) => {
    const entry = unlockHistory.find((item) => item.id === id);

    if (!entry?.unlockedAt) return 0;

    const timestamp = new Date(entry.unlockedAt).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const filteredAchievements = achievements.filter((item) => {
    if (activeFilter === "unlocked" || activeFilter === "recent") {
      return item.unlocked;
    }

    if (activeFilter === "locked") {
      return !item.unlocked;
    }

    return true;
  });

  const displayedAchievements =
    activeFilter === "recent"
      ? [...filteredAchievements].sort(
          (a, b) =>
            getUnlockTimestamp(b.id) - getUnlockTimestamp(a.id)
        )
      : filteredAchievements;

  const historyAchievements = achievements
    .filter((item) => item.unlocked)
    .sort(
      (a, b) =>
        getUnlockTimestamp(b.id) - getUnlockTimestamp(a.id)
    );

  /*  RENDER */

  return (
    <main className="achievements-page">

      {activeCelebration && (
        <div
          className="achievement-celebration-toast"
          role="status"
          aria-live="polite"
        >
          <div
            className={`achievement-celebration-icon ${activeCelebration.color}`}
          >
            {(() => {
              const Icon = activeCelebration.icon;
              return <Icon size={27} />;
            })()}
          </div>

          <div className="achievement-celebration-content">
            <span>Achievement unlocked!</span>
            <strong>{activeCelebration.title}</strong>
            <p>Great work! Keep learning with StudyMate AI.</p>
          </div>

          <button
            type="button"
            className="achievement-celebration-close"
            onClick={() => setActiveCelebration(null)}
            aria-label="Close celebration"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="achievements-header">
        <div>
          <span className="achievements-eyebrow">
            <Sparkles size={15} />
            YOUR MILESTONES
          </span>

          <h1>Achievements & Badges</h1>

          <p>
            Every learning step counts. Keep learning and unlock
            new achievements along the way.
          </p>
        </div>

        <div className="achievements-header-icon">
          <Award size={42} />
        </div>
      </section>

      {cloudLoading && (
        <div className="achievement-history-empty">
          <p>Loading your achievements...</p>
        </div>
      )}

      {!cloudLoading && cloudError && (
        <div className="achievement-empty-filter">
          <Info size={30} />
          <h3>Unable to load achievements</h3>
          <p>{cloudError}</p>

          <button
            type="button"
            onClick={() => loadCloudData(!achievementStateReady)}
          >
            Try Again
          </button>
        </div>
      )}

      {!cloudLoading && !cloudError && (
        <>
          <section className="achievements-summary">
            <div className="achievement-summary-icon">
              <Trophy size={27} />
            </div>

            <div className="achievement-summary-content">
              <div className="achievement-summary-top">
                <div>
                  <h2>
                    {unlockedCount} of {achievements.length} unlocked
                  </h2>
                  <p>Your achievement progress</p>
                </div>

                <strong>{totalProgress}%</strong>
              </div>

              <div className="achievement-progress-track">
                <div style={{ width: `${totalProgress}%` }} />
              </div>
            </div>
          </section>

          <section className="achievement-section-heading">
            <div>
              <h2>Your Badges</h2>
              <p>
                Complete learning milestones to unlock these badges.
              </p>
            </div>
          </section>

          <section className="achievement-filters">
            <div className="achievement-filter-heading">
              <Filter size={17} />
              <span>Filter badges</span>
            </div>

            <div className="achievement-filter-buttons">
              {filterOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`achievement-filter-button ${
                    activeFilter === option.id ? "active" : ""
                  }`}
                  onClick={() => setActiveFilter(option.id)}
                >
                  {option.label}
                  <span>{option.count}</span>
                </button>
              ))}
            </div>
          </section>

          {displayedAchievements.length > 0 ? (
            <section className="achievement-grid">
              {displayedAchievements.map((achievement) => {
                const Icon = achievement.icon;

                const progress = Math.round(
                  (achievement.current / achievement.target) * 100
                );

                return (
                  <article
                    className={`achievement-card ${
                      achievement.unlocked ? "unlocked" : "locked"
                    }`}
                    key={achievement.id}
                  >
                    <div className="achievement-card-top">
                      <div
                        className={`achievement-icon ${achievement.color}`}
                      >
                        <Icon size={29} />
                      </div>

                      {achievement.unlocked ? (
                        <span className="achievement-status unlocked-status">
                          <CheckCircle2 size={14} />
                          Unlocked
                        </span>
                      ) : (
                        <span className="achievement-status locked-status">
                          <Lock size={13} />
                          Locked
                        </span>
                      )}
                    </div>

                    <h3>{achievement.title}</h3>
                    <p>{achievement.description}</p>

                    <div className="achievement-card-progress">
                      <div className="achievement-card-progress-label">
                        <span>Progress</span>
                        <strong>
                          {achievement.current}/{achievement.target}
                        </strong>
                      </div>

                      <div className="achievement-progress-track">
                        <div style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {achievement.unlocked && (
                      <div className="achievement-unlocked-message">
                        <Sparkles size={14} />
                        Achievement unlocked!
                      </div>
                    )}

                    <button
                      type="button"
                      className="achievement-details-button"
                      onClick={() => setSelectedAchievement(achievement)}
                    >
                      <Info size={15} />
                      View Details
                    </button>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="achievement-empty-filter">
              <Lock size={30} />
              <h3>No achievements found</h3>
              <p>There are no badges in this category yet.</p>

              <button
                type="button"
                onClick={() => setActiveFilter("all")}
              >
                View all achievements
              </button>
            </div>
          )}

          <section className="achievement-history-section">
            <div className="achievement-history-heading">
              <div>
                <span className="achievements-eyebrow">
                  <Award size={15} />
                  YOUR JOURNEY
                </span>

                <h2>Achievement History</h2>

                <p>
                  Look back at the milestones you've unlocked.
                </p>
              </div>

              <div className="achievement-history-count">
                {unlockedCount} Earned
              </div>
            </div>

            {historyAchievements.length > 0 ? (
              <div className="achievement-history-list">
                {historyAchievements.map((achievement) => {
                  const Icon = achievement.icon;

                  const historyEntry = unlockHistory.find(
                    (item) => item.id === achievement.id
                  );

                  return (
                    <div
                      className="achievement-history-item"
                      key={achievement.id}
                    >
                      <div
                        className={`achievement-history-icon ${achievement.color}`}
                      >
                        <Icon size={21} />
                      </div>

                      <div className="achievement-history-info">
                        <strong>{achievement.title}</strong>

                        <span>
                          <CheckCircle2 size={13} />
                          Successfully unlocked
                        </span>
                      </div>

                      <time className="achievement-history-date">
                        {formatUnlockDate(historyEntry?.unlockedAt)}
                      </time>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="achievement-history-empty">
                <Award size={32} />
                <h3>Your journey starts here!</h3>
                <p>
                  Unlock your first badge to see it in your
                  achievement history.
                </p>
              </div>
            )}
          </section>

          {selectedAchievement && (() => {
            const Icon = selectedAchievement.icon;

            const remaining = Math.max(
              0,
              selectedAchievement.target - selectedAchievement.current
            );

            const progress = Math.round(
              (selectedAchievement.current /
                selectedAchievement.target) * 100
            );

            return (
              <div
                className="achievement-modal-backdrop"
                onClick={() => setSelectedAchievement(null)}
              >
                <section
                  className="achievement-details-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="achievement-modal-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="achievement-modal-close"
                    onClick={() => setSelectedAchievement(null)}
                    aria-label="Close details"
                  >
                    <X size={20} />
                  </button>

                  <div
                    className={`achievement-modal-icon ${selectedAchievement.color}`}
                  >
                    <Icon size={34} />
                  </div>

                  <span className="achievement-modal-eyebrow">
                    {selectedAchievement.unlocked
                      ? "MILESTONE COMPLETED"
                      : "YOUR NEXT MILESTONE"}
                  </span>

                  <h2 id="achievement-modal-title">
                    {selectedAchievement.title}
                  </h2>

                  <p className="achievement-modal-description">
                    {selectedAchievement.description}
                  </p>

                  <div className="achievement-modal-requirement">
                    <strong>What you need to do</strong>
                    <p>{selectedAchievement.requirement}</p>
                  </div>

                  <div className="achievement-modal-progress">
                    <div className="achievement-modal-progress-heading">
                      <strong>Your progress</strong>
                      <span>{progress}%</span>
                    </div>

                    <div className="achievement-progress-track">
                      <div style={{ width: `${progress}%` }} />
                    </div>

                    <p>
                      {selectedAchievement.current} of{" "}
                      {selectedAchievement.target} completed
                    </p>
                  </div>

                  {selectedAchievement.unlocked ? (
                    <div className="achievement-modal-reward unlocked">
                      <CheckCircle2 size={20} />

                      <div>
                        <strong>Congratulations!</strong>
                        <p>{selectedAchievement.reward}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="achievement-modal-reward locked">
                      <Lock size={19} />

                      <div>
                        <strong>{remaining} more to go!</strong>
                        <p>
                          Keep going. You're getting closer to this badge.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="achievement-modal-done"
                    onClick={() => setSelectedAchievement(null)}
                  >
                    Continue Learning
                  </button>
                </section>
              </div>
            );
          })()}

          <section className="achievement-footer">
            <Sparkles size={20} />

            <div>
              <strong>Keep going!</strong>
              <p>
                Your next achievement is waiting. Continue learning
                with StudyMate AI.
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default Achievements;
