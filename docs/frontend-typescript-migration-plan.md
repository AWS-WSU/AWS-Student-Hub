# Frontend TypeScript Migration Plan

## Goal

Migrate `frontend/` from JavaScript/JSX to TypeScript/TSX while preserving current app behavior, Vite build output, routing, Auth0 integration, and API contracts with the newly migrated TypeScript backend.

## Scope

Included:

- `frontend/src/**/*.jsx` to `frontend/src/**/*.tsx`
- `frontend/src/**/*.js` to `frontend/src/**/*.ts`
- `frontend/vite.config.js` to `frontend/vite.config.ts`
- Frontend ESLint config update for TypeScript
- Frontend package scripts and dependencies
- Shared frontend type definitions for API data, auth state, users, events, admin data, and UI props

Excluded for now:

- `prizeversity/`
- Rewriting UI architecture
- Replacing Auth0, React Router, or Vite
- Changing backend API routes
- Large feature refactors unrelated to TypeScript

## Current Frontend Overview

The frontend is a Vite React app using:

- React 19
- React Router
- Auth0 React SDK
- Lucide icons
- Motion
- React Easy Crop
- Plain CSS

Largest/highest-risk files:

- `frontend/src/pages/Account.jsx`
- `frontend/src/pages/Auth.jsx`
- `frontend/src/pages/AdminDashboard.jsx`
- `frontend/src/pages/Landing.jsx`
- `frontend/src/utils/api.js`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/components/CreateEventModal.jsx`
- `frontend/src/components/EventModal.jsx`
- `frontend/src/components/Navbar.jsx`

## Migration Strategy

Use an incremental migration rather than rewriting all typing perfectly in one pass.

Recommended order:

1. Add TypeScript infrastructure.
2. Add shared frontend type definitions.
3. Convert config and utility files.
4. Convert contexts.
5. Convert app entrypoints.
6. Convert smaller components.
7. Convert large pages.
8. Tighten types after the app builds.

Initial TypeScript strictness should be practical, not maximal. Start with `strict: false` or limited strictness, then tighten once the frontend compiles.

## Phase 1: Add TypeScript Tooling

### Add dependencies

Install frontend TypeScript dependencies:

```sh
npm install --prefix frontend -D typescript typescript-eslint @types/node
```

The frontend already has:

- `@types/react`
- `@types/react-dom`

### Add `frontend/tsconfig.json`

Recommended initial config:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts"],
  "references": []
}
```

### Add `frontend/src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Update `frontend/package.json`

Add:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

Keep existing scripts:

- `dev`
- `build`
- `lint`
- `preview`

## Phase 2: Update ESLint

Update `frontend/eslint.config.js` to support TypeScript files.

Target coverage:

- `.js`
- `.jsx`
- `.ts`
- `.tsx`

Suggested dependency:

```sh
npm install --prefix frontend -D typescript-eslint
```

Suggested rules strategy:

- Keep existing React hooks rules.
- Keep React refresh rules.
- Turn off base `no-unused-vars` for TypeScript files.
- Use `@typescript-eslint/no-unused-vars` for TypeScript files.
- Avoid strict type-aware ESLint rules initially.

## Phase 3: Add Frontend Types

Create a `frontend/src/types/` directory.

Suggested files:

```txt
frontend/src/types/api.ts
frontend/src/types/auth.ts
frontend/src/types/event.ts
frontend/src/types/user.ts
frontend/src/types/admin.ts
frontend/src/types/ui.ts
```

### `user.ts`

Define the frontend-safe user shape returned by the backend.

Suggested types:

```ts
export type UserRole = 'member' | 'moderator' | 'admin' | 'superuser';
export type UserStatus = 'active' | 'banned' | 'suspended';
export type UserGrade = '' | 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate' | 'Other';

export interface User {
  _id?: string;
  id?: string;
  username: string;
  fullName: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  major?: string;
  grade?: UserGrade;
  programmingLanguages?: string[];
  profileSetupCompleted?: boolean;
  role?: UserRole;
  status?: UserStatus;
  wantsEmails?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  hasViewedAwsCredentials?: boolean;
}

export interface PublicProfile {
  username: string;
  fullName: string;
  profilePicture?: string;
  bio?: string;
  major?: string;
  grade?: UserGrade;
  programmingLanguages: string[];
  role: UserRole;
  lastLogin?: string;
  stats: {
    memberSince: string;
    daysSinceJoin: number;
    daysSinceLastSeen: number;
  };
}
```

