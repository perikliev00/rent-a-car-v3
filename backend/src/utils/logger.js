/**
 * Shared Pino logger for the LuxRide API.
 * Production uses structured JSON; non-production pretty-prints and redacts sensitive fields.
 */

const pino = require('pino');
// Destructure object properties into local variables.
const { version } = require('../../package.json');

// Create the is prod constant.
const isProd = process.env.NODE_ENV === 'production';

// Create the logger constant.
const logger = pino({
  // Provide the level field value.
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  // Provide the base field value.
  base: {
    // Provide the service field value.
    service: 'luxride-api',
    // Contribute this line to the enclosing declaration or statement.
    version,
    // Provide the env field value.
    env: process.env.NODE_ENV || 'development',
  },
  // Provide the redact field value.
  redact: {
    // Provide the paths field value.
    paths: [
      // Supply the literal value used by the enclosing expression.
      'req.headers.cookie',
      // Supply the literal value used by the enclosing expression.
      'req.headers.authorization',
      // Supply the literal value used by the enclosing expression.
      'password',
      // Supply the literal value used by the enclosing expression.
      'req.body.password',
      // Supply the literal value used by the enclosing expression.
      'req.body.email',
      // Supply the literal value used by the enclosing expression.
      'req.body.phoneNumber',
      // Supply the literal value used by the enclosing expression.
      'req.body.address',
      // Supply the literal value used by the enclosing expression.
      'req.body.fullName',
      // Supply the literal value used by the enclosing expression.
      'email',
    ],
    // Provide the censor field value.
    censor: '[Redacted]',
  },
  // Call ... to perform this step.
  ...(!isProd && {
    // Provide the transport field value.
    transport: {
      // Provide the target field value.
      target: 'pino-pretty',
      // Provide the options field value.
      options: {
        // Provide the colorize field value.
        colorize: true,
        // Provide the translate time field value.
        translateTime: 'SYS:standard',
        // Provide the ignore field value.
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Assign the CommonJS module exports.
module.exports = logger;
