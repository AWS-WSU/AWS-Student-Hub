import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

import env from '../config/env';

export interface Auth0Identity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
}

interface Auth0Claims extends jwt.JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
}

let cachedClient: ReturnType<typeof jwksRsa> | null = null;
let cachedClientDomain: string | null = null;

const normalizeDomain = (value: string): string => {
  const domain = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (!domain || domain.includes('/') || domain.includes('\\')) {
    throw new Error('AUTH0_DOMAIN is invalid');
  }
  return domain;
};

const isAuth0Claims = (value: string | jwt.JwtPayload): value is Auth0Claims => {
  return (
    typeof value !== 'string' &&
    typeof value.sub === 'string' &&
    (value.email === undefined || typeof value.email === 'string')
  );
};

export const verifyAuth0IdToken = async (idToken: string): Promise<Auth0Identity> => {
  if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_ID) {
    throw new Error('Auth0 backend configuration is incomplete');
  }

  const domain = normalizeDomain(env.AUTH0_DOMAIN);
  const issuer = `https://${domain}/`;
  if (!cachedClient || cachedClientDomain !== domain) {
    cachedClient = jwksRsa({
      jwksUri: `${issuer}.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      timeout: 5000,
    });
    cachedClientDomain = domain;
  }
  const client = cachedClient;

  const claims = await new Promise<string | jwt.JwtPayload>((resolve, reject) => {
    jwt.verify(
      idToken,
      (header, callback) => {
        if (!header.kid) {
          callback(new jwt.JsonWebTokenError('Auth0 token is missing a key identifier'));
          return;
        }

        client.getSigningKey(header.kid, (error, key) => {
          if (error || !key) {
            callback(error || new jwt.JsonWebTokenError('Auth0 signing key was not found'));
            return;
          }
          callback(null, key.getPublicKey());
        });
      },
      {
        algorithms: ['RS256'],
        audience: env.AUTH0_CLIENT_ID,
        issuer,
      },
      (error, decoded) => {
        if (error || !decoded) {
          reject(error || new jwt.JsonWebTokenError('Auth0 token could not be decoded'));
          return;
        }
        resolve(decoded);
      }
    );
  });

  if (!isAuth0Claims(claims) || !claims.email) {
    throw new jwt.JsonWebTokenError('Auth0 token does not contain an email identity');
  }

  return {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true,
    name: claims.name,
    nickname: claims.nickname,
    picture: claims.picture,
  };
};
