import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PixelText from './PixelText';
import { BUILDER_WARS, getBuilderWarsPhase } from '../config/builderWars';
import '../pages/styles/BuilderWars.css';

/** Compact banner for the home page. Hides itself once the hackathon is over. */
function BuilderWarsTeaser() {
  if (getBuilderWarsPhase() === 'after') return null;

  return (
    <aside className="bw-teaser" aria-label="Builder Wars Hackathon">
      <Link to="/builder-wars" className="bw-teaser__link">
        <span className="bw-teaser__mark" aria-hidden="true">
          <PixelText text="BUILDER" size={3} color="currentColor" />
          <PixelText text="WARS" size={3} color="#7b68c9" />
        </span>
        <span className="bw-teaser__copy">
          <span className="bw-teaser__title">
            Our first hackathon is here. 24 hours, {BUILDER_WARS.prizePool} in prizes, free to
            enter.
          </span>
          <span className="bw-teaser__facts">
            <span>{BUILDER_WARS.dateLabel}</span>
            <span>{BUILDER_WARS.location}</span>
            <span>Teams of {BUILDER_WARS.teamSize}</span>
          </span>
        </span>
        <span className="bw-teaser__cta">
          Details
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </aside>
  );
}

export default BuilderWarsTeaser;
