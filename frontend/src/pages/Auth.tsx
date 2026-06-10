import { useState, useEffect } from 'react';
import type { ChangeEvent, FocusEventHandler, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authAPI } from '../utils/api';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import CyberChallengeModal from '../components/CyberChallengeModal';
import './styles/Auth.css';
import type { AuthResponse, AwsCredentials } from '../types/auth';
import type { Theme } from '../types/ui';
import type { User } from '../types/user';

interface AuthProps {
  theme?: Theme;
}

interface AuthUserLike extends Partial<User> {
  name?: string;
  picture?: string;
  [key: string]: any;
}

interface PasswordRequirementsProps {
  password: string;
  isVisible: boolean;
}

type PasswordVisibilityField =
  | 'password'
  | 'confirmPassword'
  | 'newPassword'
  | 'confirmResetPassword';

type PasswordVisibilityState = Record<PasswordVisibilityField, boolean>;

interface PasswordInputProps {
  name: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  required?: boolean;
  minLength?: number;
  showField?: PasswordVisibilityField;
  showPassword: PasswordVisibilityState;
  togglePasswordVisibility: (field: PasswordVisibilityField) => void;
}

interface ResetData {
  identifier: string;
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
  censoredEmail: string;
  needsEmailVerification: boolean;
}

interface AuthFormData {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
}

type ForgotPasswordStep =
  | 'forgot-password'
  | 'verify-email'
  | 'verify-code'
  | 'reset-password'
  | null;

type AuthRequestData = Omit<AuthFormData, 'confirmPassword'>;

interface ForgotPasswordResponse {
  needsEmailVerification?: boolean;
  censoredEmail?: string;
  [key: string]: any;
}

