import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Flag,
  Mail,
  MapPin,
  Users,
  Utensils,
  Zap,
} from 'lucide-react';
import PixelText, { PixelBitmap } from '../components/PixelText';
import BuilderWarsBroadcastPanel from '../components/BuilderWarsBroadcastPanel';
import { useAuth } from '../context/AuthContext';
import { BUILDER_WARS, getBuilderWarsPhase } from '../config/builderWars';
import type { BuilderWarsPhase } from '../config/builderWars';
import './styles/BuilderWars.css';

/* ------------------------------------------------------------------ */
/* Pixel art                                                           */
/* ------------------------------------------------------------------ */

const FLAG_ROWS = [
  '..gg..........',
  '.gggg.........',
  '..gg..........',
  '..ggpppppppppp',
  '..ggpwwppppppp',
  '..ggpwwpppppp.',
  '..ggpppppppp..',
  '..ggppppppp...',
  '..ggpppppppp..',
  '..ggpppppppppp',
  '..ggpppppppppp',
  '..gg..........',
  '..gg..........',
  '..gg..........',
  '.gggg.........',
  'gggggg........',
];

const FLAG_PALETTE = { g: '#f0a33a', p: '#7b68c9', w: '#ffffff' };

const CHIP_ROWS = [
  '..#..#..#..',
  '.#########.',
  '#.#.....#.#',
  '..#..#..#..',
  '#.#.....#.#',
  '..#.....#..',
  '#.#.....#.#',
  '..#..#..#..',
  '#.#.....#.#',
  '.#########.',
  '..#..#..#..',
];

const CHIP_PALETTE = { '#': '#7b68c9' };

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Drives `--bw-mix` (0 = hub colours, 1 = Builder Wars colours) from scroll
 * position with a single rAF-throttled listener. Reads one number, writes one
 * custom property: no layout thrash, no React re-render.
 */
const useTakeover = (rootRef: React.RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    let last = -1;

    const apply = () => {
      frame = 0;
      const span = Math.max(window.innerHeight * 0.7, 320);
      const next = Math.min(1, Math.max(0, window.scrollY / span));
      const rounded = Math.round(next * 50) / 50;
      if (rounded !== last) {
        last = rounded;
        root.style.setProperty('--bw-mix', String(rounded));
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef]);
};

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const splitRemaining = (ms: number): Remaining => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
};

const useCountdown = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = getBuilderWarsPhase(now);
  const target = phase === 'before' ? BUILDER_WARS.kickoff : BUILDER_WARS.wrap;
  return { phase, remaining: splitRemaining(target - now) };
};

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

function Countdown({ phase, remaining }: { phase: BuilderWarsPhase; remaining: Remaining }) {
  const title =
    phase === 'before' ? 'Kickoff in' : phase === 'live' ? 'Builders have' : 'That is a wrap';

  if (phase === 'after') {
    return (
      <div className="bw-countdown" aria-live="polite">
        <span className="bw-countdown__title">{title}</span>
        <PixelText text="GG" size={6} color="#7b68c9" depth={1} className="bw-countdown__big" />
        <p className="bw-countdown__note">Thanks for building with us. See you next year.</p>
      </div>
    );
  }

  const cells: Array<[string, number]> = [
    ['Days', remaining.days],
    ['Hrs', remaining.hours],
    ['Min', remaining.minutes],
    ['Sec', remaining.seconds],
  ];

  return (
    <div className="bw-countdown" aria-live="off">
      <span className="bw-countdown__title">
        {phase === 'live' && <span className="bw-live-dot" aria-hidden="true" />}
        {title}
        {phase === 'live' ? ' left' : ''}
      </span>
      <div className="bw-countdown__cells" role="timer" aria-label={`${title} countdown`}>
        {cells.map(([label, value], index) => (
          <div className="bw-countdown__cell" key={label}>
            <PixelText
              text={pad(value)}
              size={4}
              color={index === 0 ? '#ffffff' : '#d9d3f5'}
              depth={1}
              depthColor="rgba(123,104,201,0.55)"
              label={`${value} ${label}`}
            />
            <span className="bw-countdown__label">{label}</span>
          </div>
        ))}
      </div>
      <p className="bw-countdown__note">
        {phase === 'before'
          ? 'Doors open Saturday at 10 AM. Bring a laptop, a charger, and a team or the will to find one.'
          : 'Submissions close Sunday at 3 PM sharp.'}
      </p>
    </div>
  );
}

