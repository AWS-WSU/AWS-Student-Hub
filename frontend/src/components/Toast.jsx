import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './styles/Toast.css';

const Toast = ({ message, type = 'success', duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`toast toast-${type}`}
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="toast-content">
            <div className="toast-icon"></div>
            <span className="toast-message">{message}</span>
            <button className="toast-close" onClick={handleClose}></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
