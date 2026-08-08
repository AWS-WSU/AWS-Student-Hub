import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './styles/Account.css';
import { validateImageFile, compressImage } from '../utils/imageUtils';
import { Copy, Link2, Lock, RefreshCw, Shield, Target, Unlink, X } from 'lucide-react';
import CyberChallengeModal from '../components/CyberChallengeModal';
import { rewardIntegrationAPI } from '../utils/api';
import type { AwsCredentials } from '../types/auth';
import type { RewardIntegrationStatusResponse } from '../types/rewardIntegration';
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
  const [prizeversityStatus, setPrizeversityStatus] =
    useState<RewardIntegrationStatusResponse | null>(null);
  const [prizeversityIdentifier, setPrizeversityIdentifier] = useState<string>('');
  const [selectedRewardInstanceId, setSelectedRewardInstanceId] = useState<string>('');
  const [isPrizeversityLoading, setIsPrizeversityLoading] = useState<boolean>(false);
  const [prizeversityLinkError, setPrizeversityLinkError] = useState<string>('');
  const [prizeversityVerification, setPrizeversityVerification] = useState<{
    maskedEmail: string;
    expiresAt?: string;
  } | null>(null);
  const [prizeversityVerificationCode, setPrizeversityVerificationCode] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRefs = useRef<Partial<Record<AccountField, AccountInputElement | null>>>({});

  const navigate = useNavigate();
  const {
    user: authUser,
    updateUser,
    uploadProfilePicture,
    getAwsCredentials,
    refreshTokens,
  } = useAuth();

  const isAuthenticated = !!authUser;
  const currentUser = authUser as AccountUser | undefined;
  const isSocialLogin = Boolean(authUser?.auth0Id);
  const isPrizeversityLinked = Boolean(prizeversityStatus?.linked && prizeversityStatus.account);
  const isPrizeversityGateLoading = isPrizeversityLoading && !prizeversityStatus;

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

  useEffect(() => {
    if (!isAuthenticated || !getStoredItem('accessToken')) {
      return;
    }

    let shouldUpdate = true;
    setIsPrizeversityLoading(true);

    rewardIntegrationAPI
      .status()
      .then((status) => {
        if (shouldUpdate) {
          setPrizeversityStatus(status);
          setPrizeversityIdentifier(status.account?.email || currentUser?.email || '');
          setSelectedRewardInstanceId(
            status.account?.instanceId || status.instances?.[0]?.id || ''
          );
        }
      })
      .catch((err) => {
        if (shouldUpdate) {
          setError(getErrorMessage(err, 'Failed to load Prizeversity status'));
        }
      })
      .finally(() => {
        if (shouldUpdate) {
          setIsPrizeversityLoading(false);
        }
      });

    return () => {
      shouldUpdate = false;
    };
  }, [isAuthenticated, currentUser?.email]);

  // Scroll to top when component mounts
  useEffect(() => {
    if (window.location.hash === '#prizeversity-rewards') {
      setTimeout(() => {
        document.getElementById('prizeversity-rewards')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
      return;
    }

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

  const focusPrizeversityLinking = () => {
    document.getElementById('prizeversity-rewards')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setError('Link your Prizeversity account before starting AWS challenges.');
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
    if (!isPrizeversityLinked) {
      setShowCredentialsModal(false);
      focusPrizeversityLinking();
      return;
    }

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
    if (!isPrizeversityLinked) {
      focusPrizeversityLinking();
      return;
    }

    if (awsCredentials || (currentUser?.awsAccessKeyId && currentUser?.awsSecretAccessKey)) {
      setShowCyberModal(true);
    } else {
      setError('Reveal your AWS credentials before opening the challenge instructions.');
    }
  };

  const handlePrizeversityLink = async () => {
    setIsPrizeversityLoading(true);
    setPrizeversityLinkError('');
    setError('');
    setSuccess('');

    try {
      const response = await rewardIntegrationAPI.link(
        prizeversityIdentifier,
        selectedRewardInstanceId
      );
      if (response.verificationRequired && response.maskedEmail) {
        setPrizeversityVerification({
          maskedEmail: response.maskedEmail,
          expiresAt: response.expiresAt,
        });
        setPrizeversityVerificationCode('');
      }
      setSuccess(response.message);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to link Prizeversity account');
      setPrizeversityLinkError(message);
      setError(message);
    } finally {
      setIsPrizeversityLoading(false);
    }
  };

  const handlePrizeversityVerify = async () => {
    setIsPrizeversityLoading(true);
    setPrizeversityLinkError('');
    setError('');
    setSuccess('');

    try {
      const response = await rewardIntegrationAPI.verifyLink(prizeversityVerificationCode);
      setPrizeversityStatus(response.status);
      setPrizeversityIdentifier(response.status.account?.email || prizeversityIdentifier);
      setSelectedRewardInstanceId(
        response.status.account?.instanceId || response.status.instances?.[0]?.id || ''
      );
      setPrizeversityVerification(null);
      setPrizeversityVerificationCode('');
      await refreshTokens();
      setSuccess(response.message);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to verify Prizeversity link code');
      setPrizeversityLinkError(message);
      setError(message);
    } finally {
      setIsPrizeversityLoading(false);
    }
  };

  const handlePrizeversityUnlink = async () => {
    setIsPrizeversityLoading(true);
    setPrizeversityLinkError('');
    setPrizeversityVerification(null);
    setPrizeversityVerificationCode('');
    setError('');
    setSuccess('');

    try {
      const response = await rewardIntegrationAPI.unlink();
      setPrizeversityStatus(response.status);
      setPrizeversityIdentifier(currentUser?.email || '');
      setSelectedRewardInstanceId(response.status.instances?.[0]?.id || '');
      await refreshTokens();
      setSuccess(response.message);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unlink Prizeversity account'));
    } finally {
      setIsPrizeversityLoading(false);
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

  const isPrizeversityEmailDeliveryError = prizeversityLinkError
    .toLowerCase()
    .includes('verification email');

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
            id="prizeversity-rewards"
            className="prizeversity-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2 className="account-challenge-heading">
              <Link2 size={26} aria-hidden="true" /> Prizeversity Rewards
            </h2>

            <div className="prizeversity-card">
              <div className="prizeversity-header">
                <div className="prizeversity-icon">
                  <Shield size={28} aria-hidden="true" />
                </div>
                <div className="prizeversity-title">
                  <span>{prizeversityStatus?.linked ? 'Connected' : 'Account sync'}</span>
                  <h3>Link your Prizeversity account</h3>
                  <p>
                    Challenge completions in AWS Student Hub will use this linked Prizeversity
                    classroom account for rewards and progression.
                  </p>
                </div>
              </div>

              {!getStoredItem('accessToken') ? (
                <div className="prizeversity-notice">
                  Prizeversity linking requires an AWS Student Hub account session.
                </div>
              ) : prizeversityStatus && !prizeversityStatus.configured ? (
                <div className="prizeversity-notice">
                  Prizeversity integration is not configured yet. An admin needs to set the backend
                  Prizeversity API URL, API key, and classroom ID.
                </div>
              ) : (
                <>
                  {prizeversityStatus?.linked && prizeversityStatus.account ? (
                    <div className="prizeversity-linked-panel">
                      <div className="prizeversity-linked-grid">
                        <div>
                          <span>Matched account</span>
                          <strong>
                            {prizeversityStatus.account.matchedName ||
                              prizeversityStatus.account.email ||
                              'Prizeversity user'}
                          </strong>
                        </div>
                        <div>
                          <span>Email</span>
                          <strong>{prizeversityStatus.account.email || 'Not provided'}</strong>
                        </div>
                        <div>
                          <span>Short ID</span>
                          <strong>{prizeversityStatus.account.shortId || 'Not provided'}</strong>
                        </div>
                        <div>
                          <span>Last synced</span>
                          <strong>
                            {prizeversityStatus.account.lastSyncedAt
                              ? new Date(
                                  prizeversityStatus.account.lastSyncedAt
                                ).toLocaleDateString()
                              : 'Just now'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="prizeversity-notice">
                      Use the email, full name, or short ID from your Prizeversity classroom. If
                      left blank, we will try your AWS Student Hub email first.
                    </div>
                  )}

                  <div className="prizeversity-link-form">
                    {prizeversityStatus?.instances && prizeversityStatus.instances.length > 1 && (
                      <>
                        <label htmlFor="prizeversity-instance">Reward classroom</label>
                        <select
                          id="prizeversity-instance"
                          value={selectedRewardInstanceId}
                          onChange={(event) => setSelectedRewardInstanceId(event.target.value)}
                          disabled={isPrizeversityLoading}
                          className="prizeversity-instance-select"
                        >
                          {prizeversityStatus.instances.map((instance) => (
                            <option key={instance.id} value={instance.id}>
                              {instance.name}
                              {instance.classroomName ? ` - ${instance.classroomName}` : ''}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    <label htmlFor="prizeversity-identifier">Prizeversity identifier</label>
                    <div className="prizeversity-input-row">
                      <input
                        id="prizeversity-identifier"
                        type="text"
                        value={prizeversityIdentifier}
                        onChange={(event) => {
                          setPrizeversityIdentifier(event.target.value);
                          setPrizeversityLinkError('');
                          setPrizeversityVerification(null);
                          setPrizeversityVerificationCode('');
                        }}
                        placeholder={currentUser?.email || 'email@example.com'}
                        disabled={isPrizeversityLoading}
                      />
                      <button
                        type="button"
                        className="show-modal-btn"
                        onClick={handlePrizeversityLink}
                        disabled={isPrizeversityLoading}
                      >
                        {isPrizeversityLoading ? (
                          <>
                            <RefreshCw size={16} aria-hidden="true" /> Syncing
                          </>
                        ) : (
                          <>
                            <RefreshCw size={16} aria-hidden="true" />
                            {prizeversityVerification
                              ? 'Resend code'
                              : prizeversityStatus?.linked
                                ? 'Re-sync'
                                : 'Send code'}
                          </>
                        )}
                      </button>
                    </div>
                    {prizeversityVerification && (
                      <div className="prizeversity-verification-panel">
                        <div>
                          <strong>Check your Prizeversity email.</strong>
                          <span>
                            We sent a one-time code to {prizeversityVerification.maskedEmail}. Enter
                            it below to finish linking this account.
                          </span>
                        </div>
                        <div className="prizeversity-code-row">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={prizeversityVerificationCode}
                            onChange={(event) => {
                              setPrizeversityVerificationCode(event.target.value);
                              setPrizeversityLinkError('');
                            }}
                            placeholder="123456"
                            disabled={isPrizeversityLoading}
                          />
                          <button
                            type="button"
                            className="show-modal-btn"
                            onClick={handlePrizeversityVerify}
                            disabled={
                              isPrizeversityLoading ||
                              prizeversityVerificationCode.trim().length < 6
                            }
                          >
                            Verify code
                          </button>
                        </div>
                      </div>
                    )}
                    {prizeversityLinkError && (
                      <div className="prizeversity-link-error" role="alert">
                        <strong>
                          {prizeversityVerification
                            ? 'Verification failed.'
                            : isPrizeversityEmailDeliveryError
                              ? 'Verification email could not be sent.'
                              : 'No Prizeversity match found.'}
                        </strong>
                        <span>{prizeversityLinkError}</span>
                        <small>
                          {prizeversityVerification
                            ? 'Check the code from your email, or resend a new code if it expired.'
                            : isPrizeversityEmailDeliveryError
                              ? 'Your account was matched, but the site email provider rejected the send. Ask an admin to check SMTP credentials.'
                              : 'Confirm you selected the right reward classroom and try your Prizeversity email, full name, or short ID.'}
                        </small>
                      </div>
                    )}
                  </div>

                  {prizeversityStatus?.linked && (
                    <div className="account-challenge-actions compact">
                      <button
                        type="button"
                        className="hide-credentials-btn"
                        onClick={handlePrizeversityUnlink}
                        disabled={isPrizeversityLoading}
                      >
                        <Unlink size={16} aria-hidden="true" /> Unlink Prizeversity
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.section>

          <motion.section
            className="cyber-challenge-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2 className="account-challenge-heading">
              <Lock size={26} aria-hidden="true" /> AWS Access Challenge
            </h2>

            <div className="account-challenge-card">
              <div className="account-challenge-header">
                <div className="account-challenge-icon">
                  <Shield size={28} aria-hidden="true" />
                </div>
                <div className="account-challenge-title">
                  <span>Challenge #5</span>
                  <h3>AWS Cloud Security Lab</h3>
                  <p>Use your assigned AWS workspace to retrieve the next challenge secret.</p>
                </div>
              </div>

              <div className="account-challenge-meta-grid">
                <div className="account-challenge-meta-item">
                  <span>S3 bucket</span>
                  <code>wayne-aws-club-secrets</code>
                </div>
                <div className="account-challenge-meta-item">
                  <span>Secret path</span>
                  <code>secrets/{currentUser?.username}.txt</code>
                </div>
                <div className="account-challenge-meta-item">
                  <span>Region</span>
                  <code>us-east-1</code>
                </div>
                <div className="account-challenge-meta-item">
                  <span>IAM user</span>
                  <code>club_{currentUser?.username}</code>
                </div>
              </div>

              {isPrizeversityGateLoading ? (
                <div className="no-credentials-message">
                  <p>Checking Prizeversity reward link...</p>
                </div>
              ) : !isPrizeversityLinked ? (
                <div className="account-challenge-gate">
                  <div>
                    <span>Prizeversity required</span>
                    <h4>Link your reward account before starting this challenge.</h4>
                    <p>
                      AWS challenge completions are rewarded through Prizeversity, so we need to
                      verify your classroom account before revealing challenge credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="show-modal-btn"
                    onClick={focusPrizeversityLinking}
                  >
                    <Link2 size={16} aria-hidden="true" /> Link Prizeversity
                  </button>
                </div>
              ) : (
                <div className="account-credentials-section">
                  {!awsCredentials ? (
                    <div className="account-challenge-actions">
                      <motion.button
                        className="reveal-credentials-btn"
                        onClick={() => setShowCredentialsModal(true)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Lock size={16} aria-hidden="true" /> Reveal credentials
                      </motion.button>
                      <motion.button
                        className="show-modal-btn"
                        onClick={() => navigate('/challenges/aws-cloud-security-lab')}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Target size={16} aria-hidden="true" /> Open challenge page
                      </motion.button>
                    </div>
                  ) : (
                    <div className="credentials-display">
                      <div className="credentials-display-header">
                        <h4>AWS credentials</h4>
                        <p>Copy what you need, then hide the values when you’re done.</p>
                      </div>

                      <div className="account-credential-row">
                        <div className="account-credential-content">
                          <label>Access key ID</label>
                          <code>{awsCredentials.accessKeyId}</code>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(awsCredentials.accessKeyId)}
                          className="copy-btn"
                          aria-label="Copy access key ID"
                        >
                          <Copy size={14} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="account-credential-row">
                        <div className="account-credential-content">
                          <label>Secret access key</label>
                          <code>{awsCredentials.secretAccessKey}</code>
                        </div>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(awsCredentials.secretAccessKey)
                          }
                          className="copy-btn"
                          aria-label="Copy secret access key"
                        >
                          <Copy size={14} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="account-challenge-actions compact">
                        <button
                          className="hide-credentials-btn"
                          onClick={() => setAwsCredentials(null)}
                        >
                          Hide credentials
                        </button>
                        <motion.button
                          className="show-modal-btn"
                          onClick={handleShowCyberModal}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Target size={16} aria-hidden="true" /> Open instructions
                        </motion.button>
                        <motion.button
                          className="show-modal-btn"
                          onClick={() => navigate('/challenges/aws-cloud-security-lab')}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Target size={16} aria-hidden="true" /> Open challenge page
                        </motion.button>
                      </div>
                    </div>
                  )}
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
                <p>Receive updates about events, resources, and group news</p>
              </div>
              <div className="toggle-container">
                <motion.button
                  type="button"
                  className={`toggle-switch ${formData.wantsEmails ? 'active' : ''}`}
                  onClick={handleEmailToggle}
                  disabled={loading}
                  role="switch"
                  aria-checked={formData.wantsEmails}
                  aria-label="Email communications"
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
