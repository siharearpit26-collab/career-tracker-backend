import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CareerTracker API',
      version: '1.0.0',
      description: 'Production-ready Career Management Platform API',
      contact: {
        name: 'CareerTracker Support',
        email: 'support@careertracker.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}/api`,
        description: 'Development server',
      },
      {
        url: 'https://api.careertracker.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT Bearer token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            errors: { type: 'object', nullable: true },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: {
              type: 'object',
              properties: {
                data: { type: 'array', items: {} },
                pagination: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    totalPages: { type: 'integer' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication operations' },
      { name: 'Applications', description: 'Job application operations' },
      { name: 'Companies', description: 'Company operations' },
      { name: 'Dashboard', description: 'Dashboard analytics' },
      { name: 'Reports', description: 'Reports and exports' },
      { name: 'Reminders', description: 'Reminder management' },
      { name: 'Notifications', description: 'Notification management' },
      { name: 'Profile', description: 'User profile management' },
      { name: 'Admin', description: 'Admin operations' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
