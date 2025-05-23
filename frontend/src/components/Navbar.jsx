import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './styles/Navbar.css';

function Navbar({ theme, toggleTheme, activeSection, scrollToSection }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Close mobile menu when window is resized to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992 && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen]);

  return (
    <header className={`landing-header ${scrolled ? 'scrolled' : ''}`}>
      <motion.div 
        className="logo-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <img 
          src={theme === 'light' ? "/aws-logo-dark.svg" : "/aws-logo-light.svg"} 
          alt="AWS Logo" 
          className="aws-logo" 
        />
        <div className="logo-text">
          <h1>Wayne State University</h1>
          <span className="accent-text">AWS Cloud Computing Club</span>
        </div>
      </motion.div>
      
      <nav className="desktop-nav">
        <ul>
          <motion.li 
            className={activeSection === 'home' ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <a onClick={() => scrollToSection('home')}>Home</a>
          </motion.li>
          <motion.li 
            className={activeSection === 'about' ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <a onClick={() => scrollToSection('about')}>About</a>
          </motion.li>
          <motion.li 
            className={activeSection === 'events' ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <a onClick={() => scrollToSection('events')}>Events</a>
          </motion.li>
          <motion.li 
            className={activeSection === 'resources' ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <a onClick={() => scrollToSection('resources')}>Resources</a>
          </motion.li>
        </ul>
      </nav>
      
      <div className="header-controls">
        <motion.button 
          className="theme-toggle"
          onClick={toggleTheme}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Toggle theme"
        >
          <motion.div
            className="theme-icon-container"
            initial={false}
            animate={{ rotate: theme === 'light' ? 0 : 180 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 10,
              duration: 0.6 
            }}
          >
            {theme === 'light' ? 
              <img 
                src="/dark.svg" 
                alt="Switch to dark mode" 
                className="theme-icon" 
                style={{ filter: 'invert(0%)' }}
              /> : 
              <motion.img 
                src="/light.svg" 
                alt="Switch to light mode" 
                className="theme-icon" 
                style={{ filter: 'invert(100%)' }}
                animate={{ rotate: 180 }} // This counters the parent rotation to keep the sun upright
                transition={{ duration: 0 }} // Apply immediately with no animation
              />
            }
          </motion.div>
        </motion.button>
        <button className="mobile-menu-toggle" onClick={toggleMenu} aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            className="mobile-menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <button className="close-menu" onClick={toggleMenu}>×</button>
            <ul>
              <motion.li 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.1 }}
              >
                <a onClick={() => { scrollToSection('home'); toggleMenu(); }}>Home</a>
              </motion.li>
              <motion.li 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.2 }}
              >
                <a onClick={() => { scrollToSection('about'); toggleMenu(); }}>About</a>
              </motion.li>
              <motion.li 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.3 }}
              >
                <a onClick={() => { scrollToSection('events'); toggleMenu(); }}>Events</a>
              </motion.li>
              <motion.li 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.4 }}
              >
                <a onClick={() => { scrollToSection('resources'); toggleMenu(); }}>Resources</a>
              </motion.li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
