import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

export interface DefaultOnboardingItem {
  code: string;
  label: string;
  ownerSide: "client" | "talent" | "agency";
  sortOrder: number;
}

export const DEFAULT_ONBOARDING_ITEMS: DefaultOnboardingItem[] = [
  { code: "client_contract", label: "Client signed agreement", ownerSide: "client", sortOrder: 0 },
  { code: "talent_contract", label: "Talent signed agreement", ownerSide: "talent", sortOrder: 1 },
  { code: "nda_ip", label: "NDA & IP assignment signed", ownerSide: "talent", sortOrder: 2 },
  { code: "tools_access", label: "Client granted repo, tools & Slack/Teams access", ownerSide: "client", sortOrder: 3 },
  { code: "kickoff", label: "Kickoff call completed", ownerSide: "agency", sortOrder: 4 },
  { code: "first_checkin", label: "First week check-in completed", ownerSide: "agency", sortOrder: 5 },
];

@Injectable()
export class PlacementOnboardingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Seed default onboarding checklist for a newly created placement.
   */
  async seedOnboardingChecklist(placementId: string, currentUser?: AuthenticatedUser) {
    const items = DEFAULT_ONBOARDING_ITEMS.map((item) => ({
      placementId,
      code: item.code,
      label: item.label,
      ownerSide: item.ownerSide,
      isDone: false,
      sortOrder: item.sortOrder,
    }));

    await this.prisma.placementOnboardingItems.createMany({
      data: items,
      skipDuplicates: true,
    });
  }

  /**
   * Get all onboarding items for a placement.
   */
  async getOnboardingItems(placementId: string) {
    return this.prisma.placementOnboardingItems.findMany({
      where: { placementId },
      orderBy: { sortOrder: "asc" },
    });
  }

  /**
   * Update or toggle an onboarding item's status.
   */
  async updateOnboardingItem(
    placementId: string,
    itemId: string,
    isDone: boolean,
    currentUser: AuthenticatedUser,
  ) {
    const existing = await this.prisma.placementOnboardingItems.findFirst({
      where: { id: itemId, placementId },
    });

    if (!existing) {
      throw new NotFoundException(`Onboarding item ${itemId} not found for placement ${placementId}`);
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.placementOnboardingItems.update({
        where: { id: itemId },
        data: {
          isDone,
          doneAt: isDone ? new Date() : null,
          doneBy: isDone ? currentUser.id : null,
        },
      });
    });
  }
}

