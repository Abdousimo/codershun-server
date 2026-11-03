import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";

import {
  CompanyStatus,
  LeadSource,
  LeadStage,
  LostReason,
  TaskStatus,
  UserRole,
} from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CrmService } from "./crm.service";

describe("CrmService", () => {
  let service: CrmService;
  let mockPrisma: any;

  const salesUser: AuthenticatedUser = {
    id: "sales-uuid-1",
    email: "sales@codershub.dz",
    role: UserRole.sales,
    companyId: null,
    talentId: null,
    sessionId: "sess-1",
  };

  beforeEach(() => {
    mockPrisma = {
      companies: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        count: jest.fn<any>().mockResolvedValue(0),
        findFirst: jest.fn<any>().mockResolvedValue(null),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "comp-1", ...args.data, createdAt: new Date(), updatedAt: new Date() }),
        ),
        update: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        ),
      },
      companyTags: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      contacts: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "contact-1", ...args.data }),
        ),
        update: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: args.where.id, ...args.data }),
        ),
      },
      leads: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        count: jest.fn<any>().mockResolvedValue(0),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "lead-1", ...args.data, createdAt: new Date() }),
        ),
        update: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: args.where.id, ...args.data }),
        ),
      },
      notes: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "note-1", ...args.data }),
        ),
      },
      tasks: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "task-1", ...args.data }),
        ),
        update: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: args.where.id, ...args.data }),
        ),
      },
      withUserContext: jest.fn<any>((user, fn) => fn(mockPrisma)),
    };

    service = new CrmService(mockPrisma);
  });

  describe("Rule FR-REQ-02: Lost Reason Required for Lost Leads", () => {
    it("FR-REQ-02: rejects moving lead to lost when lostReason is missing", async () => {
      mockPrisma.leads.findUnique.mockResolvedValue({
        id: "lead-1",
        companyId: "comp-1",
        stage: LeadStage.qualified,
      });

      await expect(
        service.changeLeadStage(
          "lead-1",
          { stage: LeadStage.lost },
          salesUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.changeLeadStage(
          "lead-1",
          { stage: LeadStage.lost },
          salesUser,
        );
      } catch (err: any) {
        expect(err.getResponse().code).toBe("FR-REQ-02");
      }
    });

    it("FR-REQ-02: allows moving lead to lost when valid lostReason is provided", async () => {
      mockPrisma.leads.findUnique.mockResolvedValue({
        id: "lead-1",
        companyId: "comp-1",
        stage: LeadStage.qualified,
      });

      const result = await service.changeLeadStage(
        "lead-1",
        {
          stage: LeadStage.lost,
          lostReason: LostReason.price,
          lostReasonDetail: "Budget constraints",
        },
        salesUser,
      );

      expect(mockPrisma.leads.update).toHaveBeenCalled();
      expect(result.stage).toBe(LeadStage.lost);
      expect(result.lostReason).toBe(LostReason.price);
      expect(result.lostAt).toBeDefined();
    });
  });

  describe("Pipeline Stage Side-Effects (CDC 6.2)", () => {
    it("sets firstContactedAt when moving to contacted stage", async () => {
      mockPrisma.leads.findUnique.mockResolvedValue({
        id: "lead-1",
        companyId: "comp-1",
        stage: LeadStage.new_lead,
        firstContactedAt: null,
      });

      const result = await service.changeLeadStage(
        "lead-1",
        { stage: LeadStage.contacted },
        salesUser,
      );

      expect(result.stage).toBe(LeadStage.contacted);
      expect(result.firstContactedAt).toBeDefined();
    });

    it("sets qualifiedAt when moving to qualified stage", async () => {
      mockPrisma.leads.findUnique.mockResolvedValue({
        id: "lead-1",
        companyId: "comp-1",
        stage: LeadStage.contacted,
        qualifiedAt: null,
      });

      const result = await service.changeLeadStage(
        "lead-1",
        { stage: LeadStage.qualified },
        salesUser,
      );

      expect(result.stage).toBe(LeadStage.qualified);
      expect(result.qualifiedAt).toBeDefined();
    });

    it("sets wonAt and updates company status to client when moving to won stage", async () => {
      mockPrisma.leads.findUnique.mockResolvedValue({
        id: "lead-1",
        companyId: "comp-1",
        stage: LeadStage.proposal_sent,
        wonAt: null,
      });

      const result = await service.changeLeadStage(
        "lead-1",
        { stage: LeadStage.won },
        salesUser,
      );

      expect(result.stage).toBe(LeadStage.won);
      expect(result.wonAt).toBeDefined();
      expect(mockPrisma.companies.update).toHaveBeenCalledWith({
        where: { id: "comp-1" },
        data: expect.objectContaining({ status: CompanyStatus.client }),
      });
    });
  });

  describe("Kanban Board Grouping (CDC 7.4)", () => {
    it("groups leads by their respective pipeline stages", async () => {
      mockPrisma.leads.findMany.mockResolvedValue([
        { id: "l-1", companyId: "c-1", stage: LeadStage.new_lead },
        { id: "l-2", companyId: "c-1", stage: LeadStage.qualified },
        { id: "l-3", companyId: "c-2", stage: LeadStage.qualified },
      ]);
      mockPrisma.companies.findMany.mockResolvedValue([
        { id: "c-1", name: "Company A", countryCode: "FR" },
        { id: "c-2", name: "Company B", countryCode: "DZ" },
      ]);

      const kanban = await service.getLeadsKanban();

      expect(kanban[LeadStage.new_lead]).toHaveLength(1);
      expect(kanban[LeadStage.qualified]).toHaveLength(2);
      expect(kanban[LeadStage.won]).toHaveLength(0);
      expect(kanban[LeadStage.new_lead][0].company.name).toBe("Company A");
    });
  });

  describe("Companies CRUD & Soft Delete", () => {
    it("creates company and links tags", async () => {
      const result = await service.createCompany(
        {
          name: "Innovate SAS",
          countryCode: "FR",
          tagIds: ["tag-1"],
        },
        salesUser,
      );

      expect(mockPrisma.companies.create).toHaveBeenCalled();
      expect(mockPrisma.companyTags.createMany).toHaveBeenCalled();
      expect(result.name).toBe("Innovate SAS");
    });

    it("soft deletes company by setting deletedAt timestamp", async () => {
      mockPrisma.companies.findFirst.mockResolvedValue({
        id: "comp-1",
        name: "Old Corp",
        deletedAt: null,
      });

      const result = await service.softDeleteCompany("comp-1", salesUser);

      expect(mockPrisma.companies.update).toHaveBeenCalledWith({
        where: { id: "comp-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });
  });

  describe("Notes & Tasks", () => {
    it("creates a note linked to an entity", async () => {
      const result = await service.createNote(
        {
          entityType: "lead",
          entityId: "lead-1",
          body: "Discovery call scheduled",
        },
        salesUser,
      );

      expect(mockPrisma.notes.create).toHaveBeenCalled();
      expect(result.body).toBe("Discovery call scheduled");
    });

    it("completes a task and sets completedAt", async () => {
      mockPrisma.tasks.findUnique.mockResolvedValue({
        id: "task-1",
        status: TaskStatus.open,
      });

      const result = await service.updateTask(
        "task-1",
        { status: TaskStatus.done },
        salesUser,
      );

      expect(mockPrisma.tasks.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: expect.objectContaining({
          status: TaskStatus.done,
          completedAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe(TaskStatus.done);
    });
  });
});

