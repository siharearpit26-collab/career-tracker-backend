import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload, TokenPair } from '../types';
import { UnauthorizedError } from './errors';

export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.accessExpiration as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.secret, options);
};

export const generateRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiration as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
};

export const generateTokenPair = (payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
};

export const decodeToken = (token: string): JwtPayload | null => {
  const decoded = jwt.decode(token);
  return decoded as JwtPayload | null;
};
