interface Auth0Config {
  domain: string;
  clientId: string;
  redirectUri: string;
  audience?: string;
  configured: boolean;
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim();
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim();
const audience = import.meta.env.VITE_AUTH0_AUDIENCE?.trim();

export const auth0Config: Auth0Config = {
  domain: domain || 'your-auth0-domain.auth0.com',
  clientId: clientId || 'your-auth0-client-id',
  redirectUri: window.location.origin,
  audience,
  configured: Boolean(domain && clientId),
};
