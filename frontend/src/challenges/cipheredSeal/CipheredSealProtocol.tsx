import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clipboard,
  Copy,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import type {
  CipheredSealResolveResponse,
  CipheredSealRouteStateResponse,
  CipheredSealWard,
  CipheredSealWardCode,
  ChallengeSubmitResponse,
} from '../../types/challenge';
import { challengeAPI } from '../../utils/api';
import './CipheredSealProtocol.css';

const completedStatuses = new Set(['completed', 'reward_pending', 'reward_sent', 'reward_failed']);

const loreEntries = [
  'The first ward yields only to concord.',
  'The second will answer if any seal stirs.',
  'The third rejects matching signs.',
  'The fourth echoes the first, altered.',
];

const getRewardStatusCopy = (reward?: ChallengeSubmitResponse['reward']): string => {
  if (reward?.status === 'sent' || reward?.status === 'already_sent') {
    return 'Your reward has been synchronized with Prizeversity.';
  }
  if (reward?.status === 'failed') {
    return 'The protocol is complete, but reward synchronization needs attention.';
  }
  return 'The protocol is complete.';
};

function WardSigil({ ward }: { ward: CipheredSealWard }) {
  return (
    <span className="seal-ward-sigil" data-ward={ward.code} aria-hidden="true">
      <span />
      <i />
    </span>
  );
}

