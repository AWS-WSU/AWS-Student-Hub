import type { ChallengeXpMode } from '../../types/challenge';

export interface ChallengeRewardFormData {
  rewardEnabled: boolean;
  rewardBits: string;
  rewardXpMode: ChallengeXpMode;
  rewardXpAmount: string;
  rewardActivityName: string;
  rewardDescription: string;
  rewardStatMultiplier: string;
  rewardStatLuck: string;
  rewardStatShield: string;
  rewardStatDiscount: string;
  rewardApplyGroupMultipliers: boolean;
  rewardApplyPersonalMultipliers: boolean;
}

interface ChallengeRewardFieldsProps {
  form: ChallengeRewardFormData;
  onChange: <K extends keyof ChallengeRewardFormData>(
    field: K,
    value: ChallengeRewardFormData[K]
  ) => void;
  enabledLabel?: string;
}

function ChallengeRewardFields({
  form,
  onChange,
  enabledLabel = 'Reward enabled',
}: ChallengeRewardFieldsProps) {
  return (
    <>
      <label className="challenge-admin-checkbox">
        <input
          type="checkbox"
          checked={form.rewardEnabled}
          onChange={(event) => onChange('rewardEnabled', event.target.checked)}
        />
        {enabledLabel}
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
          Completion XP
          <select
            value={form.rewardXpMode}
            onChange={(event) => onChange('rewardXpMode', event.target.value as ChallengeXpMode)}
          >
            <option value="none">No XP</option>
            <option value="classroom">Classroom default XP</option>
            <option value="custom">Custom amount</option>
          </select>
          <small className="field-note">
            Classroom default uses the XP amount configured in Prizeversity.
          </small>
        </label>
      </div>

      {form.rewardXpMode === 'custom' && (
        <label>
          Custom XP amount
          <input
            type="number"
            min="0"
            value={form.rewardXpAmount}
            onChange={(event) => onChange('rewardXpAmount', event.target.value)}
          />
        </label>
      )}

      <label>
        Activity name
        <input
          type="text"
          maxLength={160}
          value={form.rewardActivityName}
          onChange={(event) => onChange('rewardActivityName', event.target.value)}
          placeholder="Defaults to the challenge title"
        />
        <small className="field-note">
          Shown in the student's Prizeversity activity feed. Leave blank to use the challenge title.
        </small>
      </label>

      <label>
        Reward description
        <textarea
          maxLength={500}
          value={form.rewardDescription}
          onChange={(event) => onChange('rewardDescription', event.target.value)}
          placeholder="Defaults to 'Completed <challenge title>'"
        />
      </label>

      <small className="field-note">
        Stat adjustments applied on completion. Leave a field blank to send no adjustment.
      </small>
      <div className="challenge-admin-two-col">
        <label>
          Multiplier
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.rewardStatMultiplier}
            onChange={(event) => onChange('rewardStatMultiplier', event.target.value)}
          />
        </label>
        <label>
          Luck
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.rewardStatLuck}
            onChange={(event) => onChange('rewardStatLuck', event.target.value)}
          />
        </label>
      </div>
      <div className="challenge-admin-two-col">
        <label>
          Shield
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.rewardStatShield}
            onChange={(event) => onChange('rewardStatShield', event.target.value)}
          />
        </label>
        <label>
          Discount
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.rewardStatDiscount}
            onChange={(event) => onChange('rewardStatDiscount', event.target.value)}
          />
        </label>
      </div>

      <label className="challenge-admin-checkbox">
        <input
          type="checkbox"
          checked={form.rewardApplyGroupMultipliers}
          onChange={(event) => onChange('rewardApplyGroupMultipliers', event.target.checked)}
        />
        Apply group multipliers
      </label>
      <label className="challenge-admin-checkbox">
        <input
          type="checkbox"
          checked={form.rewardApplyPersonalMultipliers}
          onChange={(event) => onChange('rewardApplyPersonalMultipliers', event.target.checked)}
        />
        Apply personal multipliers
      </label>
    </>
  );
}

export default ChallengeRewardFields;
