import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { authAPI } from '../utils/api';
import './styles/PublicProfile.css';

const languageIcons = {
  'JavaScript': '/js.svg',
  'Python': '/py.svg',
  'Java': '/java.svg',
  'C++': '/cpp.svg',  
  'C#': '/csharp.svg',
  'React': '/jsx.svg',
  'Node.js': '/js.svg',
  'TypeScript': '/ts.svg',
  'Swift': '/swift.svg',
  'Kotlin': '/kotlin.svg',
  'Ruby': '/ruby.svg',
  'Go': '/go.svg',
  'Rust': '/rs.svg',
  'HTML/CSS': '/html.svg',
  'SQL': '/sql.svg'
};

const getStatusDisplay = (role) => {
  switch (role?.toLowerCase()) {
    case 'superuser':
      return { 
        title: 'President', 
        icon: '/pres.svg',
        isPresident: true 
      };
    case 'admin':
      return { 
        title: 'Site Admin', 
        icon: '/admin.svg',
        isPresident: false 
      };
    case 'moderator':
      return { 
        title: 'Site Moderator', 
        icon: '/mod.svg',
        isPresident: false 
      };
    case 'member':
    default:
      return { 
        title: 'AWS Cloud Member', 
        icon: null,
        isPresident: false 
      };
  }
};

