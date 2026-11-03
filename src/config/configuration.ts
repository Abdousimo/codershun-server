export default () => ({
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT ?? "3001", 10),
  database: {
    url: process.env.DATABASE_URL,
    testUrl: process.env.DATABASE_URL_TEST,
  },
  auth: {
    secret: process.env.AUTH_SECRET,
  },
});
