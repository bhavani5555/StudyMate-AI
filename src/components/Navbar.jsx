
import { useEffect, useState } from "react";

import {
  Search,
  Bell,
  User,
  FileText,
  ClipboardList,
  Layers,
  BookOpen,
  X,
  Sun,
  Moon
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import {
  getCloudSettings,
  saveSettingsToCloud
} from "../services/settingsService";

import "./Navbar.css";

// Read saved data safely from localStorage
function readStorage(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Get the currently saved theme
function readSavedTheme() {
  const currentTheme = document.documentElement.dataset.theme;

  if (currentTheme === "dark" || currentTheme === "light") {
    return currentTheme;
  }

  try {
    const settings = JSON.parse(
      localStorage.getItem("studymate-settings") || "{}"
    );

    return settings.theme?.toLowerCase() === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isDashboard = location.pathname === "/";

  const [userName, setUserName] = useState("Student");
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchItems, setSearchItems] = useState([]);
  const [theme, setTheme] = useState(readSavedTheme);

  // Load logged-in user's profile and cloud settings
  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!user) return;

      setUserName(user.displayName || "Student");

      try {
        const settings = await getCloudSettings(user.uid);

        if (!active) return;

        setUserName(
          settings.userName?.trim() ||
          user.displayName ||
          "Student"
        );

        const localSettings = JSON.parse(
          localStorage.getItem("studymate-settings") || "{}"
        );

        if (!localSettings.theme && settings.theme) {
          const savedTheme =
            settings.theme.toLowerCase() === "dark"
              ? "dark"
              : "light";

          setTheme(savedTheme);
          document.documentElement.dataset.theme = savedTheme;
        }
      } catch (error) {
        console.error("Unable to load profile:", error);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  // Listen for profile and settings updates
  useEffect(() => {
    const loadLocalSettings = () => {
      try {
        const settings = JSON.parse(
          localStorage.getItem("studymate-settings") || "{}"
        );

        if (settings.theme) {
          const savedTheme =
            settings.theme.toLowerCase() === "dark"
              ? "dark"
              : "light";

          setTheme(savedTheme);
          document.documentElement.dataset.theme = savedTheme;
        }

        if (settings.userName) {
          setUserName(settings.userName);
        }
      } catch (error) {
        console.error("Unable to load local settings:", error);
      }
    };

    window.addEventListener(
      "studymate-settings-updated",
      loadLocalSettings
    );

    return () => {
      window.removeEventListener(
        "studymate-settings-updated",
        loadLocalSettings
      );
    };
  }, []);

  // Load saved learning materials for dashboard search
  useEffect(() => {
    const notes = readStorage("studymate-notes");
    const quizzes = readStorage("studymate-quizzes");
    const flashcards = readStorage("studymate-flashcards");

    const items = [
      ...notes.map((item) => ({
        title: item.topic || "Saved note",
        subtitle: "Generated Note",
        icon: FileText,
        path: "/my-learning"
      })),

      ...quizzes.map((item) => ({
        title: item.topic || "Completed quiz",
        subtitle: "Completed Quiz",
        icon: ClipboardList,
        path: "/my-learning"
      })),

      ...flashcards.map((item) => ({
        title: item.topic || "Flashcards",
        subtitle: "Flashcard Set",
        icon: Layers,
        path: "/my-learning"
      }))
    ];

    setSearchItems(items);
  }, [location.pathname, search]);

  // Filter saved learning materials
  const searchQuery = search.trim().toLowerCase();

  const filteredItems = searchQuery
    ? searchItems
        .filter((item) =>
          item.title.toLowerCase().includes(searchQuery)
        )
        .slice(0, 7)
    : [];

  // Toggle dark/light mode
  const handleThemeToggle = async () => {
    if (!user) return;

    const currentTheme =
      document.documentElement.dataset.theme || theme;

    const newTheme =
      currentTheme === "dark" ? "light" : "dark";

    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;

    try {
      const existingSettings = JSON.parse(
        localStorage.getItem("studymate-settings") || "{}"
      );

      const updatedSettings = {
        ...existingSettings,
        theme: newTheme
      };

      localStorage.setItem(
        "studymate-settings",
        JSON.stringify(updatedSettings)
      );

      await saveSettingsToCloud(user.uid, {
        theme: newTheme
      });

      window.dispatchEvent(
        new Event("studymate-settings-updated")
      );
    } catch (error) {
      console.error("Unable to save theme:", error);
    }
  };

  // Build learning notifications
  const savedQuizzes = readStorage("studymate-quizzes");
  const flashcardSets = readStorage("studymate-flashcards");

  const notifications = [
    ...(savedQuizzes.length === 0
      ? [
          {
            title: "Take your first quiz",
            description: "Test your knowledge with an AI-generated quiz.",
            path: "/quiz-generator"
          }
        ]
      : []),

    ...(flashcardSets.length > 0
      ? [
          {
            title: "Review your flashcards",
            description: "Revise your saved flashcard sets.",
            path: "/flashcards"
          }
        ]
      : []),

    {
      title: "Continue interview preparation",
      description: "Practice technical interview questions.",
      path: "/interview-prep"
    }
  ];

  return (
    <header className="navbar">

      {/* Dashboard Search */}
      {isDashboard && (
        <div className="navbar-search-container">
          <div className="navbar-search">
            <Search size={19} />

            <input
              type="text"
              placeholder="Search notes, quizzes, flashcards..."
              aria-label="Search saved learning materials"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => {
                setTimeout(() => setShowResults(false), 150);
              }}
            />

            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearch("");
                  setShowResults(false);
                }}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {showResults && searchQuery && (
            <div className="navbar-search-results">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <button
                      type="button"
                      key={`${item.title}-${index}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        navigate(item.path);
                        setSearch("");
                        setShowResults(false);
                      }}
                    >
                      <Icon size={18} />

                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="search-no-results">
                  No saved topics or learning materials found.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="navbar-right">

        {/* Theme Toggle */}
        <button
          type="button"
          className="navbar-theme-btn"
          onClick={handleThemeToggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun size={20} />
          ) : (
            <Moon size={20} />
          )}
        </button>

        {/* Notifications */}
        <div className="notification-wrapper">
          <button
            type="button"
            className="notification-btn"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="notification-dot"></span>
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-heading">
                <div>
                  <h3>Notifications</h3>
                  <p>Learning reminders for you</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  aria-label="Close notifications"
                >
                  <X size={17} />
                </button>
              </div>

              {notifications.map((item, index) => (
                <button
                  type="button"
                  className="notification-item"
                  key={index}
                  onClick={() => {
                    navigate(item.path);
                    setShowNotifications(false);
                  }}
                >
                  <span className="notification-item-icon">
                    <BookOpen size={18} />
                  </span>

                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="profile">
          <div className="profile-avatar">
            <User size={21} />
          </div>

          <div className="profile-details">
            <h4>{userName}</h4>
            <p>Free Plan</p>
          </div>
        </div>

      </div>
    </header>
  );
}

export default Navbar;
