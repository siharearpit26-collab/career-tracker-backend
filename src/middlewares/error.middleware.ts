import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ApiResponse } from '../types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Operational errors (expected)
  if (error instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      message: error.message,
      errors: error.errors,
    };
    res.status(error.statusCode).json(response);
    return;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path]!.push(err.message);
    });

    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      errors,
    };
    res.status(422).json(response);
    return;
  }

  // Mongoose validation errors
  if (error instanceof mongoose.Error.ValidationError) {
    const errors: Record<string, string[]> = {};
    Object.entries(error.errors).forEach(([key, value]) => {
      errors[key] = [value.message];
    });

    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      errors,
    };
    res.status(422).json(response);
    return;
  }

  // Mongoose duplicate key error
  if ((error as NodeJS.ErrnoException).code === '11000') {
    const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
    const field = keyPattern ? Object.keys(keyPattern)[0] : 'field';
    const response: ApiResponse = {
      success: false,
      message: `Duplicate value for ${field}`,
    };
    res.status(409).json(response);
    return;
  }

  // Mongoose cast error
  if (error instanceof mongoose.Error.CastError) {
    const response: ApiResponse = {
      success: false,
      message: `Invalid ${error.path}: ${error.value}`,
    };
    res.status(400).json(response);
    return;
  }

  // Unknown errors
  const response: ApiResponse = {
    success: false,
    message: config.app.isProduction ? 'Internal server error' : error.message,
  };
  res.status(500).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  };
  res.status(404).json(response);
};
