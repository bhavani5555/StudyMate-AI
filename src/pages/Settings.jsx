
import { useEffect, useRef, useState } from "react";

import {
  Settings as SettingsIcon,
  User,
  Brain,
  BookOpen,
  Info,
  Save,
  Mail,
  GraduationCap,
  ShieldCheck,
  CircleHelp,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  getCloudSettings,
  saveSettingsToCloud
} from "../services/settingsService";

import "./Settings.css";

/*  LOCAL SETTINGS */

function getSavedSettings(uid) {
  try {
    const rawSettings = localStorage.getItem("studymate-settings");

    if (!rawSettings) return {};

    const savedSettings = JSON.parse(rawSettings);

    if (!savedSettings || typeof savedSettings !== "object") {
      return {};
    }

    // Only use the cache belonging to the current user.
    if (!uid || savedSettings.uid !== uid) {
      return {};
    }

    return savedSettings;
  } catch (error) {
    console.error("Local settings loading failed:", error);
    return {};
  }
}

/* DOMAIN OPTIONS */

const domainOptions = [
  "Java",
  "Python",
  "C",
  "C++",
  "C#",
  "JavaScript",
  "TypeScript",
  "HTML & CSS",
  "React",
  "Angular",
  "Node.js",
  "Spring Boot",
  "Spring MVC",
  "REST APIs",
  "Microservices",
  "SQL",
  "MySQL",
  "PostgreSQL",
  "MongoDB",
  "DSA",
  "Operating Systems",
  "Computer Networks",
  "Git & GitHub"
];

const difficultyOptions = ["Easy", "Medium", "Hard"];

/* SETTINGS COMPONENT */