function CircuitBackdrop({ animate }: { animate: boolean }) {
  // Traces are drawn in viewBox units; nodes sit at trace ends like the poster.
  // Kept to the margins and the top band so nothing crosses the wordmark.
  const traces = [
    'M0 40 H140 L180 80 H330',
    'M1200 30 H900 L860 70 H640',
    'M0 420 H30 L60 450 V560',
    'M1200 300 H1160 L1120 340 V470',
    'M700 700 V640 L740 600 H880',
    'M40 700 V660 L80 620 H120',
  ];
  const nodes = [
    [330, 80],
    [640, 70],
    [60, 560],
    [1120, 470],
    [880, 600],
    [120, 620],
  ];

  return (
    <svg
      className={`bw-circuit${animate ? ' bw-circuit--animate' : ''}`}
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {traces.map((d, i) => (
        <path key={d} d={d} pathLength={1} style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <rect
          key={`${x}-${y}`}
          x={x - 5}
          y={y - 5}
          width={10}
          height={10}
          style={{ animationDelay: `${0.9 + i * 0.12}s` }}
        />
      ))}
    </svg>
  );
}

interface Fact {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  href?: string;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function BuilderWars() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { phase, remaining } = useCountdown();

  useTakeover(rootRef);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Builder Wars Hackathon · AWS Student Builder Group';
    return () => {
      document.title = previous;
    };
  }, []);

  const isAdmin = !!user && ['admin', 'superuser'].includes(user.role);

  const facts = useMemo<Fact[]>(
    () => [
      { icon: <CalendarDays size={18} />, label: 'Date', value: BUILDER_WARS.dateLabel },
      {
        icon: <Clock3 size={18} />,
        label: 'Time',
        value: BUILDER_WARS.timeLabel,
        note: '24 hours',
      },
      {
        icon: <MapPin size={18} />,
        label: 'Location',
        value: BUILDER_WARS.location,
        href: BUILDER_WARS.locationUrl,
      },
      { icon: <Users size={18} />, label: 'Team size', value: BUILDER_WARS.teamSize },
      {
        icon: <Utensils size={18} />,
        label: 'Covered',
        value: 'Meals, energy drinks & more',
        note: 'Free',
      },
      { icon: <Zap size={18} />, label: 'Prizes', value: `${BUILDER_WARS.prizePool} in prizes` },
    ],
    []
  );

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] as const },
      };

  return (
    <div className="bw-page" ref={rootRef}>
      {/* ---------------------------------------------------------- */}
      <section className="bw-hero" aria-labelledby="bw-title">
        <CircuitBackdrop animate={!reduceMotion} />
        <div className="bw-hero__grid">
          <div className="bw-hero__copy">
            <p className="bw-eyebrow">
              <span className="bw-eyebrow__rule" aria-hidden="true" />
              First annual
              <span className="bw-eyebrow__rule" aria-hidden="true" />
            </p>

            <h1 id="bw-title" className={`bw-wordmark${reduceMotion ? '' : ' bw-wordmark--boot'}`}>
              <span className="bw-wordmark__line">
                <PixelText text="BUILDER" size={9} color="#ffffff" depth={1} depthColor="#3d3856" />
              </span>
              <span className="bw-wordmark__line bw-wordmark__line--flag">
                <PixelText
                  text="WARS"
                  size={9}
                  color="#7b68c9"
                  depth={1}
                  depthColor="rgba(76,63,143,0.9)"
                />
                <PixelBitmap
                  rows={FLAG_ROWS}
                  palette={FLAG_PALETTE}
                  size={4}
                  className="bw-wordmark__flag"
                  label="Capture-the-flag pennant"
                />
              </span>
              <span className="bw-wordmark__rule" aria-hidden="true" />
              <span className="bw-wordmark__line">
                <PixelText text="HACKATHON" size={4} color="#f3f1fa" />
              </span>
            </h1>

            <p className="bw-hero__tag">
              <PixelBitmap rows={CHIP_ROWS} palette={CHIP_PALETTE} size={2} />
              AWS Student Builder Group
            </p>

            <p className="bw-hero__lede">
              A <strong>24-hour build battle</strong> at Newlab Detroit. Open to builders, problem
              solvers, and creators. Wayne State and non-WSU students alike. Team up to code,
              design, and ship something that makes a difference. All majors, all experience levels.
            </p>

            <div className="bw-hero__actions">
              <a
                className="bw-btn bw-btn--primary"
                href={BUILDER_WARS.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Flag size={16} aria-hidden="true" />
                Register at {BUILDER_WARS.registerLabel}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <a className="bw-btn bw-btn--ghost" href="#bw-details">
                Event details
              </a>
            </div>

            <ul className="bw-hero__chips" aria-label="Quick facts">
              <li>{BUILDER_WARS.dateLabel}</li>
              <li>{BUILDER_WARS.location}</li>
              <li>Free admission</li>
            </ul>
          </div>

          <motion.aside
            className="bw-hero__panel bw-frame"
            aria-label="Countdown"
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="bw-frame__inner">
              <Countdown phase={phase} remaining={remaining} />
              <div className="bw-takeover" aria-hidden="true">
                <span className="bw-takeover__label">sbg://theme</span>
                <span className="bw-takeover__meter">
                  <span className="bw-takeover__fill" />
                </span>
                <span className="bw-takeover__state">override</span>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      <section id="bw-details" className="bw-section" aria-labelledby="bw-details-title">
        <motion.header className="bw-section__head" {...reveal}>
          <span className="bw-kicker">Mission brief</span>
          <h2 id="bw-details-title">Everything you need to show up ready</h2>
        </motion.header>

        <div className="bw-facts">
          {facts.map((fact, index) => (
            <motion.div
              key={fact.label}
              className="bw-frame bw-fact"
              {...reveal}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.45, delay: index * 0.06, ease: [0.2, 0.7, 0.2, 1] }
              }
            >
              <div className="bw-frame__inner">
                <span className="bw-fact__icon" aria-hidden="true">
                  {fact.icon}
                </span>
                <span className="bw-fact__label">{fact.label}</span>
                {fact.href ? (
                  <a
                    className="bw-fact__value bw-fact__value--link"
                    href={fact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {fact.value}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="bw-fact__value">{fact.value}</span>
                )}
                {fact.note && <span className="bw-fact__note">{fact.note}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="bw-section bw-prizes" aria-labelledby="bw-prizes-title">
        <motion.div className="bw-prizes__inner" {...reveal}>
          <span className="bw-kicker">On the line</span>
          <h2 id="bw-prizes-title" className="bw-visually-hidden">
            Prizes and perks
          </h2>
          <div className="bw-prizes__amount">
            <PixelText
              text={BUILDER_WARS.prizePool}
              size={8}
              color="#f0a33a"
              depth={1}
              depthColor="rgba(123,104,201,0.9)"
              label={`${BUILDER_WARS.prizePool} prize pool`}
            />
            <span className="bw-prizes__caption">in prizes</span>
          </div>
          <ul className="bw-prizes__perks">
            <li>
              <span className="bw-perk__big">Free</span>
              <span>admission</span>
            </li>
            <li>
              <span className="bw-perk__big">Free</span>
              <span>meals &amp; energy drinks</span>
            </li>
            <li>
              <span className="bw-perk__big">24h</span>
              <span>of venue, Wi-Fi, and mentors</span>
            </li>
          </ul>
          <p className="bw-prizes__fine">
            Prize breakdown and judging tracks get announced at kickoff. Register now so you get
            them first.
          </p>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="bw-section" aria-labelledby="bw-who-title">
        <motion.header className="bw-section__head" {...reveal}>
          <span className="bw-kicker">Who it is for</span>
          <h2 id="bw-who-title">If you can build it, you can enter it</h2>
        </motion.header>

        <div className="bw-rules">
          {[
            {
              title: 'Any student',
              body: 'Wayne State or not. Freshman or grad. CS, design, business, nursing, it does not matter. If you have an idea and a laptop, you are in.',
            },
            {
              title: 'Teams of one to four',
              body: 'Roll in with a crew or come solo and find one at kickoff. Mixed-skill teams tend to win these things.',
            },
            {
              title: 'Build what matters',
              body: 'Code it, design it, prototype it. Any stack, any hardware. The brief is impactful solutions that make a difference.',
            },
            {
              title: 'We handle the rest',
              body: 'Venue, meals, energy drinks, and a sponsor lineup that wants to see what Detroit students can ship in a day.',
            },
          ].map((rule, index) => (
            <motion.article
              key={rule.title}
              className="bw-rule"
              {...reveal}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.45, delay: index * 0.07, ease: [0.2, 0.7, 0.2, 1] }
              }
            >
              <span className="bw-rule__index" aria-hidden="true">
                {pad(index + 1)}
              </span>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="bw-section bw-sponsors" aria-labelledby="bw-sponsors-title">
        <motion.header className="bw-section__head" {...reveal}>
          <span className="bw-kicker">Backed by</span>
          <h2 id="bw-sponsors-title">Sponsors</h2>
        </motion.header>

        <motion.ul className="bw-sponsors__grid" {...reveal}>
          {BUILDER_WARS.sponsors.map((sponsor) => (
            <li key={sponsor.name} className="bw-sponsor">
              <a
                className="bw-sponsor__link"
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={`${sponsor.name} (${sponsor.note})`}
              >
                <span
                  className={`bw-sponsor__logo${'invert' in sponsor && sponsor.invert ? ' bw-sponsor__logo--invert' : ''}${'round' in sponsor && sponsor.round ? ' bw-sponsor__logo--round' : ''}`}
                >
                  <img src={sponsor.logo} alt="" loading="lazy" decoding="async" />
                  {'wordmark' in sponsor && sponsor.wordmark && (
                    <span className="bw-sponsor__wordmark" aria-hidden="true">
                      {sponsor.wordmark}
                    </span>
                  )}
                </span>
                <span className="bw-sponsor__note">{sponsor.note}</span>
              </a>
            </li>
          ))}
        </motion.ul>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="bw-section bw-cta" aria-labelledby="bw-cta-title">
        <motion.div className="bw-frame bw-cta__frame" {...reveal}>
          <div className="bw-frame__inner">
            <h2 id="bw-cta-title" className="bw-cta__title">
              <PixelText text="REGISTER NOW" size={5} color="#ffffff" depth={1} />
            </h2>
            <p className="bw-cta__body">
              Seats are capped by the venue. Registration takes about a minute and locks in your
              spot, your meals, and your shot at the pool.
            </p>
            <a
              className="bw-btn bw-btn--primary bw-btn--lg"
              href={BUILDER_WARS.registerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {BUILDER_WARS.registerLabel}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <ul className="bw-cta__links">
              {BUILDER_WARS.instagram.map((account) => (
                <li key={account.handle}>
                  <a href={account.url} target="_blank" rel="noopener noreferrer">
                    <img src="/instagram.svg" alt="" className="bw-cta__ig" />
                    {account.handle}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${BUILDER_WARS.contactEmail}`}>
                  <Mail size={15} aria-hidden="true" />
                  {BUILDER_WARS.contactEmail}
                </a>
              </li>
            </ul>
          </div>
        </motion.div>
      </section>

      {isAdmin && (
        <section className="bw-section bw-section--admin" aria-label="Admin tools">
          <BuilderWarsBroadcastPanel broadcastKey={BUILDER_WARS.broadcastKey} />
        </section>
      )}
    </div>
  );
}

export default BuilderWars;
