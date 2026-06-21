import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Link2, Lock, Send, ShieldCheck, Trophy } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { challengeAPI } from '../utils/api';
import type {
  ChallengeDetail as ChallengeDetailType,
  ChallengeProgress,
  ChallengeRewardLinkSummary,
  ChallengeSubmitResponse,
} from '../types/challenge';
import type { ThemeProps } from '../types';
import type { CSSProperties } from 'react';
import './styles/Challenges.css';

const completedStatuses = new Set(['completed', 'reward_pending', 'reward_sent', 'reward_failed']);
type RewardBurstStyle = CSSProperties & { '--burst-index': number };

const getStatusCopy = (progress?: ChallengeProgress | null): string => {
  if (!progress || progress.status === 'not_started') return 'Not started';
  if (progress.status === 'in_progress') return 'In progress';
  if (progress.status === 'reward_pending') return 'Reward pending';
  if (progress.status === 'reward_sent') return 'Completed and rewarded';
  if (progress.status === 'reward_failed') return 'Completed, reward failed';
  return 'Completed';
};

const getRewardSummary = (challenge: ChallengeDetailType): string => {
  if (!challenge.reward.enabled) return 'No reward configured';
  const rewards = [`${challenge.reward.bits} bits`];
  if (challenge.reward.xpAmount && challenge.reward.xpAmount > 0) {
    rewards.push(`${challenge.reward.xpAmount} XP`);
  }
  return rewards.join(' + ');
};

const getRewardStatusCopy = (
  responseReward?: ChallengeSubmitResponse['reward'],
  progress?: ChallengeProgress | null
): string => {
  const status = responseReward?.status || progress?.status;
  if (status === 'sent' || status === 'already_sent' || status === 'reward_sent') {
    return 'Reward synced successfully.';
  }
  if (status === 'failed' || status === 'reward_failed') {
    return 'Challenge completed, but reward sync needs attention.';
  }
  if (status === 'not_required' || status === 'completed') {
    return 'Challenge completed.';
  }
  return 'Reward sync pending.';
};

