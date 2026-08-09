import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Link2,
  Lock,
  ScanSearch,
  Send,
  ShieldCheck,
  Trophy,
} from 'lucide-react';

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
  if (progress.status === 'pending_review') return 'Pending review';
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
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeDetailType | null>(null);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [rewardLink, setRewardLink] = useState<ChallengeRewardLinkSummary | null>(null);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingCapture, setDownloadingCapture] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [lastSubmitReward, setLastSubmitReward] = useState<ChallengeSubmitResponse['reward']>();
  const assignmentQuery = assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : '';
  const challengePath = `/challenges/${slug}${assignmentQuery}`;
  const labPath = `/challenges/${slug}/lab${assignmentQuery}`;

  useEffect(() => {
    let shouldUpdate = true;
    setLoading(true);
    setError('');

    challengeAPI
      .get(slug, assignmentId)
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
  }, [assignmentId, slug]);

  const isCompleted = completedStatuses.has(progress?.status || '');
  const isManualReview = challenge?.validationType === 'manual_review';
  const cipheredSealExperience =
    challenge?.experience?.type === 'ciphered_seal' ? challenge.experience : null;
  const isCipheredSeal = Boolean(cipheredSealExperience);
  const isSqlInjection = challenge?.experience?.type === 'sql_injection';
  const pcapExperience =
    challenge?.experience?.type === 'pcap_forensics' ? challenge.experience : null;
  const isPcapForensics = Boolean(pcapExperience);
  const rewardLocked = Boolean(
    user && challenge?.reward.enabled && rewardLink && !rewardLink.linked
  );
  const handleStart = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(challengePath)}`);
      return;
    }

    setStarting(true);
    setError('');
    setSuccess('');

    try {
      const response = await challengeAPI.start(slug, assignmentId);
      setChallenge(response.challenge);
      setProgress(response.progress);
      if (response.challenge.experience?.type === 'sql_injection') {
        navigate(labPath);
        return;
      }
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
      setError(
        isManualReview
          ? 'Enter proof before submitting.'
          : isPcapForensics
            ? 'Enter the flag recovered from the packet capture.'
            : 'Enter the challenge secret before submitting.'
      );
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await challengeAPI.submit(
        slug,
        isManualReview ? { proof: secret } : isPcapForensics ? { flag: secret } : { secret },
        assignmentId
      );
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

  const handlePcapDownload = async () => {
    if (!pcapExperience || !user || !progress || progress.status === 'not_started') return;

    setDownloadingCapture(true);
    setError('');
    try {
      const capture = await challengeAPI.downloadPcapCapture(slug, assignmentId);
      const downloadUrl = URL.createObjectURL(capture);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = pcapExperience.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download packet capture');
    } finally {
      setDownloadingCapture(false);
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
            <span className="challenge-detail-eyebrow">
              {challenge.difficulty}
              {challenge.classroom
                ? ` / ${challenge.classroom.classroomName || challenge.classroom.instanceName}`
                : ''}
            </span>
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

            {cipheredSealExperience && (
              <div className="ciphered-seal-discovery">
                <div className="ciphered-seal-artifact">
                  <img
                    src={cipheredSealExperience.imagePath}
                    alt="An unlabeled technical shrine diagram with four seals"
                  />
                  <span aria-hidden="true">Artifact 01</span>
                </div>
                <div className="ciphered-seal-briefing">
                  <span>Route discovery</span>
                  <h3>Inspect the original artifact</h3>
                  <p>
                    Download the unmodified file and inspect its image metadata. Its width and
                    height resolve the numeric application route described in the briefing.
                  </p>
                  <a
                    href={cipheredSealExperience.imagePath}
                    download="ciphered-seal-map.png"
                    className="ciphered-seal-download"
                  >
                    <Download size={17} aria-hidden="true" /> Download original
                  </a>
                </div>
              </div>
            )}

            {pcapExperience && (
              <div className="pcap-forensics-artifact">
                <div className="pcap-file-preview" aria-hidden="true">
                  <div className="pcap-file-bar">
                    <span />
                    <span />
                    <span />
                    <strong>CAPTURE 01</strong>
                  </div>
                  <div className="pcap-traffic-map">
                    <div className="pcap-node client">CLIENT</div>
                    <div className="pcap-packet-flow">
                      <span>DNS</span>
                      <i />
                      <span>TCP</span>
                      <i />
                      <span>HTTP</span>
                    </div>
                    <div className="pcap-node server">SERVER</div>
                  </div>
                  <div className="pcap-file-footer">
                    <span>Ethernet</span>
                    <span>{pcapExperience.packetCount} packets</span>
                  </div>
                </div>
                <div className="pcap-artifact-briefing">
                  <span>Personalized evidence</span>
                  <h3>{pcapExperience.fileName}</h3>
                  <p>
                    Open this capture in Wireshark and inspect its DNS and HTTP request traffic. The
                    evidence file is generated specifically for your challenge assignment.
                  </p>
                  <div className="pcap-protocols" aria-label="Protocols present in capture">
                    {pcapExperience.protocols.map((protocol) => (
                      <span key={protocol}>{protocol}</span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="pcap-download-button"
                    onClick={handlePcapDownload}
                    disabled={
                      downloadingCapture || !user || !progress || progress.status === 'not_started'
                    }
                  >
                    <Download size={17} aria-hidden="true" />
                    {downloadingCapture
                      ? 'Generating capture...'
                      : !progress || progress.status === 'not_started'
                        ? 'Start challenge to download'
                        : 'Download PCAP evidence'}
                  </button>
                </div>
              </div>
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
                  onClick={() => navigate(`/auth?redirect=${encodeURIComponent(challengePath)}`)}
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
                {isSqlInjection && (
                  <button type="button" onClick={() => navigate(labPath)}>
                    <Database size={16} aria-hidden="true" /> Reopen sandbox
                  </button>
                )}
              </div>
            ) : progress.status === 'pending_review' ? (
              <div className="challenge-submit-state pending">
                <Clock3 size={24} aria-hidden="true" />
                <p>Submitted for manual review</p>
                <small>
                  {progress.lastValidationMessage ||
                    'An admin will review this submission before rewards are granted.'}
                </small>
              </div>
            ) : isCipheredSeal ? (
              <div className="challenge-submit-state ciphered-seal-route-state">
                <ScanSearch size={24} aria-hidden="true" />
                <p>Discovery stage unlocked</p>
                <small>
                  This challenge does not accept a secret here. Resolve the artifact metadata, then
                  navigate to the resulting <code>/challenge/&lt;route&gt;</code> path.
                </small>
                {cipheredSealExperience && (
                  <a href={cipheredSealExperience.imagePath} download="ciphered-seal-map.png">
                    <Download size={16} aria-hidden="true" /> Download artifact
                  </a>
                )}
              </div>
            ) : isSqlInjection ? (
              <div className="challenge-submit-state">
                <Database size={24} aria-hidden="true" />
                <p>Isolated SQL lab unlocked</p>
                <small>
                  Open the synthetic archive database, manipulate its vulnerable search query, and
                  recover your personalized completion flag.
                </small>
                <button type="button" onClick={() => navigate(labPath)}>
                  Open SQL sandbox
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="challenge-submit-form">
                <label>
                  {isManualReview
                    ? 'Submission proof'
                    : isPcapForensics
                      ? 'Recovered flag'
                      : 'Challenge secret'}
                  {isManualReview ? (
                    <textarea
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                      placeholder="Describe your work or paste a proof link"
                      disabled={submitting || rewardLocked}
                    />
                  ) : (
                    <input
                      type="text"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                      placeholder={isPcapForensics ? 'FLAG{...}' : 'Paste the secret value'}
                      disabled={submitting || rewardLocked}
                    />
                  )}
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
