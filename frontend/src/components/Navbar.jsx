import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './styles/Navbar.css';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuth } from '../context/AuthContext';

function Navbar({ theme, toggleTheme, activeSection, scrollToSection }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileImage, setProfileImage] = useState('/account.svg');
  const navigate = useNavigate();
  
  const { logout: auth0Logout, isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();
  const { user: authUser, logout: authLogout } = useAuth();

  useEffect(() => {
    if (auth0User) {
      setProfileImage(auth0User.picture || '/account.svg');
    } else if (authUser) {
      setProfileImage(authUser.profilePicture || '/account.svg');
    } else {
      setProfileImage('/account.svg');
    }
  }, [auth0User, authUser]);

  useEffect(() => {
    const rememberMe = localStorage.getItem('rememberMe');
    if (!rememberMe && isAuth0Authenticated) {
      // If user didn't choose remember me, we could implement auto-logout after session
      // For now, we'll keep them logged in until they manually log out
    }
  }, [isAuth0Authenticated]);

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
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992 && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.account-dropdown-container')) {
        setIsAccountDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    if (isAuth0Authenticated) {
      auth0Logout();
    } else {
      authLogout();
    }
    setIsAccountDropdownOpen(false);
  };

  const isAuthenticated = isAuth0Authenticated || !!authUser;
  const currentUser = auth0User || authUser;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleAccountDropdown = () => {
    setIsAccountDropdownOpen(!isAccountDropdownOpen);
  };

  const getDisplayName = (user) => {
    if (!user) return 'User';
    
    // For Auth0 users (social login)
    if (user.sub) {
      if (user.sub.startsWith('google-oauth2|') || user.sub.startsWith('windowslive|')) {
        return user.name?.split(' ')[0] || user.name || 'User';
      }
    }
    
    // For our own users (email/password login)
    if (user.username) {
      return user.username;
    }
    
    // Fallback to full name or first name
    if (user.fullName) {
      return user.fullName.split(' ')[0] || user.fullName;
    }

    return 'User';
  };

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
        {!isAuth0Authenticated && !authUser && (
          <div className="auth-buttons">
            <motion.button 
              className="auth-option secondary"
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Sign In
            </motion.button>
            <motion.button 
              className="auth-option primary"
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Sign Up
            </motion.button>
          </div>
        )}

        {isAuthenticated && (
          <div className="account-dropdown-container">
            <motion.button 
              className="account-toggle"
              onClick={toggleAccountDropdown}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.img
                src={profileImage}
                alt="Account"
                className="account-icon"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/account.svg';
                  setProfileImage('/account.svg');
                }}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                initial={false}
                animate={{
                  scale: isAccountDropdownOpen ? 0.95 : 1,
                  rotate: isAccountDropdownOpen ? 180 : 0
                }}
              />
            </motion.button>

            <AnimatePresence>
              {isAccountDropdownOpen && (
                <motion.div
                  className="account-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="user-info">
                    <div className="user-details">
                      <strong>{getDisplayName(currentUser)}</strong>
                      <span>{currentUser?.email || ''}</span>
                    </div>
                  </div>

                  <motion.button 
                    className="auth-option secondary"
                    onClick={handleLogout}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img 
                      src="/login.svg" 
                      alt="Logout" 
                      className="login-icon" 
                      style={{ filter: theme === 'dark' ? 'invert(100%)' : 'invert(0%)' }}
                    />
                    Sign Out
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
                animate={{ rotate: 180 }}
                transition={{ duration: 0 }}
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
