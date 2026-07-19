import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { newsletterAPI } from '../utils/api';
import type { ThemeProps } from '../types/ui';
import './styles/Footer.css';

function Footer({ theme: _theme }: ThemeProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text?: string; type: string }>({ text: '', type: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      setMessage({ text: 'Please enter your email address', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await newsletterAPI.subscribe(email);

      if (response.success) {
        setMessage({ text: response.message, type: 'success' });
        setEmail('');
      } else {
        setMessage({ text: response.message || 'Something went wrong', type: 'error' });
      }
    } catch (error) {
      console.error('newsletter subscription error.', error);
      setMessage({
        text:
          error instanceof Error ? error.message : 'Unable to subscribe. Please try again later.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);

      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 5000);
    }
  };

  return (
    <footer className="landing-footer">
      <div className="footer-content">
        <motion.div
          className="footer-section"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="footer-logo">
            <img
              src="/aws-student-builder-group-logo.png"
              alt="AWS Student Builder Group"
              className="footer-aws-logo"
            />
            <h3>WSU AWS Student Builder Group</h3>
          </div>
          <p>
            Empowering students with cloud computing skills and connecting them to industry
            opportunities.
          </p>
        </motion.div>

        <motion.div
          className="footer-section"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
        >
          <h3>Quick Links</h3>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/about">About Us</Link>
            </li>
            <li>
              <Link to="/events">Events</Link>
            </li>
            <li>
              <Link to="/resources">Resources</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="footer-section"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h3>Contact Us</h3>
          <div className="contact-info">
            <Mail size={16} aria-hidden="true" />
            <a href="mailto:awscloudclubs@wayne.edu">awscloudclubs@wayne.edu</a>
          </div>
          <div className="contact-info">
            <ShieldCheck size={16} aria-hidden="true" />
            <a href="mailto:awssbg@wayne.edu">Account deletion: awssbg@wayne.edu</a>
          </div>
        </motion.div>

        <motion.div
          className="footer-section"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <h3>Newsletter</h3>
          <p>Stay updated with our latest events and opportunities</p>
          <div className="newsletter">
            <form className="newsletter-form" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
              <motion.button
                type="submit"
                disabled={isLoading}
                whileTap={!isLoading ? { scale: 0.95 } : {}}
                style={{
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Joining...' : 'Join'}
              </motion.button>
            </form>
            {message.text && (
              <motion.div
                className={`newsletter-message ${message.type}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {message.text}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()} Wayne State University AWS Student Builder Group -{' '}
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
