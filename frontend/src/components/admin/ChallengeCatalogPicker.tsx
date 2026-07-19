import { useState } from 'react';
import { Search, X } from 'lucide-react';

import type { AdminChallenge } from '../../types/challenge';

interface ChallengeCatalogPickerProps {
  challenges: AdminChallenge[];
  assignedChallengeIds: Set<string>;
  onSelect: (challenge: AdminChallenge) => void;
  onClose: () => void;
}

function ChallengeCatalogPicker({
  challenges,
  assignedChallengeIds,
  onSelect,
  onClose,
}: ChallengeCatalogPickerProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const availableChallenges = challenges.filter(
    (challenge) =>
      challenge.status === 'published' &&
      !assignedChallengeIds.has(challenge.id) &&
      (!query ||
        [challenge.title, challenge.summary, challenge.validationType, ...challenge.tags]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)))
  );

  return (
    <div className="modal-overlay admin-editor-overlay" onClick={onClose}>
      <div
        className="modal-content admin-editor-modal challenge-catalog-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-editor-header">
          <div>
            <span className="modal-eyebrow">Challenge catalog</span>
            <h3>Add a classroom challenge</h3>
            <p>
              Select a reusable challenge, then configure its schedule and rewards for this class.
            </p>
          </div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="catalog-picker-body">
          <label className="catalog-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, validator, or tag"
              autoFocus
            />
          </label>

          {availableChallenges.length === 0 ? (
            <div className="empty-reward-instances">
              {query
                ? 'No available catalog challenges match that search.'
                : 'Every published catalog challenge is already assigned to this classroom.'}
            </div>
          ) : (
            <div className="catalog-picker-grid">
              {availableChallenges.map((challenge) => (
                <article key={challenge.id}>
                  <div className="catalog-picker-topline">
                    <span data-source={challenge.source}>{challenge.source}</span>
                    <span>{challenge.validationType}</span>
                  </div>
                  <h4>{challenge.title}</h4>
                  <p>{challenge.summary}</p>
                  <div className="catalog-picker-meta">
                    <span>{challenge.difficulty}</span>
                    <span>{challenge.reward.bits} default bits</span>
                    <span>{challenge.maxAttempts || 'Unlimited'} attempts</span>
                  </div>
                  <button type="button" onClick={() => onSelect(challenge)}>
                    Configure assignment
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChallengeCatalogPicker;
