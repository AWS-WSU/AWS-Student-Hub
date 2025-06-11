import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function DiscordInviteModal() {
  const [inviteUrl, setInviteUrl] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const handleClick = async () => {
    setShowModal(true);

    if (!inviteUrl) {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:5001/api/discord-invite");
        const data = await res.json();
        setInviteUrl(data.inviteUrl);
      } catch (err) {
        console.error("Failed to fetch invite:", err);
        setInviteUrl("error");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleJoin = () => {
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      window.open(inviteUrl, "_blank", "noopener,noreferrer");
      setShowModal(false);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, inviteUrl]);

  const handleClose = () => {
    setShowModal(false);
    setCountdown(null);
  };

  return (
    <>
      <motion.img
        src="/discord.svg"
        alt="Join Discord"
        style={{ cursor: "pointer", width: "40px", margin: "0 6px" }}
        onClick={handleClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      />

      <AnimatePresence>
        {showModal && (
          <motion.div
            style={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={styles.modal}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <button style={styles.closeButton} onClick={handleClose}>
                X
              </button>
              <h2 style={styles.title}>Join Our Discord</h2>

              {loading ? (
                <p style={styles.text}>Loading invite link...</p>
              ) : inviteUrl === "error" ? (
                <p style={{ ...styles.text, color: "red" }}>
                  Failed to load invite. Try again later.
                </p>
              ) : countdown !== null ? (
                <p style={styles.text}>Redirecting in... {countdown}</p>
              ) : (
                <motion.button
                  style={styles.joinButton}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleJoin}
                >
                  JOIN NOW
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    padding: "24px 32px",
    borderRadius: "12px",
    minWidth: "320px",
    maxWidth: "90%",
    textAlign: "center",
    position: "relative",
    boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
    color: "#1b1b1b",
    marginBottom: "12px",
  },
  text: {
    fontSize: "16px",
    fontFamily: "'Segoe UI', 'Roboto', sans-serif",
    color: "#333",
  },
  joinButton: {
    padding: "10px 20px",
    fontSize: "16px",
    fontWeight: "bold",
    fontFamily: "'Segoe UI', 'Roboto', sans-serif",
    backgroundColor: "#5865F2",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(88,101,242,0.3)",
    transition: "background-color 0.3s ease",
  },
  closeButton: {
    position: "absolute",
    top: "12px",
    right: "16px",
    fontWeight: "bold",
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
  },
};
