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
  // Call app.use to perform this step.
  app.use(
    // Call helmet to perform this step.
    helmet({
      // JSON API — CSP adds little value; frontend is a separate SPA origin.
      contentSecurityPolicy: false,
      // Provide the cross origin embedder policy field value.
      crossOriginEmbedderPolicy: false,
      // Provide the hide powered by field value.
      hidePoweredBy: true,
      // Provide the cross origin opener policy field value.
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      // cross-origin so SPA on another origin can load /images and JSON.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Provide the frameguard field value.
      frameguard: { action: 'sameorigin' },
      // Provide the no sniff field value.
      noSniff: true,
      // Provide the referrer policy field value.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // HSTS only in production (avoid locking browsers onto HTTPS for local HTTP).
      hsts: isProd
        // Contribute this line to the enclosing declaration or statement.
        ? {
            // Provide the max age field value.
            maxAge: 15552000,
            // Provide the include sub domains field value.
            includeSubDomains: true,
            // Provide the preload field value.
            preload: false,
          }
        // Contribute this line to the enclosing declaration or statement.
        : false,
    })
  );

  // Explicitly disable powerful browser features the API never needs.
  app.use((req, res, next) => {
    // Call res.setHeader to perform this step.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Call next to perform this step.
    next();
  });
}

// Assign the CommonJS module exports.
module.exports = applySecurity;
