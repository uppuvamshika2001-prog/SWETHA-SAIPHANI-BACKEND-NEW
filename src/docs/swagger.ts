import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config/index.js';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Swetha Saiphani Clinics API',
            version: '1.0.0',
            description: 'Enterprise-grade Hospital Management System API',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: `http://localhost:${config.port}`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'error' },
                        message: { type: 'string' },
                        code: { type: 'integer' },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'success' },
                        data: { type: 'object' },
                        message: { type: 'string' },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Users', description: 'User management' },
            { name: 'Staff', description: 'Staff management' },
            { name: 'Patients', description: 'Patient management' },
            { name: 'Appointments', description: 'Appointment scheduling' },
            { name: 'Medical Records', description: 'Medical records management' },
            { name: 'Prescriptions', description: 'Prescription management' },
            { name: 'Pharmacy', description: 'Pharmacy and inventory' },
            { name: 'Lab', description: 'Lab tests and results' },
        ],
    },
    apis: ['./src/modules/**/*.ts', './src/modules/**/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
