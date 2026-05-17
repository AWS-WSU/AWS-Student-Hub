import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Target, Star, Trophy } from 'lucide-react';
import './styles/Challenges.css';
import '../pages/styles/Landing.css';

function Challenges({ theme: _theme }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChallenges = async () => {
      setLoading(false);
    };
    loadChallenges();
  }, []);

  const handleSignIn = () => {
    navigate('/auth?redirect=/challenges');
  };

  const filteredChallenges = challenges.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'single') return c.type === 'single';
    if (activeTab === 'multi') return c.type === 'multi';
    if (activeTab === 'completed') return c.completed;
    return true;
  });

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return '#4ade80';
      case 'Medium':
        return '#fbbf24';
      case 'Hard':
        return '#f87171';
      default:
        return '#94a3b8';
    }
  };

  return (
    <div className="landing-container">
      <section className="challenges-section">
        <div className="section-header">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Challenges
          </motion.h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">
              <Target size={20} />
            </div>
            <span></span>
          </div>
          <motion.p
            className="section-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Test your skills with OSINT-inspired challenges and earn rewards
          </motion.p>
        </div>

        {!user && (
          <motion.div
            className="challenges-auth-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p>Sign in to track your progress and earn points</p>
            <button onClick={handleSignIn}>Sign In</button>
          </motion.div>
        )}

        <div className="challenges-tabs">
          <button
            className={activeTab === 'all' ? 'active' : ''}
            onClick={() => setActiveTab('all')}
          >
            All Challenges
          </button>
          <button
            className={activeTab === 'single' ? 'active' : ''}
            onClick={() => setActiveTab('single')}
          >
            Single Goal
          </button>
          <button
            className={activeTab === 'multi' ? 'active' : ''}
            onClick={() => setActiveTab('multi')}
          >
            Multi-Part
          </button>
          <button
            className={activeTab === 'completed' ? 'active' : ''}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>

        <div className="challenges-grid">
          {loading ? (
            <div className="challenges-loading">Loading challenges...</div>
          ) : filteredChallenges.length === 0 ? (
            <div className="challenges-empty">No challenges found</div>
          ) : (
            filteredChallenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                className={`challenge-card ${challenge.completed ? 'completed' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <div className="challenge-card-header">
                  <span
                    className="challenge-difficulty"
                    style={{ color: getDifficultyColor(challenge.difficulty) }}
                  >
                    {challenge.difficulty}
                  </span>
                  <span className="challenge-points">{challenge.points} pts</span>
                </div>

                <h3 className="challenge-title">{challenge.title}</h3>
                <p className="challenge-description">{challenge.description}</p>

                <div className="challenge-card-footer">
                  <span className="challenge-type">
                    {challenge.type === 'multi'
                      ? `Multi-Part (${challenge.completedParts}/${challenge.parts})`
                      : 'Single Goal'}
                  </span>
                  <button className="challenge-start-btn">
                    {challenge.completed ? 'View' : 'Start'}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <motion.div
          className="challenges-info"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2>How It Works</h2>
          <div className="info-cards">
            <div className="info-card">
              <Target className="info-icon" size={32} />
              <h3>Complete Challenges</h3>
              <p>Solve OSINT-style puzzles that test your investigative and technical skills</p>
            </div>
            <div className="info-card">
              <Star className="info-icon" size={32} />
              <h3>Earn Points</h3>
              <p>Each challenge rewards you with points based on difficulty</p>
            </div>
            <div className="info-card">
              <Trophy className="info-icon" size={32} />
              <h3>Get Rewards</h3>
              <p>Points sync with Prizeversity where you can redeem real rewards</p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default Challenges;
