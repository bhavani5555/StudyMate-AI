
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  BookOpen,
  Clock,
  Trophy,
  Brain,
  MessageCircle,
  FileText,
  ClipboardList,
  Layers,
  ArrowRight,
  Sparkles,
  Flame,
  Target,
  CalendarDays,
  Code,
  CheckCircle,
  X,
  TrendingUp,
  Award,
  GraduationCap
} from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";

import { getCloudNotes } from "../services/notesService";
import { getCloudQuizzes } from "../services/quizService";
import { getCloudFlashcards } from "../services/flashcardService";
import { getCloudInterviews } from "../services/interviewService";
import { getCloudStudyTime } from "../services/studyTimeService";

import "./Dashboard.css";

/* =====================================
   DATE UTILITIES
===================================== */

function getTodayKey() {
  return getDateKey(new Date());
}

function getDateKey(value) {
  if (!value) return "";

  let date;

  try {
    if (value instanceof Date) {
      date = value;
    } else if (typeof value.toDate === "function") {
      date = value.toDate();
    } else if (typeof value.seconds === "number") {
      date = new Date(value.seconds * 1000);
    } else if (typeof value === "number") {
      date = new Date(value);
    } else if (typeof value === "string") {
      date = new Date(value);
    } else {
      return "";
    }
  } catch {
    return "";
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getTimestamp(value) {
  if (!value) return 0;

  try {
    let date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value.toDate === "function") {
      date = value.toDate();
    } else if (typeof value.seconds === "number") {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

function formatDate(value) {
  const timestamp = getTimestamp(value);

  if (!timestamp) return "";

  return new Date(timestamp).toLocaleDateString();
}

function formatDuration(seconds = 0) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/* =====================================
   LEARNING STREAK
===================================== */

function getLearningStreak(daily = {}) {
  let streak = 0;
  const date = new Date();

  if (!daily[getTodayKey()]) {
    date.setDate(date.getDate() - 1);
  }

  while (true) {
    const key = getDateKey(date);

    if (!daily[key] || Number(daily[key]) <= 0) {
      break;
    }

    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

/* =====================================
   DASHBOARD COMPONENT
===================================== */

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cloudRefresh, setCloudRefresh] = useState(0);

  const [selectedStat, setSelectedStat] = useState(null);
  const [userName, setUserName] = useState("Student");

  // Learning records
  const [notes, setNotes] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [interviews, setInterviews] = useState([]);

  // Study time
  const [dailyStudy, setDailyStudy] = useState({});
  const [studyLoading, setStudyLoading] = useState(true);
  const [studyError, setStudyError] = useState("");

  // Cloud data
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");

  /* =====================================
     LOAD LEARNING DATA
  ===================================== */

  useEffect(() => {
    let isMounted = true;

    const loadLearningData = async () => {
      setCloudLoading(true);
      setCloudError("");

      const services = [
        getCloudNotes,
        getCloudQuizzes,
        getCloudFlashcards,
        getCloudInterviews
      ];

      try {
        const results = await Promise.allSettled(
          services.map((service) => service())
        );

        if (!isMounted) return;

        const [
          notesResult,
          quizzesResult,
          flashcardsResult,
          interviewsResult
        ] = results;

        const errors = [];

        if (notesResult.status === "fulfilled") {
          setNotes(
            Array.isArray(notesResult.value)
              ? notesResult.value
              : []
          );
        } else {
          errors.push("Notes");
          console.error("Notes loading error:", notesResult.reason);
        }

        if (quizzesResult.status === "fulfilled") {
          setQuizzes(
            Array.isArray(quizzesResult.value)
              ? quizzesResult.value
              : []
          );
        } else {
          errors.push("Quizzes");
          console.error("Quizzes loading error:", quizzesResult.reason);
        }

        if (flashcardsResult.status === "fulfilled") {
          setFlashcards(
            Array.isArray(flashcardsResult.value)
              ? flashcardsResult.value
              : []
          );
        } else {
          errors.push("Flashcards");
          console.error("Flashcards loading error:", flashcardsResult.reason);
        }

        if (interviewsResult.status === "fulfilled") {
          setInterviews(
            Array.isArray(interviewsResult.value)
              ? interviewsResult.value
              : []
          );
        } else {
          errors.push("Interview sessions");
          console.error("Interviews loading error:", interviewsResult.reason);
        }

        if (errors.length > 0) {
          setCloudError(
            `Unable to load: ${errors.join(", ")}. Please retry.`
          );
        }
      } catch (error) {
        console.error("Dashboard loading error:", error);

        if (isMounted) {
          setCloudError(
            error.message || "Unable to load your learning data."
          );
        }
      } finally {
        if (isMounted) {
          setCloudLoading(false);
        }
      }
    };

    loadLearningData();

    return () => {
      isMounted = false;
    };
  }, [cloudRefresh]);

  /* =====================================
     LOAD STUDY TIME
  ===================================== */

  useEffect(() => {
    if (!user?.uid) {
      setDailyStudy({});
      setStudyLoading(false);
      setStudyError("");
      return;
    }

    let isMounted = true;
    let isFetching = false;

    const loadStudyTime = async () => {
      if (isFetching) return;

      isFetching = true;

      try {
        const cloudStudyTime = await getCloudStudyTime(user.uid);

        if (isMounted) {
          setDailyStudy(
            cloudStudyTime && typeof cloudStudyTime === "object"
              ? cloudStudyTime
              : {}
          );

          setStudyError("");
        }
      } catch (error) {
        console.error("Study time loading error:", error);

        if (isMounted) {
          setStudyError(
            error.message || "Unable to load study time."
          );
        }
      } finally {
        isFetching = false;

        if (isMounted) {
          setStudyLoading(false);
        }
      }
    };

    setStudyLoading(true);
    setStudyError("");

    loadStudyTime();

    const interval = setInterval(loadStudyTime, 30000);

    window.addEventListener(
      "studymate-study-time-updated",
      loadStudyTime
    );

    return () => {
      isMounted = false;

      clearInterval(interval);

      window.removeEventListener(
        "studymate-study-time-updated",
        loadStudyTime
      );
    };
  }, [user?.uid]);

  /* =====================================
     LOAD USER SETTINGS
  ===================================== */

  useEffect(() => {
    const loadName = () => {
      try {
        const settings = JSON.parse(
          localStorage.getItem("studymate-settings") || "{}"
        );

        setUserName(
          typeof settings.userName === "string" &&
          settings.userName.trim()
            ? settings.userName.trim()
            : "Student"
        );
      } catch {
        setUserName("Student");
      }
    };

    loadName();

    window.addEventListener(
      "studymate-settings-updated",
      loadName
    );

    return () => {
      window.removeEventListener(
        "studymate-settings-updated",
        loadName
      );
    };
  }, []);

  /* =====================================
     STATISTICS MODAL KEYBOARD SUPPORT
  ===================================== */

  useEffect(() => {
    if (!selectedStat) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedStat(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedStat]);

  /* =====================================
     TODAY'S DATA
  ===================================== */

  const today = getTodayKey();

  const allTopics = [
    ...notes.map((item) => item.topic),
    ...quizzes.map((item) => item.topic),
    ...flashcards.map((item) => item.topic),
    ...interviews.map((item) => item.domain)
  ].filter(
    (topic) => typeof topic === "string" && topic.trim()
  );

  const uniqueTopics = [
    ...new Map(
      allTopics.map((topic) => [
        topic.trim().toLowerCase(),
        topic.trim()
      ])
    ).values()
  ];

  const todayNotes = notes.filter(
    (item) => getDateKey(item.createdAt) === today
  );

  const todayQuizzes = quizzes.filter(
    (item) => getDateKey(item.createdAt) === today
  );

  const todayFlashcards = flashcards.filter(
    (item) => getDateKey(item.createdAt) === today
  );

  const todayInterviews = interviews.filter(
    (item) => getDateKey(item.createdAt) === today
  );

  const todayActivity = [
    ...todayNotes.map((item) => ({
      title: item.topic || "Untitled notes",
      type: "Notes generated",
      icon: FileText,
      path: "/my-learning"
    })),

    ...todayQuizzes.map((item) => ({
      title: item.topic || "Untitled quiz",
      type: "Quiz completed",
      icon: Trophy,
      path: "/my-learning"
    })),

    ...todayFlashcards.map((item) => ({
      title: item.topic || "Untitled flashcards",
      type: "Flashcards created",
      icon: Layers,
      path: "/my-learning"
    })),

    ...todayInterviews.map((item) => ({
      title: item.domain || "Interview practice",
      type: "Interview practice completed",
      icon: Brain,
      path: "/my-learning"
    }))
  ];

  const studyHoursToday = Number(dailyStudy[today]) || 0;

  const streak = getLearningStreak(dailyStudy);

  /* =====================================
     WEEKLY STUDY ANALYTICS
  ===================================== */

  const weeklyData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();

    date.setDate(date.getDate() - (6 - index));

    const key = getDateKey(date);

    return {
      day: date.toLocaleDateString("en-US", {
        weekday: "short"
      }),
      seconds: Number(dailyStudy[key]) || 0
    };
  });

  const weeklyTotal = weeklyData.reduce(
    (total, item) => total + item.seconds,
    0
  );

  const maxStudyTime = Math.max(
    ...weeklyData.map((item) => item.seconds),
    1
  );

  /* =====================================
     RECENT ACTIVITY
  ===================================== */

  const recentActivity = [
    ...notes.map((item) => ({
      title: item.topic || "Untitled notes",
      type: "Notes generated",
      date: item.createdAt,
      icon: FileText,
      path: "/my-learning"
    })),

    ...quizzes.map((item) => ({
      title: item.topic || "Untitled quiz",
      type: "Quiz completed",
      date: item.createdAt,
      icon: ClipboardList,
      path: "/my-learning"
    })),

    ...flashcards.map((item) => ({
      title: item.topic || "Untitled flashcards",
      type: "Flashcards created",
      date: item.createdAt,
      icon: Layers,
      path: "/my-learning"
    })),

    ...interviews.map((item) => ({
      title: item.domain || "Interview practice",
      type: "Interview practice",
      date: item.createdAt,
      icon: Brain,
      path: "/my-learning"
    }))
  ]
    .sort(
      (a, b) => getTimestamp(b.date) - getTimestamp(a.date)
    )
    .slice(0, 5);

  /* =====================================
     DASHBOARD STATISTICS
  ===================================== */

  const stats = [
    {
      title: "Topics Studied",
      value: uniqueTopics.length,
      icon: BookOpen,
      color: "purple",
      description: "Your learning topics",
      details: uniqueTopics,
      empty: "No topics studied yet."
    },
    {
      title: "Study Hours",
      value: formatDuration(studyHoursToday),
      icon: Clock,
      color: "blue",
      description: "Today's active time",
      details: [
        `Today's study time: ${formatDuration(studyHoursToday)}`
      ],
      empty: "Start learning to track your study time."
    },
    {
      title: "Quizzes Completed",
      value: quizzes.length,
      icon: Trophy,
      color: "orange",
      description: "Your completed tests",
      details: quizzes.map(
        (item) =>
          `${item.topic || "Untitled quiz"} — ${item.percentage ?? 0}% score`
      ),
      empty: "No completed quizzes yet."
    },
    {
      title: "Learning Streak",
      value: `${streak} ${streak === 1 ? "Day" : "Days"}`,
      icon: Flame,
      color: "green",
      description: "Consecutive active days",
      details: [
        `Your current learning streak is ${streak} days.`,
        "Visit StudyMate and spend some active learning time each day."
      ],
      empty: "Start learning today to build your streak."
    }
  ];

  /* =====================================
     LEARNING GOALS
  ===================================== */

  const learningGoals = [
    {
      title: "Generate your first notes",
      completed: notes.length > 0,
      path: "/notes-generator"
    },
    {
      title: "Complete an AI quiz",
      completed: quizzes.length > 0,
      path: "/quiz-generator"
    },
    {
      title: "Create flashcards",
      completed: flashcards.length > 0,
      path: "/flashcards"
    },
    {
      title: "Complete interview practice",
      completed: interviews.length > 0,
      path: "/interview-prep"
    }
  ];

  const completedGoals = learningGoals.filter(
    (goal) => goal.completed
  ).length;

  const goalPercentage = Math.round(
    (completedGoals / learningGoals.length) * 100
  );

  /* =====================================
     ACHIEVEMENTS
  ===================================== */

  const completedInterviewQuestions = interviews.reduce(
    (total, session) =>
      total + (Number(session.completedQuestions) || 0),
    0
  );

  const dashboardAchievements = [
    {
      id: "first-notes",
      title: "First Notes",
      description: "Generate your first notes",
      icon: BookOpen,
      current: Math.min(notes.length, 1),
      target: 1,
      unlocked: notes.length >= 1,
      color: "blue"
    },
    {
      id: "quiz-master",
      title: "Quiz Master",
      description: "Complete 10 quizzes",
      icon: Trophy,
      current: Math.min(quizzes.length, 10),
      target: 10,
      unlocked: quizzes.length >= 10,
      color: "orange"
    },
    {
      id: "interview-ready",
      title: "Interview Ready",
      description: "Complete 25 interview questions",
      icon: GraduationCap,
      current: Math.min(completedInterviewQuestions, 25),
      target: 25,
      unlocked: completedInterviewQuestions >= 25,
      color: "green"
    }
  ];

  const unlockedAchievements = dashboardAchievements.filter(
    (item) => item.unlocked
  ).length;

  const achievementPercentage = Math.round(
    (unlockedAchievements / dashboardAchievements.length) * 100
  );

  /* =====================================
     STUDYMATE TOOLS
  ===================================== */

  const tools = [
    {
      title: "AI Tutor",
      description: "Ask questions and learn with your personal AI tutor.",
      icon: MessageCircle,
      color: "purple",
      path: "/ai-tutor"
    },
    {
      title: "Notes Generator",
      description: "Create structured notes for any technical topic.",
      icon: FileText,
      color: "blue",
      path: "/notes-generator"
    },
    {
      title: "Quiz Generator",
      description: "Test your knowledge with AI-powered quizzes.",
      icon: ClipboardList,
      color: "orange",
      path: "/quiz-generator"
    },
    {
      title: "Flashcards",
      description: "Revise important concepts using flashcards.",
      icon: Layers,
      color: "green",
      path: "/flashcards"
    },
    {
      title: "Interview Preparation",
      description: "Practice technical interview questions.",
      icon: Brain,
      color: "purple",
      path: "/interview-prep"
    }
  ];

  /* =====================================
     DASHBOARD UI
  ===================================== */

  return (
    <main className="dashboard">

      {/* Cloud Error */}
      {cloudError && (
        <div className="dashboard-error-message">
          <span>
            Unable to load your cloud learning data: {cloudError}
          </span>

          <button
            type="button"
            onClick={() => setCloudRefresh((prev) => prev + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Study Time Error */}
      {studyError && (
        <div className="dashboard-error-message">
          <span>
            Unable to load study time: {studyError}
          </span>
        </div>
      )}

      {/* Welcome Section */}
      <section className="welcome-section">

        <div className="welcome-content">
          <p className="welcome-label">
            YOUR LEARNING SPACE
          </p>

          <h1>Welcome back, {userName}! 👋</h1>

          <p>What would you like to learn today?</p>
        </div>

        <div className="welcome-icon">
          <Sparkles size={38} />
        </div>

        {/* About StudyMate AI */}
        <div className="dashboard-about-card">

          <div className="dashboard-about-heading">

            <span className="dashboard-about-icon">
              <GraduationCap size={22} />
            </span>

            <div>
              <h3>About StudyMate AI</h3>
              <span>Your Personal AI Learning Companion</span>
            </div>

          </div>

          <p>
            StudyMate AI helps you learn smarter, practice consistently,
            and prepare confidently for technical interviews.
          </p>

          <div className="dashboard-about-features">

            <span>
              <Brain size={15} />
              AI-powered learning
            </span>

            <span>
              <FileText size={15} />
              Smart notes and quizzes
            </span>

            <span>
              <Target size={15} />
              Track your progress
            </span>

          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="stats-grid">

        {stats.map((stat) => {
          const Icon = stat.icon;

          const isStudyStat =
            stat.title === "Study Hours" ||
            stat.title === "Learning Streak";

          return (
            <button
              type="button"
              className="stat-card stat-card-clickable"
              key={stat.title}
              onClick={() => setSelectedStat(stat)}
            >

              <div className={`stat-icon ${stat.color}`}>
                <Icon />
              </div>

              <p>{stat.title}</p>

              <h2>
                {(cloudLoading && !isStudyStat) ||
                (studyLoading && isStudyStat)
                  ? "..."
                  : stat.value}
              </h2>

              <span>{stat.description}</span>

            </button>
          );
        })}

      </section>

      {/* Continue Learning and Weekly Analytics */}
      <section className="dashboard-feature-grid">

        {/* Continue Learning */}
        <div className="dashboard-panel continue-panel">

          <div className="dashboard-panel-heading">
            <div>
              <h2>Continue Learning</h2>
              <p>Pick up where you left off.</p>
            </div>

            <BookOpen size={22} />
          </div>

          <div className="continue-list">

            {[
              {
                title: "AI Tutor",
                subtitle: "Ask your next question",
                path: "/ai-tutor",
                icon: MessageCircle
              },
              {
                title: "Spring Boot",
                subtitle: "Generate notes or practice a quiz",
                path: "/notes-generator",
                icon: Code
              },
              {
                title: "Interview Preparation",
                subtitle: "Improve your interview skills",
                path: "/interview-prep",
                icon: Brain
              }
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  className="continue-item"
                  key={item.title}
                  onClick={() => navigate(item.path)}
                >

                  <span className="continue-icon">
                    <Icon size={20} />
                  </span>

                  <span className="continue-text">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>

                  <ArrowRight size={18} />

                </button>
              );
            })}

          </div>
        </div>

        {/* Weekly Analytics */}
        <div className="dashboard-panel weekly-panel">

          <div className="dashboard-panel-heading">
            <div>
              <h2>Weekly Study Analytics</h2>
              <p>Your active study time over the last 7 days.</p>
            </div>

            <TrendingUp size={22} />
          </div>

          <div className="weekly-total">
            <h2>
              {studyLoading ? "..." : formatDuration(weeklyTotal)}
            </h2>

            <span>Total this week</span>
          </div>

          <div className="weekly-chart">

            {weeklyData.map((item, index) => (
              <div
                className="weekly-chart-column"
                key={`${item.day}-${index}`}
              >

                <div className="weekly-bar-area">
                  <div
                    className="weekly-bar"
                    style={{
                      height: `${Math.max(
                        (item.seconds / maxStudyTime) * 100,
                        item.seconds > 0 ? 5 : 0
                      )}%`
                    }}
                    title={formatDuration(item.seconds)}
                  />
                </div>

                <span>{item.day}</span>

              </div>
            ))}

          </div>
        </div>

      </section>

      {/* Today's Activity and Learning Goals */}
      <section className="dashboard-feature-grid">

        {/* Today's Activity */}
        <div className="dashboard-panel">

          <div className="dashboard-panel-heading">
            <div>
              <h2>Today's Learning Activity</h2>
              <p>What you have completed today.</p>
            </div>

            <CalendarDays size={22} />
          </div>

          <div className="activity-summary">

            <div>
              <strong>{todayNotes.length}</strong>
              <span>Notes</span>
            </div>

            <div>
              <strong>{todayQuizzes.length}</strong>
              <span>Quizzes</span>
            </div>

            <div>
              <strong>{todayFlashcards.length}</strong>
              <span>Flashcard sets</span>
            </div>

            <div>
              <strong>{todayInterviews.length}</strong>
              <span>Interview sessions</span>
            </div>

          </div>

          {todayActivity.length > 0 ? (

            <div className="dashboard-activity-list">

              {todayActivity.slice(0, 4).map((item, index) => {
                const Icon = item.icon;

                return (
                  <button
                    type="button"
                    key={`${item.title}-${index}`}
                    onClick={() => navigate(item.path)}
                  >

                    <Icon size={18} />

                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.type}</small>
                    </span>

                    <ArrowRight size={16} />

                  </button>
                );
              })}

            </div>

          ) : (

            <div className="dashboard-empty">
              <BookOpen size={25} />

              <p>
                {cloudLoading
                  ? "Loading your learning activity..."
                  : "No learning activity recorded today."}
              </p>

              <span>
                Start with AI Tutor or generate some notes.
              </span>
            </div>

          )}

        </div>

        {/* Learning Goals */}
        <div className="dashboard-panel goals-panel">

          <div className="dashboard-panel-heading">
            <div>
              <h2>Learning Goals</h2>
              <p>
                Complete these activities to build your learning routine.
              </p>
            </div>

            <Target size={22} />
          </div>

          <div className="goal-progress">

            <div>
              <strong>
                {completedGoals} of {learningGoals.length}
              </strong>

              <span>Goals completed</span>
            </div>

            <strong>{goalPercentage}%</strong>

          </div>

          <div className="goal-progress-track">
            <div
              style={{
                width: `${goalPercentage}%`
              }}
            />
          </div>

          <div className="goal-list">

            {learningGoals.map((goal) => (
              <button
                type="button"
                key={goal.title}
                onClick={() => navigate(goal.path)}
              >

                <CheckCircle
                  size={19}
                  className={
                    goal.completed ? "goal-completed" : ""
                  }
                />

                <span>{goal.title}</span>

                <ArrowRight size={15} />

              </button>
            ))}

          </div>
        </div>

      </section>

      {/* Achievements Preview */}
      <section className="dashboard-panel achievements-preview-panel">

        <div className="dashboard-panel-heading">
          <div>
            <h2>Achievements &amp; Badges</h2>
            <p>Celebrate your learning milestones.</p>
          </div>

          <Award size={23} />
        </div>

        <div className="achievements-preview-summary">

          <div>
            <strong>
              {unlockedAchievements}/{dashboardAchievements.length}
            </strong>

            <span>Featured badges unlocked</span>
          </div>

          <strong>{achievementPercentage}%</strong>

        </div>

        <div className="achievements-preview-track">
          <div
            style={{
              width: `${achievementPercentage}%`
            }}
          />
        </div>

        <div className="achievements-preview-grid">

          {dashboardAchievements.map((achievement) => {
            const Icon = achievement.icon;

            const progress = Math.round(
              (achievement.current / achievement.target) * 100
            );

            return (
              <div
                className="achievements-preview-item"
                key={achievement.id}
              >

                <span
                  className={`achievements-preview-icon ${achievement.color}`}
                >
                  <Icon size={21} />
                </span>

                <div className="achievements-preview-info">

                  <strong>{achievement.title}</strong>

                  <small>{achievement.description}</small>

                  <div className="achievements-preview-mini-track">
                    <div
                      style={{
                        width: `${progress}%`
                      }}
                    />
                  </div>

                </div>

                {achievement.unlocked && (
                  <CheckCircle
                    size={18}
                    className="achievements-preview-check"
                  />
                )}

              </div>
            );
          })}

        </div>

        <button
          type="button"
          className="dashboard-text-link achievements-preview-link"
          onClick={() => navigate("/achievements")}
        >
          View all achievements <ArrowRight size={16} />
        </button>

      </section>

      {/* Recent Learning Activity */}
      <section className="dashboard-panel recent-panel">

        <div className="dashboard-panel-heading">

          <div>
            <h2>Recent Learning Activity</h2>
            <p>
              Your latest notes, quizzes, flashcards and interview sessions.
            </p>
          </div>

          <button
            type="button"
            className="dashboard-text-link"
            onClick={() => navigate("/my-learning")}
          >
            View all <ArrowRight size={16} />
          </button>

        </div>

        {recentActivity.length > 0 ? (

          <div className="recent-activity-list">

            {recentActivity.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  key={`${item.title}-${index}`}
                  onClick={() => navigate(item.path)}
                >

                  <span className="recent-activity-icon">
                    <Icon size={20} />
                  </span>

                  <span className="recent-activity-text">
                    <strong>{item.title}</strong>
                    <small>{item.type}</small>
                  </span>

                  <small>{formatDate(item.date)}</small>

                </button>
              );
            })}

          </div>

        ) : (

          <div className="dashboard-empty">

            <Sparkles size={26} />

            <p>
              {cloudLoading
                ? "Loading your recent activity..."
                : "Your learning activity will appear here."}
            </p>

            <span>
              Start using StudyMate AI to build your learning history.
            </span>

          </div>

        )}

      </section>

      {/* Explore StudyMate */}
      <section className="dashboard-panel tools-panel">

        <div className="dashboard-panel-heading">
          <div>
            <h2>Explore StudyMate</h2>
            <p>
              Everything you need to learn and prepare for interviews.
            </p>
          </div>

          <Sparkles size={22} />
        </div>

        <div className="dashboard-tools-grid">

          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <button
                type="button"
                className="dashboard-tool-card"
                key={tool.title}
                onClick={() => navigate(tool.path)}
              >

                <span className={`tool-icon ${tool.color}`}>
                  <Icon size={24} />
                </span>

                <strong>{tool.title}</strong>

                <small>{tool.description}</small>

                <span className="dashboard-tool-link">
                  Open tool <ArrowRight size={15} />
                </span>

              </button>
            );
          })}

        </div>

      </section>

      {/* Statistics Details Modal */}
      {selectedStat && (

        <div
          className="dashboard-modal-overlay"
          onClick={() => setSelectedStat(null)}
        >

          <div
            className="dashboard-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-modal-title"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="dashboard-modal-heading">

              <div>
                <h2 id="dashboard-modal-title">
                  {selectedStat.title}
                </h2>

                <p>{selectedStat.description}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStat(null)}
                aria-label="Close statistics details"
              >
                <X size={20} />
              </button>

            </div>

            <div className="dashboard-modal-value">
              {selectedStat.value}
            </div>

            {selectedStat.details.length > 0 ? (

              <ul>
                {selectedStat.details.map((detail, index) => (
                  <li key={`${selectedStat.title}-${index}`}>
                    {detail}
                  </li>
                ))}
              </ul>

            ) : (

              <div className="dashboard-empty">
                <BookOpen size={25} />
                <p>{selectedStat.empty}</p>
              </div>

            )}

            <button
              type="button"
              className="dashboard-modal-close"
              onClick={() => setSelectedStat(null)}
            >
              Close
            </button>

          </div>

        </div>

      )}

    </main>
  );
}

export default Dashboard;
