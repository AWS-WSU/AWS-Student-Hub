import { X } from 'lucide-react';

import type { AdminChallenge, ChallengeAssignmentStatus } from '../../types/challenge';

export interface ChallengeAssignmentFormData {
  status: ChallengeAssignmentStatus;
  startsAt: string;
  endsAt: string;
  maxAttempts: string;
  hint: string;
  rewardEnabled: boolean;
  rewardBits: string;
  rewardXpAmount: string;
}

interface ChallengeAssignmentFormProps {
  challenge: AdminChallenge;
  form: ChallengeAssignmentFormData;
  editing: boolean;
  saving: boolean;
  onChange: <K extends keyof ChallengeAssignmentFormData>(
    field: K,
    value: ChallengeAssignmentFormData[K]
  ) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function ChallengeAssignmentForm({
  challenge,
  form,
  editing,
  saving,
  onChange,
  onSubmit,
  onClose,
}: ChallengeAssignmentFormProps) {
  return (
    <div
      className="modal-overlay admin-editor-overlay"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="modal-content admin-editor-modal assignment-editor-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-editor-header">
          <div>
            <span className="modal-eyebrow">
              {editing ? 'Edit classroom assignment' : 'New classroom assignment'}
            </span>
            <h3>{challenge.title}</h3>
            <p>These settings apply only to this classroom and do not alter the catalog item.</p>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="reward-form assignment-form">
          <div className="assignment-definition-summary">
            <span data-source={challenge.source}>{challenge.source}</span>
            <strong>{challenge.validationType}</strong>
            <p>{challenge.summary}</p>
          </div>

          <label>
            Classroom status
            <select
              value={form.status}
              onChange={(event) =>
                onChange('status', event.target.value as ChallengeAssignmentStatus)
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published to students</option>
              {editing && <option value="archived">Archived</option>}
            </select>
            <small className="field-note">
              Draft assignments stay hidden. Published assignments appear for linked students.
            </small>
          </label>

          <div className="challenge-admin-two-col">
            <label>
              Opens at
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => onChange('startsAt', event.target.value)}
              />
              <small className="field-note">Leave blank for immediate access.</small>
            </label>
            <label>
              Closes at
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => onChange('endsAt', event.target.value)}
              />
              <small className="field-note">Leave blank for no deadline.</small>
            </label>
          </div>

          <label>
            Maximum attempts
            <input
              type="number"
              min="1"
              value={form.maxAttempts}
              onChange={(event) => onChange('maxAttempts', event.target.value)}
              placeholder="Unlimited"
            />
          </label>

          <label>
            Student hint
            <textarea
              value={form.hint}
              onChange={(event) => onChange('hint', event.target.value)}
              maxLength={2000}
              placeholder="Optional guidance for students in this classroom"
            />
            <small className="field-note">
              Optional. This appears only on this classroom's challenge assignment.
            </small>
          </label>

          <div className="challenge-admin-two-col">
            <label>
              Reward bits
              <input
                type="number"
                min="0"
                value={form.rewardBits}
                onChange={(event) => onChange('rewardBits', event.target.value)}
              />
            </label>
            <label>
              Reward XP
              <input
                type="number"
                min="0"
                value={form.rewardXpAmount}
                onChange={(event) => onChange('rewardXpAmount', event.target.value)}
              />
            </label>
          </div>

          <label className="challenge-admin-checkbox">
            <input
              type="checkbox"
              checked={form.rewardEnabled}
              onChange={(event) => onChange('rewardEnabled', event.target.checked)}
            />
            Grant the configured Prizeversity reward on completion
          </label>

          <button
            type="button"
            className="create-reward-instance-btn"
            onClick={onSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : editing ? 'Save assignment' : 'Assign challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChallengeAssignmentForm;
