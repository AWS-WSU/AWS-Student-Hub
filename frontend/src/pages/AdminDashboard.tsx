import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adminAPI } from '../utils/api';
import './styles/AdminDashboard.css';
import type { AdminStats, AdminUser, EmailQueueEntry } from '../types/admin';
import type {
  AdminChallenge,
  AdminChallengePayload,
  ChallengeDifficulty,
  ChallengeKind,
  ChallengeStatus,
} from '../types/challenge';
import type {
  RewardIntegrationInstance,
  RewardIntegrationInstancePayload,
} from '../types/rewardIntegration';
import type { Theme } from '../types/ui';
import type { UserRole, UserStatus } from '../types/user';

interface AdminDashboardProps {
  theme?: Theme;
}

interface IconProps {
  className?: string;
}

type AdminTab = 'dashboard' | 'users' | 'queue' | 'rewards' | 'challenges';
type RoleFilter = UserRole | '';
type StatusFilter = UserStatus | '';
type QueueStats = Record<string, any>;

interface RewardIntegrationFormData {
  name: string;
  description: string;
  apiBaseUrl: string;
  apiKey: string;
  classroomId: string;
  classroomName: string;
  scopes: string;
}

interface ChallengeFormData {
  key: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  instructions: string;
  kind: ChallengeKind;
  difficulty: ChallengeDifficulty;
  estimatedMinutes: string;
  tags: string;
  maxAttempts: string;
  validationJson: string;
  rewardEnabled: boolean;
  rewardBits: string;
  rewardXpAmount: string;
}

interface DashboardStats extends AdminStats {
  newsletterSubscribers?: number;
}

interface DashboardQueueEntry extends EmailQueueEntry {
  _id?: string;
  id?: string;
  fullName?: string;
  email?: string;
  eventSnapshot?: {
    title?: string;
    [key: string]: any;
  };
  status?: string;
  attempts?: number;
  createdAt?: string;
}

const adminRoles: UserRole[] = ['moderator', 'admin', 'superuser'];
const defaultRewardScopes = 'users:read,users:match,reward:grant';
const emptyRewardForm: RewardIntegrationFormData = {
  name: '',
  description: '',
  apiBaseUrl: 'https://www.prizeversity.com',
  apiKey: '',
  classroomId: '',
  classroomName: '',
  scopes: defaultRewardScopes,
};

const emptyChallengeForm: ChallengeFormData = {
  key: 'aws_cloud_security_lab',
  slug: 'aws-cloud-security-lab',
  title: 'AWS Cloud Security Lab',
  summary: 'Use your assigned AWS workspace to retrieve the next challenge secret.',
  description:
    'Configure your AWS credentials, inspect your assigned S3 secret file, and submit the secret value to complete the lab.',
  instructions:
    'S3 bucket: wayne-aws-club-secrets\nSecret path: secrets/{username}.txt\nExpected file format: next_password=<secret>',
  kind: 'single',
  difficulty: 'medium',
  estimatedMinutes: '20',
  tags: 'aws,s3,security',
  maxAttempts: '',
  validationJson: JSON.stringify(
    {
      type: 'aws_secret',
      source: 'user_next_challenge_password',
      acceptedPrefixes: ['next_password='],
    },
    null,
    2
  ),
  rewardEnabled: true,
  rewardBits: '50',
  rewardXpAmount: '30',
};

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const cleanPastedRewardValue = (value: string): string =>
  value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

const getUserId = (targetUser?: AdminUser | null): string =>
  String(targetUser?._id || targetUser?.id || '');

const getQueueEntryId = (entry?: DashboardQueueEntry | null): string =>
  String(entry?._id || entry?.id || '');

const DashBoardIcon = ({ className }: IconProps) => (
  <img
    src="/dashboard.svg"
    alt="Dashboard"
    className={className}
    style={{ width: '24px', height: '24px' }}
  />
);

const AccountIcon = ({ className }: IconProps) => (
  <img
    src="/users.svg"
    alt="User"
    className={className}
    style={{ width: '24px', height: '24px' }}
  />
);

const ActivityIcon = ({ className }: IconProps) => (
  <img
    src="/trend.svg"
    alt="Activity"
    className={className}
    style={{ width: '24px', height: '24px' }}
  />
);

const CheckIcon = ({ className }: IconProps) => (
  <img
    src="/activity.svg"
    alt="Check"
    className={className}
    style={{ width: '24px', height: '24px' }}
  />
);

const EyeClosedIcon = ({ className }: IconProps) => (
  <img
    src="/ban.svg"
    alt="Eye Closed"
    className={className}
    style={{ width: '24px', height: '24px' }}
  />
);

const AwsIcon = ({ className }: IconProps) => (
  <img src="/aws.svg" alt="AWS" className={className} style={{ width: '24px', height: '24px' }} />
);

const GmailIcon = ({ className }: IconProps) => (
  <img
    src="/email.svg"
    alt="Gmail"
    className={className}
    style={{ width: '24px', height: '24px' }}
  />
);

