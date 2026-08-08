import { defineConfig } from 'vitepress';

const teacherSidebar = [
  {
    text: 'Start here',
    items: [
      { text: 'System overview', link: '/guide/system-overview' },
      { text: 'Roles and permissions', link: '/guide/roles-and-permissions' },
      { text: 'Semester runbook', link: '/guide/semester-runbook' },
    ],
  },
  {
    text: 'Classroom operations',
    items: [
      { text: 'Prizeversity instances', link: '/guide/instances' },
      { text: 'Student account linking', link: '/guide/student-linking' },
      { text: 'Catalog and assignments', link: '/guide/catalog-and-assignments' },
      { text: 'Reviews and rewards', link: '/guide/reviews-and-rewards' },
      { text: 'Troubleshooting', link: '/guide/troubleshooting' },
    ],
  },
];

const authoringSidebar = [
  {
    text: 'Challenge authoring',
    items: [
      { text: 'Choose a challenge type', link: '/authoring/choose-a-type' },
      { text: 'Custom challenges', link: '/authoring/custom-challenges' },
      { text: 'Curated challenges', link: '/authoring/curated-challenges' },
      { text: 'Lifecycle and versioning', link: '/authoring/lifecycle-and-versioning' },
    ],
  },
];

const developerSidebar = [
  {
    text: 'Developer reference',
    items: [
      { text: 'Architecture', link: '/reference/architecture' },
      { text: 'Data model', link: '/reference/data-model' },
      { text: 'HTTP API', link: '/reference/http-api' },
      { text: 'Reward delivery', link: '/reference/reward-delivery' },
      { text: 'Security boundaries', link: '/reference/security' },
      { text: 'Deployment and migrations', link: '/reference/deployment' },
      { text: 'Screenshot maintenance', link: '/reference/screenshots' },
      { text: 'Glossary', link: '/reference/glossary' },
    ],
  },
];

export default defineConfig({
  title: 'Challenge Operations Handbook',
  description: 'Teacher and developer documentation for AWS Student Hub challenges',
  base: '/docs/',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    lineNumbers: true,
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/docs/aws-student-builder-group-logo.png' }],
    ['meta', { name: 'theme-color', content: '#17211d' }],
    ['meta', { name: 'color-scheme', content: 'light dark' }],
  ],
  themeConfig: {
    logo: {
      src: '/aws-student-builder-group-logo.png',
      alt: 'AWS Student Builder Group',
    },
    nav: [
      { text: 'Main site', link: 'https://wayneaws.dev/', target: '_self' },
      { text: 'Teacher guide', link: '/guide/system-overview', activeMatch: '^/guide/' },
      { text: 'Authoring', link: '/authoring/choose-a-type', activeMatch: '^/authoring/' },
      { text: 'Developer reference', link: '/reference/architecture', activeMatch: '^/reference/' },
    ],
    sidebar: {
      '/guide/': teacherSidebar,
      '/authoring/': authoringSidebar,
      '/reference/': developerSidebar,
    },
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },
    footer: {
      message: 'AWS Student Hub challenge operations and engineering reference.',
      copyright: 'AWS Student Hub',
    },
  },
});