const initialResetData: ResetData = {
  identifier: '',
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
  censoredEmail: '',
  needsEmailVerification: false,
};

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const PasswordRequirements = ({ password, isVisible }: PasswordRequirementsProps) => {
  const requirements = [
    {
      test: (pwd: string) => pwd.length >= 6,
      text: 'At least 6 characters long',
    },
    {
      test: (pwd: string) => /\d/.test(pwd),
      text: 'Contains at least one number',
    },
    {
      test: (pwd: string) => /[A-Z]/.test(pwd),
      text: 'Contains at least one uppercase letter',
    },
    {
      test: (pwd: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
      text: 'Contains at least one special character',
    },
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
          <li key={index} className={`requirement ${req.test(password) ? 'met' : 'unmet'}`}>
            <span className="requirement-icon">
              {req.test(password) ? <Check size={14} /> : <Circle size={14} />}
            </span>
            {req.text}
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

const PasswordInput = ({
  name,
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  required = false,
  minLength,
  showField,
  showPassword,
  togglePasswordVisibility,
}: PasswordInputProps) => {
  const fieldKey = showField || (name as PasswordVisibilityField);
  return (
    <div className="form-group password-input-container">
      <input
        type={showPassword[fieldKey] ? 'text' : 'password'}
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
        aria-label={showPassword[fieldKey] ? 'Hide password' : 'Show password'}
      >
        <img
          src={showPassword[fieldKey] ? '/eye-closed.svg' : '/eye-open.svg'}
          alt={showPassword[fieldKey] ? 'Hide' : 'Show'}
        />
      </button>
    </div>
  );
};

function Auth({ theme }: AuthProps) {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState<boolean>(searchParams.get('mode') !== 'signup');
  const redirectPath = searchParams.get('redirect') || '/';
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState<boolean>(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<ForgotPasswordStep>(null);
  const [resetData, setResetData] = useState<ResetData>(initialResetData);
  const [formData, setFormData] = useState<AuthFormData>({
    username: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState<PasswordVisibilityState>({
    password: false,
    confirmPassword: false,
    newPassword: false,
    confirmResetPassword: false,
  });
  const [showCyberModal, setShowCyberModal] = useState<boolean>(false);
  const [awsCredentials, setAwsCredentials] = useState<AwsCredentials | null>(null);

  const { loginWithRedirect, isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();
  const {
    user: authUser,
    login,
    signup,
    forceLogoutAndClearData,
    markAwsCredentialsViewed,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if ((authUser || (isAuth0Authenticated && auth0User)) && !isLoading) {
      const currentUser = (auth0User || authUser) as AuthUserLike | undefined;

      if (
        currentUser &&
        currentUser.awsAccessKeyId &&
        currentUser.awsSecretAccessKey &&
        !currentUser.hasViewedAwsCredentials &&
        !showCyberModal
      ) {
        console.log('setting aws credentials for modal.', {
          hasAccessKey: !!currentUser.awsAccessKeyId,
          hasSecretKey: !!currentUser.awsSecretAccessKey,
          hasViewed: currentUser.hasViewedAwsCredentials,
        });

        setAwsCredentials({
          accessKeyId: currentUser.awsAccessKeyId,
          secretAccessKey: currentUser.awsSecretAccessKey,
        });
        setShowCyberModal(true);
        return;
      }

      if (currentUser && !currentUser.profileSetupCompleted) {
        navigate('/setup', { replace: true });
      } else {
        navigate(redirectPath, { replace: true });
      }
    }
  }, [
    authUser,
    isAuth0Authenticated,
    auth0User,
    navigate,
    isLoading,
    showCyberModal,
    redirectPath,
  ]);

  useEffect(() => {
    console.log('auth state check.', {
      authUser: !!authUser,
      auth0User: !!auth0User,
      isLoading,
      showCyberModal,
      awsCredentials: !!awsCredentials,
    });
  }, [authUser, auth0User, isLoading, showCyberModal, awsCredentials]);

  console.log('auth render state.', {
    showCyberModal,
    hasAwsCredentials: !!awsCredentials,
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(
      (prev) =>
        ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value,
        }) as AuthFormData
    );
    setError('');
  };

  const handleResetInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setResetData(
      (prev) =>
        ({
          ...prev,
          [name]: value,
        }) as ResetData
    );
    setError('');
  };

  const togglePasswordVisibility = (field: PasswordVisibilityField) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { confirmPassword: _confirmPassword, ...authData } = formData;
      const requestData: AuthRequestData = authData;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout - backend may be starting up')), 5000)
      );

      if (isLogin) {
        const loginResult = (await Promise.race([
          login(requestData),
          timeoutPromise,
        ])) as AuthResponse;
        console.log('login result.', loginResult);

        if (
          loginResult &&
          loginResult.user &&
          loginResult.user.awsAccessKeyId &&
          loginResult.user.awsSecretAccessKey &&
          !loginResult.user.hasViewedAwsCredentials
        ) {
          console.log('login: setting aws credentials for modal.');
          setAwsCredentials({
            accessKeyId: loginResult.user.awsAccessKeyId,
            secretAccessKey: loginResult.user.awsSecretAccessKey,
          });
          setShowCyberModal(true);
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        navigate(redirectPath, { replace: true });
      } else {
        const signupResult = (await Promise.race([
          signup(requestData),
          timeoutPromise,
        ])) as AuthResponse;
        console.log('signup result.', signupResult);

        if (signupResult && signupResult.awsCredentials) {
          console.log('signup: setting aws credentials for modal.');
          setAwsCredentials(signupResult.awsCredentials);
          setShowCyberModal(true);
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Authentication failed'));
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - please check your connection')), 10000)
      );

      const data = (await Promise.race([
        authAPI.forgotPassword(resetData.identifier),
        timeoutPromise,
      ])) as ForgotPasswordResponse;

      if (data.needsEmailVerification) {
        setResetData((prev) => ({
          ...prev,
          censoredEmail: data.censoredEmail || '',
          needsEmailVerification: true,
        }));
        setForgotPasswordStep('verify-email');
      } else {
        setForgotPasswordStep('verify-code');
        showToast('Reset code sent to your email address', 'success');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send reset code'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authAPI.verifyEmail(resetData.identifier, resetData.email);

      setForgotPasswordStep('verify-code');
      showToast('Reset code sent to your email address', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to verify email'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authAPI.verifyResetCode(resetData.identifier, resetData.code);

      setForgotPasswordStep('reset-password');
      showToast('Code verified successfully', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to verify reset code'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (resetData.newPassword !== resetData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      await authAPI.resetPassword(resetData.identifier, resetData.code, resetData.newPassword);

      setForgotPasswordStep(null);
      setResetData(initialResetData);
      setError('');
      showToast(
        'Password reset successful! You can now sign in with your new password.',
        'success',
        5000
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password'));
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
          response_type: 'code',
          code_challenge_method: 'S256',
          prompt: 'login',
        },
      });
    } catch {
      setError('Social login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setForgotPasswordStep(null);
    setResetData(initialResetData);
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
            src={theme === 'light' ? '/aws-logo-dark.svg' : '/aws-logo-light.svg'}
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
                <ArrowLeft size={16} aria-hidden="true" /> Back to Sign In
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
                We found an account with username <strong>{resetData.identifier}</strong>. Please
                enter the email address <strong>{resetData.censoredEmail}</strong> to verify your
                identity.
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
                <ArrowLeft size={16} aria-hidden="true" /> Back to Sign In
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
                  maxLength={6}
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
                <ArrowLeft size={16} aria-hidden="true" /> Back to Sign In
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
                minLength={8}
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
                minLength={8}
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
                <ArrowLeft size={16} aria-hidden="true" /> Back to Sign In
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
                  placeholder={isLogin ? 'Email or Username' : 'Email'}
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
                <label className="remember-me-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    className="remember-me-checkbox"
                  />
                  <span className="remember-me-text">Remember me</span>
                </label>
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
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        {!forgotPasswordStep && (
          <>
            <div className="auth-divider">Or continue with</div>

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
              <ArrowLeft size={16} aria-hidden="true" /> Back to Home
            </motion.button>
          </>
        )}

        {/* Debug Helper for Browser Data Issues - Temporary */}
        {error && error.includes('Load failed') && (
          <motion.div
            className="debug-helper"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(255, 165, 0, 0.1)',
              border: '1px solid rgba(255, 165, 0, 0.3)',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Having login issues? This might help clear corrupted browser data:
            </p>
            <motion.button
              onClick={forceLogoutAndClearData}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: '#ff6b35',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Clear All Browser Data & Reload
            </motion.button>
          </motion.div>
        )}
      </motion.div>

      <CyberChallengeModal
        isOpen={showCyberModal}
        onClose={() => {
          setShowCyberModal(false);
          markAwsCredentialsViewed().catch(console.error);
          navigate('/', { replace: true });
        }}
        awsCredentials={awsCredentials}
      />
    </div>
  );
}

export default Auth;
