import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import { DomainError } from "../../../domain/errors";
import type { GitHubFieldValueRepository } from "../../../infrastructure/github/repositories/GitHubFieldValueRepository";
import { FieldValueService } from "../../../services/FieldValueService";
import { asFactory } from "../../helpers/mockTypes";

describe("FieldValueService", () => {
  let service: FieldValueService;
  let fieldRepo: Mocked<GitHubFieldValueRepository>;

  const ids = { projectId: "PVT_proj1", itemId: "PVTI_item1", fieldId: "PVTF_field1" };

  beforeEach(() => {
    fieldRepo = {
      setValue: vi.fn(),
      getValue: vi.fn(),
      clearValue: vi.fn(),
    } as unknown as Mocked<GitHubFieldValueRepository>;
    service = new FieldValueService(asFactory({ createFieldValueRepository: () => fieldRepo }));
  });

  it("reports the written field's name after setting a value", async () => {
    fieldRepo.setValue.mockResolvedValueOnce("Description");

    const result = await service.setFieldValue({ ...ids, value: "hello" });

    expect(result).toEqual({ success: true, message: "Field Description updated successfully" });
    expect(fieldRepo.setValue).toHaveBeenCalledWith({ ...ids, value: "hello" });
  });

  it("returns the repository's field value", async () => {
    const value = { fieldId: ids.fieldId, fieldName: "D", value: "hi", type: "TEXT" };
    fieldRepo.getValue.mockResolvedValueOnce(value);

    expect(await service.getFieldValue(ids)).toEqual(value);
  });

  it("confirms clearing a field", async () => {
    fieldRepo.clearValue.mockResolvedValueOnce();

    expect(await service.clearFieldValue(ids)).toEqual({
      success: true,
      message: `Field ${ids.fieldId} cleared successfully`,
    });
    expect(fieldRepo.clearValue).toHaveBeenCalledWith(ids);
  });

  it("maps repository failures to domain errors", async () => {
    fieldRepo.clearValue.mockRejectedValueOnce(new Error("Network error"));

    await expect(service.clearFieldValue(ids)).rejects.toThrow(DomainError);
  });
});
