import React from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import styles from "./Navigation.module.css";

export default function Navigation() {
  const location = useLocation();
  const { logout, user } = useAuth();

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.navContainer}>
        <div className={styles.brand}>
          <Link to="/" className={styles.brandLink}>
            Harvest Data Portal
          </Link>
        </div>
        
        <div className={styles.navLinks}>
          <Link 
            to="/" 
            className={`${styles.navLink} ${isActive("/") && location.pathname === "/" ? styles.active : ""}`}
          >
            Search
          </Link>
          <Link 
            to="/guide" 
            className={`${styles.navLink} ${isActive("/guide") ? styles.active : ""}`}
          >
            Guide
          </Link>
          <Link 
            to="/profile" 
            className={`${styles.navLink} ${isActive("/profile") ? styles.active : ""}`}
          >
            Profile
          </Link>
        </div>

        <div className={styles.userSection}>
          {user?.email && (
            <span className={styles.userEmail}>{user.email}</span>
          )}
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