function ChallengeDetail({ theme: _theme }: ThemeProps) {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeDetailType | null>(null);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [rewardLink, setRewardLink] = useState<ChallengeRewardLinkSummary | null>(null);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [lastSubmitReward, setLastSubmitReward] = useState<ChallengeSubmitResponse['reward']>();

  useEffect(() => {
    let shouldUpdate = true;
    setLoading(true);
    setError('');

    challengeAPI
      .get(slug)
      .then((response) => {
        if (!shouldUpdate) return;
        setChallenge(response.challenge);
        setProgress(response.challenge.progress || null);
        setRewardLink(response.rewardLink);
      })
      .catch((err) => {
        if (shouldUpdate) {
          setError(err instanceof Error ? err.message : 'Failed to load challenge');
        }
      })
      .finally(() => {
        if (shouldUpdate) setLoading(false);
      });

    return () => {
      shouldUpdate = false;
    };
  }, [slug]);

  const isCompleted = completedStatuses.has(progress?.status || '');
  const rewardLocked = Boolean(
    user && challenge?.reward.enabled && rewardLink && !rewardLink.linked
  );
  const handleStart = async () => {
    if (!user) {
      navigate(`/auth?redirect=/challenges/${slug}`);
      return;
    }

    setStarting(true);
    setError('');
    setSuccess('');

    try {
      const response = await challengeAPI.start(slug);
      setChallenge(response.challenge);
      setProgress(response.progress);
      setSuccess('Challenge started.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start challenge');
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!secret.trim()) {
      setError('Enter the challenge secret before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await challengeAPI.submit(slug, { secret });
      setProgress(response.progress);
      setSuccess(response.message);
      if (response.accepted && response.completed) {
        setSecret('');
        setLastSubmitReward(response.reward);
        setRewardModalOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit challenge');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="landing-container">
        <section className="challenge-detail-section">
          <div className="challenges-loading">Loading challenge...</div>
        </section>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="landing-container">
        <section className="challenge-detail-section">
          <Link to="/challenges" className="challenge-back-link">
            <ArrowLeft size={16} /> Back to Challenges
          </Link>
          <div className="challenges-empty">{error || 'Challenge not found.'}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="landing-container">
      <section className="challenge-detail-section">
        <Link to="/challenges" className="challenge-back-link">
          <ArrowLeft size={16} /> Back to Challenges
        </Link>

        <motion.div
          className="challenge-detail-hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="challenge-detail-eyebrow">{challenge.difficulty}</span>
            <h1>{challenge.title}</h1>
            <p>{challenge.summary}</p>
          </div>
          <div className="challenge-detail-status">
            <ShieldCheck size={24} aria-hidden="true" />
            <span>{getStatusCopy(progress)}</span>
          </div>
        </motion.div>

        {error && <div className="challenge-error-banner">{error}</div>}
        {success && <div className="challenge-success-banner">{success}</div>}

        {rewardLocked && (
          <div className="challenge-detail-gate">
            <Link2 size={22} aria-hidden="true" />
            <div>
              <strong>Prizeversity link required</strong>
              <span>
                This challenge is rewardable. Link your Prizeversity classroom account before
                submitting completion.
              </span>
            </div>
            <button type="button" onClick={() => navigate('/account#prizeversity-rewards')}>
              Link account
            </button>
          </div>
        )}

        <div className="challenge-detail-grid">
          <article className="challenge-detail-panel">
            <h2>Instructions</h2>
            <p>{challenge.description}</p>
            {challenge.instructions && (
              <div className="challenge-instructions">{challenge.instructions}</div>
            )}

            <div className="challenge-detail-meta-grid">
              <div>
                <span>Type</span>
                <strong>{challenge.kind === 'multi_part' ? 'Multi-part' : 'Single goal'}</strong>
              </div>
              <div>
                <span>Attempts</span>
                <strong>{progress?.attemptCount || 0}</strong>
              </div>
              <div>
                <span>Reward</span>
                <strong>{getRewardSummary(challenge)}</strong>
              </div>
              <div>
                <span>Version</span>
                <strong>{challenge.version}</strong>
              </div>
            </div>
          </article>

          <aside className="challenge-detail-panel challenge-submit-panel">
            <h2>Submit Proof</h2>
            {!user ? (
              <div className="challenge-submit-state">
                <Lock size={22} aria-hidden="true" />
                <p>Sign in to start this challenge and submit proof.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/auth?redirect=/challenges/${slug}`)}
                >
                  Sign in
                </button>
              </div>
            ) : !progress || progress.status === 'not_started' ? (
              <div className="challenge-submit-state">
                <Trophy size={22} aria-hidden="true" />
                <p>Start this challenge to track attempts and unlock the submission form.</p>
                <button type="button" onClick={handleStart} disabled={starting}>
                  {starting ? 'Starting...' : 'Start challenge'}
                </button>
              </div>
            ) : isCompleted ? (
              <div className="challenge-submit-state success">
                <CheckCircle2 size={24} aria-hidden="true" />
                <p>{getStatusCopy(progress)}</p>
                {challenge.reward.enabled && (
                  <div className="challenge-earned-summary">
                    <span>Earned</span>
                    <strong>{getRewardSummary(challenge)}</strong>
                    <small>{getRewardStatusCopy(undefined, progress)}</small>
                  </div>
                )}
                {progress.lastValidationMessage && <small>{progress.lastValidationMessage}</small>}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="challenge-submit-form">
                <label>
                  Challenge secret
                  <input
                    type="text"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    placeholder="Paste the secret value"
                    disabled={submitting || rewardLocked}
                  />
                </label>
                <button type="submit" disabled={submitting || rewardLocked}>
                  <Send size={16} aria-hidden="true" />
                  {submitting ? 'Submitting...' : 'Submit challenge'}
                </button>
                {progress.lastValidationMessage && <small>{progress.lastValidationMessage}</small>}
              </form>
            )}
          </aside>
        </div>
      </section>

      {rewardModalOpen && (
        <div className="reward-celebration-overlay" role="dialog" aria-modal="true">
          <motion.div
            className="reward-celebration-modal"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="reward-burst" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, index) => (
                <span key={index} style={{ '--burst-index': index } as RewardBurstStyle} />
              ))}
            </div>

            <div className="reward-celebration-icon" aria-hidden="true">
              <Trophy size={34} />
            </div>

            <span className="reward-celebration-eyebrow">Challenge complete</span>
            <h2>{challenge.title}</h2>
            <p>{getRewardStatusCopy(lastSubmitReward, progress)}</p>

            {challenge.reward.enabled && (
              <div className="reward-celebration-totals">
                <div>
                  <span>Bits earned</span>
                  <strong>{challenge.reward.bits}</strong>
                </div>
                <div>
                  <span>XP earned</span>
                  <strong>{challenge.reward.xpAmount || 0}</strong>
                </div>
              </div>
            )}

            <button type="button" onClick={() => setRewardModalOpen(false)}>
              Continue
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default ChallengeDetail;
