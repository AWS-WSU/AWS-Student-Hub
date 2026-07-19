import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cloud, Code2, Target } from 'lucide-react';
import '../pages/styles/Landing.css';

function About() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="landing-container">
      <section id="about" className="about-section">
        <div className="section-header">
          <h2>About Our Group</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">
              <Cloud size={20} />
            </div>
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
              <Target size={22} aria-hidden="true" />
            </div>
            <h3>Our Mission</h3>
            <p>
              To empower Wayne State students with AWS cloud skills, foster innovation, and connect
              members with industry opportunities.
            </p>
          </motion.div>

          <motion.div
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <Code2 size={22} aria-hidden="true" />
            </div>
            <h3>What We Do</h3>
            <p>
              We organize workshops, real world open-source project contributions, certification
              study groups, hackathons, and networking events with industry professionals.
            </p>
          </motion.div>

          <motion.div
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <Cloud size={22} aria-hidden="true" />
            </div>
            <h3>Why AWS?</h3>
            <p>
              AWS leads cloud computing worldwide. Skills in AWS are highly sought after, offering
              students a competitive advantage in the job market. Open source projects are available
              for all students looking for a boost in their resume.
            </p>
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
            <span className="stat-label">Group Members</span>
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
          <button
            className="join-button pulse-animation"
            onClick={() => navigate(user ? '/events' : '/auth?mode=signup')}
          >
            {user ? 'View Events' : 'Join the Group'}
          </button>
        </motion.div>
      </section>
    </div>
  );
}

export default About;
