
import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import { auth } from "../firebase";

const AuthContext = createContext(null);

const SESSION_EXPIRY_KEY = "studymate-session-expiry";
const SESSION_DURATION = 12 * 60 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let expiryTimer = null;
    let active = true;

    const clearExpiryTimer = () => {
      if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
      }
    };

    const handleSessionExpiry = async () => {
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      setUser(null);

      try {
        await signOut(auth);
      } catch (error) {
        console.error("Session expiration error:", error);
      }
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) return;

        clearExpiryTimer();

        if (!currentUser) {
          localStorage.removeItem(SESSION_EXPIRY_KEY);
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          let expiry = Number(
            localStorage.getItem(SESSION_EXPIRY_KEY)
          );

          // Create a session if expiry is missing or invalid.
          if (!expiry || !Number.isFinite(expiry)) {
            expiry = Date.now() + SESSION_DURATION;

            localStorage.setItem(
              SESSION_EXPIRY_KEY,
              String(expiry)
            );
          }

          // Sign out if the session has expired.
          if (Date.now() >= expiry) {
            await handleSessionExpiry();

            if (active) {
              setLoading(false);
            }

            return;
          }

          if (!active) return;

          setUser(currentUser);
          setLoading(false);

          // Schedule automatic session expiration.
          const remainingTime = expiry - Date.now();

          expiryTimer = setTimeout(
            handleSessionExpiry,
            Math.min(remainingTime, 2147483647)
          );

        } catch (error) {
          console.error("Authentication state error:", error);

          if (active) {
            setUser(null);
            setLoading(false);
          }
        }
      }
    );

    // Synchronize session expiry across browser tabs.
    const handleStorageChange = (event) => {
      if (event.key === SESSION_EXPIRY_KEY) {
        clearExpiryTimer();

        const expiry = Number(event.newValue);

        if (!event.newValue || !Number.isFinite(expiry)) {
          setUser(null);
          signOut(auth).catch((error) => {
            console.error("Session synchronization error:", error);
          });
          return;
        }

        const remainingTime = expiry - Date.now();

        if (remainingTime <= 0) {
          handleSessionExpiry();
          return;
        }

        expiryTimer = setTimeout(
          handleSessionExpiry,
          Math.min(remainingTime, 2147483647)
        );
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      active = false;

      clearExpiryTimer();
      unsubscribe();

      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
