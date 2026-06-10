import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adminAPI } from '../utils/api';
import './styles/AdminDashboard.css';
import type { AdminStats, AdminUser, EmailQueueEntry } from '../types/admin';
import type { Theme } from '../types/ui';
import type { UserRole, UserStatus } from '../types/user';

interface AdminDashboardProps {
  theme?: Theme;
}

interface IconProps {
  className?: string;
}

type AdminTab = 'dashboard' | 'users' | 'queue';
type RoleFilter = UserRole | '';
type StatusFilter = UserStatus | '';
type QueueStats = Record<string, any>;

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

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

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
    } catch {
      showToast('Failed to load users', 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [currentPage, searchTerm, roleFilter, statusFilter, showToast]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await adminAPI.getDashboardStats();
        setStats(response.stats as DashboardStats);
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
      console.error('failed to load queue stats.', err);
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
    } catch {
      showToast('Failed to load queue entries', 'error');
    } finally {
      setQueueLoading(false);
    }
  }, [queueStatusFilter, queuePage, showToast]);

  useEffect(() => {
    if (activeTab === 'queue') {
      loadQueueStats();
      loadQueueEntries();
    }
  }, [activeTab, loadQueueStats, loadQueueEntries]);

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
    </div>
  );
}

export default AdminDashboard;
