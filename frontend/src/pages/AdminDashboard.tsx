import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CircleHelp, X } from 'lucide-react';
import ChallengeAssignmentForm, {
  type ChallengeAssignmentFormData,
} from '../components/admin/ChallengeAssignmentForm';
import ChallengeCatalogPicker from '../components/admin/ChallengeCatalogPicker';
import ChallengeCreateForm, {
  type ChallengeFormData,
} from '../components/admin/ChallengeCreateForm';
import RewardInstanceForm, {
  type RewardIntegrationFormData,
} from '../components/admin/RewardInstanceForm';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adminAPI } from '../utils/api';
import './styles/AdminDashboard.css';
import type { AdminStats, AdminUser, EmailQueueEntry } from '../types/admin';
import type {
  AdminChallenge,
  AdminChallengeAssignment,
  AdminChallengeAssignmentPayload,
  AdminChallengePayload,
  AdminChallengeSubmission,
  ChallengeStatus,
  ChallengeValidationType,
} from '../types/challenge';
import type {
  RewardIntegrationClassroomMember,
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
type RewardWorkspaceTab = 'overview' | 'challenges' | 'students' | 'settings';

type ChallengeValidationTemplate = 'static_secret' | 'manual_review';

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
  key: '',
  slug: '',
  title: '',
  summary: '',
  description: '',
  instructions: '',
  kind: 'single',
  difficulty: 'easy',
  estimatedMinutes: '',
  tags: '',
  maxAttempts: '',
  validationJson: JSON.stringify(
    {
      type: 'static_secret',
      expectedValue: 'replace-with-secret-answer',
      trimSubmission: true,
      caseSensitive: true,
    },
    null,
    2
  ),
  rewardEnabled: true,
  rewardBits: '25',
  rewardXpAmount: '15',
};