function Settings() {
  const { user } = useAuth();

  const savedSettings = getSavedSettings(user?.uid);

  const [userName, setUserName] = useState(
    savedSettings.userName || user?.displayName || ""
  );

  const [email, setEmail] = useState(user?.email || "");

  const [difficulty, setDifficulty] = useState(
    savedSettings.difficulty || "Easy"
  );

  const [domain, setDomain] = useState(
    savedSettings.domain || "Java"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [saveMessage, setSaveMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Prevent duplicate cloud save requests.
  const saveLockRef = useRef(false);

  /* CLEAR FEEDBACK */

  const clearFeedback = () => {
    setSaveMessage("");
    setMessageType("");
  };

  /*LOAD SETTINGS FROM FIRESTORE */

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      if (!user?.uid) {
        setLoading(false);
        setUserName("");
        setEmail("");
        return;
      }

      setLoading(true);
      clearFeedback();

      // Refresh account information when the authenticated user changes.
      setEmail(user.email || "");

      const localSettings = getSavedSettings(user.uid);

      try {
        const cloudSettings = await getCloudSettings(user.uid);

        if (!isMounted) return;

        const settings =
          cloudSettings &&
          typeof cloudSettings === "object"
            ? cloudSettings
            : {};

        setUserName(
          settings.userName ||
          localSettings.userName ||
          user.displayName ||
          ""
        );

        setEmail(
          user.email ||
          settings.email ||
          localSettings.email ||
          ""
        );

        setDifficulty(
          difficultyOptions.includes(settings.difficulty)
            ? settings.difficulty
            : difficultyOptions.includes(localSettings.difficulty)
              ? localSettings.difficulty
              : "Easy"
        );

        setDomain(
          domainOptions.includes(settings.domain)
            ? settings.domain
            : domainOptions.includes(localSettings.domain)
              ? localSettings.domain
              : "Java"
        );
      } catch (error) {
        console.error("Settings loading failed:", error);

        if (!isMounted) return;

        // Use the same user's local cache if cloud loading fails.
        setUserName(
          localSettings.userName ||
          user.displayName ||
          ""
        );

        setEmail(
          user.email ||
          localSettings.email ||
          ""
        );

        setDifficulty(
          difficultyOptions.includes(localSettings.difficulty)
            ? localSettings.difficulty
            : "Easy"
        );

        setDomain(
          domainOptions.includes(localSettings.domain)
            ? localSettings.domain
            : "Java"
        );

        setSaveMessage(
          "Unable to load cloud settings. Showing your locally saved preferences."
        );

        setMessageType("error");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.email, user?.displayName]);

  /* SAVE SETTINGS */

  const handleSave = async () => {
    if (saveLockRef.current || saving) return;

    if (!user?.uid) {
      setSaveMessage("Please log in to save your settings.");
      setMessageType("error");
      return;
    }

    const trimmedName = userName.trim();

    if (!trimmedName) {
      setSaveMessage("Please enter your name before saving.");
      setMessageType("error");
      return;
    }

    if (trimmedName.length > 60) {
      setSaveMessage("Your name cannot exceed 60 characters.");
      setMessageType("error");
      return;
    }

    if (!difficultyOptions.includes(difficulty)) {
      setSaveMessage("Please select a valid difficulty level.");
      setMessageType("error");
      return;
    }

    if (!domainOptions.includes(domain)) {
      setSaveMessage("Please select a valid learning domain.");
      setMessageType("error");
      return;
    }

    saveLockRef.current = true;

    setSaving(true);
    clearFeedback();

    try {
      // Read the current Navbar theme without changing it.
      const currentTheme =
        document.documentElement.dataset.theme === "dark"
          ? "Dark"
          : "Light";

      const settings = {
        uid: user.uid,
        userName: trimmedName,
        email: user.email || email,
        theme: currentTheme,
        difficulty,
        domain
      };

      // Save to Firestore first.
      await saveSettingsToCloud(user.uid, settings);

      // Update local cache only after successful cloud saving.
      localStorage.setItem(
        "studymate-settings",
        JSON.stringify(settings)
      );

      // Notify other components that settings have changed.
      window.dispatchEvent(
        new Event("studymate-settings-updated")
      );

      setUserName(trimmedName);

      setSaveMessage("Your settings have been saved successfully.");
      setMessageType("success");
    } catch (error) {
      console.error("Settings saving failed:", error);

      setSaveMessage(
        "Unable to save your settings. Please check your connection and try again."
      );

      setMessageType("error");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  /* INPUT HANDLERS  */

  const handleNameChange = (value) => {
    setUserName(value);
    clearFeedback();
  };

  const handleDifficultyChange = (value) => {
    setDifficulty(value);
    clearFeedback();
  };

  const handleDomainChange = (value) => {
    setDomain(value);
    clearFeedback();
  };

  /* RENDER */

  return (
    <div className="settings-page">

      {/* PAGE HEADER */}

      <div className="settings-header">
        <div className="settings-header-content">

          <div className="settings-header-icon">
            <SettingsIcon size={25} />
          </div>

          <div>
            <h1>Settings</h1>

            <p>
              Manage your account and personalize your learning experience.
            </p>
          </div>

        </div>
      </div>

      {/* LOADING */}

      {loading && (
        <div className="settings-loading" role="status">
          <span className="settings-loading-spinner" />
          Loading your settings...
        </div>
      )}

      {/* PROFILE INFORMATION */}

      <section className="settings-card">

        <div className="settings-card-title">

          <div className="settings-section-icon profile-icon">
            <User size={20} />
          </div>

          <div>
            <h2>Profile Information</h2>
            <p>Manage your personal account information.</p>
          </div>

        </div>

        <div className="settings-form-grid">

          <div className="settings-field">

            <label htmlFor="settings-name">
              Full Name
            </label>

            <input
              id="settings-name"
              type="text"
              placeholder="Enter your full name"
              value={userName}
              maxLength={60}
              autoComplete="name"
              disabled={loading || saving}
              onChange={(e) => handleNameChange(e.target.value)}
            />

            <span className="settings-field-help">
              This name is used for your StudyMate profile.
            </span>

          </div>

          <div className="settings-field">

            <label htmlFor="settings-email">
              Email Address
            </label>

            <div className="settings-input-with-icon">

              <Mail size={17} />

              <input
                id="settings-email"
                type="email"
                value={email}
                readOnly
                autoComplete="email"
                aria-readonly="true"
              />

            </div>

            <span className="settings-field-help">
              Your registered account email address.
            </span>

          </div>

        </div>

        <div className="settings-account-note">

          <ShieldCheck size={17} />

          <span>
            Your account information is securely associated with your login.
          </span>

        </div>

      </section>

      {/* AI PREFERENCES */}

      <section className="settings-card">

        <div className="settings-card-title">

          <div className="settings-section-icon ai-icon">
            <Brain size={20} />
          </div>

          <div>
            <h2>AI Preferences</h2>
            <p>
              Choose how StudyMate AI prepares your learning content.
            </p>
          </div>

        </div>

        <div className="settings-form-grid">

          <div className="settings-field">

            <label htmlFor="settings-difficulty">
              Default Difficulty
            </label>

            <select
              id="settings-difficulty"
              value={difficulty}
              disabled={loading || saving}
              onChange={(e) =>
                handleDifficultyChange(e.target.value)
              }
            >
              {difficultyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <span className="settings-field-help">
              Your preferred difficulty for AI-generated practice.
            </span>

          </div>

          <div className="settings-field">

            <label htmlFor="settings-domain">
              Preferred Learning Domain
            </label>

            <select
              id="settings-domain"
              value={domain}
              disabled={loading || saving}
              onChange={(e) => handleDomainChange(e.target.value)}
            >
              {domainOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <span className="settings-field-help">
              Your preferred subject for learning and practice.
            </span>

          </div>

        </div>

      </section>

      {/* STUDY PREFERENCES SUMMARY */}

      <section className="settings-card">

        <div className="settings-card-title">

          <div className="settings-section-icon study-icon">
            <BookOpen size={20} />
          </div>

          <div>
            <h2>Study Preferences</h2>
            <p>
              A quick overview of your selected learning preferences.
            </p>
          </div>

        </div>

        <div className="settings-preference-grid">

          <div className="settings-preference-item">

            <div className="settings-preference-icon">
              <GraduationCap size={21} />
            </div>

            <div>
              <span>Preferred Domain</span>
              <strong>{domain}</strong>
            </div>

          </div>

          <div className="settings-preference-item">

            <div className="settings-preference-icon">
              <Sparkles size={21} />
            </div>

            <div>
              <span>Default Difficulty</span>
              <strong>{difficulty}</strong>
            </div>

          </div>

        </div>

      </section>

      {/* HELP AND SUPPORT */}

      <section className="settings-card">

        <div className="settings-card-title">

          <div className="settings-section-icon help-icon">
            <CircleHelp size={20} />
          </div>

          <div>
            <h2>Help & Support</h2>
            <p>
              Some useful information to help you use StudyMate AI.
            </p>
          </div>

        </div>

        <div className="settings-help-content">

          <div className="settings-help-item">
            <CheckCircle2 size={18} />
            <p>
              Use AI Tutor to understand concepts and clarify your doubts.
            </p>
          </div>

          <div className="settings-help-item">
            <CheckCircle2 size={18} />
            <p>
              Generate notes, quizzes, and flashcards for your preparation.
            </p>
          </div>

          <div className="settings-help-item">
            <CheckCircle2 size={18} />
            <p>
              Track your saved learning materials and progress in My Learning.
            </p>
          </div>

          <div className="settings-help-item">
            <CheckCircle2 size={18} />
            <p>
              If an AI feature does not respond, check your internet connection
              and try again.
            </p>
          </div>

        </div>

      </section>

      {/* ABOUT STUDYMATE */}

      <section className="settings-card settings-about-card">

        <div className="settings-card-title">

          <div className="settings-section-icon about-icon">
            <Info size={20} />
          </div>

          <div>
            <h2>About StudyMate AI</h2>
            <p>Learn more about the platform.</p>
          </div>

        </div>

        <p className="settings-description">
          StudyMate AI is an AI-powered learning platform designed to help
          students learn effectively through AI-generated notes, quizzes,
          flashcards, interview preparation, and personalized learning tools.
        </p>

        <div className="settings-version-row">
          <span>Application Version</span>
          <strong>1.0.0</strong>
        </div>

      </section>

      {/* SAVE FEEDBACK */}

      {saveMessage && (
        <div
          className={`settings-save-message ${messageType}`}
          role={messageType === "error" ? "alert" : "status"}
          aria-live="polite"
        >

          {messageType === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span>{saveMessage}</span>

        </div>
      )}

      {/* SAVE BUTTON */}

      <div className="settings-actions">

        <button
          type="button"
          className="settings-save-btn"
          onClick={handleSave}
          disabled={saving || loading || !user?.uid}
        >

          <Save size={18} />

          {saving ? "Saving Changes..." : "Save Changes"}

        </button>

      </div>

    </div>
  );
}

export default Settings;
