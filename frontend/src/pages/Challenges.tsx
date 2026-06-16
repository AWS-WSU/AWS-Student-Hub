import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Link2, ShieldCheck, Target, Star, Trophy, X } from 'lucide-react';
import { rewardIntegrationAPI } from '../utils/api';
import type { ThemeProps } from '../types';
import type { RewardIntegrationStatusResponse } from '../types/rewardIntegration';
import './styles/Challenges.css';
import '../pages/styles/Landing.css';

type ChallengeTab = 'all' | 'single' | 'multi' | 'completed';
type ChallengeType = 'single' | 'multi';
type ChallengeDifficulty = 'Easy' | 'Medium' | 'Hard' | string;

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  points: number;
  type: ChallengeType;
  completed?: boolean;
  completedParts?: number;
  parts?: number;
}

function Challenges({ theme: _theme }: ThemeProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ChallengeTab>('all');
  const [challenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardStatus, setRewardStatus] = useState<RewardIntegrationStatusResponse | null>(null);
  const [rewardStatusLoading, setRewardStatusLoading] = useState<boolean>(false);
  const [rewardStatusError, setRewardStatusError] = useState<string>('');
  const [rewardGateDismissed, setRewardGateDismissed] = useState<boolean>(false);
  const rewardGateDismissKey = user
    ? `awsStudentHub:challengeRewardGateDismissed:${user.id || user._id || user.email}`
    : '';

  useEffect(() => {
    const loadChallenges = async () => {
      setLoading(false);
    };
    loadChallenges();
  }, []);

  useEffect(() => {
    if (!user) {
      setRewardStatus(null);
      setRewardStatusError('');
      return;
    }

    let shouldUpdate = true;
    setRewardStatusLoading(true);
    setRewardStatusError('');

    rewardIntegrationAPI
      .status()
      .then((status) => {
        if (shouldUpdate) {
          setRewardStatus(status);
        }
      })
      .catch((err) => {
        if (shouldUpdate) {
          setRewardStatusError(
            err instanceof Error ? err.message : 'Failed to load Prizeversity link status'
          );
        }
      })
      .finally(() => {
        if (shouldUpdate) {
          setRewardStatusLoading(false);
        }
      });

    return () => {
      shouldUpdate = false;
    };
  }, [user]);

  useEffect(() => {
    if (!rewardGateDismissKey) {
      setRewardGateDismissed(false);
      return;
    }

    setRewardGateDismissed(localStorage.getItem(rewardGateDismissKey) === 'true');
  }, [rewardGateDismissKey]);

  const handleSignIn = () => {
    navigate('/auth?redirect=/challenges');
  };

  const handleLinkPrizeversity = () => {
    navigate('/account#prizeversity-rewards');
  };

  const handleDismissRewardGate = () => {
    if (rewardGateDismissKey) {
      localStorage.setItem(rewardGateDismissKey, 'true');
    }
    setRewardGateDismissed(true);
  };

  const filteredChallenges = challenges.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'single') return c.type === 'single';
    if (activeTab === 'multi') return c.type === 'multi';
    if (activeTab === 'completed') return c.completed;
    return true;
  });

  const getDifficultyColor = (difficulty: ChallengeDifficulty): string => {
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

        {user && (!rewardStatus?.linked || !rewardGateDismissed) && (
          <motion.div
            className={`challenges-reward-gate ${rewardStatus?.linked ? 'linked' : ''}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <div className="reward-gate-icon" aria-hidden="true">
              {rewardStatus?.linked ? <ShieldCheck size={26} /> : <Link2 size={26} />}
            </div>
            <div className="reward-gate-copy">
              <span>{rewardStatus?.linked ? 'Rewards connected' : 'Required before play'}</span>
              <h3>
                {rewardStatus?.linked
                  ? 'Prizeversity is linked for challenge rewards.'
                  : 'Link Prizeversity to unlock rewardable challenges.'}
              </h3>
              <p>
                {rewardStatusLoading
                  ? 'Checking your classroom reward link...'
                  : rewardStatusError
                    ? rewardStatusError
                    : rewardStatus?.linked
                      ? `Completions will sync to ${rewardStatus.account?.matchedName || rewardStatus.account?.email || 'your Prizeversity classroom account'}.`
                      : rewardStatus && !rewardStatus.configured
                        ? 'An admin needs to configure a Prizeversity classroom instance before challenges can award progress.'
                        : 'Use your AWS Student Hub profile to connect the Prizeversity classroom account that will receive challenge progress and rewards.'}
              </p>
            </div>
            {!rewardStatus?.linked && (
              <button
                type="button"
                className="reward-gate-button"
                onClick={handleLinkPrizeversity}
                disabled={rewardStatusLoading || Boolean(rewardStatus && !rewardStatus.configured)}
              >
                Link in Account
              </button>
            )}
            {rewardStatus?.linked && (
              <button
                type="button"
                className="reward-gate-dismiss"
                onClick={handleDismissRewardGate}
                aria-label="Dismiss rewards connected message"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </motion.div>
        )}

        <motion.div
          className="challenges-coming-soon"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <span className="coming-soon-badge">Coming soon</span>
          <h3>Challenge Hub is under active development</h3>
          <p>
            We are rebuilding the challenge experience with progress tracking, points, and rewards.
            Check back here for updates as the new system rolls out.
          </p>
        </motion.div>

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
            <div className="challenges-empty">
              New challenges are coming soon. Thanks for your patience while we finish building this
              experience.
            </div>
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
