import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import styles from "./Register.module.css";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/";
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

  const verifyRegistrationCode = async (code) => {
    // TODO: Restore API validation once backend endpoint is available
    // const response = await fetch(`${API_BASE_URL}/register`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ code }),
    // });

    // if (!response.ok) {
    //   const error = new Error("Invalid registration code");
    //   error.status = response.status;
    //   throw error;
    // }

    if (code !== "6CXBVE") {
      const error = new Error("Invalid registration code");
      error.status = 400;
      throw error;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!registrationCode.trim()) {
      setError("Registration code is required");
      return;
    }

    setIsLoading(true);

    try {
      await verifyRegistrationCode(registrationCode.trim());
      await register(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err?.code === "auth/email-already-in-use"
        ? "This email address is already registered"
        : err?.status === 400
          ? "Invalid registration code"
          : err?.message || "Unable to create account";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <h1 className={styles.title}>Gather Data Portal</h1>
        <h2 className={styles.subtitle}>Create an Account</h2>

        {error && <p className={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={styles.input}
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={styles.input}
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="registrationCode" className={styles.label}>
              Registration Code
            </label>
            <input
              id="registrationCode"
              type="text"
              value={registrationCode}
              onChange={(event) => setRegistrationCode(event.target.value)}
              className={styles.input}
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className={styles.helper}>
          Already have an account?{' '}
          <Link to="/login" className={styles.helperLink}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