function CipheredSealProtocol() {
  const { routeKey = '' } = useParams();
  const [searchParams] = useSearchParams();
  const requestedAssignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<CipheredSealRouteStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [seedResult, setSeedResult] = useState<CipheredSealResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [sequence, setSequence] = useState<CipheredSealWardCode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ritualMessage, setRitualMessage] = useState('Awaiting invocation.');
  const [copied, setCopied] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [submitReward, setSubmitReward] = useState<ChallengeSubmitResponse['reward']>();
  const routePath = `/challenge/${routeKey}${
    requestedAssignmentId ? `?assignmentId=${encodeURIComponent(requestedAssignmentId)}` : ''
  }`;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(routePath)}`, { replace: true });
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    challengeAPI
      .getCipheredSealState(routeKey, requestedAssignmentId)
      .then((response) => {
        if (active) setState(response);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'The protocol route could not be loaded.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, navigate, requestedAssignmentId, routeKey, routePath, user]);

  const isCompleted = completedStatuses.has(state?.progress.status || '');
  const canInvoke = Boolean(seedResult?.resolved && seedResult.values && !isCompleted);

  const handleCopyIdentifier = async () => {
    if (!state?.protocol.identifier) return;
    await navigator.clipboard.writeText(state.protocol.identifier);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleResolveSeed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seedNumber = Number(seedInput);
    if (!seedInput.trim() || !Number.isInteger(seedNumber)) {
      setSeedResult({ resolved: false, message: 'Enter a whole SeedNumber.' });
      return;
    }

    setResolving(true);
    setError('');
    setSequence([]);
    setRitualMessage('Awaiting invocation.');
    try {
      const response = await challengeAPI.resolveCipheredSealSeed(
        routeKey,
        seedNumber,
        requestedAssignmentId || state?.challenge.assignmentId
      );
      setSeedResult(response);
    } catch (requestError: unknown) {
      setSeedResult(null);
      setError(
        requestError instanceof Error ? requestError.message : 'The seals could not be resolved.'
      );
    } finally {
      setResolving(false);
    }
  };

  const handleWardInvocation = (code: CipheredSealWardCode) => {
    if (!canInvoke || sequence.includes(code) || sequence.length >= 4) return;
    const nextSequence = [...sequence, code];
    setSequence(nextSequence);
    setRitualMessage(
      nextSequence.length === 4 ? 'Sequence formed. Submit when ready.' : 'Invocation recorded.'
    );
  };

  const resetRitual = () => {
    setSequence([]);
    setRitualMessage('Awaiting invocation.');
    setError('');
  };

  const submitSequence = async () => {
    if (!state || sequence.length !== 4 || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const response = await challengeAPI.submit(
        state.challenge.slug,
        { sequence },
        requestedAssignmentId || state.challenge.assignmentId
      );
      setState((current) => (current ? { ...current, progress: response.progress } : current));
      setRitualMessage(response.message);
      if (response.accepted && response.completed) {
        setSubmitReward(response.reward);
        setRewardModalOpen(true);
      } else {
        setSequence([]);
      }
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The invocation could not be submitted.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <main className="seal-protocol-page seal-protocol-loading">
        <RefreshCw size={24} aria-hidden="true" />
        <span>Initializing protocol...</span>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="seal-protocol-page">
        <div className="seal-protocol-failure">
          <span>Route unresolved</span>
          <h1>Ciphered Seal Protocol</h1>
          <p>{error || 'The requested shrine route does not exist.'}</p>
          <Link to="/challenges">
            <ArrowLeft size={16} /> Return to challenges
          </Link>
        </div>
      </main>
    );
  }

  const { challenge, protocol } = state;

  return (
    <main className="seal-protocol-page">
      <div className="seal-protocol-frame">
        <div className="seal-frame-corner top-left" aria-hidden="true" />
        <div className="seal-frame-corner top-right" aria-hidden="true" />
        <div className="seal-frame-corner bottom-left" aria-hidden="true" />
        <div className="seal-frame-corner bottom-right" aria-hidden="true" />

        <header className="seal-protocol-header">
          <div className="seal-protocol-utility">
            <Link to="/challenges" className="seal-back-link">
              <ArrowLeft size={15} /> Challenges
            </Link>
            <span>Node map // sector 04</span>
          </div>
          <div className="seal-title-lockup">
            <span aria-hidden="true" />
            <div>
              <small>Protocol initialized</small>
              <h1>{challenge.title}</h1>
            </div>
            <span aria-hidden="true" />
          </div>
          <div className="seal-route-bar">
            <div>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Route verified:</span>
              <strong>{protocol.routeKey}</strong>
            </div>
            <div className="seal-identifier">
              <span>Challenge ID</span>
              <strong>{protocol.identifier}</strong>
              <button type="button" onClick={handleCopyIdentifier} aria-label="Copy challenge ID">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <p className="seal-protocol-directive">
            Use your ID to resolve the shrine state. Then invoke the shrine in the proper order.
          </p>
        </header>

        {error && <div className="seal-protocol-error">{error}</div>}
        {isCompleted && (
          <div className="seal-protocol-complete">
            <Check size={18} aria-hidden="true" />
            <span>Protocol completed</span>
            {challenge.reward.enabled && (
              <strong>
                {challenge.reward.bits} bits
                {challenge.reward.xpAmount ? ` + ${challenge.reward.xpAmount} XP` : ''}
              </strong>
            )}
          </div>
        )}

        <section className="seal-tools-grid">
          <article className="seal-console-panel seal-calculator-panel">
            <div className="seal-panel-heading">
              <Clipboard size={21} aria-hidden="true" />
              <h2>Seal Calculator</h2>
            </div>
            <p>The shrine accepts two resolved seals derived from your identifier.</p>
            <form onSubmit={handleResolveSeed} className="seal-calculator-form">
              <label htmlFor="seal-seed">Enter SeedNumber</label>
              <input
                id="seal-seed"
                type="number"
                min="0"
                max="100000"
                step="1"
                inputMode="numeric"
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
                placeholder="Enter number"
                disabled={resolving || isCompleted}
              />
              <button type="submit" disabled={resolving || isCompleted}>
                {resolving ? 'Resolving...' : 'Compute'}
              </button>
            </form>

            <div className="seal-results" aria-live="polite">
              <div>
                <span>R1</span>
                <strong>{seedResult?.values?.r1 ?? '—'}</strong>
              </div>
              <div>
                <span>Left Seal</span>
                <strong>{seedResult?.values?.leftSeal ?? '—'}</strong>
              </div>
              <div>
                <span>R2</span>
                <strong>{seedResult?.values?.r2 ?? '—'}</strong>
              </div>
              <div>
                <span>Right Seal</span>
                <strong>{seedResult?.values?.rightSeal ?? '—'}</strong>
              </div>
            </div>
            <div className={`seal-seed-message ${seedResult?.resolved ? 'resolved' : ''}`}>
              <Sparkles size={15} aria-hidden="true" />
              <span>{seedResult?.message || 'The script has order, not just shape.'}</span>
            </div>
          </article>

          <article className="seal-console-panel seal-lore-panel">
            <div className="seal-panel-heading">
              <BookOpen size={21} aria-hidden="true" />
              <h2>Lore Book</h2>
            </div>
            <ol>
              {loreEntries.map((entry, index) => (
                <li key={entry}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{entry}</p>
                </li>
              ))}
            </ol>
            <div className="seal-order-law">
              Active wards first, then inactive wards. Within each group, follow visible shrine
              order: top-left, top-right, bottom-left, bottom-right.
            </div>
          </article>
        </section>

        <section className="seal-shrine" aria-label="Personalized shrine ward layout">
          {protocol.layout.map((ward, index) => {
            const invocationIndex = sequence.indexOf(ward.code);
            return (
              <motion.button
                type="button"
                key={ward.code}
                className={`seal-ward ${invocationIndex >= 0 ? 'invoked' : ''}`}
                data-ward={ward.code}
                onClick={() => handleWardInvocation(ward.code)}
                disabled={!canInvoke || invocationIndex >= 0}
                whileHover={canInvoke && invocationIndex < 0 ? { y: -4 } : undefined}
                whileTap={canInvoke && invocationIndex < 0 ? { scale: 0.985 } : undefined}
              >
                <span className="seal-ward-position">0{index + 1}</span>
                <span className="seal-ward-code">{ward.code}</span>
                <span className="seal-ward-name">{ward.name}</span>
                <WardSigil ward={ward} />
                {invocationIndex >= 0 && (
                  <span className="seal-invocation-index">{invocationIndex + 1}</span>
                )}
              </motion.button>
            );
          })}
        </section>

        <section className="seal-sequence-console">
          <div className="seal-sequence-row">
            <span>Sequence</span>
            <div className="seal-sequence-slots">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index}>{sequence[index] || '—'}</span>
              ))}
            </div>
          </div>
          <div className="seal-status-row">
            <span>Status</span>
            <strong>{ritualMessage}</strong>
          </div>
          <div className="seal-sequence-actions">
            <button
              type="button"
              className="seal-reset-button"
              onClick={resetRitual}
              disabled={submitting}
            >
              <RotateCcw size={16} aria-hidden="true" /> Reset ritual
            </button>
            <button
              type="button"
              className="seal-submit-button"
              onClick={submitSequence}
              disabled={sequence.length !== 4 || submitting || isCompleted}
            >
              <Sparkles size={16} aria-hidden="true" />
              {submitting ? 'Verifying...' : 'Submit sequence'}
            </button>
          </div>
        </section>
      </div>

      {rewardModalOpen && (
        <div className="seal-reward-overlay" role="dialog" aria-modal="true">
          <motion.div
            className="seal-reward-modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="seal-reward-mark" aria-hidden="true">
              <Sparkles size={30} />
            </div>
            <span>Protocol complete</span>
            <h2>The sanctum acknowledges you.</h2>
            <p>{getRewardStatusCopy(submitReward)}</p>
            {challenge.reward.enabled && (
              <div className="seal-reward-totals">
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
              Return to shrine
            </button>
          </motion.div>
        </div>
      )}
    </main>
  );
}

export default CipheredSealProtocol;
