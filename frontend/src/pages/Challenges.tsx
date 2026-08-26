import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Link2, ShieldCheck, Star, Target, Trophy, X } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { challengeAPI } from '../utils/api';
import type { ChallengeListItem, ChallengeListResponse } from '../types/challenge';
import type { ThemeProps } from '../types';
import './styles/Challenges.css';
import '../pages/styles/Landing.css';

type ChallengeTab = 'all' | 'single' | 'multi' | 'completed';

const completedStatuses = new Set(['completed', 'reward_pending', 'reward_sent', 'reward_failed']);

const difficultyColors: Record<string, string> = {
  easy: '#4ade80',
  medium: '#fbbf24',
  hard: '#f87171',
  expert: '#c084fc',
};

const formatDifficulty = (difficulty: string): string => {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
};

const getChallengeStatusLabel = (challenge: ChallengeListItem): string => {
  const status = challenge.progress?.status;
  if (!status || status === 'not_started') return 'Not started';
  if (status === 'in_progress') return 'In progress';
  if (status === 'reward_failed') return 'Reward failed';
  if (status === 'reward_sent') return 'Completed';
  if (status === 'reward_pending') return 'Reward pending';
  return 'Completed';
};

function Challenges({ theme: _theme }: ThemeProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ChallengeTab>('all');
  const [challengeResponse, setChallengeResponse] = useState<ChallengeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rewardGateDismissed, setRewardGateDismissed] = useState<boolean>(false);
  const rewardGateDismissKey = user
    ? `awsStudentHub:challengeRewardGateDismissed:${user.id || user._id || user.email}`
    : '';

  useEffect(() => {
    let shouldUpdate = true;
    setLoading(true);
    setError('');

    challengeAPI
      .list()
      .then((response) => {
        if (shouldUpdate) {
          setChallengeResponse(response);
        }
      })
      .catch((err) => {
        if (shouldUpdate) {
          setError(err instanceof Error ? err.message : 'Failed to load challenges');
        }
      })
      .finally(() => {
        if (shouldUpdate) {
          setLoading(false);
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

  const rewardLink = challengeResponse?.rewardLink;
  const challenges = challengeResponse?.challenges || [];
  const rewardLinked = Boolean(rewardLink?.linked);
  const rewardConfigured = Boolean(rewardLink?.configured);
  const linkedInstanceIds = new Set(rewardLink?.linkedInstanceIds || []);
  const classroomCount = new Set(
    challenges.map((challenge) => challenge.rewardIntegrationInstanceId).filter(Boolean)
  ).size;

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

  const filteredChallenges = challenges.filter((challenge) => {
    const completed = completedStatuses.has(challenge.progress?.status || '');
    if (activeTab === 'single') return challenge.kind === 'single';
    if (activeTab === 'multi') return challenge.kind === 'multi_part';
    if (activeTab === 'completed') return completed;
    return true;
  });

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
            Solve technical labs, prove completion, and sync rewards through your linked classroom.
          </motion.p>
        </div>

        {!user && (
          <motion.div
            className="challenges-auth-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p>Sign in to track progress and earn rewards.</p>
            <button onClick={handleSignIn}>Sign In</button>
          </motion.div>
        )}

        {user && rewardLink && (!rewardLinked || !rewardGateDismissed) && (
          <motion.div
            className={`challenges-reward-gate ${rewardLinked ? 'linked' : ''}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <div className="reward-gate-icon" aria-hidden="true">
              {rewardLinked ? <ShieldCheck size={26} /> : <Link2 size={26} />}
            </div>
            <div className="reward-gate-copy">
              <span>{rewardLinked ? 'Rewards connected' : 'Required before rewards'}</span>
              <h3>
                {rewardLinked
                  ? 'Prizeversity is linked for challenge rewards.'
                  : 'Link Prizeversity to complete rewardable challenges.'}
              </h3>
              <p>
                {rewardLinked
                  ? 'Challenge completions will sync to your verified Prizeversity classroom account.'
                  : rewardConfigured
                    ? 'Use Account Settings to verify the classroom account that should receive challenge progress.'
                    : 'An admin needs to configure a Prizeversity classroom instance before challenge rewards can be emitted.'}
              </p>
            </div>
            {!rewardLinked && (
              <button
                type="button"
                className="reward-gate-button"
                onClick={handleLinkPrizeversity}
                disabled={!rewardConfigured}
              >
                Link in Account
              </button>
            )}
            {rewardLinked && (
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

        <div className="challenges-tabs">
          {(['all', 'single', 'multi', 'completed'] as ChallengeTab[]).map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'all'
                ? 'All Challenges'
                : tab === 'single'
                  ? 'Single Goal'
                  : tab === 'multi'
                    ? 'Multi-Part'
                    : 'Completed'}
            </button>
          ))}
        </div>

        {error && <div className="challenge-error-banner">{error}</div>}

        <div className="challenges-grid">
          {loading ? (
            <div className="challenges-loading">Loading challenges...</div>
          ) : filteredChallenges.length === 0 ? (
            <div className="challenges-empty">
              No published challenges match this view yet. Admins can publish challenges from the
              admin dashboard.
            </div>
          ) : (
            filteredChallenges.map((challenge, index) => {
              const completed = completedStatuses.has(challenge.progress?.status || '');
              const challengeRewardLinked = challenge.rewardIntegrationInstanceId
                ? linkedInstanceIds.has(challenge.rewardIntegrationInstanceId)
                : rewardLinked;
              const locked = Boolean(
                challenge.reward.enabled && user && rewardLink && !challengeRewardLinked
              );

              return (
                <motion.article
                  key={challenge.assignmentId || challenge.id}
                  className={`challenge-card ${completed ? 'completed' : ''} ${locked ? 'locked' : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.06 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <div className="challenge-card-header">
                    <div className="challenge-card-context">
                      <span
                        className="challenge-difficulty"
                        style={{ color: difficultyColors[challenge.difficulty] || '#94a3b8' }}
                      >
                        {formatDifficulty(challenge.difficulty)}
                      </span>
                      {challenge.classroom && classroomCount > 1 && (
                        <span className="challenge-classroom">
                          {challenge.classroom.classroomName || challenge.classroom.instanceName}
                        </span>
                      )}
                    </div>
                    {challenge.reward.enabled && (
                      <span className="challenge-points">{challenge.reward.bits} bits</span>
                    )}
                  </div>

                  <h3 className="challenge-title">{challenge.title}</h3>
                  <p className="challenge-description">{challenge.summary}</p>

                  <div className="challenge-card-meta">
                    <span>{challenge.kind === 'multi_part' ? 'Multi-part' : 'Single goal'}</span>
                    {challenge.estimatedMinutes ? (
                      <span>{challenge.estimatedMinutes} min</span>
                    ) : null}
                    <span>{getChallengeStatusLabel(challenge)}</span>
                  </div>

                  {locked && (
                    <div className="challenge-lock-note">
                      Link Prizeversity before submitting this rewardable challenge.
                    </div>
                  )}

                  <div className="challenge-card-footer">
                    <span className="challenge-type">
                      {challenge.tags.length
                        ? challenge.tags.slice(0, 2).join(' / ')
                        : 'AWS Student Builder Group'}
                    </span>
                    <button
                      type="button"
                      className="challenge-start-btn"
                      onClick={() =>
                        navigate(
                          `/challenges/${challenge.slug}${
                            challenge.assignmentId
                              ? `?assignmentId=${encodeURIComponent(challenge.assignmentId)}`
                              : ''
                          }`
                        )
                      }
                    >
                      {completed
                        ? 'Review'
                        : challenge.progress?.status === 'in_progress'
                          ? 'Resume'
                          : 'Start'}
                    </button>
                  </div>
                </motion.article>
              );
            })
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
              <h3>Start a Lab</h3>
              <p>Open a challenge, follow the instructions, and submit proof from the lab.</p>
            </div>
            <div className="info-card">
              <Star className="info-icon" size={32} />
              <h3>Validate Progress</h3>
              <p>The backend validator checks your answer and records every attempt safely.</p>
            </div>
            <div className="info-card">
              <Trophy className="info-icon" size={32} />
              <h3>Sync Rewards</h3>
              <p>
                Completed rewardable challenges emit rewards to your linked Prizeversity account.
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default Challenges;
