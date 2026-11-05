import { ApiProperty } from "@nestjs/swagger";

export class AppliedDiscountDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  discountPct!: string;
}

export class PricingResultDto {
  @ApiProperty({ type: String, description: "Rate card version ID used" })
  rateCardVersionId!: string;

  @ApiProperty({ type: String, description: "Base talent monthly pay" })
  talentPay!: string;

  @ApiProperty({ type: String, description: "Gross monthly client price before discounts" })
  grossClientPrice!: string;

  @ApiProperty({ type: String, description: "Total effective discount percentage (capped at max combined discount)" })
  discountPct!: string;

  @ApiProperty({ type: String, description: "Total discount amount absorbed by agency" })
  discountAmount!: string;

  @ApiProperty({ type: String, description: "Net monthly client price billed to client" })
  netClientPrice!: string;

  @ApiProperty({ type: String, description: "Gross agency margin amount before discounts" })
  grossMarginAmount!: string;

  @ApiProperty({ type: String, description: "Gross agency margin percentage before discounts" })
  grossMarginPct!: string;

  @ApiProperty({ type: String, description: "Net agency margin amount after discounts" })
  netMarginAmount!: string;

  @ApiProperty({ type: String, description: "Net agency margin percentage after discounts" })
  netMarginPct!: string;

  @ApiProperty({ type: String, description: "T&M hourly client rate (includes flexibility premium)" })
  hourlyRate!: string;

  @ApiProperty({ type: String, description: "T&M daily client rate (8h/day)" })
  dailyRate!: string;

  @ApiProperty({ type: String, description: "Talent daily equivalent pay" })
  talentDailyPay!: string;

  @ApiProperty({ type: Boolean, description: "Flag indicating whether net margin is below warning threshold (30%)" })
  isUnderWarningMargin!: boolean;

  @ApiProperty({ type: Boolean, description: "Flag indicating whether net margin is below floor threshold (25%) requiring Super Admin approval" })
  isUnderFloorMargin!: boolean;

  @ApiProperty({ type: () => [AppliedDiscountDto] })
  appliedDiscounts!: AppliedDiscountDto[];
}

export class BuyoutResultDto {
  @ApiProperty({ type: Number, description: "Months elapsed since start" })
  monthsElapsed!: number;

  @ApiProperty({ type: String, description: "Buyout tier multiplier applied" })
  multiplier!: string;

  @ApiProperty({ type: String, description: "Final buyout fee amount" })
  fee!: string;
}

