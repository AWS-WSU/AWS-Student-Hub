import { useState } from 'react';
import { motion } from 'framer-motion';
import { newsletterAPI } from '../utils/api';
import './styles/Footer.css';

function Footer({ theme }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success', 'error', ''
  
  const handleSubmit = async (e) => {
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
        setEmail(''); // Clear the input on success
      } else {
        setMessage({ text: response.message || 'Something went wrong', type: 'error' });
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      setMessage({ 
        text: error.message || 'Unable to subscribe. Please try again later.',
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
      
      // Clear message after 5 seconds
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
            <img src={theme === 'light' ? "/aws-logo-dark.svg" : "/aws-logo-light.svg"} alt="AWS Logo" className="footer-aws-logo" />
            <h3>WSU AWS Cloud Computing Club</h3>
          </div>
          <p>Empowering students with cloud computing skills and connecting them to industry opportunities.</p>
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
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About Us</a></li>
            <li><a href="#events">Events</a></li>
            <li><a href="#resources">Resources</a></li>
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
            <i className="fas fa-envelope"></i>
            <span>awscloudclubs@wayne.edu</span>
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
                whileHover={!isLoading ? { backgroundColor: 'var(--accent-secondary)' } : {}}
                whileTap={!isLoading ? { scale: 0.95 } : {}}
                style={{ 
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer'
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
        <p>&copy; {new Date().getFullYear()} Wayne State University AWS Cloud Computing Club</p>
      </div>
    </footer>
  );
}

export default Footer;
