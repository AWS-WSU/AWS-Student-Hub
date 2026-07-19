import type { ChallengeDifficulty, ChallengeKind } from '../../types/challenge';
import type { RewardIntegrationInstance } from '../../types/rewardIntegration';

export interface ChallengeFormData {
  key: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  instructions: string;
  kind: ChallengeKind;
  difficulty: ChallengeDifficulty;
  estimatedMinutes: string;
  tags: string;
  maxAttempts: string;
  validationJson: string;
  rewardIntegrationInstanceId: string;
  rewardEnabled: boolean;
  rewardBits: string;
  rewardXpAmount: string;
}

type ValidationTemplate = 'aws_secret' | 'static_secret' | 'manual_review';

interface ChallengeCreateFormProps {
  form: ChallengeFormData;
  rewardInstances: RewardIntegrationInstance[];
  saving: boolean;
  onChange: <K extends keyof ChallengeFormData>(field: K, value: ChallengeFormData[K]) => void;
  onApplyTemplate: (template: ValidationTemplate) => void;
  onSubmit: () => void;
}

const formatRewardInstanceLabel = (instance: RewardIntegrationInstance): string => {
  const classroomLabel = instance.classroomName || instance.classroomId;
  return `${instance.name} (${classroomLabel})`;
};

function ChallengeCreateForm({
  form,
  rewardInstances,
  saving,
  onChange,
  onApplyTemplate,
  onSubmit,
}: ChallengeCreateFormProps) {
  return (
    <div className="reward-form challenge-create-form">
      <label>
        Title
        <input
          type="text"
          value={form.title}
          onChange={(event) => onChange('title', event.target.value)}
        />
      </label>

      <div className="challenge-admin-two-col">
        <label>
          Key
          <input
            type="text"
            value={form.key}
            onChange={(event) => onChange('key', event.target.value)}
          />
        </label>
        <label>
          Slug
          <input
            type="text"
            value={form.slug}
            onChange={(event) => onChange('slug', event.target.value)}
          />
        </label>
      </div>

      <label>
        Summary
        <input
          type="text"
          value={form.summary}
          onChange={(event) => onChange('summary', event.target.value)}
        />
      </label>

      <label>
        Description
        <textarea
          value={form.description}
          onChange={(event) => onChange('description', event.target.value)}
        />
      </label>

      <label>
        Instructions
        <textarea
          value={form.instructions}
          onChange={(event) => onChange('instructions', event.target.value)}
        />
      </label>

      <div className="challenge-admin-two-col">
        <label>
          Kind
          <select
            value={form.kind}
            onChange={(event) => onChange('kind', event.target.value as ChallengeKind)}
          >
            <option value="single">Single goal</option>
            <option value="multi_part">Multi-part</option>
          </select>
        </label>
        <label>
          Difficulty
          <select
            value={form.difficulty}
            onChange={(event) => onChange('difficulty', event.target.value as ChallengeDifficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
          </select>
        </label>
      </div>

      <div className="challenge-admin-two-col">
        <label>
          Estimated minutes
          <input
            type="number"
            min="1"
            value={form.estimatedMinutes}
            onChange={(event) => onChange('estimatedMinutes', event.target.value)}
          />
        </label>
        <label>
          Max attempts
          <input
            type="number"
            min="1"
            value={form.maxAttempts}
            onChange={(event) => onChange('maxAttempts', event.target.value)}
            placeholder="Unlimited"
          />
        </label>
      </div>

      <label>
        Tags
        <input
          type="text"
          value={form.tags}
          onChange={(event) => onChange('tags', event.target.value)}
          placeholder="aws,s3,security"
        />
      </label>

      <label>
        Reward classroom
        <select
          value={form.rewardIntegrationInstanceId}
          onChange={(event) => onChange('rewardIntegrationInstanceId', event.target.value)}
        >
          <option value="">Global / any linked classroom</option>
          {rewardInstances.map((instance) => (
            <option key={instance.id} value={instance.id}>
              {formatRewardInstanceLabel(instance)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Validation JSON
        <div className="challenge-validation-templates">
          <button type="button" onClick={() => onApplyTemplate('aws_secret')}>
            AWS secret
          </button>
          <button type="button" onClick={() => onApplyTemplate('static_secret')}>
            Static secret
          </button>
          <button type="button" onClick={() => onApplyTemplate('manual_review')}>
            Manual review
          </button>
        </div>
        <textarea
          value={form.validationJson}
          onChange={(event) => onChange('validationJson', event.target.value)}
        />
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
        Reward enabled
      </label>

      <button
        type="button"
        className="create-reward-instance-btn"
        onClick={onSubmit}
        disabled={saving}
      >
        {saving ? 'Creating...' : 'Create challenge'}
      </button>
    </div>
  );
}

export default ChallengeCreateForm;
