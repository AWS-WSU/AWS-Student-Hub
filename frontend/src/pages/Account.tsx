import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuth } from '../context/AuthContext';
import './styles/Account.css';
import { validateImageFile, compressImage } from '../utils/imageUtils';
import { Copy, Lock, Shield, Target, X } from 'lucide-react';
import CyberChallengeModal from '../components/CyberChallengeModal';
import type { AwsCredentials } from '../types/auth';
import type { User } from '../types/user';
import type { Theme } from '../types/ui';

interface AccountProps {
  theme?: Theme;
}

interface AccountUser extends Partial<User> {
  name?: string;
  picture?: string;
  [key: string]: any;
}

interface AccountFormData {
  name: string;
  username: string;
  email: string;
  wantsEmails: boolean;
  bio: string;
  major: string;
  grade: string;
  programmingLanguages: string[];
}

type AccountField = keyof AccountFormData;
type AccountTextField = 'name' | 'username' | 'email' | 'major';
type AccountInputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type EditingState = Partial<Record<AccountField, boolean>>;
type FieldLoadingState = Partial<Record<AccountField, boolean>>;

const getStoredItem = (key: string): string | null =>
  localStorage.getItem(key) || sessionStorage.getItem(key);

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const programmingLanguages: string[] = [
  'JavaScript',
  'Python',
  'Java',
  'C++',
  'C#',
  'React',
  'Node.js',
  'PHP',
  'Ruby',
  'Go',
  'Rust',
  'TypeScript',
  'Swift',
  'Kotlin',
  'HTML/CSS',
  'SQL',
];

const languageIcons: Record<string, string> = {
  JavaScript: '/js.svg',
  Python: '/py.svg',
  Java: '/java.svg',
  'C++': '/cpp.svg',
  'C#': '/csharp.svg',
  React: '/jsx.svg',
  'Node.js': '/js.svg',
  PHP: '/php.svg',
  TypeScript: '/ts.svg',
  Swift: '/swift.svg',
  Kotlin: '/kotlin.svg',
  Ruby: '/ruby.svg',
  Go: '/go.svg',
  Rust: '/rs.svg',
  'HTML/CSS': '/html.svg',
  SQL: '/sql.svg',
};

const grades = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'];

