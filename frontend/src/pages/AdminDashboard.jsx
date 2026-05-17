import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adminAPI } from '../utils/api';
import './styles/AdminDashboard.css';


const DashBoardIcon = ({ className }) => (
  <img src="/dashboard.svg" alt="Dashboard" className={className} style={{ width: '24px', height: '24px' }} />
);

const AccountIcon = ({ className }) => (
  <img src="/users.svg" alt="User" className={className} style={{ width: '24px', height: '24px' }} />
);

const ActivityIcon = ({ className }) => (
 <img src="/trend.svg" alt="Activity" className={className} style={{ width: '24px', height: '24px' }} />
);

const CheckIcon = ({ className }) => (
  <img src="/activity.svg" alt="Check" className={className} style={{ width: '24px', height: '24px' }} />
);

const EyeClosedIcon = ({ className }) => (
<img src="/ban.svg" alt="Eye Closed" className={className} style={{ width: '24px', height: '24px' }} />
);

const AwsIcon = ({ className }) => (
<img src="/aws.svg" alt="AWS" className={className} style={{ width: '24px', height: '24px' }} />
);

const GmailIcon = ({ className }) => (
 <img src="/email.svg" alt="Gmail" className={className} style={{ width: '24px', height: '24px' }} />
);

function AdminDashboard({ theme }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [newRole, setNewRole] = useState('');
  
  // Email Queue state
  const [queueStats, setQueueStats] = useState(null);
  const [queueEntries, setQueueEntries] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

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
    
    if (!['moderator', 'admin', 'superuser'].includes(user.role)) {
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
      setUsers(response.users);
      setTotalPages(response.pagination.totalPages);
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
        setStats(response.stats);
      } catch {
        setError('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    if (user && ['moderator', 'admin', 'superuser'].includes(user.role)) {
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
      console.error('Failed to load queue stats:', err);
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
      setQueueEntries(response.entries || []);
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

  const handleRetryEmail = async (queueId) => {
    setRetryingId(queueId);
    try {
      await adminAPI.retryQueuedEmail(queueId);
      showToast('Email retry initiated', 'success');
      loadQueueEntries();
      loadQueueStats();
    } catch (err) {
      showToast(err.message || 'Failed to retry email', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const response = await adminAPI.processEmailQueue(10);
      const result = response.result || {};
      showToast(`Processed ${result.processed || 0} emails (${result.succeeded || 0} succeeded, ${result.failed || 0} failed)`, 'success');
      loadQueueEntries();
      loadQueueStats();
    } catch (err) {
      showToast(err.message || 'Failed to process queue', 'error');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleRoleUpdate = async () => {
    try {
      await adminAPI.updateUserRole(selectedUser._id, newRole);
      showToast(`User role updated to ${newRole}`, 'success');
      setShowRoleModal(false);
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBanUser = async () => {
    try {
      await adminAPI.banUser(selectedUser._id, banReason);
      showToast('User banned successfully', 'success');
      setShowBanModal(false);
      setBanReason('');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await adminAPI.unbanUser(userId);
      showToast('User unbanned successfully', 'success');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async () => {
    try {
      await adminAPI.deleteUser(selectedUser._id);
      showToast('User deleted successfully', 'success');
      setShowDeleteModal(false);
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
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
                onChange={(e) => setRoleFilter(e.target.value)}
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
                onChange={(e) => setStatusFilter(e.target.value)}
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
                    <div key={userData._id} className="table-row">
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
                        {new Date(userData.createdAt).toLocaleDateString()}
                      </div>
                      
                      <div className="user-actions">
                        {user.role === 'admin' || user.role === 'superuser' ? (
                          <button
                            onClick={() => {
                              setSelectedUser(userData);
                              setNewRole(userData.role);
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
                            onClick={() => handleUnbanUser(userData._id)}
                            className="action-btn unban-btn"
                          >
                            Unban
                          </button>
                        )}
                        
                        {(user.role === 'admin' || user.role === 'superuser') && userData._id !== user.id ? (
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
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>
                    
                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
                {processingQueue ? 'Processing...' : `Process Queue (${queueStats?.pending || 0} emails)`}
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
                  
                  {queueEntries.map((entry) => (
                    <div key={entry._id} className="table-row">
                      <div className="queue-recipient">
                        <div className="recipient-name">{entry.fullName}</div>
                        <div className="recipient-email">{entry.email}</div>
                      </div>
                      
                      <div className="queue-event">
                        {entry.eventSnapshot?.title || 'N/A'}
                      </div>
                      
                      <div className="queue-status" data-status={entry.status}>
                        {entry.status}
                      </div>
                      
                      <div className="queue-attempts">
                        {entry.attempts || 0}
                      </div>
                      
                      <div className="queue-date">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                      
                      <div className="queue-entry-actions">
                        {(entry.status === 'failed' || entry.status === 'pending') && (
                          <button
                            onClick={() => handleRetryEmail(entry._id)}
                            className="action-btn retry-btn"
                            disabled={retryingId === entry._id}
                          >
                            {retryingId === entry._id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {queueTotalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => setQueuePage(prev => Math.max(prev - 1, 1))}
                      disabled={queuePage === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>
                    
                    <span className="page-info">
                      Page {queuePage} of {queueTotalPages}
                    </span>
                    
                    <button
                      onClick={() => setQueuePage(prev => Math.min(prev + 1, queueTotalPages))}
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
              onChange={(e) => setNewRole(e.target.value)}
              className="role-select"
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
              {user.role === 'superuser' && <option value="admin">Admin</option>}
              {user.role === 'superuser' && <option value="superuser">Superuser</option>}
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