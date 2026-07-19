export interface RewardIntegrationFormData {
  name: string;
  description: string;
  apiBaseUrl: string;
  apiKey: string;
  classroomId: string;
  classroomName: string;
  scopes: string;
}

interface RewardInstanceFormProps {
  form: RewardIntegrationFormData;
  saving: boolean;
  submitLabel?: string;
  apiKeyOptional?: boolean;
  onChange: (field: keyof RewardIntegrationFormData, value: string) => void;
  onSubmit: () => void;
}

function RewardInstanceForm({
  form,
  saving,
  submitLabel = 'Create and verify instance',
  apiKeyOptional = false,
  onChange,
  onSubmit,
}: RewardInstanceFormProps) {
  return (
    <div className="reward-form">
      <label>
        Instance name
        <input
          type="text"
          value={form.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="Cyber Challenge Section A"
        />
      </label>

      <div className="challenge-admin-two-col">
        <label>
          Classroom ID
          <input
            type="text"
            value={form.classroomId}
            onChange={(event) => onChange('classroomId', event.target.value)}
            placeholder="68e169fa349b208d3db7b129"
          />
        </label>
        <label>
          Classroom label
          <input
            type="text"
            value={form.classroomName}
            onChange={(event) => onChange('classroomName', event.target.value)}
            placeholder="Verified from Prizeversity"
          />
        </label>
      </div>

      <label>
        API key {apiKeyOptional && <span className="field-note">Optional unless rotating</span>}
        <input
          type="password"
          value={form.apiKey}
          onChange={(event) => onChange('apiKey', event.target.value)}
          placeholder={apiKeyOptional ? 'Leave blank to keep the current key' : 'pvk_...'}
        />
      </label>

      <label>
        Prizeversity base URL
        <input
          type="url"
          value={form.apiBaseUrl}
          onChange={(event) => onChange('apiBaseUrl', event.target.value)}
          placeholder="https://www.prizeversity.com"
        />
      </label>

      <label>
        Expected scopes
        <input
          type="text"
          value={form.scopes}
          onChange={(event) => onChange('scopes', event.target.value)}
        />
      </label>

      <label>
        Description
        <textarea
          value={form.description}
          onChange={(event) => onChange('description', event.target.value)}
          placeholder="Who should use this classroom integration?"
        />
      </label>

      <button
        type="button"
        className="create-reward-instance-btn"
        onClick={onSubmit}
        disabled={saving}
      >
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

export default RewardInstanceForm;
