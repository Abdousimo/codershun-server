export default () => ({
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT ?? "3001", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL,
    testUrl: process.env.DATABASE_URL_TEST,
  },
  auth: {
    secret: process.env.AUTH_SECRET || "codershub-dev-secret-key-must-be-at-least-32-characters-long",
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS || "30", 10),
  },
  storage: {
    uploadDir: process.env.STORAGE_UPLOAD_DIR || "uploads",
  },
  email: {
    backend: process.env.EMAIL_BACKEND || "django.core.mail.backends.smtp.EmailBackend",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    useTls: process.env.EMAIL_USE_TLS === "True" || process.env.EMAIL_USE_TLS === "true" || true,
    user: process.env.EMAIL_HOST_USER || "testingtestingapp5@gmail.com",
    password: process.env.EMAIL_HOST_PASSWORD || "ufpp qlla mawt wrcq",
    defaultFrom: process.env.DEFAULT_FROM_EMAIL || "testingtestingapp5@gmail.com",
    agentFrom: process.env.AGENT_FROM_EMAIL || "testingtestingapp5@gmail.com",
  },
});
