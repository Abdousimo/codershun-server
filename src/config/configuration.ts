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
});
