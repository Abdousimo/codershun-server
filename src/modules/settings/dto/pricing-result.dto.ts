import { ApiProperty } from "@nestjs/swagger";

export class AppliedDiscountDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  discountPct!: string;
}

export class PricingResultDto {
  @ApiProperty({ description: "Rate card version ID used" })
  rateCardVersionId!: string;

  @ApiProperty({ description: "Base talent monthly pay" })
  talentPay!: string;

  @ApiProperty({ description: "Gross monthly client price before discounts" })
  grossClientPrice!: string;

  @ApiProperty({ description: "Total effective discount percentage (capped at max combined discount)" })
  discountPct!: string;

  @ApiProperty({ description: "Total discount amount absorbed by agency" })
  discountAmount!: string;

  @ApiProperty({ description: "Net monthly client price billed to client" })
  netClientPrice!: string;

  @ApiProperty({ description: "Gross agency margin amount before discounts" })
  grossMarginAmount!: string;

  @ApiProperty({ description: "Gross agency margin percentage before discounts" })
  grossMarginPct!: string;

  @ApiProperty({ description: "Net agency margin amount after discounts" })
  netMarginAmount!: string;

  @ApiProperty({ description: "Net agency margin percentage after discounts" })
  netMarginPct!: string;

  @ApiProperty({ description: "T&M hourly client rate (includes flexibility premium)" })
  hourlyRate!: string;

  @ApiProperty({ description: "T&M daily client rate (8h/day)" })
  dailyRate!: string;

  @ApiProperty({ description: "Talent daily equivalent pay" })
  talentDailyPay!: string;

  @ApiProperty({ description: "Flag indicating whether net margin is below warning threshold (30%)" })
  isUnderWarningMargin!: boolean;

  @ApiProperty({ description: "Flag indicating whether net margin is below floor threshold (25%) requiring Super Admin approval" })
  isUnderFloorMargin!: boolean;

  @ApiProperty({ type: [AppliedDiscountDto] })
  appliedDiscounts!: AppliedDiscountDto[];
}

export class BuyoutResultDto {
  @ApiProperty({ description: "Months elapsed since start" })
  monthsElapsed!: number;

  @ApiProperty({ description: "Buyout tier multiplier applied" })
  multiplier!: string;

  @ApiProperty({ description: "Final buyout fee amount" })
  fee!: string;
}

