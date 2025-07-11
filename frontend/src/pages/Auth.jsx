import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './styles/Auth.css';

const PasswordRequirements = ({ password, isVisible }) => {
  const requirements = [
    {
      test: (pwd) => pwd.length >= 6,
      text: 'At least 6 characters long'
    },
    {
      test: (pwd) => /\d/.test(pwd),
      text: 'Contains at least one number'
    },
    {
      test: (pwd) => /[A-Z]/.test(pwd),
      text: 'Contains at least one uppercase letter'
    },
    {
      test: (pwd) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
      text: 'Contains at least one special character'
    }
  ];

  if (!isVisible) return null;

  return (
    <motion.div
      className="password-requirements"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="requirements-title">Password must:</div>
      <ul className="requirements-list">
        {requirements.map((req, index) => (
          <li 
            key={index} 
            className={`requirement ${req.test(password) ? 'met' : 'unmet'}`}
          >
            <span className="requirement-icon">
              {req.test(password) ? '✓' : '○'}
            </span>
            {req.text}
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

const PasswordInput = ({ name, placeholder, value, onChange, onFocus, onBlur, required = false, minLength, showField, showPassword, togglePasswordVisibility }) => {
  const fieldKey = showField || name;
  return (
    <div className="form-group password-input-container">
      <input
        type={showPassword[fieldKey] ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => togglePasswordVisibility(fieldKey)}
        aria-label={showPassword[fieldKey] ? "Hide password" : "Show password"}
      >
        <img
          src={showPassword[fieldKey] ? "/eye-closed.svg" : "/eye-open.svg"}
          alt={showPassword[fieldKey] ? "Hide" : "Show"}
        />
      </button>
    </div>
  );
};

function Auth({ theme }) {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(null);
  const [resetData, setResetData] = useState({
    identifier: '',
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
    censoredEmail: '',
    needsEmailVerification: false
  });
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState({
    password: false,
    confirmPassword: false,
    newPassword: false,
    confirmResetPassword: false
  });
  
  const { loginWithRedirect, isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();
  const { user: authUser, login, signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if ((authUser || (isAuth0Authenticated && auth0User)) && !isLoading) {
      const currentUser = auth0User || authUser;
      if (currentUser && !currentUser.profileSetupCompleted) {
        navigate('/setup', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [authUser, isAuth0Authenticated, auth0User, navigate, isLoading]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleResetInputChange = (e) => {
    setResetData({
      ...resetData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { confirmPassword: _, ...authData } = formData;
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout - backend may be starting up')), 5000)
      );
      
      if (isLogin) {
        await Promise.race([login(authData), timeoutPromise]);
      } else {
        await Promise.race([signup(authData), timeoutPromise]);
      }
      
      setIsLoading(false);
      navigate('/', { replace: true });
      
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout - please check your connection')), 10000)
      );
      
      const response = await Promise.race([
        fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ identifier: resetData.identifier }),
        }),
        timeoutPromise
      ]);

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(data.error || 'Request failed');
      }

      const data = await response.json();

      if (data.needsEmailVerification) {
        setResetData(prev => ({
          ...prev,
          censoredEmail: data.censoredEmail,
          needsEmailVerification: true
        }));
        setForgotPasswordStep('verify-email');
      } else {
        setForgotPasswordStep('verify-code');
        showToast('Reset code sent to your email address', 'success');
      }
    } catch (err) {
      setError(err.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: resetData.identifier, 
          email: resetData.email 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setForgotPasswordStep('verify-code');
      showToast('Reset code sent to your email address', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          identifier: resetData.needsEmailVerification ? resetData.identifier : resetData.identifier,
          code: resetData.code 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setForgotPasswordStep('reset-password');
      showToast('Code verified successfully', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (resetData.newPassword !== resetData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          identifier: resetData.needsEmailVerification ? resetData.identifier : resetData.identifier,
          code: resetData.code,
          newPassword: resetData.newPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setForgotPasswordStep(null);
      setResetData({
        identifier: '',
        email: '',
        code: '',
        newPassword: '',
        confirmPassword: '',
        censoredEmail: '',
        needsEmailVerification: false
      });
      setError('');
      showToast('Password reset successful! You can now sign in with your new password.', 'success', 5000);
    } catch (err) {
      setError(err.message);
    } finally {
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
    } catch {
      setError('Social login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setForgotPasswordStep(null);
    setResetData({
      identifier: '',
      email: '',
      code: '',
      newPassword: '',
      confirmPassword: '',
      censoredEmail: '',
      needsEmailVerification: false
    });
    setError('');
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
          <h1>
            {forgotPasswordStep === 'forgot-password' && 'Reset Password'}
            {forgotPasswordStep === 'verify-email' && 'Verify Email'}
            {forgotPasswordStep === 'verify-code' && 'Enter Reset Code'}
            {forgotPasswordStep === 'reset-password' && 'New Password'}
            {!forgotPasswordStep && 'Welcome to AWS Club'}
          </h1>
          <p>
            {forgotPasswordStep === 'forgot-password' && 'Enter your email or username'}
            {forgotPasswordStep === 'verify-email' && 'Confirm your email address'}
            {forgotPasswordStep === 'verify-code' && 'Check your email for the 6-digit code'}
            {forgotPasswordStep === 'reset-password' && 'Create a new secure password'}
            {!forgotPasswordStep && (isLogin ? 'Sign in to continue' : 'Create your account')}
          </p>
        </div>

        {!forgotPasswordStep && (
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
        )}

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

        <AnimatePresence mode="wait">
          {forgotPasswordStep === 'forgot-password' && (
            <motion.form
              onSubmit={handleForgotPassword}
              className="auth-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="form-group">
                <input
                  type="text"
                  name="identifier"
                  placeholder="Email or Username"
                  value={resetData.identifier}
                  onChange={handleResetInputChange}
                  required
                />
              </div>
              <motion.button
                type="submit"
                className="auth-submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
              >
                {isLoading ? <div className="loading-spinner" /> : 'Continue'}
              </motion.button>
              <motion.button 
                type="button"
                className="back-home"
                onClick={resetForgotPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ← Back to Sign In
              </motion.button>
            </motion.form>
          )}

          {forgotPasswordStep === 'verify-email' && (
            <motion.form
              onSubmit={handleVerifyEmail}
              className="auth-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <p className="verify-email-text">
                We found an account with username <strong>{resetData.identifier}</strong>. 
                Please enter the email address <strong>{resetData.censoredEmail}</strong> to verify your identity.
              </p>
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={resetData.email}
                  onChange={handleResetInputChange}
                  required
                />
              </div>
              <motion.button
                type="submit"
                className="auth-submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
              >
                {isLoading ? <div className="loading-spinner" /> : 'Verify Email'}
              </motion.button>
              <motion.button 
                type="button"
                className="back-home"
                onClick={resetForgotPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ← Back to Sign In
              </motion.button>
            </motion.form>
          )}

          {forgotPasswordStep === 'verify-code' && (
            <motion.form
              onSubmit={handleVerifyCode}
              className="auth-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="form-group">
                <input
                  type="text"
                  name="code"
                  placeholder="6-Digit Code"
                  value={resetData.code}
                  onChange={handleResetInputChange}
                  maxLength="6"
                  pattern="[0-9]{6}"
                  required
                />
              </div>
              <motion.button
                type="submit"
                className="auth-submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
              >
                {isLoading ? <div className="loading-spinner" /> : 'Verify Code'}
              </motion.button>
              <motion.button 
                type="button"
                className="back-home"
                onClick={resetForgotPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ← Back to Sign In
              </motion.button>
            </motion.form>
          )}

          {forgotPasswordStep === 'reset-password' && (
            <motion.form
              onSubmit={handleResetPassword}
              className="auth-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PasswordInput
                name="newPassword"
                placeholder="New Password"
                value={resetData.newPassword}
                onChange={handleResetInputChange}
                minLength="8"
                required
                showField="newPassword"
                showPassword={showPassword}
                togglePasswordVisibility={togglePasswordVisibility}
              />
              <PasswordInput
                name="confirmPassword"
                placeholder="Confirm New Password"
                value={resetData.confirmPassword}
                onChange={handleResetInputChange}
                minLength="8"
                required
                showField="confirmResetPassword"
                showPassword={showPassword}
                togglePasswordVisibility={togglePasswordVisibility}
              />
              <motion.button
                type="submit"
                className="auth-submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
              >
                {isLoading ? <div className="loading-spinner" /> : 'Reset Password'}
              </motion.button>
              <motion.button 
                type="button"
                className="back-home"
                onClick={resetForgotPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ← Back to Sign In
              </motion.button>
            </motion.form>
          )}

          {!forgotPasswordStep && (
            <motion.form
              onSubmit={handleSubmit}
              className="auth-form"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
            >
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
                  type="text"
                  name="email"
                  placeholder={isLogin ? "Email or Username" : "Email"}
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="password-field-container">
                <PasswordInput
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onFocus={() => !isLogin && setShowPasswordRequirements(true)}
                  onBlur={() => setShowPasswordRequirements(false)}
                  required
                  showPassword={showPassword}
                  togglePasswordVisibility={togglePasswordVisibility}
                />
                <AnimatePresence>
                  <PasswordRequirements
                    password={formData.password}
                    isVisible={!isLogin && showPasswordRequirements}
                  />
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <PasswordInput
                      name="confirmPassword"
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required={!isLogin}
                      showPassword={showPassword}
                      togglePasswordVisibility={togglePasswordVisibility}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="form-options">
                {isLogin && (
                  <button 
                    type="button"
                    className="forgot-password"
                    onClick={() => setForgotPasswordStep('forgot-password')}
                  >
                    Forgot Password?
                  </button>
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
            </motion.form>
          )}
        </AnimatePresence>

        {!forgotPasswordStep && (
          <>
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
          </>
        )}
      </motion.div>
    </div>
  );
}

export default Auth;
