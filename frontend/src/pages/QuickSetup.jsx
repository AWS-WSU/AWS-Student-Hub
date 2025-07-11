import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateImageFile, compressImage } from '../utils/imageUtils';
import './styles/QuickSetup.css';

const programmingLanguages = [
  'JavaScript', 'Python', 'Java', 'C++', 'C#', 'React', 'Node.js', 'PHP', 
  'Ruby', 'Go', 'Rust', 'TypeScript', 'Swift', 'Kotlin', 'HTML/CSS', 'SQL'
];

const grades = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'];

function QuickSetup({ theme }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('/account.svg');
  const [formData, setFormData] = useState({
    bio: '',
    major: '',
    grade: '',
    programmingLanguages: []
  });
  
  const { user, updateUser, uploadProfilePicture } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState('');
  


  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (user.profileSetupCompleted) {
      navigate('/', { replace: true });
      return;
    }

    setFormData({
      bio: user.bio || '',
      major: user.major || '',
      grade: user.grade || '',
      programmingLanguages: user.programmingLanguages || []
    });
    
    setProfileImagePreview(user.profilePicture || '/account.svg');
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLanguageToggle = (language) => {
    setFormData(prev => ({
      ...prev,
      programmingLanguages: prev.programmingLanguages.includes(language)
        ? prev.programmingLanguages.filter(lang => lang !== language)
        : [...prev.programmingLanguages, language]
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImageError('');
    
    // Validate file using utility
    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      setImageError(validation.error);
      return;
    }
    
    try {
      // Compress image for better performance
      const compressedBlob = await compressImage(file, 400, 0.9);
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      setProfileImage(compressedFile);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target.result);
      };
      reader.readAsDataURL(compressedFile);
      
    } catch (error) {
      console.error('Image compression error:', error);
      setImageError('Failed to process image. Please try a different image.');
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    navigate('/', { replace: true });
  };

  const handleComplete = async () => {
    setLoading(true);
    
    try {
      if (profileImage) {
        const response = await uploadProfilePicture(profileImage);
        if (response.profilePicture) {
          setProfileImagePreview(response.profilePicture);
        }
      }
      
      await updateUser({
        ...formData,
        profileSetupCompleted: true
      });

      showToast('Profile setup completed!', 'success');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Setup completion error:', error);
      showToast(error.message || 'Failed to complete setup', 'error');
    } finally {
      setLoading(false);
    }
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  const renderStep1 = () => (
    <motion.div
      key="step1"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="setup-step"
    >
      <div className="step-header">
        <h2>Welcome, {user?.fullName?.split(' ')[0] || 'there'}! 👋</h2>
        <p>Let's complete your profile to get the most out of AWS Club</p>
      </div>

      <div className="current-info">
        <h3>Your current information:</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Name:</span>
            <span className="value">{user?.fullName}</span>
          </div>
          <div className="info-item">
            <span className="label">Email:</span>
            <span className="value">{user?.email}</span>
          </div>
          <div className="info-item">
            <span className="label">Username:</span>
            <span className="value">@{user?.username}</span>
          </div>
        </div>
      </div>

      <div className="profile-picture-section">
        <h3>Profile Picture</h3>
        <div className="image-upload-container">
          <div className="image-preview">
            <img 
              src={profileImagePreview} 
              alt="Profile preview" 
              onError={(e) => {
                e.target.src = '/account.svg';
              }}
            />
          </div>
          <div className="upload-controls">
            <input
              type="file"
              id="profileImage"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <motion.label
              htmlFor="profileImage"
              className="upload-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Choose Photo
            </motion.label>
            <p className="upload-hint">Auto-compressed to under 1MB • Square images work best</p>
            {imageError && (
              <motion.div 
                className="image-error"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {imageError}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="setup-step"
    >
      <div className="step-header">
        <h2>Tell us about yourself 📚</h2>
        <p>This information will be shown on your public profile</p>
      </div>

      <div className="form-group">
        <label htmlFor="bio">Quick Bio</label>
        <textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleInputChange}
          placeholder="Tell us a bit about yourself, your interests in cloud computing, or what you're hoping to learn..."
          maxLength={500}
          rows={4}
        />
        <span className="char-count">{formData.bio.length}/500</span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="major">Major/Field of Study</label>
          <input
            type="text"
            id="major"
            name="major"
            value={formData.major}
            onChange={handleInputChange}
            placeholder="e.g., Computer Science, Business, etc."
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label htmlFor="grade">Academic Level</label>
          <select
            id="grade"
            name="grade"
            value={formData.grade}
            onChange={handleInputChange}
          >
            <option value="">Select your level</option>
            {grades.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      key="step3"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="setup-step"
    >
      <div className="step-header">
        <h2>Your Programming Skills 💻</h2>
        <p>Select the programming languages and technologies you're comfortable with</p>
      </div>

      <div className="languages-grid">
        {programmingLanguages.map(language => (
          <motion.button
            key={language}
            type="button"
            className={`language-chip ${formData.programmingLanguages.includes(language) ? 'selected' : ''}`}
            onClick={() => handleLanguageToggle(language)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {language}
          </motion.button>
        ))}
      </div>

      {formData.programmingLanguages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="selected-summary"
        >
          <p>Selected: {formData.programmingLanguages.join(', ')}</p>
        </motion.div>
      )}
    </motion.div>
  );

  if (!user) {
    return null;
  }

  return (
    <div className="quick-setup-container">
      <div className="setup-modal">
        <div className="setup-header">
          <div className="logo">
            <img 
              src={theme === 'light' ? "/aws-logo-dark.svg" : "/aws-logo-light.svg"} 
              alt="AWS Logo" 
            />
          </div>
          <div className="progress-bar">
            <div className="progress-steps">
              {[1, 2, 3].map(stepNum => (
                <div
                  key={stepNum}
                  className={`progress-step ${step >= stepNum ? 'completed' : ''} ${step === stepNum ? 'active' : ''}`}
                >
                  {stepNum}
                </div>
              ))}
            </div>
            <div className="progress-labels">
              <span>Welcome</span>
              <span>About You</span>
              <span>Skills</span>
            </div>
          </div>
        </div>

        <div className="setup-content">
          <AnimatePresence mode="wait">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </AnimatePresence>
        </div>

        <div className="setup-footer">
          <div className="footer-buttons">
            {step > 1 && (
              <motion.button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Back
              </motion.button>
            )}
            
            <motion.button
              type="button"
              className="btn-ghost"
              onClick={handleSkip}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Skip for now
            </motion.button>

            {step < 3 ? (
              <motion.button
                type="button"
                className="btn-primary"
                onClick={handleNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next
              </motion.button>
            ) : (
              <motion.button
                type="button"
                className="btn-primary"
                onClick={handleComplete}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? 'Completing...' : 'Complete Setup'}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickSetup; 