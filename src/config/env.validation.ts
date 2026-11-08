import { plainToInstance } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, validateSync } from "class-validator";

export enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(0)
  @IsOptional()
  PORT: number = 3001;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = "http://localhost:3000";

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  DATABASE_URL_TEST?: string;

  @IsString()
  @MinLength(32)
  @IsOptional()
  AUTH_SECRET: string = "codershub-dev-secret-key-must-be-at-least-32-characters-long";

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL: string = "15m";

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL_DAYS: string = "30";

  @IsString()
  @IsOptional()
  STORAGE_UPLOAD_DIR?: string;

  @IsString()
  @IsOptional()
  EMAIL_BACKEND?: string;

  @IsString()
  @IsOptional()
  EMAIL_HOST?: string;

  @IsNumber()
  @IsOptional()
  EMAIL_PORT?: number;

  @IsOptional()
  EMAIL_USE_TLS?: boolean | string;

  @IsString()
  @IsOptional()
  EMAIL_HOST_USER?: string;

  @IsString()
  @IsOptional()
  EMAIL_HOST_PASSWORD?: string;

  @IsString()
  @IsOptional()
  DEFAULT_FROM_EMAIL?: string;

  @IsString()
  @IsOptional()
  AGENT_FROM_EMAIL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }
  return validatedConfig;
}
