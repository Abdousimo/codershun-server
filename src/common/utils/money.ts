import { Prisma } from "../../generated/prisma/client";

/**
 * Ensures a value is a Prisma.Decimal.
 */
export function toDecimal(val: Prisma.Decimal | string | number): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) {
    return val;
  }
  return new Prisma.Decimal(val);
}

/**
 * Rounds a Decimal to 2 decimal places using Decimal.ROUND_HALF_UP (default financial rounding).
 */
export function round2(val: Prisma.Decimal | string | number): Prisma.Decimal {
  const d = toDecimal(val);
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

