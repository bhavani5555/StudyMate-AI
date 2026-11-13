
import { useState } from "react";

import {
  Eye,
  EyeOff,
  BookOpen,
  Mail,
  Lock,
  User,
  Sparkles,
  GraduationCap,
  Brain,
  Target,
  ArrowRight,
  LoaderCircle
} from "lucide-react";

import {
  loginUser,
  registerUser,
  resetPassword
} from "../services/authService";

import "./Auth.css";

function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  // CLEAR MESSAGES

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

 
  // FIREBASE ERROR HANDLING

  const getFirebaseErrorMessage = (err) => {
    const messages = {
      "auth/email-already-in-use":
        "This email is already registered. Please log in instead.",

      "auth/invalid-email":
        "Please enter a valid email address.",

      "auth/invalid-credential":
        "Incorrect email or password. Please check your details.",

      "auth/weak-password":
        "Please choose a stronger password with at least 6 characters.",

      "auth/user-not-found":
        "No account was found with this email address.",

      "auth/wrong-password":
        "Incorrect password. Please try again.",

      "auth/too-many-requests":
        "Too many attempts. Please wait a while and try again.",

      "auth/network-request-failed":
        "Network error. Please check your internet connection.",

      "auth/user-disabled":
        "This account has been disabled. Please contact support.",

      "auth/operation-not-allowed":
        "This authentication method is currently disabled.",

      "auth/invalid-api-key":
        "Firebase configuration is invalid. Please check your Firebase settings."
    };

    return (
      messages[err?.code] ||
      "Something went wrong. Please try again."
    );
  };

  // SWITCH LOGIN / REGISTER

  const switchMode = (registerMode) => {
    if (loading || resetLoading) return;

    setIsRegister(registerMode);
    setPassword("");
    setShowPassword(false);

    clearMessages();
  };


  // LOGIN / REGISTER SUBMISSION
  

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || resetLoading) return;

    clearMessages();

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    // Name validation
    if (isRegister && !trimmedName) {
      setError("Please enter your full name.");
      return;
    }

    // Email validation
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Password validation
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      if (isRegister) {
        const user = await registerUser(
          trimmedEmail,
          password,
          trimmedName
        );

        // Save user settings without interrupting registration
        try {
          const existingSettings = JSON.parse(
            localStorage.getItem("studymate-settings") || "{}"
          );

          localStorage.setItem(
            "studymate-settings",
            JSON.stringify({
              ...existingSettings,
              userName: trimmedName,
              email: user.email || trimmedEmail
            })
          );
        } catch (storageError) {
          console.error(
            "Unable to save user settings:",
            storageError
          );
        }
      } else {
        await loginUser(trimmedEmail, password);
      }


    } catch (err) {
      console.error("Authentication Error:", err);

      setError(getFirebaseErrorMessage(err));

    } finally {
      setLoading(false);
    }
  };


  // FORGOT PASSWORD
  const handleForgotPassword = async () => {
    if (resetLoading || loading) return;

    clearMessages();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Enter your email address first.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setResetLoading(true);

      await resetPassword(trimmedEmail);

      setSuccess(
        "Password reset link sent successfully. Please check your email."
      );

    } catch (err) {
      console.error("Password Reset Error:", err);

      setError(getFirebaseErrorMessage(err));

    } finally {
      setResetLoading(false);
    }
  };

  
  // UI
  
  return (
    <div className="auth-page">

      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      {/* Brand */}
      <header className="auth-header">

        <div className="auth-brand">

          <div className="auth-logo">
            <Sparkles size={25} strokeWidth={2.3} />
          </div>

          <span>
            StudyMate <strong>AI</strong>
          </span>

        </div>

        <div className="auth-header-caption">
          Your personal AI learning companion
        </div>

      </header>

      {/* Main content */}
      <main className="auth-main">

        {/* Introduction */}
        <section className="auth-intro">

          <div className="auth-intro-badge">
            <Sparkles size={15} />
            <span>SMARTER LEARNING STARTS HERE</span>
          </div>

          <h1>
            Learn smarter.
            <br />
            <span>Achieve more.</span>
          </h1>

          <p className="auth-intro-description">
            Your learning journey, powered by AI. Understand concepts,
            create study notes, practice quizzes and prepare for
            interviews — all in one place.
          </p>

          <div className="auth-feature-list">

            <div className="auth-feature">

              <div className="auth-feature-icon">
                <Brain size={21} />
              </div>

              <div>
                <h3>AI-Powered Learning</h3>
                <p>
                  Get explanations and personalized study support.
                </p>
              </div>

            </div>

            <div className="auth-feature">

              <div className="auth-feature-icon">
                <BookOpen size={21} />
              </div>

              <div>
                <h3>Organized Study Tools</h3>
                <p>
                  Create notes, quizzes and flashcards with ease.
                </p>
              </div>

            </div>

            <div className="auth-feature">

              <div className="auth-feature-icon">
                <Target size={21} />
              </div>

              <div>
                <h3>Track Your Progress</h3>
                <p>
                  Stay consistent and move closer to your goals.
                </p>
              </div>

            </div>

          </div>

          <div className="auth-intro-bottom">
            <GraduationCap size={20} />
            <span>One workspace. Endless possibilities.</span>
          </div>

        </section>

        {/* Authentication card */}
        <section className="auth-form-section">

          <div className="auth-card">

            <div className="auth-card-top">

              <div className="auth-card-icon">
                <Sparkles size={25} />
              </div>

              <span className="auth-secure-label">
                <Lock size={13} />
                Secure access
              </span>

            </div>

            <h2>
              {isRegister
                ? "Create your account"
                : "Welcome back!"}
            </h2>

            <p className="auth-subtitle">
              {isRegister
                ? "Create an account and start learning smarter."
                : "Sign in to continue your learning journey."}
            </p>

            {/* Login / Register tabs */}
            <div className="auth-tabs">

              <button
                type="button"
                className={!isRegister ? "active" : ""}
                onClick={() => switchMode(false)}
                disabled={loading || resetLoading}
              >
                Login
              </button>

              <button
                type="button"
                className={isRegister ? "active" : ""}
                onClick={() => switchMode(true)}
                disabled={loading || resetLoading}
              >
                Register
              </button>

            </div>

            <form onSubmit={handleSubmit} noValidate>

              {/* Full Name */}
              {isRegister && (
                <div className="auth-input-group">

                  <label htmlFor="auth-name">
                    Full Name
                  </label>

                  <div className="auth-input-wrapper">

                    <User size={18} />

                    <input
                      id="auth-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearMessages();
                      }}
                      autoComplete="name"
                      required
                      disabled={loading}
                    />

                  </div>

                </div>
              )}

              {/* Email */}
              <div className="auth-input-group">

                <label htmlFor="auth-email">
                  Email Address
                </label>

                <div className="auth-input-wrapper">

                  <Mail size={18} />

                  <input
                    id="auth-email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearMessages();
                    }}
                    autoComplete="email"
                    required
                    disabled={loading || resetLoading}
                  />

                </div>

              </div>

              {/* Password */}
              <div className="auth-input-group">

                <label htmlFor="auth-password">
                  Password
                </label>

                <div className="auth-input-wrapper">

                  <Lock size={18} />

                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearMessages();
                    }}
                    autoComplete={
                      isRegister
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={6}
                    required
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>

                </div>

              </div>

              {/* Forgot password */}
              {!isRegister && (
                <div className="auth-forgot">

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading || loading}
                  >
                    {resetLoading ? (
                      <>
                        <LoaderCircle
                          size={14}
                          className="auth-button-spinner"
                        />
                        Sending reset link...
                      </>
                    ) : (
                      "Forgot password?"
                    )}
                  </button>

                </div>
              )}

              {/* Error */}
              {error && (
                <div
                  className="auth-message error"
                  role="alert"
                  aria-live="assertive"
                >
                  <span>{error}</span>
                </div>
              )}

              {/* Success */}
              {success && (
                <div
                  className="auth-message success"
                  role="status"
                  aria-live="polite"
                >
                  <span>{success}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="auth-submit"
                disabled={loading || resetLoading}
              >

                {loading ? (
                  <>
                    <LoaderCircle
                      className="auth-button-spinner"
                      size={19}
                    />

                    <span>
                      {isRegister
                        ? "Creating your account..."
                        : "Signing you in..."}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {isRegister
                        ? "Create Account"
                        : "Login to StudyMate"}
                    </span>

                    <ArrowRight size={19} />
                  </>
                )}

              </button>

            </form>

            {/* Divider */}
            <div className="auth-divider">
              <span />
              <p>YOUR LEARNING JOURNEY STARTS HERE</p>
              <span />
            </div>

            {/* Footer */}
            <p className="auth-footer">

              {isRegister
                ? "Already have an account?"
                : "Don't have an account?"}

              <button
                type="button"
                onClick={() => switchMode(!isRegister)}
                disabled={loading || resetLoading}
              >
                {isRegister
                  ? "Login"
                  : "Create account"}
              </button>

            </p>

          </div>

          <p className="auth-form-caption">
            By continuing, you agree to use StudyMate AI responsibly.
          </p>

        </section>

      </main>

      {/* Footer */}
      <footer className="auth-bottom-text">

        <span>
          © {new Date().getFullYear()} StudyMate AI
        </span>

        <span className="auth-footer-dot">•</span>

        <span>
          Learn smarter. Grow faster. Achieve more.
        </span>

      </footer>

    </div>
  );
}

export default Auth;