function AdminDashboard({ theme }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [showBanModal, setShowBanModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [banReason, setBanReason] = useState<string>('');
  const [newRole, setNewRole] = useState<RoleFilter>('');

  // Email Queue state
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueEntries, setQueueEntries] = useState<DashboardQueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('');
  const [queuePage, setQueuePage] = useState<number>(1);
  const [queueTotalPages, setQueueTotalPages] = useState<number>(1);
  const [processingQueue, setProcessingQueue] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Reward integration state
  const [rewardInstances, setRewardInstances] = useState<RewardIntegrationInstance[]>([]);
  const [rewardForm, setRewardForm] = useState<RewardIntegrationFormData>(emptyRewardForm);
  const [rewardLoading, setRewardLoading] = useState<boolean>(false);
  const [rewardSaving, setRewardSaving] = useState<boolean>(false);
  const [testingRewardId, setTestingRewardId] = useState<string | null>(null);

  // Challenge admin state
  const [adminChallenges, setAdminChallenges] = useState<AdminChallenge[]>([]);
  const [challengeForm, setChallengeForm] = useState<ChallengeFormData>(emptyChallengeForm);
  const [challengeLoading, setChallengeLoading] = useState<boolean>(false);
  const [challengeSaving, setChallengeSaving] = useState<boolean>(false);
  const [challengeStatusFilter, setChallengeStatusFilter] = useState<ChallengeStatus | ''>('');
  const [updatingChallengeId, setUpdatingChallengeId] = useState<string | null>(null);
  const [challengeToDelete, setChallengeToDelete] = useState<AdminChallenge | null>(null);

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate('/auth');
      return;
    }

    if (!user.role || !adminRoles.includes(user.role)) {
      navigate('/');
      showToast('Access denied. Admin privileges required.', 'error');
      return;
    }
  }, [user, navigate, showToast, authLoading]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await adminAPI.getAllUsers(
        currentPage,
        20,
        searchTerm,
        roleFilter,
        statusFilter
      );
      setUsers(response.users as AdminUser[]);
      setTotalPages(response.pagination?.totalPages || 1);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users'));
    } finally {
      setUsersLoading(false);
    }
  }, [currentPage, searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await adminAPI.getDashboardStats();
        setStats(response.stats as DashboardStats);
        setError('');
      } catch {
        setError('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role && adminRoles.includes(user.role)) {
      loadStats();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, loadUsers]);

  // Load email queue data
  const loadQueueStats = useCallback(async () => {
    try {
      const response = await adminAPI.getEmailQueueStats();
      setQueueStats(response.stats);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load queue stats'));
    }
  }, []);

  const loadQueueEntries = useCallback(async () => {
    setQueueLoading(true);
    try {
      const response = await adminAPI.getEmailQueueEntries(
        queueStatusFilter || null,
        queuePage,
        20
      );
      setQueueEntries((response.entries || []) as DashboardQueueEntry[]);
      setQueueTotalPages(response.pagination?.totalPages || 1);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load queue entries'));
    } finally {
      setQueueLoading(false);
    }
  }, [queueStatusFilter, queuePage]);

  useEffect(() => {
    if (activeTab === 'queue') {
      loadQueueStats();
      loadQueueEntries();
    }
  }, [activeTab, loadQueueStats, loadQueueEntries]);

  const loadRewardIntegrations = useCallback(async () => {
    setRewardLoading(true);
    try {
      const response = await adminAPI.listRewardIntegrations();
      setRewardInstances(response.instances || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load reward integrations'));
    } finally {
      setRewardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'rewards') {
      loadRewardIntegrations();
    }
  }, [activeTab, loadRewardIntegrations]);

  const loadAdminChallenges = useCallback(async () => {
    setChallengeLoading(true);
    try {
      const response = await adminAPI.listChallenges(challengeStatusFilter || undefined);
      setAdminChallenges(response.items || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load challenges'));
    } finally {
      setChallengeLoading(false);
    }
  }, [challengeStatusFilter]);

  useEffect(() => {
    if (activeTab === 'challenges') {
      loadAdminChallenges();
    }
  }, [activeTab, loadAdminChallenges]);

  const handleRetryEmail = async (queueId: string) => {
    if (!queueId) {
      showToast('Unable to retry email: missing queue ID', 'error');
      return;
    }

    setRetryingId(queueId);
    try {
      await adminAPI.retryQueuedEmail(queueId);
      showToast('Email retry initiated', 'success');
      loadQueueEntries();
      loadQueueStats();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to retry email'), 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const response = await adminAPI.processEmailQueue(10);
      const result = response.result || {};
      showToast(
        `Processed ${result.processed || 0} emails (${result.succeeded || 0} succeeded, ${result.failed || 0} failed)`,
        'success'
      );
      loadQueueEntries();
      loadQueueStats();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to process queue'), 'error');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleRewardFieldChange = (field: keyof RewardIntegrationFormData, value: string) => {
    setRewardForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildRewardPayload = (): RewardIntegrationInstancePayload => ({
    name: cleanPastedRewardValue(rewardForm.name),
    description: cleanPastedRewardValue(rewardForm.description),
    apiBaseUrl: cleanPastedRewardValue(rewardForm.apiBaseUrl),
    apiKey: cleanPastedRewardValue(rewardForm.apiKey),
    classroomId: cleanPastedRewardValue(rewardForm.classroomId),
    classroomName: cleanPastedRewardValue(rewardForm.classroomName),
    scopes: rewardForm.scopes.split(',').map(cleanPastedRewardValue).filter(Boolean),
    active: true,
  });

  const handleCreateRewardIntegration = async () => {
    const payload = buildRewardPayload();
    if (!payload.name || !payload.apiKey || !payload.classroomId) {
      showToast('Name, API key, and classroom ID are required', 'error');
      return;
    }

    setRewardSaving(true);
    try {
      await adminAPI.createRewardIntegration(payload);
      showToast('Reward integration instance created', 'success');
      setRewardForm(emptyRewardForm);
      loadRewardIntegrations();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create reward integration'), 'error');
    } finally {
      setRewardSaving(false);
    }
  };

  const handleTestRewardIntegration = async (instanceId: string) => {
    setTestingRewardId(instanceId);
    try {
      const response = await adminAPI.testRewardIntegration(instanceId);
      showToast(`Verified ${response.test?.userCount ?? 0} classroom users`, 'success');
      loadRewardIntegrations();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to verify reward integration'), 'error');
      loadRewardIntegrations();
    } finally {
      setTestingRewardId(null);
    }
  };

  const handleToggleRewardIntegration = async (instance: RewardIntegrationInstance) => {
    try {
      if (instance.active) {
        await adminAPI.deactivateRewardIntegration(instance.id);
        showToast('Reward integration deactivated', 'success');
      } else {
        await adminAPI.updateRewardIntegration(instance.id, { active: true });
        showToast('Reward integration activated', 'success');
      }
      loadRewardIntegrations();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update reward integration'), 'error');
    }
  };

  const handleChallengeFieldChange = <K extends keyof ChallengeFormData>(
    field: K,
    value: ChallengeFormData[K]
  ) => {
    setChallengeForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildChallengePayload = (): AdminChallengePayload => {
    const validation = JSON.parse(challengeForm.validationJson) as Record<string, unknown>;
    return {
      key: challengeForm.key.trim(),
      slug: challengeForm.slug.trim(),
      title: challengeForm.title.trim(),
      summary: challengeForm.summary.trim(),
      description: challengeForm.description.trim(),
      instructions: challengeForm.instructions.trim(),
      kind: challengeForm.kind,
      difficulty: challengeForm.difficulty,
      estimatedMinutes: Number(challengeForm.estimatedMinutes) || undefined,
      tags: challengeForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      maxAttempts: Number(challengeForm.maxAttempts) || undefined,
      validation,
      reward: {
        enabled: challengeForm.rewardEnabled,
        bits: Number(challengeForm.rewardBits) || 0,
        xpMode: challengeForm.rewardXpAmount ? 'custom' : 'none',
        xpAmount: Number(challengeForm.rewardXpAmount) || undefined,
        activityName: challengeForm.title.trim(),
        description: `Completed ${challengeForm.title.trim()}`,
      },
    };
  };

  const handleCreateChallenge = async () => {
    if (
      !challengeForm.title.trim() ||
      !challengeForm.summary.trim() ||
      !challengeForm.description.trim()
    ) {
      showToast('Title, summary, and description are required', 'error');
      return;
    }

    setChallengeSaving(true);
    try {
      await adminAPI.createChallenge(buildChallengePayload());
      showToast('Challenge created', 'success');
      setChallengeForm(emptyChallengeForm);
      loadAdminChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create challenge'), 'error');
    } finally {
      setChallengeSaving(false);
    }
  };

  const handlePublishChallenge = async (challengeId: string) => {
    setUpdatingChallengeId(challengeId);
    try {
      await adminAPI.publishChallenge(challengeId);
      showToast('Challenge published', 'success');
      loadAdminChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to publish challenge'), 'error');
    } finally {
      setUpdatingChallengeId(null);
    }
  };

  const handleArchiveChallenge = async (challengeId: string) => {
    setUpdatingChallengeId(challengeId);
    try {
      await adminAPI.archiveChallenge(challengeId);
      showToast('Challenge archived', 'success');
      loadAdminChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to archive challenge'), 'error');
    } finally {
      setUpdatingChallengeId(null);
    }
  };

  const handleDeleteChallenge = (challenge: AdminChallenge) => {
    if (challenge.status === 'published') {
      showToast('Archive the challenge before deleting it', 'error');
      return;
    }

    setChallengeToDelete(challenge);
  };

  const handleConfirmDeleteChallenge = async () => {
    if (!challengeToDelete) return;

    setUpdatingChallengeId(challengeToDelete.id);
    try {
      const response = await adminAPI.deleteChallenge(challengeToDelete.id);
      showToast(
        `Challenge deleted. Removed ${response.progressDeleted} progress records and ${response.submissionsDeleted} submissions.`,
        'success'
      );
      setChallengeToDelete(null);
      loadAdminChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete challenge'), 'error');
    } finally {
      setUpdatingChallengeId(null);
    }
  };

  const handleRoleUpdate = async () => {
    const selectedUserId = getUserId(selectedUser);
    if (!selectedUserId || !newRole) {
      showToast('Unable to update role: missing user or role', 'error');
      return;
    }

    try {
      await adminAPI.updateUserRole(selectedUserId, newRole as UserRole);
      showToast(`User role updated to ${newRole}`, 'success');
      setShowRoleModal(false);
      loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update user role'), 'error');
    }
  };

  const handleBanUser = async () => {
    const selectedUserId = getUserId(selectedUser);
    if (!selectedUserId) {
      showToast('Unable to ban user: missing user ID', 'error');
      return;
    }

    try {
      await adminAPI.banUser(selectedUserId, banReason);
      showToast('User banned successfully', 'success');
      setShowBanModal(false);
      setBanReason('');
      loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to ban user'), 'error');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    if (!userId) {
      showToast('Unable to unban user: missing user ID', 'error');
      return;
    }

    try {
      await adminAPI.unbanUser(userId);
      showToast('User unbanned successfully', 'success');
      loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to unban user'), 'error');
    }
  };

  const handleDeleteUser = async () => {
    const selectedUserId = getUserId(selectedUser);
    if (!selectedUserId) {
      showToast('Unable to delete user: missing user ID', 'error');
      return;
    }

    try {
      await adminAPI.deleteUser(selectedUserId);
      showToast('User deleted successfully', 'success');
      setShowDeleteModal(false);
      loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete user'), 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="admin-dashboard-container">
        <div className="admin-content">
          <div className="loading-stats">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      <div className="admin-content">
        <motion.div
          className="admin-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1>Admin Dashboard</h1>
          <p>Manage users and monitor your AWS Student Hub</p>
        </motion.div>

        <div className="admin-tabs">
          <button
            className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
            data-tab="dashboard"
            onClick={() => setActiveTab('dashboard')}
          >
            <DashBoardIcon className="tab-icon" />
            Dashboard
          </button>
          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            data-tab="users"
            onClick={() => setActiveTab('users')}
          >
            <AccountIcon className="tab-icon" />
            User Management
          </button>
          {(user?.role === 'admin' || user?.role === 'superuser') && (
            <button
              className={`tab-button ${activeTab === 'challenges' ? 'active' : ''}`}
              data-tab="challenges"
              onClick={() => setActiveTab('challenges')}
            >
              <CheckIcon className="tab-icon" />
              Challenges
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'superuser') && (
            <button
              className={`tab-button ${activeTab === 'rewards' ? 'active' : ''}`}
              data-tab="rewards"
              onClick={() => setActiveTab('rewards')}
            >
              <AwsIcon className="tab-icon" />
              Reward Integrations
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'superuser') && (
            <button
              className={`tab-button ${activeTab === 'queue' ? 'active' : ''}`}
              data-tab="queue"
              onClick={() => setActiveTab('queue')}
            >
              <GmailIcon className="tab-icon" />
              Email Queue
            </button>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <motion.div
            className="dashboard-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {loading ? (
              <div className="loading-stats">Loading dashboard stats...</div>
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : stats ? (
              <div className="stats-grid">
                <div className="stat-card" data-type="total">
                  <div className="stat-icon">
                    <AccountIcon className="stat-svg" />
                  </div>
                  <div className="stat-info">
                    <h3>Total Users</h3>
                    <p>{stats.totalUsers}</p>
                  </div>
                </div>

                <div className="stat-card" data-type="active">
                  <div className="stat-icon">
                    <CheckIcon className="stat-svg" />
                  </div>
                  <div className="stat-info">
                    <h3>Active Users</h3>
                    <p>{stats.activeUsers}</p>
                  </div>
                </div>

                <div className="stat-card" data-type="banned">
                  <div className="stat-icon">
                    <EyeClosedIcon className="stat-svg" />
                  </div>
                  <div className="stat-info">
                    <h3>Banned Users</h3>
                    <p>{stats.bannedUsers}</p>
                  </div>
                </div>

                <div className="stat-card" data-type="admin">
                  <div className="stat-icon">
                    <img
                      src={theme === 'dark' ? '/aws-light.svg' : '/aws.svg'}
                      alt="AWS"
                      className="stat-svg"
                      style={{ width: '24px', height: '24px' }}
                    />
                  </div>
                  <div className="stat-info">
                    <h3>Admin Users</h3>
                    <p>{stats.adminUsers}</p>
                  </div>
                </div>

                <div className="stat-card" data-type="signups">
                  <div className="stat-icon">
                    <ActivityIcon className="stat-svg" />
                  </div>
                  <div className="stat-info">
                    <h3>Recent Signups</h3>
                    <p>{stats.recentSignups}</p>
                  </div>
                </div>

                <div className="stat-card" data-type="newsletter">
                  <div className="stat-icon">
                    <GmailIcon className="stat-svg" />
                  </div>
                  <div className="stat-info">
                    <h3>Newsletter Subscribers</h3>
                    <p>{stats.newsletterSubscribers}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            className="users-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="user-filters">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className="filter-select"
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="superuser">Superuser</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {usersLoading ? (
              <div className="loading-users">Loading users...</div>
            ) : (
              <>
                <div className="users-table">
                  <div className="table-header">
                    <div>User</div>
                    <div>Role</div>
                    <div>Status</div>
                    <div>Joined</div>
                    <div>Actions</div>
                  </div>

                  {users.map((userData) => (
                    <div key={getUserId(userData) || userData.email} className="table-row">
                      <div className="user-info">
                        <img
                          src={userData.profilePicture || '/avatar.jpg'}
                          alt={userData.fullName}
                          className="user-avatar"
                        />
                        <div className="user-details">
                          <div className="user-name">{userData.fullName}</div>
                          <div className="user-username">@{userData.username}</div>
                        </div>
                      </div>

                      <div className="user-role" data-role={userData.role}>
                        {userData.role}
                      </div>

                      <div className="user-status" data-status={userData.status}>
                        {userData.status}
                      </div>

                      <div className="user-joined">
                        {userData.createdAt
                          ? new Date(userData.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </div>

                      <div className="user-actions">
                        {user?.role === 'admin' || user?.role === 'superuser' ? (
                          <button
                            onClick={() => {
                              setSelectedUser(userData);
                              setNewRole(userData.role || '');
                              setShowRoleModal(true);
                            }}
                            className="action-btn role-btn"
                          >
                            Role
                          </button>
                        ) : null}

                        {userData.status === 'active' ? (
                          <button
                            onClick={() => {
                              setSelectedUser(userData);
                              setShowBanModal(true);
                            }}
                            className="action-btn ban-btn"
                          >
                            Ban
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnbanUser(getUserId(userData))}
                            className="action-btn unban-btn"
                          >
                            Unban
                          </button>
                        )}

                        {(user?.role === 'admin' || user?.role === 'superuser') &&
                        getUserId(userData) !== String(user?.id || user?._id || '') ? (
                          <button
                            onClick={() => {
                              setSelectedUser(userData);
                              setShowDeleteModal(true);
                            }}
                            className="action-btn delete-btn"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>

                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'challenges' && (
          <motion.div
            className="challenges-admin-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="reward-admin-grid">
              <section className="reward-admin-panel">
                <div className="reward-admin-heading">
                  <span>Authoring</span>
                  <h2>Create challenge</h2>
                  <p>
                    Create provider-neutral challenges. The default config migrates the existing AWS
                    Cyber Challenge into the new validator/reward flow.
                  </p>
                </div>

                <div className="reward-form">
                  <label>
                    Title
                    <input
                      type="text"
                      value={challengeForm.title}
                      onChange={(e) => handleChallengeFieldChange('title', e.target.value)}
                    />
                  </label>

                  <div className="challenge-admin-two-col">
                    <label>
                      Key
                      <input
                        type="text"
                        value={challengeForm.key}
                        onChange={(e) => handleChallengeFieldChange('key', e.target.value)}
                      />
                    </label>
                    <label>
                      Slug
                      <input
                        type="text"
                        value={challengeForm.slug}
                        onChange={(e) => handleChallengeFieldChange('slug', e.target.value)}
                      />
                    </label>
                  </div>

                  <label>
                    Summary
                    <input
                      type="text"
                      value={challengeForm.summary}
                      onChange={(e) => handleChallengeFieldChange('summary', e.target.value)}
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      value={challengeForm.description}
                      onChange={(e) => handleChallengeFieldChange('description', e.target.value)}
                    />
                  </label>

                  <label>
                    Instructions
                    <textarea
                      value={challengeForm.instructions}
                      onChange={(e) => handleChallengeFieldChange('instructions', e.target.value)}
                    />
                  </label>

                  <div className="challenge-admin-two-col">
                    <label>
                      Kind
                      <select
                        value={challengeForm.kind}
                        onChange={(e) =>
                          handleChallengeFieldChange('kind', e.target.value as ChallengeKind)
                        }
                      >
                        <option value="single">Single goal</option>
                        <option value="multi_part">Multi-part</option>
                      </select>
                    </label>
                    <label>
                      Difficulty
                      <select
                        value={challengeForm.difficulty}
                        onChange={(e) =>
                          handleChallengeFieldChange(
                            'difficulty',
                            e.target.value as ChallengeDifficulty
                          )
                        }
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                        <option value="expert">Expert</option>
                      </select>
                    </label>
                  </div>

                  <div className="challenge-admin-two-col">
                    <label>
                      Estimated minutes
                      <input
                        type="number"
                        min="1"
                        value={challengeForm.estimatedMinutes}
                        onChange={(e) =>
                          handleChallengeFieldChange('estimatedMinutes', e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Max attempts
                      <input
                        type="number"
                        min="1"
                        value={challengeForm.maxAttempts}
                        onChange={(e) => handleChallengeFieldChange('maxAttempts', e.target.value)}
                        placeholder="Unlimited"
                      />
                    </label>
                  </div>

                  <label>
                    Tags
                    <input
                      type="text"
                      value={challengeForm.tags}
                      onChange={(e) => handleChallengeFieldChange('tags', e.target.value)}
                      placeholder="aws,s3,security"
                    />
                  </label>

                  <label>
                    Validation JSON
                    <textarea
                      value={challengeForm.validationJson}
                      onChange={(e) => handleChallengeFieldChange('validationJson', e.target.value)}
                    />
                  </label>

                  <div className="challenge-admin-two-col">
                    <label>
                      Reward bits
                      <input
                        type="number"
                        min="0"
                        value={challengeForm.rewardBits}
                        onChange={(e) => handleChallengeFieldChange('rewardBits', e.target.value)}
                      />
                    </label>
                    <label>
                      Reward XP
                      <input
                        type="number"
                        min="0"
                        value={challengeForm.rewardXpAmount}
                        onChange={(e) =>
                          handleChallengeFieldChange('rewardXpAmount', e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <label className="challenge-admin-checkbox">
                    <input
                      type="checkbox"
                      checked={challengeForm.rewardEnabled}
                      onChange={(e) =>
                        handleChallengeFieldChange('rewardEnabled', e.target.checked)
                      }
                    />
                    Reward enabled
                  </label>

                  <button
                    type="button"
                    className="create-reward-instance-btn"
                    onClick={handleCreateChallenge}
                    disabled={challengeSaving}
                  >
                    {challengeSaving ? 'Creating...' : 'Create challenge'}
                  </button>
                </div>
              </section>

              <section className="reward-admin-panel">
                <div className="reward-admin-heading">
                  <span>Catalog</span>
                  <h2>Challenge records</h2>
                  <p>Publish, archive, and inspect the current challenge catalog.</p>
                </div>

                <div className="challenge-admin-actions">
                  <select
                    value={challengeStatusFilter}
                    onChange={(e) =>
                      setChallengeStatusFilter(e.target.value as ChallengeStatus | '')
                    }
                  >
                    <option value="">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button type="button" onClick={loadAdminChallenges}>
                    Refresh
                  </button>
                </div>

                {challengeLoading ? (
                  <div className="loading-users">Loading challenges...</div>
                ) : adminChallenges.length === 0 ? (
                  <div className="empty-reward-instances">No challenges created yet.</div>
                ) : (
                  <div className="reward-instance-list">
                    {adminChallenges.map((challenge) => (
                      <article key={challenge.id} className="reward-instance-card">
                        <div className="reward-instance-topline">
                          <span data-active={challenge.status === 'published'}>
                            {challenge.status}
                          </span>
                          <span>{challenge.validation?.type as string}</span>
                        </div>
                        <h3>{challenge.title}</h3>
                        <p>{challenge.summary}</p>

                        <div className="reward-instance-meta">
                          <div>
                            <span>Slug</span>
                            <strong>{challenge.slug}</strong>
                          </div>
                          <div>
                            <span>Difficulty</span>
                            <strong>{challenge.difficulty}</strong>
                          </div>
                          <div>
                            <span>Reward</span>
                            <strong>
                              {challenge.reward.enabled ? `${challenge.reward.bits} bits` : 'Off'}
                            </strong>
                          </div>
                          <div>
                            <span>Attempts</span>
                            <strong>{challenge.maxAttempts || 'Unlimited'}</strong>
                          </div>
                        </div>

                        <div className="reward-instance-actions">
                          {challenge.status !== 'published' && (
                            <button
                              type="button"
                              className="action-btn role-btn"
                              onClick={() => handlePublishChallenge(challenge.id)}
                              disabled={updatingChallengeId === challenge.id}
                            >
                              Publish
                            </button>
                          )}
                          {challenge.status !== 'archived' && (
                            <button
                              type="button"
                              className="action-btn ban-btn"
                              onClick={() => handleArchiveChallenge(challenge.id)}
                              disabled={updatingChallengeId === challenge.id}
                            >
                              Archive
                            </button>
                          )}
                          <button
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteChallenge(challenge)}
                            disabled={
                              updatingChallengeId === challenge.id ||
                              challenge.status === 'published'
                            }
                            title={
                              challenge.status === 'published'
                                ? 'Archive this challenge before deleting it.'
                                : 'Delete this challenge and its related records.'
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'rewards' && (
          <motion.div
            className="rewards-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="reward-admin-grid">
              <section className="reward-admin-panel">
                <div className="reward-admin-heading">
                  <span>New instance</span>
                  <h2>Prizeversity classroom</h2>
                  <p>
                    Store a Prizeversity integration API key scoped to one classroom. AWS Student
                    Hub uses this server-side key for account linking and challenge rewards.
                  </p>
                </div>

                <div className="reward-form">
                  <label>
                    Instance name
                    <input
                      type="text"
                      value={rewardForm.name}
                      onChange={(e) => handleRewardFieldChange('name', e.target.value)}
                      placeholder="Cyber Challenge Section A"
                    />
                  </label>

                  <label>
                    Classroom ID
                    <input
                      type="text"
                      value={rewardForm.classroomId}
                      onChange={(e) => handleRewardFieldChange('classroomId', e.target.value)}
                      placeholder="68e169fa349b208d3db7b129"
                    />
                  </label>

                  <label>
                    API key
                    <input
                      type="password"
                      value={rewardForm.apiKey}
                      onChange={(e) => handleRewardFieldChange('apiKey', e.target.value)}
                      placeholder="pvk_..."
                    />
                  </label>

                  <label>
                    Prizeversity base URL
                    <input
                      type="url"
                      value={rewardForm.apiBaseUrl}
                      onChange={(e) => handleRewardFieldChange('apiBaseUrl', e.target.value)}
                      placeholder="https://prizeversity.com"
                    />
                  </label>

                  <label>
                    Classroom label
                    <input
                      type="text"
                      value={rewardForm.classroomName}
                      onChange={(e) => handleRewardFieldChange('classroomName', e.target.value)}
                      placeholder="Optional; verified value will replace this when available"
                    />
                  </label>

                  <label>
                    Expected scopes
                    <input
                      type="text"
                      value={rewardForm.scopes}
                      onChange={(e) => handleRewardFieldChange('scopes', e.target.value)}
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      value={rewardForm.description}
                      onChange={(e) => handleRewardFieldChange('description', e.target.value)}
                      placeholder="Who should use this classroom integration?"
                    />
                  </label>

                  <button
                    type="button"
                    className="create-reward-instance-btn"
                    onClick={handleCreateRewardIntegration}
                    disabled={rewardSaving}
                  >
                    {rewardSaving ? 'Verifying...' : 'Create and verify instance'}
                  </button>
                </div>
              </section>

              <section className="reward-admin-panel">
                <div className="reward-admin-heading">
                  <span>Configured</span>
                  <h2>Reward instances</h2>
                  <p>
                    Active instances appear on user account linking. API keys are never returned to
                    the browser after creation.
                  </p>
                </div>

                {rewardLoading ? (
                  <div className="loading-users">Loading reward integrations...</div>
                ) : rewardInstances.length === 0 ? (
                  <div className="empty-reward-instances">
                    No reward integration instances have been created yet.
                  </div>
                ) : (
                  <div className="reward-instance-list">
                    {rewardInstances.map((instance) => (
                      <article key={instance.id} className="reward-instance-card">
                        <div className="reward-instance-topline">
                          <span data-active={instance.active}>
                            {instance.active ? 'Active' : 'Inactive'}
                          </span>
                          <span>{instance.lastVerificationStatus || 'untested'}</span>
                        </div>
                        <h3>{instance.name}</h3>
                        <p>{instance.description || 'No description provided.'}</p>

                        <div className="reward-instance-meta">
                          <div>
                            <span>Classroom</span>
                            <strong>{instance.classroomName || instance.classroomId}</strong>
                          </div>
                          <div>
                            <span>Classroom ID</span>
                            <strong>{instance.classroomId}</strong>
                          </div>
                          <div>
                            <span>API key</span>
                            <strong>{instance.apiKeyPreview || 'Stored'}</strong>
                          </div>
                          <div>
                            <span>Users seen</span>
                            <strong>{instance.lastUserCount ?? 'Not tested'}</strong>
                          </div>
                        </div>

                        {instance.lastVerificationError && (
                          <div className="reward-instance-error">
                            {instance.lastVerificationError}
                          </div>
                        )}

                        <div className="reward-instance-actions">
                          <button
                            type="button"
                            className="action-btn role-btn"
                            onClick={() => handleTestRewardIntegration(instance.id)}
                            disabled={testingRewardId === instance.id}
                          >
                            {testingRewardId === instance.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            className={`action-btn ${instance.active ? 'ban-btn' : 'unban-btn'}`}
                            onClick={() => handleToggleRewardIntegration(instance)}
                          >
                            {instance.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'queue' && (
          <motion.div
            className="queue-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Queue Stats */}
            {queueStats && (
              <div className="queue-stats-grid">
                <div className="queue-stat-card" data-type="pending">
                  <div className="queue-stat-value">{queueStats.pending || 0}</div>
                  <div className="queue-stat-label">Pending</div>
                </div>
                <div className="queue-stat-card" data-type="processing">
                  <div className="queue-stat-value">{queueStats.processing || 0}</div>
                  <div className="queue-stat-label">Processing</div>
                </div>
                <div className="queue-stat-card" data-type="completed">
                  <div className="queue-stat-value">{queueStats.completed || 0}</div>
                  <div className="queue-stat-label">Completed</div>
                </div>
                <div className="queue-stat-card" data-type="failed">
                  <div className="queue-stat-value">{queueStats.failed || 0}</div>
                  <div className="queue-stat-label">Failed</div>
                </div>
              </div>
            )}

            {/* Queue Actions */}
            <div className="queue-actions">
              <button
                className="process-queue-btn"
                onClick={handleProcessQueue}
                disabled={processingQueue}
              >
                {processingQueue
                  ? 'Processing...'
                  : `Process Queue (${queueStats?.pending || 0} emails)`}
              </button>

              <select
                value={queueStatusFilter}
                onChange={(e) => {
                  setQueueStatusFilter(e.target.value);
                  setQueuePage(1);
                }}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Queue Entries Table */}
            {queueLoading ? (
              <div className="loading-users">Loading queue entries...</div>
            ) : queueEntries.length === 0 ? (
              <div className="empty-queue">
                <GmailIcon className="empty-icon" />
                <p>No emails in queue</p>
              </div>
            ) : (
              <>
                <div className="queue-table">
                  <div className="table-header">
                    <div>Recipient</div>
                    <div>Event</div>
                    <div>Status</div>
                    <div>Attempts</div>
                    <div>Created</div>
                    <div>Actions</div>
                  </div>

                  {queueEntries.map((entry, index) => {
                    const entryId = getQueueEntryId(entry);

                    return (
                      <div key={entryId || index} className="table-row">
                        <div className="queue-recipient">
                          <div className="recipient-name">{entry.fullName}</div>
                          <div className="recipient-email">{entry.email}</div>
                        </div>

                        <div className="queue-event">{entry.eventSnapshot?.title || 'N/A'}</div>

                        <div className="queue-status" data-status={entry.status}>
                          {entry.status}
                        </div>

                        <div className="queue-attempts">{entry.attempts || 0}</div>

                        <div className="queue-date">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'N/A'}
                        </div>

                        <div className="queue-entry-actions">
                          {(entry.status === 'failed' || entry.status === 'pending') && (
                            <button
                              onClick={() => handleRetryEmail(entryId)}
                              className="action-btn retry-btn"
                              disabled={retryingId === entryId}
                            >
                              {retryingId === entryId ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {queueTotalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => setQueuePage((prev) => Math.max(prev - 1, 1))}
                      disabled={queuePage === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>

                    <span className="page-info">
                      Page {queuePage} of {queueTotalPages}
                    </span>

                    <button
                      onClick={() => setQueuePage((prev) => Math.min(prev + 1, queueTotalPages))}
                      disabled={queuePage === queueTotalPages}
                      className="pagination-btn"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>

      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Update User Role</h3>
            <p>Change role for {selectedUser?.fullName}:</p>

            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as RoleFilter)}
              className="role-select"
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
              {user?.role === 'superuser' && <option value="admin">Admin</option>}
              {user?.role === 'superuser' && <option value="superuser">Superuser</option>}
            </select>

            <div className="modal-actions">
              <button onClick={() => setShowRoleModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleRoleUpdate} className="confirm-btn">
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {showBanModal && (
        <div className="modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Ban User</h3>
            <p>Ban {selectedUser?.fullName}?</p>

            <textarea
              placeholder="Reason for ban (optional)"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="ban-reason"
            />

            <div className="modal-actions">
              <button onClick={() => setShowBanModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleBanUser} className="ban-btn">
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete User</h3>
            <p>Are you sure you want to permanently delete {selectedUser?.fullName}?</p>
            <p className="warning-text">This action cannot be undone!</p>

            <div className="modal-actions">
              <button onClick={() => setShowDeleteModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDeleteUser} className="delete-btn">
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {challengeToDelete && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (updatingChallengeId !== challengeToDelete.id) {
              setChallengeToDelete(null);
            }
          }}
        >
          <div
            className="modal-content challenge-delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="modal-eyebrow">Delete challenge</span>
            <h3>{challengeToDelete.title}</h3>
            <p>
              This will permanently remove the challenge record and all related progress and
              submissions.
            </p>

            <div className="challenge-delete-summary">
              <div>
                <span>Status</span>
                <strong>{challengeToDelete.status}</strong>
              </div>
              <div>
                <span>Slug</span>
                <strong>{challengeToDelete.slug}</strong>
              </div>
              <div>
                <span>Reward</span>
                <strong>
                  {challengeToDelete.reward.enabled
                    ? `${challengeToDelete.reward.bits} bits`
                    : 'Off'}
                </strong>
              </div>
            </div>

            <p className="warning-text">This action cannot be undone.</p>

            <div className="modal-actions">
              <button
                onClick={() => setChallengeToDelete(null)}
                className="cancel-btn"
                disabled={updatingChallengeId === challengeToDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteChallenge}
                className="delete-btn"
                disabled={updatingChallengeId === challengeToDelete.id}
              >
                {updatingChallengeId === challengeToDelete.id ? 'Deleting...' : 'Delete Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
