import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "../../generated/prisma/client";

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Prisma Known Request Errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.warn(`Prisma error code: ${exception.code} - ${exception.message}`);

      switch (exception.code) {
        case "P2002": {
          const target = (exception.meta?.target as string[])?.join(", ") ?? "field";
          return response.status(HttpStatus.CONFLICT).json({
            statusCode: HttpStatus.CONFLICT,
            error: "Conflict",
            message: `A record with this ${target} already exists.`,
            code: "P2002",
          });
        }
        case "P2025": {
          return response.status(HttpStatus.NOT_FOUND).json({
            statusCode: HttpStatus.NOT_FOUND,
            error: "Not Found",
            message: (exception.meta?.cause as string) ?? "Record not found.",
            code: "P2025",
          });
        }
        case "P2003": {
          const field = (exception.meta?.field_name as string) ?? "foreign key";
          return response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            error: "Unprocessable Entity",
            message: `Foreign key constraint failed on ${field}.`,
            code: "P2003",
          });
        }
        default:
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            error: "Database Error",
            message: exception.message,
            code: exception.code,
          });
      }
    }

    // 2. Direct PostgreSQL driver error (e.g., inside executeRaw or triggers)
    if (typeof exception === "object" && exception !== null && "code" in exception) {
      const pgError = exception as { code: string; message: string; detail?: string };

      // 23505: unique_violation
      if (pgError.code === "23505") {
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          error: "Conflict",
          message: pgError.detail ?? "A record with this value already exists.",
          code: "23505",
        });
      }

      // 23514: check_violation (e.g. margin floor < 25%)
      if (pgError.code === "23514") {
        return response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: "Unprocessable Entity",
          message: pgError.message ?? "Database check constraint violation.",
          code: "23514",
        });
      }

      // P0001: raise_exception from PL/pgSQL triggers
      if (pgError.code === "P0001") {
        return response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: "Unprocessable Entity",
          message: pgError.message ?? "Business rule violation enforced by database trigger.",
          code: "P0001",
        });
      }
    }

    // Let other exceptions bubble or return 500
    if (typeof exception === "object" && exception !== null && "status" in exception) {
      const httpException = exception as { getStatus?: () => number; getResponse?: () => unknown; status: number };
      const status = typeof httpException.getStatus === "function" ? httpException.getStatus() : httpException.status;
      const resp = typeof httpException.getResponse === "function" ? httpException.getResponse() : exception;
      return response.status(status).json(resp);
    }

    this.logger.error("Unhandled exception:", exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
