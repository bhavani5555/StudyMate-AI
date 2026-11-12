
import { useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import StudyTimeTracker from "./components/StudyTimeTracker";

import Dashboard from "./pages/Dashboard.jsx";
import AITutor from "./pages/AITutor.jsx";
import NotesGenerator from "./pages/NotesGenerator.jsx";
import QuizGenerator from "./pages/QuizGenerator.jsx";
import Flashcards from "./pages/Flashcards.jsx";
import InterviewPrep from "./pages/InterviewPrep.jsx";
import Settings from "./pages/Settings.jsx";
import MyLearning from "./pages/MyLearning.jsx";
import Achievements from "./pages/Achievements.jsx";
import Auth from "./pages/Auth.jsx";

import { useAuth } from "./context/AuthContext.jsx";

import "./App.css";

/* =====================================
   APPLY SAVED THEME
===================================== */

function applySavedTheme() {
  try {
    const savedSettings = JSON.parse(
      localStorage.getItem("studymate-settings") || "{}"
    );

    const savedTheme = String(
      savedSettings.theme || "Light"
    ).toLowerCase();

    document.documentElement.dataset.theme =
      savedTheme === "dark" ? "dark" : "light";

  } catch (error) {
    document.documentElement.dataset.theme = "light";
    console.error("Theme initialization error:", error);
  }
}

applySavedTheme();

/* =====================================
   LOADING SCREEN
===================================== */

function AuthLoading() {
  return (
    <div className="auth-loading">
      <div className="auth-loading-spinner"></div>
      <p>Loading StudyMate AI...</p>
    </div>
  );
}

/* =====================================
   PROTECTED LAYOUT
===================================== */

function ProtectedLayout() {
  const { user, loading } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const openSidebar = () => {
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  if (loading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      {/* Firestore-based study time tracking */}
      <StudyTimeTracker />

      <div className="app-container">

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            onClick={closeSidebar}
            aria-label="Close navigation menu"
          />
        )}

        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
        />

        {/* Main Application Content */}
        <div className="main-content">

          <Navbar onMenuClick={openSidebar} />

          <Outlet />

        </div>
      </div>
    </>
  );
}

/* =====================================
   PUBLIC ROUTE
===================================== */

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/* =====================================
   MAIN APP
===================================== */

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Authentication */}
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          }
        />

        {/* Protected Application Pages */}
        <Route element={<ProtectedLayout />}>

          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/ai-tutor"
            element={<AITutor />}
          />

          <Route
            path="/notes-generator"
            element={<NotesGenerator />}
          />

          <Route
            path="/quiz-generator"
            element={<QuizGenerator />}
          />

          <Route
            path="/flashcards"
            element={<Flashcards />}
          />

          <Route
            path="/interview-prep"
            element={<InterviewPrep />}
          />

          <Route
            path="/settings"
            element={<Settings />}
          />

          <Route
            path="/my-learning"
            element={<MyLearning />}
          />

          <Route
            path="/achievements"
            element={<Achievements />}
          />

        </Route>

        {/* Unknown Routes */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
