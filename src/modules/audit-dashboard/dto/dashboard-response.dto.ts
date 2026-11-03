import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DashboardResponseDto {
  @ApiProperty({ type: [Object] })
  mrr!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  invoiceAging!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  placementEconomics!: Record<string, unknown>[];

  @ApiProperty()
  summary!: {
    activePlacements: number;
    mrr: string;
    monthlyGrossMargin: string;
    contributionMargin: string;
    overdueInvoices: number;
    payoutsDue: number;
  };
}
