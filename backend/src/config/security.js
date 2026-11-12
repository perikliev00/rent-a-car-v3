/**
 * Applies Helmet and Permissions-Policy headers for the JSON API process.
 * Frontend CSP lives on the SPA host; this process only hardens API responses.
 */
const helmet = require('helmet');

/**
 * Mount security headers on the Express app.
 * Side effects: registers Helmet and a Permissions-Policy middleware on `app`.
 * @param {import('express').Express} app - Express application instance
 * @param {{ isProd: boolean }} options - HSTS is enabled only when `isProd` is true
 * @returns {void}
 */
function applySecurity(app, { isProd }) {
  app.use(
    helmet({
      // JSON API — CSP adds little value; frontend is a separate SPA origin.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hidePoweredBy: true,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      // cross-origin so SPA on another origin can load /images and JSON.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'sameorigin' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // HSTS only in production (avoid locking browsers onto HTTPS for local HTTP).
      hsts: isProd
        ? {
            maxAge: 15552000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
    })
  );

  // Explicitly disable powerful browser features the API never needs.
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
}

module.exports = applySecurity;