### `event.ts`

```ts
export type EventStatus = 'draft' | 'published';

export interface Event {
  _id: string;
  title: string;
  startTime: string;
  isRemote: boolean | 'true' | 'false';
  zoomLink?: string;
  address?: string;
  directions?: string;
  locationName?: string;
  description?: string;
  thumbnailUrl?: string;
  meetupUrl?: string;
  status?: EventStatus;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventFormPayload {
  title?: string;
  startTime?: string;
  date?: string;
  time?: string;
  isRemote?: boolean | string;
  zoomLink?: string;
  address?: string;
  directions?: string;
  locationName?: string;
  description?: string;
  meetupUrl?: string;
  status?: EventStatus;
  thumbnail?: File | Blob | null;
}
```

### `api.ts`

```ts
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  success?: false;
  error?: string;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
  success: boolean;
  pagination: {
    currentPage?: number;
    page?: number;
    totalPages: number;
    totalUsers?: number;
    total?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
  data?: T[];
}
```

### `auth.ts`

```ts
import type { User } from './user';

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  rememberMe: boolean;
  user: User;
  awsCredentials?: AwsCredentials;
}

export interface LoginCredentials {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
}

export interface SignupPayload {
  username?: string;
  fullName: string;
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (payload: SignupPayload) => Promise<AuthResponse>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshTokens: () => Promise<AuthResponse | void>;
  forceLogoutAndClearData: () => void;
  isAuthenticated: boolean;
}
```

## Phase 4: Convert Config and Utilities

Convert these first:

```txt
frontend/vite.config.js -> frontend/vite.config.ts
frontend/src/config/auth0.js -> frontend/src/config/auth0.ts
frontend/src/utils/api.js -> frontend/src/utils/api.ts
frontend/src/utils/imageUtils.js -> frontend/src/utils/imageUtils.ts
```

### `api.ts` migration guidance

`frontend/src/utils/api.js` is central and large. Convert it early, but do not over-type everything at once.

Recommended steps:

1. Type storage helpers:
   - `getStoredItem(key: string): string | null`
   - `setStoredItem(key: string, value: string): void`
   - `clearStoredItem(key: string): void`
2. Type `apiRequest<T>()` generically:

```ts
const apiRequest = async <T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  // existing logic
};
```

3. Add return types incrementally for each API object:
   - `newsletterAPI`
   - `authAPI`
   - `discordAPI`
   - `adminAPI`
   - `eventsAPI`

4. Keep unknown responses where exact API shape is unclear, then tighten later.

## Phase 5: Convert Contexts

Convert:

```txt
frontend/src/context/AuthContext.jsx -> frontend/src/context/AuthContext.tsx
frontend/src/context/ToastContext.jsx -> frontend/src/context/ToastContext.tsx
```

### Auth context risks

High-risk areas:

- `createContext()` currently has no default type.
- `useRef(null)` for refresh promises needs typing.
- JWT decoding with `atob` should have a typed payload.
- Auth0 user and local backend user are different shapes.
- Cached user parsing should be guarded.

Suggested helper type:

```ts
interface JwtPayload {
  exp: number;
  id?: string;
  email?: string;
  tokenVersion?: number;
}
```

Use:

```ts
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
```

### Toast context

Suggested types:

```ts
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: number) => void;
}
```

## Phase 6: Convert App Entrypoints

Convert:

```txt
frontend/src/main.jsx -> frontend/src/main.tsx
frontend/src/App.jsx -> frontend/src/App.tsx
```

Expected prop types:

```ts
export type Theme = 'light' | 'dark';

interface ThemeProps {
  theme: Theme;
}

interface LayoutProps extends ThemeProps {
  toggleTheme: () => void;
}
```

Use `Theme` consistently across pages/components that accept `theme`.

## Phase 7: Convert Smaller Components

Recommended order:

```txt
frontend/src/components/Toast.jsx
frontend/src/components/SocialLinks.jsx
frontend/src/components/Footer.jsx
frontend/src/components/Layout.jsx
frontend/src/components/Navbar.jsx
frontend/src/components/CyberChallengeModal.jsx
frontend/src/components/EventModal.jsx
frontend/src/components/CreateEventModal.jsx
```

### Component prop typing pattern

Use local prop interfaces first:

```ts
interface FooterProps {
  theme: Theme;
}

function Footer({ theme }: FooterProps) {
  // existing implementation
}
```

If a prop type becomes shared, move it to `frontend/src/types/ui.ts`.

## Phase 8: Convert Pages

Recommended order from easiest to hardest:

```txt
frontend/src/pages/NotFoundPage.jsx
frontend/src/pages/About.jsx
frontend/src/pages/Resources.jsx
frontend/src/pages/Challenges.jsx
frontend/src/pages/QuickSetup.jsx
frontend/src/pages/PublicProfile.jsx
frontend/src/pages/Events.jsx
frontend/src/pages/Landing.jsx
frontend/src/pages/AdminDashboard.jsx
frontend/src/pages/Auth.jsx
frontend/src/pages/Account.jsx
```

Large pages should be converted with pragmatic typing first.

### `Account.tsx` risks

- Many `useState({})` objects need explicit interfaces.
- `inputRefs` should use `useRef<Record<string, HTMLInputElement | null>>({})`.
- File upload handlers need `ChangeEvent<HTMLInputElement>`.
- Form submit handlers need `FormEvent`.
- AWS credentials modal state should use `AwsCredentials | null`.

### `Auth.tsx` risks

- Reset password flow state should have a dedicated interface.
- Form data should have a dedicated interface.
- Auth API calls should use typed payloads/responses.
- Query params from React Router are nullable strings.

### `AdminDashboard.tsx` risks

- Admin stats response needs a type.
- User table rows should use `User` plus admin-only fields.
- Queue entries need an `EmailQueueEntry` type.
- Modal state should use `User | null` instead of untyped objects.

## Phase 9: Styling and Asset Typing

If importing non-code assets becomes an issue, add declarations in `vite-env.d.ts` or a dedicated file:

```ts
declare module '*.css';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.webp';
```

Vite often handles this automatically, but explicit declarations can help editor tooling.

## Phase 10: Validation Checklist

Run after each meaningful batch:

```sh
npm run typecheck --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Recommended validation milestones:

1. After tooling/config setup.
2. After utilities and contexts.
3. After app entrypoints.
4. After components.
5. After pages.
6. Final full frontend build.

## Suggested Commit Breakdown

Use small commits to keep review manageable:

1. `chore(frontend): add typescript tooling`
2. `chore(frontend): add shared frontend types`
3. `refactor(frontend): migrate config and api utilities to typescript`
4. `refactor(frontend): migrate auth and toast contexts to typescript`
5. `refactor(frontend): migrate app entrypoints to tsx`
6. `refactor(frontend): migrate shared components to tsx`
7. `refactor(frontend): migrate frontend pages to tsx`
8. `chore(frontend): enable frontend typecheck in validation`

## Acceptance Criteria

Frontend migration is complete when:

- No `.jsx` files remain under `frontend/src`.
- No app `.js` files remain under `frontend/src` except intentionally ignored generated files.
- `frontend/vite.config.ts` is used.
- `npm run typecheck --prefix frontend` passes.
- `npm run lint --prefix frontend` passes.
- `npm run build --prefix frontend` passes.
- Auth flows still work:
  - login
  - signup
  - refresh token
  - logout
  - profile fetch
- Core pages still render:
  - landing
  - events
  - account
  - admin dashboard
  - public profile
- Event creation/edit/delete still works for admins.
- Profile picture upload still works.

## Recommended Initial Strictness

Start practical:

```json
{
  "strict": false,
  "noImplicitAny": false
}
```

Then later tighten to:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true
}
```

Do not enable full strictness until the initial migration builds cleanly.

## Known Follow-Up Improvements

After the frontend is compiling in TypeScript:

- Share generated or manually maintained API DTOs between backend and frontend.
- Replace repeated API response parsing with a typed helper.
- Add runtime validation for critical API responses if needed.
- Tighten context types and remove broad `unknown`/`Record<string, unknown>` usage.
- Consider enabling stricter TypeScript settings once the app stabilizes.
