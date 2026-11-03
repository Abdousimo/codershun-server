import "reflect-metadata";
import "dotenv/config";

import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  // Global prefix /api/v1
  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "", method: RequestMethod.GET }],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger OpenAPI docs at /api/docs
  const nodeEnv = configService.get<string>("env", "development");
  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Coders Hub API")
      .setDescription(
        [
          "REST API for the Coders Hub IT staff augmentation platform.",
          "",
          "All application endpoints use the /api/v1 prefix. Protected endpoints require a JWT access token.",
          "Use the Authorize button to provide a token as: Bearer <access-token>.",
        ].join("\n"),
      )
      .setVersion("1.0.0")
      .setContact("Coders Hub", "https://codershub.dz", "support@codershub.dz")
      .addServer(`http://localhost:${configService.get<number>("port", 3001)}`, "Local development")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token",
        },
        "bearer",
      )
      .addTag("Health", "Service health and readiness")
      .addTag("Authentication", "Registration, login, refresh and account security")
      .addTag("Public Forms", "Unauthenticated lead, talent and referral forms")
      .addTag("CRM Leads", "Leads, companies and CRM activity")
      .addTag("Admin / Placements", "Placement lifecycle and pricing operations")
      .addTag("Admin / Contracts", "Contract metadata and signed documents")
      .addTag("Admin / Invoices", "Invoices, credit notes and payments")
      .addTag("Admin / Payouts", "Talent payout preparation and payment tracking")
      .addTag("Admin / Referrals", "Referral attribution and rewards")
      .addTag("Notifications", "In-app notifications and preferences")
      .addTag("Admin / Notifications", "Email templates and notification administration")
      .addTag("Admin / Audit & Dashboard", "Audit history and operational KPIs")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      customSiteTitle: "Coders Hub API Documentation",
      jsonDocumentUrl: "api/docs-json",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });
    logger.log("Swagger documentation initialized at /api/docs (OpenAPI JSON: /api/docs-json)");
  }

  const port = configService.get<number>("port", 3001);
  await app.listen(port, "0.0.0.0");
  logger.log(`Server running at http://localhost:${port}/api/v1`);
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
