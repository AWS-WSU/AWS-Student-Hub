import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Database,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TerminalSquare,
  Trophy,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import type {
  ChallengeSubmitResponse,
  SqlInjectionSandboxSearchResponse,
  SqlInjectionSandboxStateResponse,
} from '../../types/challenge';
import { challengeAPI } from '../../utils/api';
import './SqlInjectionSandbox.css';

const completedStatuses = new Set(['completed', 'reward_pending', 'reward_sent', 'reward_failed']);

const getRewardSummary = (state: SqlInjectionSandboxStateResponse): string => {
  const { reward } = state.challenge;
  if (!reward.enabled) return 'No reward configured';
  return reward.xpAmount ? `${reward.bits} bits + ${reward.xpAmount} XP` : `${reward.bits} bits`;
};

const getRewardStatus = (reward?: ChallengeSubmitResponse['reward']): string => {
  if (reward?.status === 'sent' || reward?.status === 'already_sent') {
    return 'Reward synchronized with Prizeversity.';
  }
  if (reward?.status === 'failed') {
    return 'Challenge complete. Reward synchronization needs attention.';
  }
  return 'Challenge complete.';
};

function SqlInjectionSandbox() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<SqlInjectionSandboxStateResponse | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState<SqlInjectionSandboxSearchResponse | null>(null);
  const [flag, setFlag] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [copiedValue, setCopiedValue] = useState('');
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [submitReward, setSubmitReward] = useState<ChallengeSubmitResponse['reward']>();
  const assignmentQuery = assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : '';
  const labPath = `/challenges/${slug}/lab${assignmentQuery}`;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(labPath)}`, {
        replace: true,
      });
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    challengeAPI
      .getSqlInjectionSandbox(slug, assignmentId)
      .then((response) => {
        if (active) setState(response);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'The SQL sandbox could not be loaded.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assignmentId, authLoading, labPath, navigate, slug, user]);

  const isCompleted = completedStatuses.has(state?.progress.status || '');

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchInput) {
      setError('Enter a search term or SQL payload.');
      return;
    }

    setSearching(true);
    setError('');
    setSubmitMessage('');
    try {
      const response = await challengeAPI.searchSqlInjectionSandbox(
        slug,
        searchInput,
        assignmentId
      );
      setSearchResult(response);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'The sandbox query could not run.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(''), 1400);
  };

  const handleSubmitFlag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!flag.trim()) {
      setError('Enter the flag recovered from the restricted row.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSubmitMessage('');
    try {
      const response = await challengeAPI.submit(slug, { flag }, assignmentId);
      setState((current) => (current ? { ...current, progress: response.progress } : current));
      setSubmitMessage(response.message);
      if (response.accepted && response.completed) {
        setFlag('');
        setSubmitReward(response.reward);
        setRewardModalOpen(true);
      }
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'The flag could not be submitted.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <main className="sql-lab-page sql-lab-loading">
        <RefreshCw size={22} aria-hidden="true" />
        <span>Provisioning isolated database...</span>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="sql-lab-page">
        <section className="sql-lab-failure">
          <Database size={30} aria-hidden="true" />
          <span>Sandbox unavailable</span>
          <h1>SQL Injection Sandbox</h1>
          <p>{error || 'This lab is not available for your classroom.'}</p>
          <Link to="/challenges">
            <ArrowLeft size={16} /> Return to challenges
          </Link>
        </section>
      </main>
    );
  }

  const { challenge, progress, sandbox } = state;

  return (
    <main className="sql-lab-page">
      <section className="sql-lab-shell">
        <header className="sql-lab-header">
          <div className="sql-lab-header-copy">
            <Link
              to={`/challenges/${challenge.slug}${assignmentQuery}`}
              className="sql-lab-back-link"
            >
              <ArrowLeft size={15} /> Challenge briefing
            </Link>
            <span className="sql-lab-kicker">Isolated training environment</span>
            <h1>{challenge.title}</h1>
            <p>{challenge.summary}</p>
          </div>
          <div className={`sql-lab-status ${isCompleted ? 'complete' : ''}`}>
            {isCompleted ? <CheckCircle2 size={20} /> : <ShieldCheck size={20} />}
            <div>
              <span>{isCompleted ? 'Completed' : 'Sandbox active'}</span>
              <small>Synthetic data only</small>
            </div>
          </div>
        </header>

        {error && <div className="sql-lab-alert error">{error}</div>}
        {submitMessage && <div className="sql-lab-alert success">{submitMessage}</div>}

        <div className="sql-lab-workspace">
          <section className="sql-query-console">
            <div className="sql-panel-heading">
              <div>
                <span>Archive directory</span>
                <h2>Record search</h2>
              </div>
              <Database size={22} aria-hidden="true" />
            </div>

            <form className="sql-search-form" onSubmit={handleSearch}>
              <label htmlFor="sql-search-input">Search by record title</label>
              <div>
                <input
                  id="sql-search-input"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  maxLength={sandbox.maxInputLength}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Cloud orientation"
                />
                <button type="submit" disabled={searching}>
                  {searching ? <RefreshCw size={17} /> : <Search size={17} />}
                  {searching ? 'Running' : 'Search'}
                </button>
              </div>
              <small>
                Input is inserted into the application query exactly as entered. Stacked statements
                are disabled.
              </small>
            </form>

            <div className="sql-statement-viewer">
              <div>
                <TerminalSquare size={16} aria-hidden="true" />
                <span>Executed statement</span>
              </div>
              <code>
                {searchResult?.statement ||
                  `SELECT ... FROM ${sandbox.tableName} WHERE title ILIKE '%[input]%' AND published = TRUE`}
              </code>
            </div>

            <div className="sql-results-heading">
              <span>Query results</span>
              <strong>{searchResult ? `${searchResult.rowCount} rows` : 'Not run'}</strong>
            </div>

            {searchResult?.queryError ? (
              <div className="sql-query-error">{searchResult.queryError}</div>
            ) : searchResult && searchResult.rows.length > 0 ? (
              <div className="sql-results-table-wrap">
                <table className="sql-results-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Department</th>
                      <th>Classification</th>
                      <th>Content</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.rows.map((row) => {
                      const isFlag = row.content.startsWith('FLAG{');
                      return (
                        <tr key={row.id} className={isFlag ? 'restricted' : ''}>
                          <td data-label="ID">{row.id}</td>
                          <td data-label="Title">{row.title}</td>
                          <td data-label="Department">{row.department}</td>
                          <td data-label="Classification">
                            <span>{row.classification}</span>
                          </td>
                          <td data-label="Content">
                            <div className="sql-result-content">
                              <code>{row.content}</code>
                              {isFlag && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(row.content)}
                                  aria-label="Copy recovered flag"
                                >
                                  {copiedValue === row.content ? (
                                    <Check size={15} />
                                  ) : (
                                    <Copy size={15} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {searchResult.truncated && (
                  <small className="sql-results-truncated">Additional rows were truncated.</small>
                )}
              </div>
            ) : searchResult ? (
              <div className="sql-results-empty">No archive records matched that query.</div>
            ) : (
              <div className="sql-results-empty">Run a search to inspect the result set.</div>
            )}
          </section>

          <aside className="sql-lab-sidebar">
            <section className="sql-mission-card">
              <span>Objective</span>
              <h2>Recover the restricted row</h2>
              <p>
                Normal searches return published records only. Alter the query logic, locate the
                personalized flag, and submit it below.
              </p>
              <dl>
                <div>
                  <dt>Table</dt>
                  <dd>{sandbox.tableName}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{progress.attemptCount}</dd>
                </div>
                <div>
                  <dt>Reward</dt>
                  <dd>{getRewardSummary(state)}</dd>
                </div>
              </dl>
            </section>

            <section className="sql-flag-card">
              <span>Completion proof</span>
              <h2>Submit recovered flag</h2>
              {isCompleted ? (
                <div className="sql-completed-state">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  <strong>Challenge completed</strong>
                  <p>{progress.lastValidationMessage}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFlag}>
                  <label htmlFor="sql-flag-input">Personalized flag</label>
                  <input
                    id="sql-flag-input"
                    value={flag}
                    onChange={(event) => setFlag(event.target.value)}
                    placeholder="FLAG{...}"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="submit" disabled={submitting}>
                    <Send size={16} aria-hidden="true" />
                    {submitting ? 'Validating' : 'Submit flag'}
                  </button>
                  {progress.lastValidationMessage && (
                    <small>{progress.lastValidationMessage}</small>
                  )}
                </form>
              )}
            </section>
          </aside>
        </div>
      </section>

      {rewardModalOpen && (
        <div className="sql-reward-overlay" role="dialog" aria-modal="true">
          <motion.div
            className="sql-reward-modal"
            initial={{ opacity: 0, scale: 0.94, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 22 }}
          >
            <div className="sql-reward-icon" aria-hidden="true">
              <Trophy size={31} />
            </div>
            <span>Exploit confirmed</span>
            <h2>Restricted row recovered</h2>
            <p>{getRewardStatus(submitReward)}</p>
            {challenge.reward.enabled && (
              <div className="sql-reward-totals">
                <div>
                  <span>Bits</span>
                  <strong>{challenge.reward.bits}</strong>
                </div>
                <div>
                  <span>XP</span>
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
    </main>
  );
}

export default SqlInjectionSandbox;
