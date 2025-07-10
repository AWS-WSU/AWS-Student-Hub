import { useState, useEffect, useRef } from 'react';
import './styles/Landing.css';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SocialLinks from '../components/SocialLinks';
import { authAPI } from '../utils/api';

function Landing({ theme, toggleTheme }) {
  const [activeSection, setActiveSection] = useState('home');
  const [recentUsers, setRecentUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const sectionsRef = useRef({});
  const navigate = useNavigate();
  
  // Intersection Observer for sections
  useEffect(() => {
    const observers = [];
    const sections = ['home', 'about', 'events', 'resources'];
    
    sections.forEach(section => {
      if (sectionsRef.current[section]) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActiveSection(section);
            }
          },
          { threshold: 0.3 }
        );
        
        observer.observe(sectionsRef.current[section]);
        observers.push(observer);
      }
    });
    
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  useEffect(() => {
    const fetchRecentUsers = async () => {
      try {
        const response = await authAPI.getRecentUsers(6);
        setRecentUsers(response.users || []);
      } catch (error) {
        console.error('Error fetching recent users:', error);
        setRecentUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchRecentUsers();
  }, []);

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleJoinClick = () => {
    navigate('/auth?mode=signup');
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
  };

  return (
    <div className="landing-container">
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        activeSection={activeSection} 
        scrollToSection={scrollToSection} 
        themeIcon={theme === 'light' ? "/dark.svg" : "/light.svg"}
      />
      
      <section id="home" className="hero-section" ref={el => sectionsRef.current.home = el}>
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
              src={theme === 'light' ? "/aws-logo-dark.svg" : "/aws-logo-light.svg"} 
              alt="AWS Logo" 
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
              <span className="gradient-text animated-text">
                Building The Future
              </span>
            </span>
            <span className="hero-subtitle">
              with Cloud Computing
            </span>
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
              Join the Club
            </button>
            <button className="cta-secondary" onClick={() => scrollToSection('about')}>
              Learn More
            </button>
          </motion.div>
          
          <motion.div 
            className="scroll-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            onClick={() => scrollToSection('about')}
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
            <div className="divider-icon">👋</div>
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
              {recentUsers.map((user, index) => (
                <motion.div
                  key={user._id}
                  className="welcome-user-card"
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  onClick={() => handleUserClick(user.username)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="user-avatar">
                    <img 
                      src={user.profilePicture || '/account.svg'} 
                      alt={`${user.fullName}'s profile`}
                      onError={(e) => {
                        e.target.src = '/account.svg';
                      }}
                    />
                    <div className="avatar-ring"></div>
                  </div>
                  <div className="user-info">
                    <h4 className="user-name">{user.fullName}</h4>
                    <p className="user-username">@{user.username}</p>
                    <span className="join-date">
                      Joined {new Date(user.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="welcome-badge">
                    <i className="fas fa-star"></i>
                    <span>New</span>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.p 
              className="welcome-message"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true, amount: 0.3 }}
            >
              Let's give a warm welcome to our newest club members! 🎉 
              Ready to join this amazing community?
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
            <div className="no-users-icon">🌟</div>
            <h3>Be Our First Member!</h3>
            <p>Join our community and be part of something amazing from the beginning.</p>
          </motion.div>
        )}
      </section>

      <section id="about" className="about-section" ref={el => sectionsRef.current.about = el}>
        <div className="section-header">
          <h2>About Our Club</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">☁️</div>
            <span></span>
          </div>
        </div>
        
        <div className="about-content">
          <motion.div 
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <i className="fas fa-bullseye"></i>
            </div>
            <h3>Our Mission</h3>
            <p>To empower Wayne State students with AWS cloud skills, foster innovation, and connect members with industry opportunities.</p>
          </motion.div>
          
          <motion.div 
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <i className="fas fa-laptop-code"></i>
            </div>
            <h3>What We Do</h3>
            <p>We organize workshops, real world open-source project contributions, certification study groups, hackathons, and networking events with industry professionals.</p>
          </motion.div>
          
          <motion.div 
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <i className="fas fa-cloud"></i>
            </div>
            <h3>Why AWS?</h3>
            <p>AWS leads cloud computing worldwide. Skills in AWS are highly sought after, offering students a competitive advantage in the job market. Open source projects are available for all students looking for a boost in their resume.</p>
          </motion.div>
        </div>
        
        <motion.div 
          className="stats-container"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="stat-item">
            <span className="stat-number">250+</span>
            <span className="stat-label">Club Members</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">6+</span>
            <span className="stat-label">Events Per Year</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">FREE</span>
            <span className="stat-label">Chances for Certifications</span>
          </div>
        </motion.div>
      </section>

      <section id="events" className="events-section" ref={el => sectionsRef.current.events = el}>
        <div className="section-header">
          <h2>Upcoming Events</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">📅</div>
            <span></span>
          </div>
        </div>
        
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
            fontStyle: 'italic'
          }}
        >
          <div className="no-events-icon" style={{ fontSize: '3rem', marginBottom: '20px' }}>
            🗓️
          </div>
          <h3>Nothing to see here yet</h3>
          <p>Stay tuned for our upcoming events!</p>
        </motion.div>
        
        <motion.div 
          className="view-all-container"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, amount: 0.1 }}
        >
          <button className="view-all-button">View All Events</button>
        </motion.div>
      </section>

      <section id="resources" className="resources-section" ref={el => sectionsRef.current.resources = el}>
        <div className="section-header">
          <h2>Club Resources</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">🔗</div>
            <span></span>
          </div>
        </div>
        
        <div className="resources-container">
          <motion.div 
            className="resource-card"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <h3>AWS Free Tier Access</h3>
            <p>Get started with AWS services at no cost through our educational partnership.</p>
            <a href="#" className="resource-link">Access Now <i className="fas fa-arrow-right"></i></a>
          </motion.div>
          
          <motion.div 
            className="resource-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <i className="fas fa-certificate"></i>
            </div>
            <h3>Certification Vouchers</h3>
            <p>Active members may qualify for discounted AWS certification exam vouchers.</p>
            <a href="#" className="resource-link">Learn More <i className="fas fa-arrow-right"></i></a>
          </motion.div>
          
          <motion.div 
            className="resource-card"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <i className="fas fa-book"></i>
            </div>
            <h3>Learning Materials</h3>
            <p>Access our curated collection of guides, tutorials, and practice exercises.</p>
            <a href="#" className="resource-link">Browse Library <i className="fas fa-arrow-right"></i></a>
          </motion.div>
        </div>
        
        <motion.div 
          className="testimonials-container"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <h3>What Our Members Say</h3>
          <div className="testimonials-slider">
            <div className="testimonial">
              <p>"The AWS Club helped me land my dream job as a cloud engineer. The certification prep and hands-on labs were invaluable."</p>
              <div className="testimonial-author">
                <img src="/avatar.svg" alt="Jane Doe" />
                <div>
                  <strong>Jane Doe</strong>
                  <span>Computer Science, '22</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
      
      <section className="cta-section">
        <motion.div 
          className="cta-card"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2>Ready to start your cloud journey?</h2>
          <p>Join our community today and get access to workshops, networking events, and resources to accelerate your career.</p>
          <button className="join-button pulse-animation" onClick={handleJoinClick}>
            Join the Club
          </button>
        </motion.div>
      </section>
      <SocialLinks />

      <Footer theme={theme} />
    </div>
  );
}

export default Landing;
