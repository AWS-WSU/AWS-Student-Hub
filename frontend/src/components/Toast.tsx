import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Check, Info, X } from 'lucide-react';
import type { ToastType } from '../types/ui';
import './styles/Toast.css';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast = ({ message, type = 'success', duration = 4000, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const ToastIcon = type === 'success' ? Check : type === 'info' ? Info : AlertCircle;

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
            <div className="toast-icon">
              <ToastIcon size={12} aria-hidden="true" />
            </div>
            <span className="toast-message">{message}</span>
            <button className="toast-close" onClick={handleClose} aria-label="Close toast">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