function Account({ theme: _theme }: AccountProps) {
  const [profileImage, setProfileImage] = useState<string>('/avatar.jpg');
  const [isEditing, setIsEditing] = useState<EditingState>({
    name: false,
    username: false,
    bio: false,
    major: false,
    grade: false,
    programmingLanguages: false,
  });
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    username: '',
    email: '',
    wantsEmails: false,
    bio: '',
    major: '',
    grade: '',
    programmingLanguages: [],
  });
  const [originalData, setOriginalData] = useState<AccountFormData>({
    name: '',
    username: '',
    email: '',
    wantsEmails: false,
    bio: '',
    major: '',
    grade: '',
    programmingLanguages: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [fieldLoading, setFieldLoading] = useState<FieldLoadingState>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [successField, setSuccessField] = useState<AccountField | ''>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [awsCredentials, setAwsCredentials] = useState<AwsCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState<boolean>(false);
  const [credentialsPassword, setCredentialsPassword] = useState<string>('');
  const [isLoadingCredentials, setIsLoadingCredentials] = useState<boolean>(false);
  const [showCyberModal, setShowCyberModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRefs = useRef<Partial<Record<AccountField, AccountInputElement | null>>>({});

  const navigate = useNavigate();
  const { isAuthenticated: isAuth0Authenticated, user: auth0User } = useAuth0();
  const { user: authUser, updateUser, uploadProfilePicture, getAwsCredentials } = useAuth();

  const isAuthenticated = isAuth0Authenticated || !!authUser;
  const currentUser = (auth0User || authUser) as AccountUser | undefined;
  const isSocialLogin = !!auth0User;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    if (currentUser) {
      const userData = {
        name: currentUser.name || currentUser.fullName || '',
        username: currentUser.username || '',
        email: currentUser.email || '',
        wantsEmails: currentUser.wantsEmails || false,
        bio: currentUser.bio || '',
        major: currentUser.major || '',
        grade: currentUser.grade || '',
        programmingLanguages: currentUser.programmingLanguages || [],
      };
      setFormData(userData);
      setOriginalData(userData);
      setProfileImage(currentUser.picture || currentUser.profilePicture || '/avatar.jpg');
    }
  }, [isAuthenticated, currentUser, navigate]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const nextValue =
      e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
        ? e.target.checked
        : value;

    setFormData(
      (prev) =>
        ({
          ...prev,
          [name]: nextValue,
        }) as AccountFormData
    );
    setError('');
  };

  const handleLanguageToggle = (language: string) => {
    setFormData((prev) => ({
      ...prev,
      programmingLanguages: prev.programmingLanguages.includes(language)
        ? prev.programmingLanguages.filter((lang) => lang !== language)
        : [...prev.programmingLanguages, language],
    }));
    setError('');
  };

  const handleCancel = (field: AccountField) => {
    setFormData(
      (prev) =>
        ({
          ...prev,
          [field]: originalData[field],
        }) as AccountFormData
    );
    setIsEditing((prev) => ({
      ...prev,
      [field]: false,
    }));
    setError('');
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleProfilePictureUpload(file);
    }
  };

  const handleProfilePictureUpload = async (file: File) => {
    if (!file) return;

    // Validate file using utility
    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      setError(validation.error || 'Please select a valid image file');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Compress image for better upload performance
      const compressedFile = await compressImage(file, 400, 0.9);
      const finalFile = new File([compressedFile || file], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      const response = await uploadProfilePicture(finalFile);
      setProfileImage(String(response.profilePicture || '/avatar.jpg'));
      setSuccess('Profile picture updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload profile picture'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFieldClick = (field: AccountField) => {
    if (isSocialLogin && (field === 'name' || field === 'username')) return;

    setIsEditing((prev) => ({
      ...prev,
      [field]: true,
    }));

    // Not sure why but sometimes the input doesn't focus immediately
    // So we use a timeout to ensure it does. This also
    // Stops the text from being selected when clicking the field.
    setTimeout(() => {
      inputRefs.current[field]?.focus();
    }, 100);
  };

  const handleInputBlur = async (field: AccountField) => {
    if (formData[field] !== originalData[field]) {
      await handleSave(field);
    } else {
      setIsEditing((prev) => ({
        ...prev,
        [field]: false,
      }));
    }
  };

  const handleInputKeyDown = async (e: KeyboardEvent<AccountInputElement>, field: AccountField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (formData[field] !== originalData[field]) {
        await handleSave(field);
      } else {
        setIsEditing((prev) => ({
          ...prev,
          [field]: false,
        }));
      }
    } else if (e.key === 'Escape') {
      setFormData(
        (prev) =>
          ({
            ...prev,
            [field]: originalData[field],
          }) as AccountFormData
      );
      setIsEditing((prev) => ({
        ...prev,
        [field]: false,
      }));
      setError('');
    }
  };

  const handleSave = async (field: AccountField) => {
    setFieldLoading((prev) => ({ ...prev, [field]: true }));
    setError('');
    setSuccess('');

    try {
      if (field === 'username') {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://bx7226tmz2.execute-api.us-east-1.amazonaws.com/prod'}/auth/check-username`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getStoredItem('accessToken')}`,
            },
            body: JSON.stringify({ username: formData.username }),
          }
        );

        const data = (await response.json()) as { available?: boolean; message?: string };
        if (!response.ok) {
          throw new Error(data.message || 'Username validation failed');
        }

        if (!data.available) {
          throw new Error('Username is already taken');
        }
      }

      const updateData: Record<string, any> = {};
      if (field === 'name') {
        updateData.fullName = formData.name;
      } else if (field === 'username') {
        updateData.username = formData.username;
      } else if (field === 'bio') {
        updateData.bio = formData.bio;
      } else if (field === 'major') {
        updateData.major = formData.major;
      } else if (field === 'grade') {
        updateData.grade = formData.grade;
      } else if (field === 'programmingLanguages') {
        updateData.programmingLanguages = formData.programmingLanguages;
      }

      await updateUser(updateData);

      setOriginalData(
        (prev) =>
          ({
            ...prev,
            [field]: formData[field],
          }) as AccountFormData
      );

      setIsEditing((prev) => ({
        ...prev,
        [field]: false,
      }));

      setSuccessField(field);
      setTimeout(() => setSuccessField(''), 600);
    } catch (err) {
      setError(getErrorMessage(err, `Failed to update ${field}`));
      setFormData(
        (prev) =>
          ({
            ...prev,
            [field]: originalData[field],
          }) as AccountFormData
      );
      setIsEditing((prev) => ({
        ...prev,
        [field]: false,
      }));
    } finally {
      setFieldLoading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleEmailToggle = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const newValue = !formData.wantsEmails;
      setFormData((prev) => ({ ...prev, wantsEmails: newValue }));

      await updateUser({ wantsEmails: newValue });

      setOriginalData((prev) => ({ ...prev, wantsEmails: newValue }));
      setSuccess(`Email notifications ${newValue ? 'enabled' : 'disabled'}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setFormData((prev) => ({ ...prev, wantsEmails: !prev.wantsEmails }));
      setError('Failed to update email preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleRevealCredentials = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!credentialsPassword) {
      setError('Password is required');
      return;
    }

    setIsLoadingCredentials(true);
    setError('');

    try {
      const credentials = await getAwsCredentials(credentialsPassword);
      setAwsCredentials(credentials);
      setCredentialsPassword('');
      setShowCredentialsModal(false);

      setSuccess('AWS credentials revealed successfully!');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to retrieve AWS credentials'));
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  const handleShowCyberModal = () => {
    if (currentUser?.awsAccessKeyId && currentUser?.awsSecretAccessKey) {
      setShowCyberModal(true);
    } else {
      setError('No AWS credentials found for your account');
    }
  };

  const renderEditableField = (
    field: AccountTextField,
    label: string,
    value: string,
    placeholder: string,
    readonly = false
  ) => {
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
              ref={(el) => {
                inputRefs.current[field] = el;
              }}
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

          <div
            className={`edit-hint ${readonly || isCurrentlyEditing || isFieldLoading ? 'hidden' : ''}`}
          >
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
      <div className="account-content">
        <div className="account-header">
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
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/avatar.jpg';
                    setProfileImage('/avatar.jpg');
                  }}
                  referrerPolicy="no-referrer"
                  key={profileImage}
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
                      {isUploading ? (
                        '...'
                      ) : (
                        <img src="/upload-icon.svg" alt="Upload" height="24px" width="24px" />
                      )}
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

              {renderEditableField('email', 'Email Address', formData.email, '', true)}
            </div>
          </motion.section>

          <motion.section
            className="profile-details-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2>Profile Details</h2>

            <div className="form-fields">
              <div className="form-field">
                <label>Bio</label>
                <div
                  className={`field-container textarea-container ${isEditing.bio ? 'editing' : ''}`}
                  onClick={() => handleFieldClick('bio')}
                >
                  {successField === 'bio' && <div className="success-flash" />}

                  <div className="display-container">
                    <span className={`field-value editable ${isEditing.bio ? 'editing' : ''}`}>
                      {formData.bio || 'Tell us about yourself...'}
                    </span>
                  </div>

                  <div className={`edit-overlay ${isEditing.bio ? 'active' : ''}`}>
                    <textarea
                      ref={(el) => {
                        inputRefs.current.bio = el;
                      }}
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      onBlur={() => handleInputBlur('bio')}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          handleInputKeyDown(e, 'bio');
                        }
                      }}
                      className="edit-input edit-textarea"
                      placeholder="Tell us about yourself..."
                      maxLength={500}
                      rows={4}
                    />
                    <div className="character-count">{formData.bio.length}/500</div>
                  </div>

                  <div className={`edit-hint ${isEditing.bio || fieldLoading.bio ? 'hidden' : ''}`}>
                    {fieldLoading.bio ? (
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

              {renderEditableField(
                'major',
                'Major/Field of Study',
                formData.major,
                'e.g. Computer Science, Engineering, Business'
              )}

              <div className="form-field">
                <label>Academic Level</label>
                <div
                  className={`field-container ${isEditing.grade ? 'editing' : ''}`}
                  onClick={() => handleFieldClick('grade')}
                >
                  {successField === 'grade' && <div className="success-flash" />}

                  <div className="display-container">
                    <span className={`field-value editable ${isEditing.grade ? 'editing' : ''}`}>
                      {formData.grade || 'Select your academic level'}
                    </span>
                  </div>

                  <div className={`edit-overlay ${isEditing.grade ? 'active' : ''}`}>
                    <select
                      ref={(el) => {
                        inputRefs.current.grade = el;
                      }}
                      name="grade"
                      value={formData.grade}
                      onChange={handleInputChange}
                      onBlur={() => handleInputBlur('grade')}
                      onKeyDown={(e) => handleInputKeyDown(e, 'grade')}
                      className="edit-input edit-select"
                    >
                      <option value="">Select your academic level</option>
                      {grades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`edit-hint ${isEditing.grade || fieldLoading.grade ? 'hidden' : ''}`}
                  >
                    {fieldLoading.grade ? (
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

              <div className="form-field">
                <label>Programming Languages & Technologies</label>
                <div
                  className={`field-container languages-container ${isEditing.programmingLanguages ? 'editing' : ''}`}
                  onClick={() => handleFieldClick('programmingLanguages')}
                >
                  {successField === 'programmingLanguages' && <div className="success-flash" />}

                  <div className="display-container">
                    <div className="languages-display">
                      {formData.programmingLanguages.length > 0 ? (
                        formData.programmingLanguages.map((lang) => (
                          <span key={lang} className="language-tag">
                            {languageIcons[lang] && (
                              <img
                                src={languageIcons[lang]}
                                alt={lang}
                                className="language-tag-icon"
                              />
                            )}
                            {lang}
                          </span>
                        ))
                      ) : (
                        <span className="field-value editable">
                          Select your programming languages...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`edit-overlay ${isEditing.programmingLanguages ? 'active' : ''}`}>
                    <div className="languages-modal">
                      <button
                        type="button"
                        className="languages-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel('programmingLanguages');
                        }}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                      <h3>Select Programming Languages & Technologies</h3>
                      <div className="languages-grid">
                        {programmingLanguages.map((language) => (
                          <button
                            key={language}
                            type="button"
                            className={`language-option ${formData.programmingLanguages.includes(language) ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLanguageToggle(language);
                            }}
                          >
                            {languageIcons[language] && (
                              <img
                                src={languageIcons[language]}
                                alt={language}
                                className="language-icon"
                              />
                            )}
                            <span className="language-name">{language}</span>
                          </button>
                        ))}
                      </div>
                      <div className="languages-actions">
                        <button
                          type="button"
                          className="save-languages-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInputBlur('programmingLanguages');
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          className="cancel-languages-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel('programmingLanguages');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`edit-hint ${isEditing.programmingLanguages || fieldLoading.programmingLanguages ? 'hidden' : ''}`}
                  >
                    {fieldLoading.programmingLanguages ? (
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
            </div>
          </motion.section>

          <motion.section
            className="cyber-challenge-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2>
              <Lock size={28} aria-hidden="true" /> Cyber Challenge #5 Info
            </h2>

            <div className="challenge-card">
              <div className="challenge-header">
                <div className="challenge-icon">
                  <Shield size={30} aria-hidden="true" />
                </div>
                <div className="challenge-title">
                  <h3>AWS Cloud Security Challenge</h3>
                  <p>Access your personalized AWS environment</p>
                </div>
              </div>

              <div className="challenge-info">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">S3 Bucket:</span>
                    <code>wayne-aws-club-secrets</code>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Your Secret File:</span>
                    <code>secrets/{currentUser?.username}.txt</code>
                  </div>
                  <div className="info-item">
                    <span className="info-label">AWS Region:</span>
                    <code>us-east-1</code>
                  </div>
                  <div className="info-item">
                    <span className="info-label">IAM User:</span>
                    <code>club_{currentUser?.username}</code>
                  </div>
                </div>
              </div>

              {currentUser?.awsAccessKeyId ? (
                <div className="credentials-section">
                  {!awsCredentials ? (
                    <>
                      <motion.button
                        className="reveal-credentials-btn"
                        onClick={() => setShowCredentialsModal(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Lock size={16} aria-hidden="true" /> Reveal AWS Credentials
                      </motion.button>

                      <motion.button
                        className="show-modal-btn"
                        onClick={handleShowCyberModal}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ marginLeft: '1rem' }}
                      >
                        <Target size={16} /> Show Challenge Modal
                      </motion.button>
                    </>
                  ) : (
                    <div className="credentials-display">
                      <h4>Your AWS Credentials</h4>
                      <div className="credential-row">
                        <label>Access Key ID:</label>
                        <div className="credential-value">
                          <code>{awsCredentials.accessKeyId}</code>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(awsCredentials.accessKeyId)
                            }
                            className="copy-btn"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="credential-row">
                        <label>Secret Access Key:</label>
                        <div className="credential-value">
                          <code>{awsCredentials.secretAccessKey}</code>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(awsCredentials.secretAccessKey)
                            }
                            className="copy-btn"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                          className="hide-credentials-btn"
                          onClick={() => setAwsCredentials(null)}
                        >
                          Hide Credentials
                        </button>
                        <motion.button
                          className="show-modal-btn"
                          onClick={handleShowCyberModal}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Target size={16} /> Show Challenge Modal
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-credentials-message">
                  <p>AWS credentials not available for this account.</p>
                </div>
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

      {showCredentialsModal && (
        <div className="modal-overlay" onClick={() => setShowCredentialsModal(false)}>
          <div className="credentials-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Enter Your Password</h3>
            <p>Please enter your account password to reveal your AWS credentials.</p>
            <form onSubmit={handleRevealCredentials}>
              <input
                type="password"
                value={credentialsPassword}
                onChange={(e) => setCredentialsPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoFocus
              />
              <div className="modal-actions">
                <button type="submit" disabled={isLoadingCredentials}>
                  {isLoadingCredentials ? 'Verifying...' : 'Reveal Credentials'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCredentialsModal(false);
                    setCredentialsPassword('');
                    setError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CyberChallengeModal
        isOpen={showCyberModal}
        onClose={() => setShowCyberModal(false)}
        awsCredentials={
          currentUser?.awsAccessKeyId && currentUser?.awsSecretAccessKey
            ? {
                accessKeyId: currentUser.awsAccessKeyId,
                secretAccessKey: currentUser.awsSecretAccessKey,
              }
            : null
        }
      />
    </div>
  );
}

export default Account;
