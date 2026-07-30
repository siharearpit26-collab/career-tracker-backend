import { config } from '../config';
import { encrypt, decrypt } from './encryption.utils';
import { logger } from './logger';

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  email: string;
  name?: string;
}

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface MicrosoftUserInfo {
  mail?: string;
  userPrincipalName: string;
}

// Gmail OAuth
export const getGmailAuthUrl = (redirectUri: string): string => {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const exchangeGmailCode = async (
  code: string,
  redirectUri: string
): Promise<OAuthTokens> => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Gmail token exchange failed:', error);
    throw new Error('Failed to exchange Gmail authorization code');
  }

  const data = (await response.json()) as GoogleTokenResponse;

  if (!data.refresh_token) {
    throw new Error('No refresh token received. Please re-authorize with consent.');
  }

  // Get user email
  const userResponse = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${data.access_token}` } }
  );

  if (!userResponse.ok) {
    throw new Error('Failed to get Gmail user info');
  }

  const userInfo = (await userResponse.json()) as GoogleUserInfo;

  return {
    accessToken: encrypt(data.access_token),
    refreshToken: encrypt(data.refresh_token),
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    email: userInfo.email,
  };
};

export const refreshGmailToken = async (
  encryptedRefreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> => {
  const refreshToken = decrypt(encryptedRefreshToken);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Gmail token');
  }

  const data = (await response.json()) as GoogleTokenResponse;

  return {
    accessToken: encrypt(data.access_token),
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
};

// Outlook OAuth
export const getOutlookAuthUrl = (redirectUri: string): string => {
  const clientId = process.env['OUTLOOK_CLIENT_ID'] ?? '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ].join(' '),
    response_mode: 'query',
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
};

export const exchangeOutlookCode = async (
  code: string,
  redirectUri: string
): Promise<OAuthTokens> => {
  const clientId = process.env['OUTLOOK_CLIENT_ID'] ?? '';
  const clientSecret = process.env['OUTLOOK_CLIENT_SECRET'] ?? '';

  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('Outlook token exchange failed:', error);
    throw new Error('Failed to exchange Outlook authorization code');
  }

  const data = (await response.json()) as MicrosoftTokenResponse;

  if (!data.refresh_token) {
    throw new Error('No refresh token received from Outlook');
  }

  // Get user email
  const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get Outlook user info');
  }

  const userInfo = (await userResponse.json()) as MicrosoftUserInfo;

  return {
    accessToken: encrypt(data.access_token),
    refreshToken: encrypt(data.refresh_token),
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    email: userInfo.mail ?? userInfo.userPrincipalName,
  };
};

export const refreshOutlookToken = async (
  encryptedRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> => {
  const refreshToken = decrypt(encryptedRefreshToken);
  const clientId = process.env['OUTLOOK_CLIENT_ID'] ?? '';
  const clientSecret = process.env['OUTLOOK_CLIENT_SECRET'] ?? '';

  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to refresh Outlook token');
  }

  const data = (await response.json()) as MicrosoftTokenResponse;

  return {
    accessToken: encrypt(data.access_token),
    refreshToken: data.refresh_token ? encrypt(data.refresh_token) : encryptedRefreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
};
