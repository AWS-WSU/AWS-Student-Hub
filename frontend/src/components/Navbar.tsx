import { useState, useEffect } from 'react';
import type { SyntheticEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import './styles/Navbar.css';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuth } from '../context/AuthContext';
import type { LayoutProps } from '../types/ui';
import type { User as HubUser } from '../types/user';

type NavbarUser = Partial<
  Pick<HubUser, 'username' | 'fullName' | 'email' | 'profilePicture' | 'role'>
> & {
  sub?: string;
  name?: string;
  picture?: string;
};

function Navbar({ theme, toggleTheme }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileImage, setProfileImage] = useState('/avatar.jpg');
  const navigate = useNavigate();
  const location = useLocation();

  const {
    logout: auth0Logout,
    isAuthenticated: isAuth0Authenticated,
    user: auth0User,
  } = useAuth0();
  const { user: authUser, logout: authLogout } = useAuth();

  useEffect(() => {
    if (auth0User) {
      setProfileImage(auth0User.picture || '/avatar.jpg');
    } else if (authUser) {
      const profilePic = authUser.profilePicture || '/avatar.jpg';
      setProfileImage(profilePic);
    } else {
      setProfileImage('/avatar.jpg');
    }
  }, [auth0User, authUser]);

  useEffect(() => {
    const rememberMe = localStorage.getItem('rememberMe');
    if (!rememberMe && isAuth0Authenticated) {
      // TODO: handle session expiry for non-remembered Auth0 users
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
    const handleClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest('.account-dropdown-container')) {
        setIsAccountDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await authLogout();
    if (isAuth0Authenticated) {
      auth0Logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });
    }
    setIsAccountDropdownOpen(false);
  };

  const isAuthenticated = !!authUser;
  const currentUser = authUser as NavbarUser | undefined;

  const isActive = (path: string): boolean => location.pathname === path;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleAccountDropdown = () => {
    setIsAccountDropdownOpen(!isAccountDropdownOpen);
  };

  const getDisplayName = (user?: NavbarUser | null): string => {
    if (!user) return 'User';

    if (user.sub) {
      if (user.sub.startsWith('google-oauth2|') || user.sub.startsWith('windowslive|')) {
        return user.name?.split(' ')[0] || user.name || 'User';
      }
    }

    if (user.username) {
      return user.username;
    }

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
        <Link to="/" className="brand-link" aria-label="AWS Student Builder Group home">
          <span className="brand-mark-wrap" aria-hidden="true">
            <img src="/aws-student-builder-group-logo.png" alt="" className="aws-logo" />
          </span>
          <div className="logo-text">
            <span className="brand-university">Wayne State University</span>
            <span className="brand-name">AWS Student Builder Group</span>
          </div>
        </Link>
      </motion.div>

      <nav className="desktop-nav">
        <ul>
          <motion.li
            className={isActive('/') ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link to="/">Home</Link>
          </motion.li>
          <motion.li
            className={isActive('/about') ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Link to="/about">About</Link>
          </motion.li>
          <motion.li
            className={isActive('/events') ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Link to="/events">Events</Link>
          </motion.li>
          <motion.li
            className={isActive('/resources') ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Link to="/resources">Resources</Link>
          </motion.li>
          <motion.li
            className={isActive('/challenges') ? 'active' : ''}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Link to="/challenges">Challenges</Link>
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
                onError={(e: SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/avatar.jpg';
                  setProfileImage('/avatar.jpg');
                }}
                referrerPolicy="no-referrer"
                initial={false}
                animate={{
                  scale: isAccountDropdownOpen ? 0.95 : 1,
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
                    onClick={() => {
                      navigate('/account');
                      setIsAccountDropdownOpen(false);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="login-icon profile-menu-icon"
                      onError={(e: SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/avatar.jpg';
                      }}
                      referrerPolicy="no-referrer"
                    />
                    Profile
                  </motion.button>

                  {authUser && ['moderator', 'admin', 'superuser'].includes(authUser.role) && (
                    <motion.button
                      className="auth-option secondary admin-link"
                      onClick={() => {
                        navigate('/admin');
                        setIsAccountDropdownOpen(false);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <LayoutDashboard className="login-icon" aria-hidden="true" />
                      Admin Dashboard
                    </motion.button>
                  )}

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
              type: 'spring',
              stiffness: 200,
              damping: 10,
              duration: 0.6,
            }}
          >
            {theme === 'light' ? (
              <img
                src="/dark.svg"
                alt="Switch to dark mode"
                className="theme-icon"
                style={{ filter: 'invert(0%)' }}
              />
            ) : (
              <motion.img
                src="/light.svg"
                alt="Switch to light mode"
                className="theme-icon"
                style={{ filter: 'invert(100%)' }}
                animate={{ rotate: 180 }}
                transition={{ duration: 0 }}
              />
            )}
          </motion.div>
        </motion.button>

        <motion.button
          className={`mobile-menu-toggle ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.span
            animate={{
              rotate: isMenuOpen ? 45 : 0,
              y: isMenuOpen ? 10 : 0,
              x: isMenuOpen ? 2 : 0,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
          <motion.span
            animate={{
              opacity: isMenuOpen ? 0 : 1,
              scale: isMenuOpen ? 0 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
          <motion.span
            animate={{
              rotate: isMenuOpen ? -45 : 0,
              y: isMenuOpen ? -10 : 0,
              x: isMenuOpen ? 2 : 0,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </motion.button>
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
            <ul>
              <motion.li
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Link to="/" onClick={toggleMenu}>
                  Home
                </Link>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Link to="/about" onClick={toggleMenu}>
                  About
                </Link>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Link to="/events" onClick={toggleMenu}>
                  Events
                </Link>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Link to="/resources" onClick={toggleMenu}>
                  Resources
                </Link>
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link to="/challenges" onClick={toggleMenu}>
                  Challenges
                </Link>
              </motion.li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
