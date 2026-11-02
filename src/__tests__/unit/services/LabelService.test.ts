import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import { DomainError } from "../../../domain/errors";
import type { GitHubLabelRepository } from "../../../infrastructure/github/repositories/GitHubLabelRepository";
import { LabelService } from "../../../services/LabelService";
import { asFactory } from "../../helpers/mockTypes";

describe("LabelService", () => {
  let service: LabelService;
  let labelRepo: Mocked<GitHubLabelRepository>;

  const label = { id: 1, name: "bug", color: "ff0000", description: "Bug reports" };

  beforeEach(() => {
    labelRepo = {
      create: vi.fn(),
      list: vi.fn(),
    } as unknown as Mocked<GitHubLabelRepository>;
    service = new LabelService(asFactory({ createLabelRepository: () => labelRepo }));
  });

  it("creates a label through the repository", async () => {
    labelRepo.create.mockResolvedValueOnce(label);

    const data = { name: "bug", color: "#ff0000", description: "Bug reports" };
    expect(await service.createLabel(data)).toEqual(label);
    expect(labelRepo.create).toHaveBeenCalledWith(data);
  });

  it("lists labels with a default limit of 100 and a custom limit", async () => {
    labelRepo.list.mockResolvedValue([label]);

    expect(await service.listLabels()).toEqual([label]);
    expect(labelRepo.list).toHaveBeenLastCalledWith(100);

    await service.listLabels({ limit: 10 });
    expect(labelRepo.list).toHaveBeenLastCalledWith(10);
  });

  it("maps repository failures to domain errors", async () => {
    labelRepo.create.mockRejectedValueOnce(new Error("Label already exists"));
    labelRepo.list.mockRejectedValueOnce(new Error("Not Found"));

    await expect(service.createLabel({ name: "dup" })).rejects.toThrow(DomainError);
    await expect(service.listLabels()).rejects.toThrow(DomainError);
  });
});
