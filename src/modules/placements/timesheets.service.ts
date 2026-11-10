import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TimesheetStatus, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

@Injectable()
export class TimesheetsService {
  private readonly logger = new Logger(TimesheetsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getTalentTimesheets(monthParam?: string, placementIdParam?: string, currentUser?: AuthenticatedUser) {
    let talentId = currentUser?.talentId;
    if (!talentId && currentUser?.id) {
      const talent = await this.prisma.talents.findFirst({
        where: { userId: currentUser.id },
        select: { id: true },
      });
      talentId = talent?.id;
    }

    if (!talentId && currentUser?.role === UserRole.super_admin) {
      const firstTalent = await this.prisma.talents.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      talentId = firstTalent?.id;
    }

    if (!talentId) {
      throw new ForbiddenException("No talent profile found for this account");
    }

    // Find all active/notice/in_trial/ended placements for this talent
    const placements = await this.prisma.placements.findMany({
      where: {
        talentId,
        status: { in: ["in_trial", "active", "notice", "ended"] },
      },
      orderBy: { startDate: "desc" },
    });

    const availablePlacements = await Promise.all(
      placements.map(async (p) => {
        const company = await this.prisma.companies.findUnique({
          where: { id: p.companyId },
          select: { name: true },
        });
        return {
          id: p.id,
          reference: p.reference,
          companyName: company?.name || "Client Company",
          status: p.status,
          engagementModel: p.engagementModel,
        };
      }),
    );

    const selectedPlacementId = placementIdParam || placements[0]?.id;
    if (!selectedPlacementId) {
      return {
        availablePlacements: [],
        selectedPlacementId: null,
        timesheet: null,
        entries: [],
        absences: [],
        history: [],
      };
    }

    // Resolve month: default to current month YYYY-MM-01
    const now = new Date();
    let monthDate: Date;
    if (monthParam) {
      const [year, month] = monthParam.split("-").map(Number);
      monthDate = new Date(Date.UTC(year, month - 1, 1));
    } else {
      monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }

    // Upsert or find current month's timesheet
    let timesheet = await this.prisma.timesheets.findUnique({
      where: {
        placementId_periodMonth: {
          placementId: selectedPlacementId,
          periodMonth: monthDate,
        },
      },
    });

    if (!timesheet) {
      timesheet = await this.prisma.timesheets.create({
        data: {
          placementId: selectedPlacementId,
          periodMonth: monthDate,
          status: TimesheetStatus.draft,
          totalHours: new Prisma.Decimal(0),
          totalDays: new Prisma.Decimal(0),
        },
      });
    }

    const entries = await this.prisma.timesheetEntries.findMany({
      where: { timesheetId: timesheet.id },
      orderBy: { workDate: "asc" },
    });

    // Month boundary for absences
    const nextMonthDate = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1));
    const absences = await this.prisma.absences.findMany({
      where: {
        placementId: selectedPlacementId,
        startDate: { lte: nextMonthDate },
        endDate: { gte: monthDate },
      },
      orderBy: { startDate: "asc" },
    });

    // History of timesheets for this placement
    const history = await this.prisma.timesheets.findMany({
      where: { placementId: selectedPlacementId },
      orderBy: { periodMonth: "desc" },
      take: 12,
    });

