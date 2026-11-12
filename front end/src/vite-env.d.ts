/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Contribute this line to the enclosing declaration or statement.
  readonly VITE_API_BASE_URL: string;
  // Contribute this line to the enclosing declaration or statement.
  readonly VITE_ADMIN_FRONTEND_URL?: string;
  // Contribute this line to the enclosing declaration or statement.
  readonly VITE_SENTRY_DSN?: string;
  // Contribute this line to the enclosing declaration or statement.
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
}

// Declare the ImportMeta TypeScript interface.
interface ImportMeta {
  // Contribute this line to the enclosing declaration or statement.
  readonly env: ImportMetaEnv;
}
