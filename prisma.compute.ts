import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "codershub",
    framework: "nestjs",
    httpPort: 3001,
    env: ".env",
  },
});
