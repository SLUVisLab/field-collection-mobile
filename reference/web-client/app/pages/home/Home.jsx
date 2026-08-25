import React from "react";
import styles from "./Home.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Hello World!</h1>
      <p className={styles.welcome}>Welcome to the Harvest Data Portal</p>
    </div>
  );
}