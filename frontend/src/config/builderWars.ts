/** Single source of truth for Builder Wars facts shown across the hub. */

export const BUILDER_WARS = {
  broadcastKey: 'builder-wars-2026',
  registerUrl: 'https://builderwars.dev',
  registerLabel: 'builderwars.dev',
  // Sat Nov 14, 10:00 AM America/Detroit (EST after the Nov 1 DST change)
  kickoff: Date.UTC(2026, 10, 14, 15, 0, 0),
  // Sun Nov 15, 3:00 PM America/Detroit
  wrap: Date.UTC(2026, 10, 15, 20, 0, 0),
  dateLabel: 'November 14-15, 2026',
  timeLabel: 'Sat 10 AM to Sun 3 PM',
  location: 'Newlab Detroit',
  locationUrl: 'https://maps.google.com/?q=Newlab+Detroit',
  teamSize: '1 to 4 members',
  prizePool: '$2,000+',
  contactEmail: 'awssbg@wayne.edu',
  instagram: [
    { handle: '@builderwars.hack', url: 'https://www.instagram.com/builderwars.hack/' },
    { handle: '@aws_sbg_wsu', url: 'https://www.instagram.com/aws_sbg_wsu/' },
  ],
  sponsors: [
    { name: 'AWS', note: 'Cloud' },
    { name: 'FreeWili', note: 'Hardware' },
    { name: 'Red Bull', note: 'Fuel' },
    { name: 'Ford', note: 'Mobility' },
    { name: 'Rezzy', note: 'Partner' },
    { name: 'Newlab', note: 'Venue' },
    { name: 'WSU Engineering Student Senate', note: 'Campus' },
  ],
} as const;

export type BuilderWarsPhase = 'before' | 'live' | 'after';

export const getBuilderWarsPhase = (now = Date.now()): BuilderWarsPhase => {
  if (now < BUILDER_WARS.kickoff) return 'before';
  if (now < BUILDER_WARS.wrap) return 'live';
  return 'after';
};