function PublicProfile({ theme, toggleTheme }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setError('Username is required');
        setLoading(false);
        return;
      }

      try {
        const response = await authAPI.getPublicProfile(username);
        setProfile(response.profile);
      } catch (err) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const scrollToSection = (sectionId) => {
    navigate(`/#${sectionId}`);
  };

  const formatLastSeen = (lastLogin, daysSinceLastSeen) => {
    if (daysSinceLastSeen === 0) {
      return 'Active today';
    } else if (daysSinceLastSeen === 1) {
      return 'Active yesterday';
    } else if (daysSinceLastSeen < 7) {
      return `Active ${daysSinceLastSeen} days ago`;
    } else if (daysSinceLastSeen < 30) {
      const weeks = Math.floor(daysSinceLastSeen / 7);
      return `Active ${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return new Date(lastLogin).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  if (loading) {
    return (
      <div className="public-profile-container">
        <Navbar 
          theme={theme} 
          toggleTheme={toggleTheme} 
          activeSection="" 
          scrollToSection={scrollToSection}
        />
        <div className="profile-loading">
          <motion.div 
            className="loading-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            ⚙️
          </motion.div>
          <p>Loading profile...</p>
        </div>
        <Footer theme={theme} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-profile-container">
        <Navbar 
          theme={theme} 
          toggleTheme={toggleTheme} 
          activeSection="" 
          scrollToSection={scrollToSection}
        />
        <div className="profile-error">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="error-content"
          >
            <div className="error-icon">😞</div>
            <h2>Profile Not Found</h2>
            <p>{error}</p>
            <motion.button
              className="back-home-btn"
              onClick={() => navigate('/')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Back to Home
            </motion.button>
          </motion.div>
        </div>
        <Footer theme={theme} />
      </div>
    );
  }

  return (
    <div className="public-profile-container">
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        activeSection="" 
        scrollToSection={scrollToSection}
      />
      
      <div className="profile-content">
        <motion.button 
          className="back-button"
          onClick={() => navigate(-1)}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          ← Back
        </motion.button>

        <motion.div 
          className={`profile-header ${getStatusDisplay(profile.role).isPresident ? 'president-header' : ''}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              <img 
                src={profile.profilePicture || '/account.svg'} 
                alt={`${profile.fullName}'s profile`}
                onError={(e) => {
                  e.target.src = '/account.svg';
                }}
              />
              <div className="avatar-border"></div>
            </div>
          </div>
          
          <div className="profile-info">
            <h1 className="profile-name">{profile.fullName}</h1>
            <p className="profile-username">@{profile.username}</p>
            <p className="profile-member-since">
              Member since {profile.stats.memberSince}
            </p>
          </div>
        </motion.div>

        <motion.div 
          className="profile-stats"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="stat-card">
            <div className="stat-icon"><img src="/calendar.svg" alt="Days as Member" style={{ width: '32px', height: '32px' }} /></div>
            <div className="stat-content">
              <h3>Days as Member</h3>
              <p>{profile.stats.daysSinceJoin}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon"><img src="/activity.svg" alt="Last Seen" style={{ width: '32px', height: '32px' }} /></div>
            <div className="stat-content">
              <h3>Last Seen</h3>
              <p>{formatLastSeen(profile.lastLogin, profile.stats.daysSinceLastSeen)}</p>
            </div>
          </div>
          
          <div className={`stat-card ${getStatusDisplay(profile.role).isPresident ? 'president-status' : ''}`}>
            <div className="stat-icon">
              {getStatusDisplay(profile.role).icon ? (
                <img 
                  src={getStatusDisplay(profile.role).icon} 
                  alt={getStatusDisplay(profile.role).title}
                  className={`role-icon ${getStatusDisplay(profile.role).isPresident ? 'president-icon' : ''}`}
                  style={{ width: '32px', height: '32px' }}
                />
              ) : (
                <img src={theme === 'dark' ? '/aws-light.svg' : '/aws.svg'} alt="Status" style={{ width: '32px', height: '32px' }} />
              )}
            </div>
            <div className="stat-content">
              <h3>Status</h3>
              <p className={getStatusDisplay(profile.role).isPresident ? 'president-title' : ''}>
                {getStatusDisplay(profile.role).title}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="profile-bio"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3>About {profile.fullName.split(' ')[0]}</h3>
          <div className="bio-content">
            {profile.bio ? (
              <p className="user-bio">{profile.bio}</p>
            ) : (
              <p className="default-bio">
                {profile.fullName} is an active member of the Wayne State University AWS Cloud Computing Club. 
                {profile.stats.daysSinceJoin < 30 ? ' They recently joined our community' : ' They have been part of our community'} 
                {profile.stats.daysSinceJoin >= 365 ? ' for over a year' : 
                 profile.stats.daysSinceJoin >= 30 ? ` for ${Math.floor(profile.stats.daysSinceJoin / 30)} month${Math.floor(profile.stats.daysSinceJoin / 30) > 1 ? 's' : ''}` : 
                 ` ${profile.stats.daysSinceJoin} day${profile.stats.daysSinceJoin > 1 ? 's' : ''} ago`} 
                and is actively learning about cloud computing technologies with AWS.
              </p>
            )}
          </div>

          {(profile.major || profile.grade) && (
            <motion.div 
              className="academic-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <h4>Academic Information</h4>
              <div className="academic-details">
                {profile.major && (
                  <div className="academic-item">
                    <span className="academic-label">Major:</span>
                    <span className="academic-value">{profile.major}</span>
                  </div>
                )}
                {profile.grade && (
                  <div className="academic-item">
                    <span className="academic-label">Level:</span>
                    <span className="academic-value">{profile.grade}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {profile.programmingLanguages && profile.programmingLanguages.length > 0 && (
            <motion.div 
              className="programming-skills"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <h4>Programming Skills</h4>
              <div className="skills-grid">
                {profile.programmingLanguages.map((language, index) => (
                  <motion.span 
                    key={language} 
                    className="skill-chip"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.7 + (index * 0.1) }}
                  >
                    {languageIcons[language] && (
                      <img 
                        src={languageIcons[language]} 
                        alt={language}
                        className="skill-chip-icon"
                      />
                    )}
                    <span className="skill-chip-name">{language}</span>
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
          
          <div className="join-cta">
            <p>Interested in joining our AWS community?</p>
            <motion.button
              className="join-community-btn"
              onClick={() => navigate('/auth?mode=signup')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Join the Club
            </motion.button>
          </div>
        </motion.div>
      </div>
      
      <Footer theme={theme} />
    </div>
  );
}

export default PublicProfile; 