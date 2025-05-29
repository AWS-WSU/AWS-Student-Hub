import { useState } from 'react';
import { motion } from 'framer-motion';
import './styles/Footer.css';

function Footer({ theme }) {
  const [email, setEmail] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Add newsletter subscription functionality here
    console.log(`Subscribing email: ${email}`);
    setEmail('');
    // You could add a toast notification or success message here
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
                required
              />
              <motion.button 
                type="submit"
                whileHover={{ backgroundColor: 'var(--accent-secondary)' }}
                whileTap={{ scale: 0.95 }}
              >
                Join
              </motion.button>
            </form>
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
