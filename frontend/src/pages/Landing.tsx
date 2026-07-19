import { useState, useEffect } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent, SyntheticEvent } from 'react';
import './styles/Landing.css';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, Sparkles, UserPlus } from 'lucide-react';
import SocialLinks from '../components/SocialLinks';
import CreateEventModal from '../components/CreateEventModal';
import EventModal from '../components/EventModal';
import { authAPI, eventsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import type { Event as HubEvent, ThemeProps, User } from '../types';

function Landing({ theme: _theme }: ThemeProps) {
  const [events, setEvents] = useState<HubEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<HubEvent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showReferralLink, setShowReferralLink] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const lock = showCreateModal || !!selectedEvent;
    if (lock) {
      const prev = document.body.style.overflow;
      document.body.dataset.prevOverflow = prev;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = document.body.dataset.prevOverflow || '';
      delete document.body.dataset.prevOverflow;
    }
    return () => {
      document.body.style.overflow = document.body.dataset.prevOverflow || '';
      delete document.body.dataset.prevOverflow;
    };
  }, [showCreateModal, selectedEvent]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await eventsAPI.listPublic(6);
        setEvents(res.events || []);
      } catch {
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchRecentUsers = async () => {
      try {
        const response = await authAPI.getRecentUsers(6);
        setRecentUsers(response.users || []);
      } catch (error) {
        console.error('error fetching recent users.', error);
        setRecentUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchRecentUsers();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    setIsSearching(true);
    setSearchPerformed(true);
    setShowReferralLink(false);

    try {
      const response = await authAPI.searchUsers(searchQuery.trim(), 5);
      setSearchResults(response.users || []);

      if (!response.users || response.users.length === 0) {
        setTimeout(() => setShowReferralLink(true), 500);
      }
    } catch (error) {
      console.error('error searching users.', error);
      setSearchResults([]);
      setTimeout(() => setShowReferralLink(true), 500);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (!value.trim()) {
      setSearchResults([]);
      setSearchPerformed(false);
      setShowReferralLink(false);
      setReferralCopied(false);
    }
  };

  const handleSearchKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const generateReferralLink = () => {
    const currentUrl = window.location.origin;
    return `${currentUrl}/auth?mode=signup&ref=${user?.username || 'friend'}`;
  };

  const copyReferralLink = async () => {
    try {
      const referralLink = generateReferralLink();
      await navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 3000);
    } catch (error) {
      console.error('failed to copy referral link.', error);
    }
  };

  const handleJoinClick = () => {
    if (user) {
      navigate('/events');
    } else {
      navigate('/auth?mode=signup');
    }
  };

  const isAdmin = !!user && (user.role === 'admin' || user.role === 'superuser');

  const handleUserClick = (username: string) => {
    navigate(`/profile/${username}`);
  };

  return (
    <div className="landing-container">
      <section id="home" className="hero-section">
        <div className="hero-backdrop"></div>
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="hero-logo-container"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <img
              src="/aws-student-builder-group-logo.png"
              alt="AWS Student Builder Group"
              className="hero-logo"
            />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="hero-title"
          >
            <span className="hero-main-text">
              <span className="gradient-text animated-text">Building The Future</span>
            </span>
            <span className="hero-subtitle">with Cloud Computing</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            Join a community of cloud enthusiasts learning, building, and innovating together
          </motion.p>

          <motion.div
            className="cta-buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8 }}
          >
            <button className="cta-primary pulse-animation" onClick={handleJoinClick}>
              {user ? 'View Events' : 'Join the Group'}
            </button>
            <button className="cta-secondary" onClick={() => navigate('/about')}>
              Learn More
            </button>
          </motion.div>

          <motion.div
            className="scroll-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            onClick={() => navigate('/about')}
          >
            <span>Explore</span>
            <div className="scroll-arrow"></div>
          </motion.div>
        </motion.div>

        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </section>

      <section id="welcome" className="welcome-section">
        <div className="section-header">
          <h2>Welcome Our Newest Members!</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">
              <UserPlus size={20} aria-hidden="true" />
            </div>
            <span></span>
          </div>
        </div>

        {loadingUsers ? (
          <motion.div
            className="loading-users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="loading-text">
              <span>Loading our newest members...</span>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </motion.div>
        ) : recentUsers.length > 0 ? (
          <motion.div
            className="welcome-users-container"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="welcome-users-grid">
              {Array.from({ length: 3 }).map((_, index) => {
                const user = recentUsers[index];
                const isPlaceholder = !user;

                return (
                  <motion.div
                    key={user?._id || `placeholder-${index}`}
                    className={`welcome-user-card ${isPlaceholder ? 'placeholder-card' : ''}`}
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    onClick={!isPlaceholder ? () => handleUserClick(user.username) : undefined}
                    whileHover={!isPlaceholder ? { scale: 1.02 } : {}}
                    whileTap={!isPlaceholder ? { scale: 0.98 } : {}}
                  >
                    {!isPlaceholder ? (
                      <>
                        <div className="user-avatar">
                          <img
                            src={user.profilePicture || '/avatar.jpg'}
                            alt={`${user.fullName}'s profile`}
                            onError={(e: SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src = '/avatar.jpg';
                            }}
                          />
                        </div>
                        <div className="user-info">
                          <h4 className="user-name">{user.fullName}</h4>
                          <p className="user-username">@{user.username}</p>
                          <span className="join-date">
                            Joined{' '}
                            {new Date(user.createdAt ?? '').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="welcome-badge">New</div>
                      </>
                    ) : (
                      <>
                        <div className="placeholder-avatar">
                          <div className="placeholder-icon">
                            <UserPlus size={24} aria-hidden="true" />
                          </div>
                        </div>
                        <div className="placeholder-info">
                          <h4 className="placeholder-title">Your Spot Awaits</h4>
                          <p className="placeholder-text">Join our community</p>
                          <span className="placeholder-cta">Be the next member!</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <motion.p
              className="welcome-message"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true, amount: 0.3 }}
            >
              Let's give a warm welcome to our newest group members! Ready to join this amazing
              community?
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            className="no-users-message"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="no-users-icon">
              <Sparkles size={32} />
            </div>
            <h3>Be Our First Member!</h3>
            <p>Join our community and be part of something amazing from the beginning.</p>
          </motion.div>
        )}
      </section>

      {user && (
        <section id="friend-search" className="friend-search-section">
          <div className="section-header">
            <h2>Find a Friend</h2>
            <div className="section-divider">
              <span></span>
              <div className="divider-icon">
                <Search size={20} aria-hidden="true" />
              </div>
              <span></span>
            </div>
          </div>
          <div className="friend-search-content">
            <motion.div
              className="search-input-container"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, amount: 0.3 }}
            >
              <input
                type="text"
                placeholder="Search by name, username, or email..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyPress={handleSearchKeyPress}
                className="search-input"
              />
              <button className="search-button" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </motion.div>

            {searchPerformed && searchResults.length === 0 && (
              <motion.div
                className="no-results-message"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="no-results-icon">
                  <Search size={48} aria-hidden="true" />
                </div>
                <h3>No results found for "{searchQuery}"</h3>
                <p>Try a different search term or invite a friend directly.</p>
                {showReferralLink && (
                  <motion.div
                    className="referral-link-container"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    <p>
                      Don't see your friend?{' '}
                      <span className="referral-link" onClick={copyReferralLink}>
                        Copy invite link
                      </span>
                    </p>
                    {referralCopied && <span className="copied-message">Copied!</span>}
                  </motion.div>
                )}
              </motion.div>
            )}

            {searchPerformed && searchResults.length > 0 && (
              <motion.div
                className="search-results-container"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <h3>Search Results</h3>
                <div className="search-results-grid">
                  {searchResults.map((result, index) => (
                    <motion.div
                      key={result._id}
                      className="search-result-card"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true, amount: 0.3 }}
                      onClick={() => handleUserClick(result.username)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="user-avatar">
                        <img
                          src={result.profilePicture || '/avatar.jpg'}
                          alt={`${result.fullName}'s profile`}
                          onError={(e: SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.src = '/avatar.jpg';
                          }}
                        />
                      </div>
                      <div className="user-info">
                        <h4 className="user-name">{result.fullName}</h4>
                        <p className="user-username">@{result.username}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}

      <section id="events" className="events-section">
        <div className="section-header">
          <h2>Upcoming Events</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">
              <Calendar size={20} />
            </div>
            <span></span>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="cta-secondary" onClick={() => setShowCreateModal(true)}>
              + Create Event
            </button>
          </div>
        )}

        {eventsLoading ? (
          <motion.div
            className="no-events-message"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
            style={{ textAlign: 'center', padding: '40px 20px' }}
          >
            Loading events...
          </motion.div>
        ) : events.length === 0 ? (
          <motion.div
            className="no-events-message"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
            style={{
              textAlign: 'center',
              padding: '50px 20px',
              fontSize: '1.2rem',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}
          >
            <div className="no-events-icon" style={{ marginBottom: '20px' }}>
              <Calendar size={48} aria-hidden="true" />
            </div>
            <h3>Nothing to see here yet</h3>
            <p>Stay tuned for our upcoming events!</p>
          </motion.div>
        ) : (
          <div className="events-grid" data-count={events.length}>
            {events.map((ev) => {
              const dt = new Date(ev.startTime);
              const formatted = dt.toLocaleString('en-US', {
                timeZone: 'America/Detroit',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
              return (
                <motion.div
                  key={ev._id}
                  className="event-card"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true, amount: 0.2 }}
                  onClick={() => setSelectedEvent(ev)}
                >
                  {ev.thumbnailUrl && (
                    <img
                      src={ev.thumbnailUrl}
                      alt={ev.title}
                      style={{
                        width: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  )}
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{formatted}</div>
                    {ev.meetupUrl && (
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                        <a
                          href={ev.meetupUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                          className="event-meetup-btn"
                          title="Reserve your spot on Meetup"
                        >
                          <img src="/meetup.svg" alt="Meetup" />
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          className="view-all-container"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, amount: 0.1 }}
        >
          <button className="view-all-button" onClick={() => navigate('/events')}>
            View All Events
          </button>
        </motion.div>
      </section>

      {showCreateModal && isAdmin && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onEventCreated={(event: HubEvent) => {
            setEvents((prev) => [event, ...prev].slice(0, 6));
          }}
        />
      )}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          isAdmin={isAdmin}
          onClose={() => setSelectedEvent(null)}
          onEventUpdated={(updated: HubEvent) => {
            setEvents((prev) => prev.map((ev) => (ev._id === updated._id ? updated : ev)));
            setSelectedEvent(updated);
          }}
          onEventDeleted={(id: string) => {
            setEvents((prev) => prev.filter((ev) => ev._id !== id));
            setSelectedEvent(null);
          }}
        />
      )}

      <section className="cta-section">
        <motion.div
          className="cta-card"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2>{user ? 'Welcome back!' : 'Ready to start your cloud journey?'}</h2>
          <p>
            {user
              ? 'Check out upcoming events and stay connected with the community.'
              : 'Join our community today and get access to workshops, networking events, and resources to accelerate your career.'}
          </p>
          <button className="join-button pulse-animation" onClick={handleJoinClick}>
            {user ? 'View Events' : 'Join the Group'}
          </button>
        </motion.div>
      </section>
      <SocialLinks />
    </div>
  );
}

export default Landing;
