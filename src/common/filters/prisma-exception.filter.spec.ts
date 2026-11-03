import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HttpStatus } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaExceptionFilter } from "./prisma-exception.filter";

describe("PrismaExceptionFilter", () => {
  let filter: PrismaExceptionFilter;
  let statusMock: jest.Mock<any>;
  let jsonMock: jest.Mock<any>;
  let hostMock: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn<any>().mockReturnValue({ json: jsonMock });

    hostMock = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  it("should map P2002 unique constraint violation to 409 Conflict", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.0.0",
      meta: { target: ["email"] },
    });

    filter.catch(error, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        error: "Conflict",
        code: "P2002",
      }),
    );
  });

  it("should map 23514 check constraint violation to 422 Unprocessable Entity", () => {
    const error = {
      code: "23514",
      message: "new row for relation 'placements' violates check constraint 'placement_margin_floor_chk'",
    };

    filter.catch(error, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: "23514",
      }),
    );
  });

  it("should map P0001 trigger exception to 422 Unprocessable Entity", () => {
    const error = {
      code: "P0001",
      message: "FR-PRICE-02: Margin cannot be below floor without Super admin approval",
    };

    filter.catch(error, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: "P0001",
      }),
    );
  });

  it("should map P2025 record not found to 404 Not Found", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "7.0.0",
      meta: { cause: "Record to update not found." },
    });

    filter.catch(error, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        code: "P2025",
      }),
    );
  });
});
