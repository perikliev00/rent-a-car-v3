const pino = require('pino');
const { version } = require('../../package.json');

const isProd = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: {
    service: 'luxride-api',
    version,
    env: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'req.body.password',
      'req.body.email',
      'req.body.phoneNumber',
      'req.body.address',
      'req.body.fullName',
      'email',
      'token',
      'rawToken',
      'req.body.token',
      'req.query.token',
      'verificationToken',
      'verificationUrl',
      'claimToken',
      'claimUrl',
    ],
    censor: '[Redacted]',
  },
  ...(!isProd && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

module.exports = logger;
