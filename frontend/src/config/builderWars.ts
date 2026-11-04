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
    { name: 'AWS', note: 'Cloud', logo: '/aws-light.svg', url: 'https://aws.amazon.com' },
    {
      name: 'FreeWili',
      note: 'Hardware',
      logo: '/sponsors/freewili.svg',
      url: 'https://www.freewili.com',
    },
    {
      name: 'Red Bull',
      note: 'Fuel',
      logo: '/sponsors/redbull.svg',
      url: 'https://www.redbull.com',
    },
    { name: 'Ford', note: 'Mobility', logo: '/sponsors/ford.svg', url: 'https://www.ford.com' },
    {
      name: 'Rezzy',
      note: 'Partner',
      logo: '/sponsors/rezzy.svg',
      url: 'https://www.rezzy.dev',
      // Rezzy ships only the star mark; its wordmark is set in type.
      wordmark: 'Rezzy',
    },
    {
      name: 'Newlab',
      note: 'Venue',
      logo: '/sponsors/newlab.svg',
      url: 'https://newlab.com',
      // Only a black wordmark is published; flip it for the dark panel.
      invert: true,
    },
    {
      name: 'WSU Engineering Student Senate',
      note: 'Campus',
      logo: '/sponsors/wsu-ess.jpg',
      url: 'https://getinvolved.wayne.edu/organization/ess',
      // Round seal on a white square; crop to the circle.
      round: true,
    },
  ],
} as const;

export type BuilderWarsPhase = 'before' | 'live' | 'after';

export const getBuilderWarsPhase = (now = Date.now()): BuilderWarsPhase => {
  if (now < BUILDER_WARS.kickoff) return 'before';
  if (now < BUILDER_WARS.wrap) return 'live';
  return 'after';
};