const emptyAssignmentForm: ChallengeAssignmentFormData = {
  status: 'draft',
  startsAt: '',
  endsAt: '',
  maxAttempts: '',
  rewardEnabled: true,
  rewardBits: '0',
  rewardXpAmount: '0',
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

const getChallengeValidationType = (challenge: AdminChallenge): ChallengeValidationType =>
  challenge.validationType || String(challenge.validation?.type || '');

const formatSubmissionPreview = (submission: AdminChallengeSubmission): string => {
  const preview = submission.submittedPayloadPreview || {};
  const values = Object.entries(preview)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

  return values.length ? values.join('\n') : 'No preview available.';
};

const toDateTimeInput = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoDate = (value: string): string | null => (value ? new Date(value).toISOString() : null);

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
  const [showRewardCreateModal, setShowRewardCreateModal] = useState<boolean>(false);
  const [selectedRewardInstanceId, setSelectedRewardInstanceId] = useState<string>('');
  const [rewardWorkspaceTab, setRewardWorkspaceTab] = useState<RewardWorkspaceTab>('overview');
  const [rewardMembers, setRewardMembers] = useState<RewardIntegrationClassroomMember[]>([]);
  const [rewardMembersLoading, setRewardMembersLoading] = useState<boolean>(false);
  const [rewardMemberSearch, setRewardMemberSearch] = useState<string>('');
  const [rewardSettingsForm, setRewardSettingsForm] =
    useState<RewardIntegrationFormData>(emptyRewardForm);
  const [rewardSettingsSaving, setRewardSettingsSaving] = useState<boolean>(false);

  // Challenge admin state
  const [adminChallenges, setAdminChallenges] = useState<AdminChallenge[]>([]);
  const [assignableChallenges, setAssignableChallenges] = useState<AdminChallenge[]>([]);
  const [challengeForm, setChallengeForm] = useState<ChallengeFormData>(emptyChallengeForm);
  const [challengeLoading, setChallengeLoading] = useState<boolean>(false);
  const [challengeSaving, setChallengeSaving] = useState<boolean>(false);
  const [challengeStatusFilter, setChallengeStatusFilter] = useState<ChallengeStatus | ''>('');
  const [updatingChallengeId, setUpdatingChallengeId] = useState<string | null>(null);
  const [challengeToDelete, setChallengeToDelete] = useState<AdminChallenge | null>(null);
  const [reviewChallenge, setReviewChallenge] = useState<AdminChallenge | null>(null);
  const [reviewRewardInstanceId, setReviewRewardInstanceId] = useState<string | null>(null);
  const [manualReviewSubmissions, setManualReviewSubmissions] = useState<
    AdminChallengeSubmission[]
  >([]);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [showChallengeCreateModal, setShowChallengeCreateModal] = useState<boolean>(false);
  const [challengeAssignments, setChallengeAssignments] = useState<AdminChallengeAssignment[]>([]);
  const [challengeAssignmentsLoading, setChallengeAssignmentsLoading] = useState<boolean>(false);
  const [assignmentSaving, setAssignmentSaving] = useState<boolean>(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState<boolean>(false);
  const [assignmentChallenge, setAssignmentChallenge] = useState<AdminChallenge | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<AdminChallengeAssignment | null>(null);
  const [assignmentForm, setAssignmentForm] =
    useState<ChallengeAssignmentFormData>(emptyAssignmentForm);
  const [assignmentToRemove, setAssignmentToRemove] = useState<AdminChallengeAssignment | null>(
    null
  );

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const selectedRewardInstance = rewardInstances.find(
    (instance) => instance.id === selectedRewardInstanceId
  );
  const assignedChallengeIds = new Set(
    challengeAssignments.map((assignment) => assignment.challengeId)
  );
  const filteredRewardMembers = rewardMembers.filter((member) => {
    const query = rewardMemberSearch.trim().toLowerCase();
    if (!query) return true;
    return [member.name, member.email, member.shortId, member.userId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

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
      const instances = response.instances || [];
      setRewardInstances(instances);
      setSelectedRewardInstanceId((currentId) => {
        if (instances.some((instance) => instance.id === currentId)) return currentId;
        return instances[0]?.id || '';
      });
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load reward integrations'));
    } finally {
      setRewardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'rewards' || activeTab === 'challenges') {
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

  const loadAssignableChallenges = useCallback(async () => {
    try {
      const response = await adminAPI.listChallenges('published', '', 1, 100);
      setAssignableChallenges(response.items || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load the published challenge catalog'));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'challenges' || activeTab === 'rewards') {
      loadAdminChallenges();
    }
  }, [activeTab, loadAdminChallenges]);

  useEffect(() => {
    if (activeTab === 'rewards') loadAssignableChallenges();
  }, [activeTab, loadAssignableChallenges]);

  const loadChallengeAssignments = useCallback(async (instanceId: string) => {
    if (!instanceId) {
      setChallengeAssignments([]);
      return;
    }
    setChallengeAssignmentsLoading(true);
    setChallengeAssignments([]);
    try {
      const response = await adminAPI.listChallengeAssignments(instanceId);
      setChallengeAssignments(response.items || []);
      setError('');
    } catch (err) {
      setChallengeAssignments([]);
      setError(getErrorMessage(err, 'Failed to load classroom challenge assignments'));
    } finally {
      setChallengeAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'rewards' && selectedRewardInstanceId) {
      loadChallengeAssignments(selectedRewardInstanceId);
    }
  }, [activeTab, selectedRewardInstanceId, loadChallengeAssignments]);

  useEffect(() => {
    if (!selectedRewardInstance) return;
    setRewardSettingsForm({
      name: selectedRewardInstance.name,
      description: selectedRewardInstance.description || '',
      apiBaseUrl: selectedRewardInstance.apiBaseUrl,
      apiKey: '',
      classroomId: selectedRewardInstance.classroomId,
      classroomName: selectedRewardInstance.classroomName || '',
      scopes: selectedRewardInstance.scopes.join(','),
    });
  }, [selectedRewardInstance]);

  const loadRewardMembers = useCallback(async (instanceId: string) => {
    if (!instanceId) return;
    setRewardMembersLoading(true);
    try {
      const response = await adminAPI.listRewardIntegrationMembers(instanceId);
      setRewardMembers(response.users || []);
      setError('');
    } catch (err) {
      setRewardMembers([]);
      setError(getErrorMessage(err, 'Failed to load classroom members'));
    } finally {
      setRewardMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'rewards' && rewardWorkspaceTab === 'students' && selectedRewardInstanceId) {
      loadRewardMembers(selectedRewardInstanceId);
    }
  }, [activeTab, rewardWorkspaceTab, selectedRewardInstanceId, loadRewardMembers]);

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
      const response = await adminAPI.createRewardIntegration(payload);
      showToast('Reward integration instance created', 'success');
      setRewardForm(emptyRewardForm);
      setShowRewardCreateModal(false);
      setSelectedRewardInstanceId(response.instance.id);
      setRewardWorkspaceTab('overview');
      await loadRewardIntegrations();
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

  const handleRewardSettingsFieldChange = (
    field: keyof RewardIntegrationFormData,
    value: string
  ) => {
    setRewardSettingsForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSaveRewardSettings = async () => {
    if (!selectedRewardInstance) return;
    setRewardSettingsSaving(true);
    try {
      const payload: Partial<RewardIntegrationInstancePayload> = {
        name: cleanPastedRewardValue(rewardSettingsForm.name),
        description: cleanPastedRewardValue(rewardSettingsForm.description),
        apiBaseUrl: cleanPastedRewardValue(rewardSettingsForm.apiBaseUrl),
        classroomId: cleanPastedRewardValue(rewardSettingsForm.classroomId),
        classroomName: cleanPastedRewardValue(rewardSettingsForm.classroomName),
        scopes: rewardSettingsForm.scopes.split(',').map(cleanPastedRewardValue).filter(Boolean),
      };
      const apiKey = cleanPastedRewardValue(rewardSettingsForm.apiKey);
      if (apiKey) payload.apiKey = apiKey;
      await adminAPI.updateRewardIntegration(selectedRewardInstance.id, payload);
      showToast('Instance settings saved', 'success');
      await loadRewardIntegrations();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save instance settings'), 'error');
    } finally {
      setRewardSettingsSaving(false);
    }
  };

  const openChallengeCreateModal = () => {
    setChallengeForm({ ...emptyChallengeForm });
    setShowChallengeCreateModal(true);
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

  const applyChallengeValidationTemplate = (template: ChallengeValidationTemplate) => {
    const templates: Record<ChallengeValidationTemplate, Record<string, unknown>> = {
      static_secret: {
        type: 'static_secret',
        expectedValue: 'replace-with-secret-answer',
        trimSubmission: true,
        caseSensitive: true,
      },
      manual_review: {
        type: 'manual_review',
        minLength: 20,
        maxLength: 2000,
        submittedMessage: 'Submission received for review.',
      },
    };

    setChallengeForm((prev) => ({
      ...prev,
      validationJson: JSON.stringify(templates[template], null, 2),
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
      setShowChallengeCreateModal(false);
      loadAdminChallenges();
      loadAssignableChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create challenge'), 'error');
    } finally {
      setChallengeSaving(false);
    }
  };

  const openAssignmentEditor = (
    challenge: AdminChallenge,
    assignment: AdminChallengeAssignment | null = null
  ) => {
    const reward = assignment?.reward || challenge.reward;
    setAssignmentChallenge(challenge);
    setEditingAssignment(assignment);
    setAssignmentForm({
      status: assignment?.status || 'draft',
      startsAt: toDateTimeInput(assignment?.startsAt),
      endsAt: toDateTimeInput(assignment?.endsAt),
      maxAttempts: String(assignment?.maxAttempts || challenge.maxAttempts || ''),
      rewardEnabled: reward.enabled,
      rewardBits: String(reward.bits || 0),
      rewardXpAmount: String(reward.xpAmount || 0),
    });
    setShowCatalogPicker(false);
  };

  const handleAssignmentFieldChange = <K extends keyof ChallengeAssignmentFormData>(
    field: K,
    value: ChallengeAssignmentFormData[K]
  ) => {
    setAssignmentForm((previous) => ({ ...previous, [field]: value }));
  };

  const buildAssignmentPayload = (): AdminChallengeAssignmentPayload => ({
    challengeId: editingAssignment ? undefined : assignmentChallenge?.id,
    status: assignmentForm.status,
    startsAt: toIsoDate(assignmentForm.startsAt),
    endsAt: toIsoDate(assignmentForm.endsAt),
    maxAttempts: assignmentForm.maxAttempts ? Number(assignmentForm.maxAttempts) : null,
    reward: {
      enabled: assignmentForm.rewardEnabled,
      bits: Number(assignmentForm.rewardBits) || 0,
      xpMode: Number(assignmentForm.rewardXpAmount) > 0 ? 'custom' : 'none',
      xpAmount: Number(assignmentForm.rewardXpAmount) || 0,
      activityName: assignmentChallenge?.title,
      description: assignmentChallenge ? `Completed ${assignmentChallenge.title}` : undefined,
    },
  });

  const closeAssignmentEditor = () => {
    if (assignmentSaving) return;
    setAssignmentChallenge(null);
    setEditingAssignment(null);
    setAssignmentForm(emptyAssignmentForm);
  };

  const handleSaveAssignment = async () => {
    if (!selectedRewardInstanceId || !assignmentChallenge) return;
    if (
      assignmentForm.startsAt &&
      assignmentForm.endsAt &&
      new Date(assignmentForm.startsAt) >= new Date(assignmentForm.endsAt)
    ) {
      showToast('The assignment close date must be after its open date', 'error');
      return;
    }

    setAssignmentSaving(true);
    try {
      if (editingAssignment) {
        await adminAPI.updateChallengeAssignment(
          selectedRewardInstanceId,
          editingAssignment.id,
          buildAssignmentPayload()
        );
        showToast('Classroom challenge updated', 'success');
      } else {
        await adminAPI.createChallengeAssignment(
          selectedRewardInstanceId,
          buildAssignmentPayload()
        );
        showToast('Challenge added to classroom', 'success');
      }
      setAssignmentChallenge(null);
      setEditingAssignment(null);
      setAssignmentForm(emptyAssignmentForm);
      await loadChallengeAssignments(selectedRewardInstanceId);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save classroom challenge'), 'error');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleAssignmentStatus = async (
    assignment: AdminChallengeAssignment,
    status: AdminChallengeAssignment['status']
  ) => {
    if (!selectedRewardInstanceId) return;
    setUpdatingChallengeId(assignment.id);
    try {
      await adminAPI.updateChallengeAssignment(selectedRewardInstanceId, assignment.id, { status });
      showToast(
        status === 'published' ? 'Challenge published to this classroom' : 'Assignment archived',
        'success'
      );
      await loadChallengeAssignments(selectedRewardInstanceId);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update classroom challenge'), 'error');
    } finally {
      setUpdatingChallengeId(null);
    }
  };

  const handleConfirmRemoveAssignment = async () => {
    if (!selectedRewardInstanceId || !assignmentToRemove) return;
    setUpdatingChallengeId(assignmentToRemove.id);
    try {
      const result = await adminAPI.removeChallengeAssignment(
        selectedRewardInstanceId,
        assignmentToRemove.id
      );
      showToast(result.message, 'success');
      setAssignmentToRemove(null);
      await loadChallengeAssignments(selectedRewardInstanceId);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to remove classroom challenge'), 'error');
    } finally {
      setUpdatingChallengeId(null);
    }
  };

  const handlePublishChallenge = async (challengeId: string) => {
    setUpdatingChallengeId(challengeId);
    try {
      await adminAPI.publishChallenge(challengeId);
      showToast('Challenge published', 'success');
      loadAdminChallenges();
      loadAssignableChallenges();
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
      loadAssignableChallenges();
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
      loadAssignableChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete challenge'), 'error');
    } finally {
      setUpdatingChallengeId(null);
    }
  };

  const loadManualReviewSubmissions = async (
    challenge: AdminChallenge,
    rewardIntegrationInstanceId: string | null = null
  ) => {
    setReviewChallenge(challenge);
    setReviewRewardInstanceId(rewardIntegrationInstanceId);
    setReviewLoading(true);
    try {
      const response = await adminAPI.listChallengeSubmissions(
        challenge.id,
        'pending_review',
        1,
        50,
        rewardIntegrationInstanceId || undefined
      );
      setManualReviewSubmissions(response.items || []);
      showToast(`Loaded ${response.items?.length || 0} pending submissions`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load manual review submissions'), 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleManualReviewDecision = async (
    submission: AdminChallengeSubmission,
    decision: 'approve' | 'reject'
  ) => {
    if (!reviewChallenge) return;

    setReviewingSubmissionId(submission.id);
    try {
      if (decision === 'approve') {
        await adminAPI.approveChallengeSubmission(reviewChallenge.id, submission.id);
        showToast('Submission approved', 'success');
      } else {
        await adminAPI.rejectChallengeSubmission(reviewChallenge.id, submission.id);
        showToast('Submission rejected', 'success');
      }

      await loadManualReviewSubmissions(reviewChallenge, reviewRewardInstanceId);
      loadAdminChallenges();
    } catch (err) {
      showToast(getErrorMessage(err, `Failed to ${decision} submission`), 'error');
    } finally {
      setReviewingSubmissionId(null);
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
            <div className="challenge-catalog-layout">
              <section className="reward-admin-panel">
                <div className="reward-admin-heading">
                  <div className="admin-section-title-row">
                    <div>
                      <span>Catalog</span>
                      <h2>Challenge catalog</h2>
                      <p>
                        Manage reusable challenge definitions. Classroom access and rewards are
                        configured from each instance.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="create-reward-instance-btn"
                      onClick={() => openChallengeCreateModal()}
                    >
                      Create custom challenge
                    </button>
                  </div>
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
                          <span data-source={challenge.source}>{challenge.source}</span>
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
                          <div>
                            <span>Validator</span>
                            <strong>{getChallengeValidationType(challenge)}</strong>
                          </div>
                        </div>

                        <div className="reward-instance-actions">
                          {getChallengeValidationType(challenge) === 'manual_review' && (
                            <button
                              type="button"
                              className="action-btn role-btn"
                              onClick={() => loadManualReviewSubmissions(challenge)}
                              disabled={reviewLoading}
                            >
                              Review
                            </button>
                          )}
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
                              challenge.status === 'published' ||
                              challenge.source === 'curated'
                            }
                            title={
                              challenge.source === 'curated'
                                ? 'Curated challenges are maintained in source control and cannot be deleted here.'
                                : challenge.status === 'published'
                                  ? 'Archive this challenge before deleting it.'
                                  : 'Delete this custom catalog challenge.'
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

              {reviewChallenge && (
                <section className="reward-admin-panel challenge-review-panel">
                  <div className="reward-admin-heading">
                    <span>Manual review</span>
                    <h2>{reviewChallenge.title}</h2>
                    <p>
                      Approve or reject pending proof submissions
                      {reviewRewardInstanceId
                        ? ` for ${
                            rewardInstances.find(
                              (instance) => instance.id === reviewRewardInstanceId
                            )?.name || 'this classroom'
                          }.`
                        : ' across all classrooms.'}
                    </p>
                  </div>

                  {reviewLoading ? (
                    <div className="loading-users">Loading submissions...</div>
                  ) : manualReviewSubmissions.length === 0 ? (
                    <div className="empty-reward-instances">
                      No pending submissions for this challenge.
                    </div>
                  ) : (
                    <div className="challenge-review-list">
                      {manualReviewSubmissions.map((submission) => (
                        <article key={submission.id} className="challenge-review-card">
                          <div className="reward-instance-topline">
                            <span data-active>{submission.status}</span>
                            <span>{new Date(submission.createdAt || '').toLocaleString()}</span>
                          </div>

                          <pre>{formatSubmissionPreview(submission)}</pre>

                          {submission.message && <p>{submission.message}</p>}

                          <div className="reward-instance-actions">
                            <button
                              type="button"
                              className="action-btn role-btn"
                              onClick={() => handleManualReviewDecision(submission, 'approve')}
                              disabled={reviewingSubmissionId === submission.id}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="action-btn ban-btn"
                              onClick={() => handleManualReviewDecision(submission, 'reject')}
                              disabled={reviewingSubmissionId === submission.id}
                            >
                              Reject
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
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
            <div className="instance-manager-heading">
              <div>
                <span>Prizeversity operations</span>
                <h2>Classroom instances</h2>
                <p>Manage each classroom's students, challenge catalog, and reward connection.</p>
              </div>
              <button
                type="button"
                className="create-reward-instance-btn"
                onClick={() => {
                  setRewardForm(emptyRewardForm);
                  setShowRewardCreateModal(true);
                }}
              >
                New instance
              </button>
            </div>

            {rewardLoading ? (
              <div className="reward-admin-panel loading-users">Loading reward integrations...</div>
            ) : rewardInstances.length === 0 ? (
              <section className="reward-admin-panel instance-empty-state">
                <span>No classrooms connected</span>
                <h2>Create your first Prizeversity instance</h2>
                <p>
                  Connect one classroom API key to begin assigning challenges and linking students.
                </p>
                <button
                  type="button"
                  className="create-reward-instance-btn"
                  onClick={() => setShowRewardCreateModal(true)}
                >
                  New instance
                </button>
              </section>
            ) : (
              <div className="instance-manager-shell">
                <aside className="instance-directory" aria-label="Reward instances">
                  <div className="instance-directory-label">
                    <span>Instances</span>
                    <strong>{rewardInstances.length}</strong>
                  </div>
                  <div className="instance-directory-list">
                    {rewardInstances.map((instance) => {
                      return (
                        <button
                          type="button"
                          key={instance.id}
                          className={`instance-directory-item ${
                            selectedRewardInstanceId === instance.id ? 'active' : ''
                          }`}
                          onClick={() => {
                            setSelectedRewardInstanceId(instance.id);
                            setRewardWorkspaceTab('overview');
                            setRewardMemberSearch('');
                          }}
                        >
                          <span className="instance-monogram">
                            {(instance.classroomName || instance.name)
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                          <span className="instance-directory-copy">
                            <strong>{instance.name}</strong>
                            <small>{instance.classroomName || instance.classroomId}</small>
                            <em>
                              {instance.lastUserCount ?? 0} students ·{' '}
                              {instance.active ? 'active' : 'inactive'}
                            </em>
                          </span>
                          <span
                            className={`instance-status-dot ${instance.active ? 'active' : ''}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </aside>

                {selectedRewardInstance && (
                  <section className="instance-workspace">
                    <header className="instance-workspace-header">
                      <div>
                        <div className="instance-workspace-status">
                          <span data-active={selectedRewardInstance.active}>
                            {selectedRewardInstance.active ? 'Active' : 'Inactive'}
                          </span>
                          <span>{selectedRewardInstance.lastVerificationStatus || 'untested'}</span>
                        </div>
                        <h2>{selectedRewardInstance.name}</h2>
                        <p>
                          {selectedRewardInstance.classroomName ||
                            selectedRewardInstance.classroomId}
                        </p>
                      </div>
                      <div className="connection-check-control">
                        <button
                          type="button"
                          className="instance-test-btn"
                          onClick={() => handleTestRewardIntegration(selectedRewardInstance.id)}
                          disabled={testingRewardId === selectedRewardInstance.id}
                          aria-describedby="connection-check-help"
                        >
                          {testingRewardId === selectedRewardInstance.id
                            ? 'Checking...'
                            : 'Check connection'}
                        </button>
                        <button
                          type="button"
                          className="connection-help-trigger"
                          aria-label="What does Check connection do?"
                          aria-describedby="connection-check-help"
                        >
                          <CircleHelp size={18} aria-hidden="true" />
                        </button>
                        <span
                          id="connection-check-help"
                          className="connection-check-tooltip"
                          role="tooltip"
                        >
                          Uses the stored API key to request this classroom&apos;s current roster
                          from Prizeversity. A successful check refreshes the classroom name,
                          student count, verification status, and timestamp. It does not send
                          rewards.
                        </span>
                      </div>
                    </header>

                    <nav className="instance-workspace-tabs" aria-label="Instance management">
                      {(
                        ['overview', 'challenges', 'students', 'settings'] as RewardWorkspaceTab[]
                      ).map((workspaceTab) => (
                        <button
                          type="button"
                          key={workspaceTab}
                          className={rewardWorkspaceTab === workspaceTab ? 'active' : ''}
                          onClick={() => setRewardWorkspaceTab(workspaceTab)}
                        >
                          {workspaceTab}
                        </button>
                      ))}
                    </nav>

                    {selectedRewardInstance.lastVerificationError && (
                      <div className="reward-instance-error">
                        {selectedRewardInstance.lastVerificationError}
                      </div>
                    )}

                    {rewardWorkspaceTab === 'overview' && (
                      <div className="instance-overview">
                        <div className="instance-stat-grid">
                          <article>
                            <span>Students</span>
                            <strong>{selectedRewardInstance.lastUserCount ?? '—'}</strong>
                            <small>Last verified roster</small>
                          </article>
                          <article>
                            <span>Live challenges</span>
                            <strong>
                              {
                                challengeAssignments.filter(
                                  (assignment) => assignment.status === 'published'
                                ).length
                              }
                            </strong>
                            <small>{challengeAssignments.length} assigned total</small>
                          </article>
                          <article>
                            <span>API key</span>
                            <strong className="instance-key-preview">
                              {selectedRewardInstance.apiKeyPreview || 'Stored'}
                            </strong>
                          </article>
                          <article>
                            <span>Last checked</span>
                            <strong className="instance-date-value">
                              {selectedRewardInstance.lastVerifiedAt
                                ? new Date(
                                    selectedRewardInstance.lastVerifiedAt
                                  ).toLocaleDateString()
                                : 'Never'}
                            </strong>
                            <small>
                              {selectedRewardInstance.lastVerificationStatus || 'Untested'}
                            </small>
                          </article>
                        </div>

                        <div className="instance-overview-grid">
                          <article className="instance-info-card">
                            <span>Instance purpose</span>
                            <p>
                              {selectedRewardInstance.description || 'No description provided.'}
                            </p>
                            <dl>
                              <div>
                                <dt>Classroom ID</dt>
                                <dd>{selectedRewardInstance.classroomId}</dd>
                              </div>
                              <div>
                                <dt>Scopes</dt>
                                <dd>{selectedRewardInstance.scopes.join(' · ')}</dd>
                              </div>
                            </dl>
                          </article>
                          <article className="instance-quick-actions">
                            <span>Quick actions</span>
                            <button
                              type="button"
                              onClick={() => setShowCatalogPicker(true)}
                              disabled={!selectedRewardInstance.active}
                              title={
                                selectedRewardInstance.active
                                  ? undefined
                                  : 'Activate this instance before assigning challenges.'
                              }
                            >
                              Add from challenge catalog
                              <small>Configure a reusable challenge for this class</small>
                            </button>
                            <button type="button" onClick={() => setRewardWorkspaceTab('students')}>
                              Review student roster
                              <small>View balances, XP, and account links</small>
                            </button>
                          </article>
                        </div>
                      </div>
                    )}

                    {rewardWorkspaceTab === 'challenges' && (
                      <div className="instance-challenges-panel">
                        <div className="instance-panel-heading">
                          <div>
                            <span>Classroom delivery</span>
                            <h3>Challenge assignments</h3>
                            <p>Publish catalog challenges with settings specific to this class.</p>
                          </div>
                          <button
                            type="button"
                            className="create-reward-instance-btn"
                            onClick={() => setShowCatalogPicker(true)}
                            disabled={!selectedRewardInstance.active}
                          >
                            Add from catalog
                          </button>
                        </div>
                        {challengeAssignmentsLoading ? (
                          <div className="loading-users">Loading challenge assignments...</div>
                        ) : challengeAssignments.length === 0 ? (
                          <div className="empty-reward-instances">
                            No catalog challenges are assigned to this classroom yet.
                          </div>
                        ) : (
                          <div className="instance-challenge-list">
                            {challengeAssignments.map((assignment) => (
                              <article key={assignment.id}>
                                <div>
                                  <div className="assignment-card-topline">
                                    <span data-status={assignment.status}>{assignment.status}</span>
                                    <span data-source={assignment.challenge.source}>
                                      {assignment.challenge.source}
                                    </span>
                                    {assignment.challenge.status !== 'published' && (
                                      <span className="assignment-definition-unavailable">
                                        catalog {assignment.challenge.status}
                                      </span>
                                    )}
                                  </div>
                                  <h4>{assignment.challenge.title}</h4>
                                  <p>{assignment.challenge.summary}</p>
                                  <div className="assignment-card-meta">
                                    <span>
                                      <strong>{assignment.reward.bits}</strong> bits
                                    </span>
                                    <span>
                                      <strong>{assignment.reward.xpAmount || 0}</strong> XP
                                    </span>
                                    <span>
                                      <strong>{assignment.maxAttempts || 'Unlimited'}</strong>{' '}
                                      attempts
                                    </span>
                                    <span>
                                      <strong>{assignment.progress.completed}</strong> completed
                                    </span>
                                    {assignment.progress.pendingReview > 0 && (
                                      <span className="assignment-review-count">
                                        <strong>{assignment.progress.pendingReview}</strong>{' '}
                                        awaiting review
                                      </span>
                                    )}
                                  </div>
                                  {(assignment.startsAt || assignment.endsAt) && (
                                    <small className="assignment-window">
                                      {assignment.startsAt
                                        ? `Opens ${new Date(assignment.startsAt).toLocaleString()}`
                                        : 'Open now'}
                                      {' · '}
                                      {assignment.endsAt
                                        ? `Closes ${new Date(assignment.endsAt).toLocaleString()}`
                                        : 'No deadline'}
                                    </small>
                                  )}
                                </div>
                                <div className="reward-instance-actions">
                                  {assignment.challenge.validationType === 'manual_review' &&
                                    assignment.progress.pendingReview > 0 && (
                                      <button
                                        type="button"
                                        className="action-btn role-btn"
                                        onClick={() => {
                                          setActiveTab('challenges');
                                          loadManualReviewSubmissions(
                                            assignment.challenge,
                                            selectedRewardInstance.id
                                          );
                                        }}
                                      >
                                        Review ({assignment.progress.pendingReview})
                                      </button>
                                    )}
                                  <button
                                    type="button"
                                    className="action-btn assignment-edit-btn"
                                    onClick={() =>
                                      openAssignmentEditor(assignment.challenge, assignment)
                                    }
                                    disabled={updatingChallengeId === assignment.id}
                                  >
                                    Edit
                                  </button>
                                  {assignment.status !== 'published' && (
                                    <button
                                      type="button"
                                      className="action-btn role-btn"
                                      onClick={() =>
                                        handleAssignmentStatus(assignment, 'published')
                                      }
                                      disabled={
                                        updatingChallengeId === assignment.id ||
                                        assignment.challenge.status !== 'published'
                                      }
                                      title={
                                        assignment.challenge.status === 'published'
                                          ? undefined
                                          : 'Publish the catalog challenge before publishing this assignment.'
                                      }
                                    >
                                      Publish
                                    </button>
                                  )}
                                  {assignment.status !== 'archived' && (
                                    <button
                                      type="button"
                                      className="action-btn ban-btn"
                                      onClick={() => handleAssignmentStatus(assignment, 'archived')}
                                      disabled={updatingChallengeId === assignment.id}
                                    >
                                      Archive
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="action-btn delete-btn"
                                    onClick={() => setAssignmentToRemove(assignment)}
                                    disabled={updatingChallengeId === assignment.id}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {rewardWorkspaceTab === 'students' && (
                      <div className="instance-students-panel">
                        <div className="instance-panel-heading">
                          <div>
                            <span>Prizeversity roster</span>
                            <h3>Students</h3>
                            <p>
                              Balances and XP are read-only here and remain managed by Prizeversity.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="instance-test-btn"
                            onClick={() => loadRewardMembers(selectedRewardInstance.id)}
                            disabled={rewardMembersLoading}
                          >
                            Refresh roster
                          </button>
                        </div>
                        <input
                          className="instance-member-search"
                          type="search"
                          value={rewardMemberSearch}
                          onChange={(event) => setRewardMemberSearch(event.target.value)}
                          placeholder="Search by name, email, or short ID"
                        />
                        {rewardMembersLoading ? (
                          <div className="loading-users">Loading classroom roster...</div>
                        ) : filteredRewardMembers.length === 0 ? (
                          <div className="empty-reward-instances">
                            No matching classroom members.
                          </div>
                        ) : (
                          <div className="instance-member-table">
                            <div className="instance-member-row instance-member-header">
                              <span>Member</span>
                              <span>Role</span>
                              <span>Bits</span>
                              <span>Level / XP</span>
                              <span>AWS link</span>
                            </div>
                            {filteredRewardMembers.map((member) => (
                              <div className="instance-member-row" key={member.userId}>
                                <div className="instance-member-identity">
                                  <strong>{member.name}</strong>
                                  <small>{member.email || member.shortId || member.userId}</small>
                                </div>
                                <span className="instance-member-role">{member.role}</span>
                                <strong>{member.balance.toLocaleString()}</strong>
                                <span>
                                  Level {member.level} · {member.xp.toLocaleString()} XP
                                </span>
                                <span
                                  className={
                                    member.linkedAwsAccount ? 'member-linked' : 'member-unlinked'
                                  }
                                >
                                  {member.linkedAwsAccount ? 'Linked' : 'Not linked'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {rewardWorkspaceTab === 'settings' && (
                      <div className="instance-settings-panel">
                        <div className="instance-panel-heading">
                          <div>
                            <span>Configuration</span>
                            <h3>Instance settings</h3>
                            <p>Rotate credentials or update the classroom connection.</p>
                          </div>
                        </div>
                        {selectedRewardInstance.source === 'database' ? (
                          <RewardInstanceForm
                            form={rewardSettingsForm}
                            saving={rewardSettingsSaving}
                            submitLabel="Save settings"
                            apiKeyOptional
                            onChange={handleRewardSettingsFieldChange}
                            onSubmit={handleSaveRewardSettings}
                          />
                        ) : (
                          <div className="empty-reward-instances">
                            Environment-configured instances must be changed in deployment settings.
                          </div>
                        )}
                        <div className="instance-danger-zone">
                          <div>
                            <strong>
                              {selectedRewardInstance.active
                                ? 'Deactivate instance'
                                : 'Activate instance'}
                            </strong>
                            <p>
                              {selectedRewardInstance.active
                                ? 'Stops new account links and scoped challenge access.'
                                : 'Restores account linking and scoped challenge access.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className={selectedRewardInstance.active ? 'ban-btn' : 'unban-btn'}
                            onClick={() => handleToggleRewardIntegration(selectedRewardInstance)}
                          >
                            {selectedRewardInstance.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
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

      {showRewardCreateModal && (
        <div
          className="modal-overlay admin-editor-overlay"
          onClick={() => {
            if (!rewardSaving) setShowRewardCreateModal(false);
          }}
        >
          <div
            className="modal-content admin-editor-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-editor-header">
              <div>
                <span className="modal-eyebrow">New reward instance</span>
                <h3>Connect a Prizeversity classroom</h3>
                <p>The API key is verified and stored only on the server.</p>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Close"
                onClick={() => setShowRewardCreateModal(false)}
                disabled={rewardSaving}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <RewardInstanceForm
              form={rewardForm}
              saving={rewardSaving}
              onChange={handleRewardFieldChange}
              onSubmit={handleCreateRewardIntegration}
            />
          </div>
        </div>
      )}

      {showChallengeCreateModal && (
        <div
          className="modal-overlay admin-editor-overlay"
          onClick={() => {
            if (!challengeSaving) setShowChallengeCreateModal(false);
          }}
        >
          <div
            className="modal-content admin-editor-modal challenge-editor-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-editor-header">
              <div>
                <span className="modal-eyebrow">Challenge authoring</span>
                <h3>Create a custom catalog challenge</h3>
                <p>
                  Define reusable content and defaults. Assign it to classrooms after publishing it
                  to the catalog.
                </p>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Close"
                onClick={() => setShowChallengeCreateModal(false)}
                disabled={challengeSaving}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <ChallengeCreateForm
              form={challengeForm}
              saving={challengeSaving}
              onChange={handleChallengeFieldChange}
              onApplyTemplate={applyChallengeValidationTemplate}
              onSubmit={handleCreateChallenge}
            />
          </div>
        </div>
      )}

      {showCatalogPicker && selectedRewardInstance && (
        <ChallengeCatalogPicker
          challenges={assignableChallenges}
          assignedChallengeIds={assignedChallengeIds}
          onSelect={(challenge) => openAssignmentEditor(challenge)}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}

      {assignmentChallenge && (
        <ChallengeAssignmentForm
          challenge={assignmentChallenge}
          form={assignmentForm}
          editing={Boolean(editingAssignment)}
          saving={assignmentSaving}
          onChange={handleAssignmentFieldChange}
          onSubmit={handleSaveAssignment}
          onClose={closeAssignmentEditor}
        />
      )}

      {assignmentToRemove && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (updatingChallengeId !== assignmentToRemove.id) setAssignmentToRemove(null);
          }}
        >
          <div
            className="modal-content challenge-delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="modal-eyebrow">Remove classroom assignment</span>
            <h3>{assignmentToRemove.challenge.title}</h3>
            <p>
              This removes the challenge from this classroom only. The reusable catalog challenge is
              not changed.
            </p>
            {assignmentToRemove.progress.total > 0 && (
              <p className="assignment-preservation-note">
                {assignmentToRemove.progress.total} student progress record
                {assignmentToRemove.progress.total === 1 ? '' : 's'} will be preserved, so this
                assignment will be archived instead of deleted.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setAssignmentToRemove(null)}
                disabled={updatingChallengeId === assignmentToRemove.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-btn"
                onClick={handleConfirmRemoveAssignment}
                disabled={updatingChallengeId === assignmentToRemove.id}
              >
                {updatingChallengeId === assignmentToRemove.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

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
