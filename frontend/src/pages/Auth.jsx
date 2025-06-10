import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './styles/Auth.css';

function Auth({ theme }) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const { loginWithRedirect, isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();
  const { user: authUser, login, signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if ((authUser || (isAuth0Authenticated && auth0User)) && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [authUser, isAuth0Authenticated, auth0User, navigate, isLoading]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { confirmPassword, ...authData } = formData;
      const authPayload = { ...authData, rememberMe };
      
      if (isLogin) {
        await login(authPayload);
      } else {
        await signup(authPayload);
      }
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async () => {
    try {
      setIsLoading(true);
      await loginWithRedirect({
        appState: { returnTo: window.location.origin },
        authorizationParams: {
          connection: 'google-oauth2',
          response_type: "code",
          code_challenge_method: "S256",
          prompt: "login"
        }
      });
    } catch (error) {
      console.error('Social login error:', error);
      setError('Social login failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <motion.div 
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="auth-header">
          <motion.img 
            src={theme === 'light' ? "/aws-logo-dark.svg" : "/aws-logo-light.svg"}
            alt="AWS Logo" 
            className="auth-logo"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          />
          <h1>Welcome to AWS Club</h1>
          <p>{isLogin ? 'Sign in to continue' : 'Create your account'}</p>
        </div>

        <div className="auth-toggle">
          <button 
            className={isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            Sign In
          </button>
          <button 
            className={!isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
          >
            Sign Up
          </button>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="auth-form">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="form-group">
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Full Name"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required={!isLogin}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required={!isLogin}
                    pattern="[a-zA-Z0-9_]+"
                    title="Username can only contain letters, numbers, and underscores"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>

          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="form-group">
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={!isLogin}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="form-options">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark"></span>
              Keep me signed in
            </label>
            {isLogin && (
              <a href="#" className="forgot-password">
                Forgot Password?
              </a>
            )}
          </div>

          <motion.button
            type="submit"
            className="auth-submit"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <div className="loading-spinner" />
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </motion.button>
        </form>

        <div className="auth-divider">
          Or continue with
        </div>

        <div className="social-auth">
          <motion.button
            className="social-button"
            onClick={handleSocialLogin}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <img src="/gmail.svg" alt="Google" />
            Continue with Google
          </motion.button>
        </div>

        <motion.button 
          className="back-home"
          onClick={() => navigate('/')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          ← Back to Home
        </motion.button>
      </motion.div>
    </div>
  );
}

export default Auth;
