const helmet = require('helmet');

function applySecurity(app, { isProd }) {
  app.use(
    helmet({
      // JSON API — CSP adds little value; frontend is a separate SPA origin.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hidePoweredBy: true,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'sameorigin' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd
        ? {
            maxAge: 15552000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
    })
  );

  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
}

module.exports = applySecurity;