    return {
      availablePlacements,
      selectedPlacementId,
      timesheet: {
        id: timesheet.id,
        placementId: timesheet.placementId,
        periodMonth: timesheet.periodMonth.toISOString().split("T")[0],
        status: timesheet.status,
        totalHours: timesheet.totalHours.toString(),
        totalDays: timesheet.totalDays.toString(),
        submittedAt: timesheet.submittedAt?.toISOString() || null,
        approvedAt: timesheet.approvedAt?.toISOString() || null,
        rejectionComment: timesheet.rejectionComment || null,
      },
      entries: entries.map((e) => ({
        id: e.id,
        workDate: e.workDate.toISOString().split("T")[0],
        hours: Number(e.hours),
        projectTask: e.projectTask || null,
        note: e.note || null,
      })),
      absences: absences.map((a) => ({
        id: a.id,
        type: a.type,
        startDate: a.startDate.toISOString().split("T")[0],
        endDate: a.endDate.toISOString().split("T")[0],
        days: a.days.toString(),
        isPaidToTalent: a.isPaidToTalent,
        note: a.note || null,
      })),
      history: history.map((h) => ({
        id: h.id,
        periodMonth: h.periodMonth.toISOString().split("T")[0],
        status: h.status,
        totalDays: h.totalDays.toString(),
        totalHours: h.totalHours.toString(),
        submittedAt: h.submittedAt?.toISOString() || null,
      })),
    };
  }

  async saveEntries(
    placementId: string,
    periodMonthStr: string,
    entries: Array<{ workDate: string; hours: number; note?: string; task?: string }>,
    currentUser: AuthenticatedUser,
  ) {
    const [year, month] = periodMonthStr.split("-").map(Number);
    const monthDate = new Date(Date.UTC(year, month - 1, 1));

    let timesheet = await this.prisma.timesheets.findUnique({
      where: {
        placementId_periodMonth: {
          placementId,
          periodMonth: monthDate,
        },
      },
    });

    if (!timesheet) {
      timesheet = await this.prisma.timesheets.create({
        data: {
          placementId,
          periodMonth: monthDate,
          status: TimesheetStatus.draft,
        },
      });
    }

    if (timesheet.status === TimesheetStatus.approved) {
      throw new BadRequestException("Cannot edit an already approved timesheet");
    }

    for (const item of entries) {
      const entryDate = new Date(item.workDate);
      const hoursDecimal = new Prisma.Decimal(item.hours);
      const projectTask = item.task || "Regular Development";

      if (item.hours <= 0) {
        await this.prisma.timesheetEntries.deleteMany({
          where: {
            timesheetId: timesheet.id,
            workDate: entryDate,
          },
        });
      } else {
        await this.prisma.timesheetEntries.upsert({
          where: {
            timesheetId_workDate_projectTask: {
              timesheetId: timesheet.id,
              workDate: entryDate,
              projectTask,
            },
          },
          update: {
            hours: hoursDecimal,
            note: item.note || null,
          },
          create: {
            timesheetId: timesheet.id,
            workDate: entryDate,
            hours: hoursDecimal,
            projectTask,
            note: item.note || null,
          },
        });
      }
    }

    const allEntries = await this.prisma.timesheetEntries.findMany({
      where: { timesheetId: timesheet.id },
    });

    const totalHours = allEntries.reduce((sum, e) => sum + Number(e.hours), 0);
    const totalDays = Number((totalHours / 8).toFixed(2));

    const updated = await this.prisma.timesheets.update({
      where: { id: timesheet.id },
      data: {
        totalHours: new Prisma.Decimal(totalHours),
        totalDays: new Prisma.Decimal(totalDays),
        status: timesheet.status === TimesheetStatus.rejected ? TimesheetStatus.draft : timesheet.status,
      },
    });

    return {
      timesheetId: updated.id,
      totalHours,
      totalDays,
      status: updated.status,
    };
  }

  async submitTimesheet(timesheetId: string, currentUser: AuthenticatedUser) {
    const timesheet = await this.prisma.timesheets.findUnique({
      where: { id: timesheetId },
    });
    if (!timesheet) {
      throw new NotFoundException("Timesheet not found");
    }

    if (timesheet.status === TimesheetStatus.approved) {
      throw new BadRequestException("Timesheet is already approved");
    }

    const entriesCount = await this.prisma.timesheetEntries.count({
      where: { timesheetId },
    });
    if (entriesCount === 0) {
      throw new BadRequestException("Cannot submit an empty timesheet without work entries");
    }

    const updated = await this.prisma.timesheets.update({
      where: { id: timesheetId },
      data: {
        status: TimesheetStatus.submitted,
        submittedAt: new Date(),
        rejectionComment: null,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      submittedAt: updated.submittedAt?.toISOString(),
      message: "Timesheet submitted successfully for client sign-off",
    };
  }

  // ==========================================
  // CLIENT PORTAL TIMESHEET METHODS
  // ==========================================

  async getClientTimesheets(monthParam?: string, placementIdParam?: string, currentUser?: AuthenticatedUser) {
    let companyId = currentUser?.companyId;
    if (!companyId && currentUser?.id) {
      const cu = await this.prisma.companyUsers.findFirst({
        where: { userId: currentUser.id },
        select: { companyId: true },
      });
      companyId = cu?.companyId;
    }
    if (!companyId && currentUser?.role === UserRole.super_admin) {
      const firstComp = await this.prisma.companies.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      companyId = firstComp?.id;
    }
    if (!companyId) {
      throw new ForbiddenException("No client company profile associated with this account");
    }

    const placements = await this.prisma.placements.findMany({
      where: {
        companyId,
        status: { in: ["in_trial", "active", "notice", "ended"] },
      },
      orderBy: { startDate: "desc" },
    });

    const availablePlacements = await Promise.all(
      placements.map(async (p) => {
        let talentName = `Engineer ${p.reference}`;
        if (p.talentId) {
          const tal = await this.prisma.talents.findUnique({
            where: { id: p.talentId },
            select: { firstName: true },
          });
          if (tal?.firstName) talentName = tal.firstName;
        }
        return {
          id: p.id,
          reference: p.reference,
          talentName,
          status: p.status,
          engagementModel: p.engagementModel,
        };
      }),
    );

    const activePlacement = placementIdParam
      ? placements.find((p) => p.id === placementIdParam)
      : placements[0];

    const targetDate = monthParam ? new Date(`${monthParam}-01T00:00:00Z`) : new Date();
    const targetMonthStr = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, "0")}`;

    let timesheet = null;
    let entries: any[] = [];
    let absences: any[] = [];

    if (activePlacement) {
      timesheet = await this.prisma.timesheets.findFirst({
        where: {
          placementId: activePlacement.id,
          periodMonth: {
            gte: new Date(`${targetMonthStr}-01T00:00:00Z`),
            lt: new Date(
              targetDate.getUTCMonth() === 11
                ? `${targetDate.getUTCFullYear() + 1}-01-01T00:00:00Z`
                : `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 2).padStart(2, "0")}-01T00:00:00Z`,
            ),
          },
        },
      });

      if (timesheet) {
        entries = await this.prisma.timesheetEntries.findMany({
          where: { timesheetId: timesheet.id },
          orderBy: { workDate: "asc" },
        });
      }

      absences = await this.prisma.absences.findMany({
        where: {
          placementId: activePlacement.id,
          startDate: {
            gte: new Date(`${targetMonthStr}-01T00:00:00Z`),
          },
        },
      });
    }

    const placementIds = placements.map((p) => p.id);
    const history = placementIds.length > 0
      ? await this.prisma.timesheets.findMany({
          where: {
            placementId: { in: placementIds },
          },
          orderBy: { periodMonth: "desc" },
          take: 20,
        })
      : [];

    return {
      availablePlacements,
      selectedPlacementId: activePlacement?.id || null,
      timesheet: timesheet
        ? {
            id: timesheet.id,
            placementId: timesheet.placementId,
            periodMonth: timesheet.periodMonth ? timesheet.periodMonth.toISOString().split("T")[0].slice(0, 7) : targetMonthStr,
            status: timesheet.status,
            totalHours: timesheet.totalHours ? timesheet.totalHours.toString() : "0.0",
            totalDays: timesheet.totalDays ? timesheet.totalDays.toString() : "0.0",
            submittedAt: timesheet.submittedAt?.toISOString() || null,
            approvedAt: timesheet.approvedAt?.toISOString() || null,
            rejectionComment: timesheet.rejectionComment || null,
          }
        : null,
      entries: entries.map((e) => ({
        id: e.id,
        workDate: e.workDate.toISOString().split("T")[0],
        hours: Number(e.hours),
        projectTask: e.projectTask,
        note: e.note,
      })),
      absences: absences.map((a) => ({
        id: a.id,
        type: a.type,
        startDate: a.startDate.toISOString().split("T")[0],
        endDate: a.endDate.toISOString().split("T")[0],
        days: a.days ? a.days.toString() : "1.0",
        isPaidToTalent: a.isPaidToTalent,
        note: a.notes,
      })),
      history: history.map((h) => ({
        id: h.id,
        periodMonth: h.periodMonth ? h.periodMonth.toISOString().split("T")[0].slice(0, 7) : "",
        status: h.status,
        totalDays: h.totalDays ? h.totalDays.toString() : "0.0",
        totalHours: h.totalHours ? h.totalHours.toString() : "0.0",
        submittedAt: h.submittedAt?.toISOString() || null,
        approvedAt: h.approvedAt?.toISOString() || null,
        rejectionComment: h.rejectionComment || null,
      })),
    };
  }

  async approveTimesheet(timesheetId: string, currentUser: AuthenticatedUser) {
    const timesheet = await this.prisma.timesheets.findUnique({
      where: { id: timesheetId },
    });
    if (!timesheet) {
      throw new NotFoundException("Timesheet not found");
    }

    if (currentUser.role !== UserRole.super_admin) {
      let companyId = currentUser.companyId;
      if (!companyId && currentUser.id && this.prisma.companyUsers?.findFirst) {
        const cu = await this.prisma.companyUsers.findFirst({
          where: { userId: currentUser.id },
          select: { companyId: true },
        });
        companyId = cu?.companyId;
      }

      const placement = await this.prisma.placements.findUnique({
        where: { id: timesheet.placementId },
        select: { companyId: true },
      });

      if (!placement || placement.companyId !== companyId) {
        throw new ForbiddenException("Access to this timesheet is denied");
      }
    }

    const updated = await this.prisma.withUserContext(currentUser, async (tx) =>
      tx.timesheets.update({
        where: { id: timesheetId },
        data: {
          status: TimesheetStatus.approved,
          approvedBy: currentUser.id,
          approvedAt: new Date(),
          rejectionComment: null,
        },
      }),
    );

    return {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt?.toISOString(),
      message: "Timesheet approved successfully",
    };
  }

  async rejectTimesheet(timesheetId: string, reason: string, currentUser: AuthenticatedUser) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("Rejection reason is mandatory when requesting a timesheet revision");
    }

    const timesheet = await this.prisma.timesheets.findUnique({
      where: { id: timesheetId },
    });
    if (!timesheet) {
      throw new NotFoundException("Timesheet not found");
    }

    if (currentUser.role !== UserRole.super_admin) {
      let companyId = currentUser.companyId;
      if (!companyId && currentUser.id && this.prisma.companyUsers?.findFirst) {
        const cu = await this.prisma.companyUsers.findFirst({
          where: { userId: currentUser.id },
          select: { companyId: true },
        });
        companyId = cu?.companyId;
      }

      const placement = await this.prisma.placements.findUnique({
        where: { id: timesheet.placementId },
        select: { companyId: true },
      });

      if (!placement || placement.companyId !== companyId) {
        throw new ForbiddenException("Access to this timesheet is denied");
      }
    }

    const updated = await this.prisma.withUserContext(currentUser, async (tx) =>
      tx.timesheets.update({
        where: { id: timesheetId },
        data: {
          status: TimesheetStatus.rejected,
          rejectedBy: currentUser.id,
          rejectedAt: new Date(),
          rejectionComment: reason.trim(),
        },
      }),
    );

    return {
      id: updated.id,
      status: updated.status,
      rejectedAt: updated.rejectedAt?.toISOString(),
      rejectionComment: updated.rejectionComment,
      message: "Timesheet returned to developer for correction",
    };
  }
}

