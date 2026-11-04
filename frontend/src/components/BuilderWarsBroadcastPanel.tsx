import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { broadcastAPI } from '../utils/api';
import type { BroadcastStatusResponse } from '../types/admin';

interface Props {
  broadcastKey: string;
}

const ARM_WINDOW_MS = 45_000;
const CONFIRM_WORD = 'SEND';
const POLL_MS = 5_000;

const formatWhen = (iso: string): string =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * One-shot broadcast control. The server owns the lock; this panel only
 * reflects it and keeps an in-flight send moving until every row is done.
 */
function BuilderWarsBroadcastPanel({ broadcastKey }: Props) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<BroadcastStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pumping = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await broadcastAPI.getStatus(broadcastKey);
      setStatus(next);
      return next;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load broadcast', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [broadcastKey, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep an in-flight broadcast moving: pump batches until nothing is pending,
  // then fall back to polling in case another invocation holds the last rows.
  useEffect(() => {
    if (!status?.broadcast || status.broadcast.status !== 'sending') return;

    let cancelled = false;
    const remaining = status.counts.pending + status.counts.processing;

    const run = async () => {
      if (cancelled) return;
      if (status.counts.pending > 0 && !pumping.current) {
        pumping.current = true;
        try {
          const next = await broadcastAPI.process(broadcastKey);
          if (!cancelled) setStatus(next);
        } catch (error) {
          if (!cancelled) {
            showToast(error instanceof Error ? error.message : 'Batch failed', 'error');
          }
        } finally {
          pumping.current = false;
        }
        return;
      }
      if (remaining > 0) {
        await refresh();
      }
    };

    const timer = setTimeout(run, status.counts.pending > 0 ? 250 : POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, broadcastKey, refresh, showToast]);

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    []
  );

  const disarm = () => {
    setArmed(false);
    setConfirmText('');
  };

  const arm = () => {
    setArmed(true);
    setConfirmText('');
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(disarm, ARM_WINDOW_MS);
  };

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const fire = async () => {
    if (!confirmed) return;
    if (armTimer.current) clearTimeout(armTimer.current);
    disarm();
    setBusy(true);
    try {
      const next = await broadcastAPI.send(broadcastKey);
      setStatus(next);
      showToast(`Transmission started: ${next.results?.sent ?? 0} sent in the first batch.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed';
      showToast(message, 'error');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bw-admin">
        <div className="bw-admin__head">
          <Radio size={16} aria-hidden="true" />
          <span>Admin transmission</span>
        </div>
        <p className="bw-admin__muted">Checking transmitter status...</p>
      </div>
    );
  }

  if (!status) return null;

  const record = status.broadcast;
  const total = Math.max(status.counts.total, record?.recipientCount ?? 0);
  const done = status.counts.sent + status.counts.failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bw-admin" data-state={record ? record.status : 'ready'}>
      <div className="bw-admin__head">
        <Radio size={16} aria-hidden="true" />
        <span>Admin transmission</span>
        <span className="bw-admin__key">{status.definition.key}</span>
      </div>

      <div className="bw-admin__body">
        <div className="bw-admin__meta">
          <div>
            <span className="bw-admin__label">Subject</span>
            <span className="bw-admin__value">{status.definition.subject}</span>
          </div>
          <div>
            <span className="bw-admin__label">Audience</span>
            <span className="bw-admin__value">
              {record ? record.recipientCount : status.eligibleRecipients} active members
            </span>
          </div>
        </div>

        {!record && (
          <div className="bw-admin__actions">
            <p className="bw-admin__warn">
              <ShieldAlert size={16} aria-hidden="true" />
              One shot. Once this fires, the key locks on the server and nobody can send it again.
            </p>
            {!armed ? (
              <button type="button" className="bw-btn bw-btn--ghost" onClick={arm} disabled={busy}>
                Arm transmitter
              </button>
            ) : (
              <div className="bw-admin__armed">
                <label className="bw-admin__confirm">
                  <span>
                    Type <strong>{CONFIRM_WORD}</strong> to confirm emailing all{' '}
                    {status.eligibleRecipients} members
                  </span>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && confirmed && !busy) void fire();
                    }}
                    placeholder={CONFIRM_WORD}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={busy}
                    aria-label={`Type ${CONFIRM_WORD} to confirm`}
                  />
                </label>
                <div className="bw-admin__armed-actions">
                  <button
                    type="button"
                    className="bw-btn bw-btn--danger"
                    onClick={fire}
                    disabled={busy || !confirmed}
                  >
                    {busy ? (
                      <>
                        <Loader2 size={16} className="bw-spin" aria-hidden="true" /> Sending
                      </>
                    ) : (
                      `Send to ${status.eligibleRecipients} members now`
                    )}
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn--ghost"
                    onClick={disarm}
                    disabled={busy}
                  >
                    Stand down
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {record && (
          <div className="bw-admin__progress">
            <div className="bw-admin__bar" role="progressbar" aria-valuenow={pct}>
              <span style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
            <div className="bw-admin__stats">
              <span>
                <strong>{status.counts.sent}</strong> sent
              </span>
              <span>
                <strong>{status.counts.pending + status.counts.processing}</strong> queued
              </span>
              <span>
                <strong>{status.counts.failed}</strong> failed
              </span>
            </div>
            <p className="bw-admin__muted">
              {record.status === 'completed' ? (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" /> Transmitted{' '}
                  {formatWhen(record.completedAt ?? record.startedAt)} by {record.triggeredByEmail}.
                  Locked.
                </>
              ) : (
                <>
                  <Loader2 size={14} className="bw-spin" aria-hidden="true" /> Started{' '}
                  {formatWhen(record.startedAt)} by {record.triggeredByEmail}. Keep this tab open
                  and it will finish on its own. A scheduled job also sweeps leftovers every five
                  minutes.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BuilderWarsBroadcastPanel;
