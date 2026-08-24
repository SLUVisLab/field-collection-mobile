import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";

// Create an auth context
const AuthContext = createContext(null);

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const auth = useMemo(() => getFirebaseAuth(), []);

  // Check for existing user session on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Login function
  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      setUser(credentials.user);
      return credentials.user;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  // Register function
  const register = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      const credentials = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      setUser(credentials.user);
      return credentials.user;
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  // Reset password function
  const resetPassword = useCallback(async (email) => {
    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Reset password email failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  // Determine if user is authenticated
  const isAuthenticated = !!user;

  // Provide auth context value
  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    resetPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook for using the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}