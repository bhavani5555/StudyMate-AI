
import {
  LayoutDashboard,
  MessageCircle,
  FileText,
  ClipboardList,
  Layers,
  GraduationCap,
  Settings,
  BookOpen,
  Sparkles,
  Award,
  LogOut
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../services/authService";

import "./Sidebar.css";

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const getMenuClass = ({ isActive }) =>
    `menu-item${isActive ? " active" : ""}`;

  const handleLogout = async () => {
    try {
      onClose?.();
      await logoutUser();
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Unable to logout. Please try again.");
    }
  };

  const menuItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/ai-tutor", label: "AI Tutor", icon: MessageCircle },
    { path: "/notes-generator", label: "Notes Generator", icon: FileText },
    { path: "/quiz-generator", label: "Quiz Generator", icon: ClipboardList },
    { path: "/flashcards", label: "Flashcards", icon: Layers },
    { path: "/interview-prep", label: "Interview Prep", icon: GraduationCap },
    { path: "/achievements", label: "Achievements", icon: Award }
  ];

  const bottomItems = [
    { path: "/my-learning", label: "My Learning", icon: BookOpen },
    { path: "/settings", label: "Settings", icon: Settings }
  ];

  const renderMenuItem = ({ path, label, icon: Icon, end }) => (
    <NavLink
      key={path}
      to={path}
      end={end}
      className={getMenuClass}
      onClick={onClose}
    >
      <Icon size={19} />
      {label}
    </NavLink>
  );

  return (
    <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Sparkles size={24} />
        </div>

        <h2>
          StudyMate <span>AI</span>
        </h2>
      </div>

      <p className="menu-heading">MAIN MENU</p>

      <nav className="sidebar-menu">
        {menuItems.map(renderMenuItem)}
      </nav>

      <div className="sidebar-bottom">
        {bottomItems.map(renderMenuItem)}

        <button
          type="button"
          className="menu-item logout-button"
          onClick={handleLogout}
        >
          <LogOut size={19} />
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
