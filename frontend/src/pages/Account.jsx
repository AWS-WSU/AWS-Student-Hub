import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './styles/Account.css';

function Account({ theme, toggleTheme }) {
  const [activeSection, setActiveSection] = useState('profile');
  const [profileImage, setProfileImage] = useState('/account.svg');
  const [isEditing, setIsEditing] = useState({
    name: false,
    username: false
  });
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    wantsEmails: false
  });
  const [originalData, setOriginalData] = useState({});
  const [loading, setLoading] = useState(false);
  const [fieldLoading, setFieldLoading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successField, setSuccessField] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const inputRefs = useRef({});
  
  const navigate = useNavigate();
  const { logout: auth0Logout, isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();
  const { user: authUser, logout: authLogout, updateUser, uploadProfilePicture } = useAuth();

  const isAuthenticated = isAuth0Authenticated || !!authUser;
  const currentUser = auth0User || authUser;
  const isSocialLogin = !!auth0User;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Set user data
    if (currentUser) {
      const userData = {
        name: currentUser.name || currentUser.fullName || '',
        username: currentUser.username || '',
        email: currentUser.email || '',
        wantsEmails: currentUser.wantsEmails || false
      };
      setFormData(userData);
      setOriginalData(userData);
      setProfileImage(currentUser.picture || currentUser.profilePicture || '/account.svg');
    }
  }, [isAuthenticated, currentUser, navigate]);

  const scrollToSection = (sectionId) => {
    // Navigate to home page with section anchor
    navigate(`/#${sectionId}`);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleEdit = (field) => {
    setIsEditing(prev => ({
      ...prev,
      [field]: true
    }));
  };

  const handleCancel = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: originalData[field]
    }));
    setIsEditing(prev => ({
      ...prev,
      [field]: false
    }));
    setError('');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleProfilePictureUpload(file);
    }
  };

  const handleProfilePictureUpload = async (file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPG, PNG, or WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const response = await uploadProfilePicture(file);
      setProfileImage(response.profilePicture);
      setSuccess('Profile picture updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFieldClick = (field) => {
    if (isSocialLogin && (field === 'name' || field === 'username')) return;
    
    setIsEditing(prev => ({
      ...prev,
      [field]: true
    }));
    
    // Not sure why but sometimes the input doesn't focus immediately
    // So we use a timeout to ensure it does. This also 
    // Stops the text from being selected when clicking the field.
    setTimeout(() => {
      if (inputRefs.current[field]) {
        inputRefs.current[field].focus();
      }
    }, 100);
  };

  const handleInputBlur = async (field) => {
    if (formData[field] !== originalData[field]) {
      await handleSave(field);
    } else {
      setIsEditing(prev => ({
        ...prev,
        [field]: false
      }));
    }
  };

  const handleInputKeyDown = async (e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (formData[field] !== originalData[field]) {
        await handleSave(field);
      } else {
        setIsEditing(prev => ({
          ...prev,
          [field]: false
        }));
      }
    } else if (e.key === 'Escape') {
      setFormData(prev => ({
        ...prev,
        [field]: originalData[field]
      }));
      setIsEditing(prev => ({
        ...prev,
        [field]: false
      }));
      setError('');
    }
  };

  const handleSave = async (field) => {
    setFieldLoading(prev => ({ ...prev, [field]: true }));
    setError('');
    setSuccess('');

    try {
      if (field === 'username') {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/auth/check-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ username: formData.username })
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Username validation failed');
        }
        
        if (!data.available) {
          throw new Error('Username is already taken');
        }
      }
      
      const updateData = {};
      if (field === 'name') {
        updateData.fullName = formData.name;
      } else if (field === 'username') {
        updateData.username = formData.username;
      }
      
      await updateUser(updateData);
      
      setOriginalData(prev => ({
        ...prev,
        [field]: formData[field]
      }));
      
      setIsEditing(prev => ({
        ...prev,
        [field]: false
      }));
      
      // Show success flash
      setSuccessField(field);
      setTimeout(() => setSuccessField(''), 600);
      
    } catch (err) {
      setError(err.message || `Failed to update ${field}`);
      setFormData(prev => ({
        ...prev,
        [field]: originalData[field]
      }));
      setIsEditing(prev => ({
        ...prev,
        [field]: false
      }));
    } finally {
      setFieldLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleEmailToggle = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const newValue = !formData.wantsEmails;
      setFormData(prev => ({ ...prev, wantsEmails: newValue }));
      
      await updateUser({ wantsEmails: newValue });
      
      setOriginalData(prev => ({ ...prev, wantsEmails: newValue }));
      setSuccess(`Email notifications ${newValue ? 'enabled' : 'disabled'}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setFormData(prev => ({ ...prev, wantsEmails: !prev.wantsEmails }));
      setError('Failed to update email preferences');
    } finally {
      setLoading(false);
    }
  };

  const renderEditableField = (field, label, value, placeholder, readonly = false) => {
    const isCurrentlyEditing = isEditing[field];
    const isFieldLoading = fieldLoading[field];
    const showSuccessFlash = successField === field;
    
    return (
      <div className="form-field">
        <label>{label}</label>
        <div 
          className={`field-container ${isCurrentlyEditing ? 'editing' : ''} ${readonly ? 'readonly' : ''}`}
          onClick={() => !readonly && handleFieldClick(field)}
        >
          {showSuccessFlash && <div className="success-flash" />}
          
          <div className="display-container">
            <span 
              className={`field-value ${!readonly ? 'editable' : ''} ${isCurrentlyEditing ? 'editing' : ''} ${field === 'email' ? 'email-readonly' : ''}`}
            >
              {field === 'username' && value ? `@${value}` : value || 'Not set'}
            </span>
            {readonly && <span className="readonly-indicator">Read-only</span>}
          </div>

          <div className={`edit-overlay ${isCurrentlyEditing ? 'active' : ''}`}>
            <input
              ref={el => inputRefs.current[field] = el}
              type="text"
              name={field}
              value={formData[field]}
              onChange={handleInputChange}
              onBlur={() => handleInputBlur(field)}
              onKeyDown={(e) => handleInputKeyDown(e, field)}
              className="edit-input"
              placeholder={placeholder}
            />
          </div>

          <div className={`edit-hint ${readonly || isCurrentlyEditing || isFieldLoading ? 'hidden' : ''}`}>
            {isFieldLoading ? (
              <div className="loading-indicator">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            ) : (
              'Click to edit'
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="account-container">
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        activeSection={activeSection} 
        scrollToSection={scrollToSection}
      />
      
      <div className="account-content">
        <div className="account-header">
          <motion.button 
            className="back-button"
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ← Back to Home
          </motion.button>
          
          <motion.div 
            className="account-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1>Account Settings</h1>
            <p>Manage your profile and preferences</p>
          </motion.div>
        </div>

        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            className="success-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {success}
          </motion.div>
        )}

        <div className="account-sections">
          <motion.section 
            className="profile-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2>Profile Information</h2>
            
            <div className="profile-picture-section">
              <div className="profile-picture-container">
                <img 
                  src={profileImage}
                  alt="Profile"
                  className="profile-picture"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/account.svg';
                    setProfileImage('/account.svg');
                  }}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
                {!isSocialLogin && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="upload-button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? '...' : <img src='/upload-icon.svg' alt='Upload' height="24px" width="24px"/>}
                    </button>
                  </>
                )}
                {isSocialLogin && (
                  <div className="social-indicator">
                    <span>Managed by Google</span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-fields">
              {renderEditableField(
                'name', 
                'Full Name', 
                formData.name, 
                'Enter your full name',
                isSocialLogin
              )}

              {renderEditableField(
                'username', 
                'Username', 
                formData.username, 
                'Enter your username'
              )}

              {renderEditableField(
                'email', 
                'Email Address', 
                formData.email, 
                '',
                true
              )}
            </div>
          </motion.section>

          <motion.section 
            className="preferences-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2>Preferences</h2>
            
            <div className="preference-item">
              <div className="preference-info">
                <h3>Email Communications</h3>
                <p>Receive updates about events, resources, and club news</p>
              </div>
              <div className="toggle-container">
                <motion.button
                  className={`toggle-switch ${formData.wantsEmails ? 'active' : ''}`}
                  onClick={handleEmailToggle}
                  disabled={loading}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div 
                    className="toggle-slider"
                    animate={{ x: formData.wantsEmails ? 24 : 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </motion.button>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      <Footer theme={theme} />
    </div>
  );
}

export default Account;
