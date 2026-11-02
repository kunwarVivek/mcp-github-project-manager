import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ValidationError } from "../../../../../domain/errors";
import { ResourceNotFoundError } from "../../../../../domain/resource-types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubFieldValueRepository } from "../../../../../infrastructure/github/repositories/GitHubFieldValueRepository";
import { asOctokit, type GraphqlFn } from "../../../../helpers/mockTypes";
import { must } from "../../../../helpers/must";

describe("GitHubFieldValueRepository", () => {
  let repository: GitHubFieldValueRepository;
  let graphql: Mock<GraphqlFn>;

  const projectId = "PVT_proj1";
  const itemId = "PVTI_item1";
  const fieldId = "PVTF_field1";

  beforeEach(() => {
    graphql = vi.fn<GraphqlFn>();
    repository = new GitHubFieldValueRepository(
      asOctokit({ graphql }),
      new GitHubConfig("testOwner", "testRepo", { kind: "pat", token: "token" })
    );
  });

  const mutationValue = () => must(graphql.mock.calls[1][1], "mutation variables").value;

  describe("setValue", () => {
    it("sets a TEXT value and returns the field name", async () => {
      graphql
        .mockResolvedValueOnce({ node: { id: fieldId, name: "Description", dataType: "TEXT" } })
        .mockResolvedValueOnce({});

      const name = await repository.setValue({ projectId, itemId, fieldId, value: "hello" });

      expect(name).toBe("Description");
      expect(graphql).toHaveBeenCalledTimes(2);
      expect(mutationValue()).toBe("hello");
    });

    it("coerces a NUMBER value", async () => {
      graphql
        .mockResolvedValueOnce({ node: { id: fieldId, name: "Points", dataType: "NUMBER" } })
        .mockResolvedValueOnce({});

      await repository.setValue({ projectId, itemId, fieldId, value: "42" });

      expect(mutationValue()).toBe(42);
    });

    it("resolves a SINGLE_SELECT option name to its id", async () => {
      graphql
        .mockResolvedValueOnce({
          node: {
            id: fieldId,
            name: "Status",
            dataType: "SINGLE_SELECT",
            options: [
              { id: "opt-1", name: "Todo" },
              { id: "opt-2", name: "Done" },
            ],
          },
        })
        .mockResolvedValueOnce({});

      await repository.setValue({ projectId, itemId, fieldId, value: "Done" });

      expect(mutationValue()).toBe("opt-2");
    });

    it("resolves MULTI_SELECT names to ids from multiSelectOptions", async () => {
      graphql
        .mockResolvedValueOnce({
          node: {
            id: fieldId,
            name: "Tags",
            dataType: "MULTI_SELECT",
            multiSelectOptions: [
              { id: "a", name: "Alpha" },
              { id: "b", name: "Beta" },
            ],
          },
        })
        .mockResolvedValueOnce({});

      await repository.setValue({ projectId, itemId, fieldId, value: ["Alpha", "b", "raw"] });

      expect(mutationValue()).toEqual(["a", "b", "raw"]);
    });

    it("unwraps an ITERATION value", async () => {
      graphql
        .mockResolvedValueOnce({ node: { id: fieldId, name: "Sprint", dataType: "ITERATION" } })
        .mockResolvedValueOnce({});

      await repository.setValue({ projectId, itemId, fieldId, value: { iterationId: "iter-1" } });

      expect(mutationValue()).toBe("iter-1");
    });

    // ProjectV2.field() only takes `name`; querying it by id is rejected by GitHub,
    // which made every set_field_value call fail (e.g. moving a board item between columns).
    it("looks the field up by its node ID, not through ProjectV2.field(id:)", async () => {
      graphql
        .mockResolvedValueOnce({ node: { id: fieldId, name: "D", dataType: "TEXT" } })
        .mockResolvedValueOnce({});

      await repository.setValue({ projectId, itemId, fieldId, value: "x" });

      const [query, variables] = graphql.mock.calls[0];
      expect(query).toContain("node(id: $fieldId)");
      expect(query).not.toContain("field(id:");
      expect(variables).toEqual(expect.objectContaining({ fieldId }));
    });

    it("throws when the node is missing or not a project field", async () => {
      graphql.mockResolvedValueOnce({ node: null }).mockResolvedValueOnce({ node: {} });

      await expect(repository.setValue({ projectId, itemId, fieldId, value: "x" })).rejects.toThrow(
        ResourceNotFoundError
      );
      await expect(repository.setValue({ projectId, itemId, fieldId, value: "x" })).rejects.toThrow(
        ResourceNotFoundError
      );
      expect(graphql).toHaveBeenCalledTimes(2);
    });

    it("throws for an unsupported field type before mutating", async () => {
      graphql.mockResolvedValueOnce({ node: { id: fieldId, name: "C", dataType: "UNSUPPORTED" } });

      await expect(repository.setValue({ projectId, itemId, fieldId, value: "x" })).rejects.toThrow(
        ValidationError
      );
      expect(graphql).toHaveBeenCalledTimes(1);
    });
  });

  describe("getValue", () => {
    const nodes = (...values: object[]) => ({ node: { fieldValues: { nodes: values } } });

    it("decodes TEXT, NUMBER and SINGLE_SELECT values", async () => {
      graphql.mockResolvedValueOnce(nodes({ field: { id: fieldId, name: "D" }, text: "hi" }));
      expect(await repository.getValue({ itemId, fieldId })).toEqual({
        fieldId,
        fieldName: "D",
        value: "hi",
        type: "TEXT",
      });

      graphql.mockResolvedValueOnce(nodes({ field: { id: fieldId, name: "P" }, number: 5 }));
      const number = await repository.getValue({ itemId, fieldId });
      expect(number.value).toBe(5);
      expect(number.type).toBe("NUMBER");

      graphql.mockResolvedValueOnce(
        nodes({ field: { id: fieldId, name: "S" }, optionId: "opt-1", name: "Todo" })
      );
      const select = await repository.getValue({ itemId, fieldId });
      expect(select.value).toEqual({ optionId: "opt-1", name: "Todo" });
      expect(select.type).toBe("SINGLE_SELECT");
    });

    it("returns a null unknown value when the field is not among the item's values", async () => {
      graphql.mockResolvedValueOnce(nodes({ field: { id: "other", name: "O" }, text: "v" }));

      expect(await repository.getValue({ itemId, fieldId })).toEqual({
        fieldId,
        fieldName: "unknown",
        value: null,
        type: "unknown",
      });
    });

    it("throws when the item has no fieldValues", async () => {
      graphql.mockResolvedValueOnce({ node: { fieldValues: null } });

      await expect(repository.getValue({ itemId, fieldId })).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("clearValue", () => {
    it("sends the clear mutation with project, item and field ids", async () => {
      graphql.mockResolvedValueOnce({});

      await repository.clearValue({ projectId, itemId, fieldId });

      const [query, variables] = graphql.mock.calls[0];
      expect(query).toContain("clearProjectV2ItemFieldValue");
      expect(variables).toEqual(expect.objectContaining({ projectId, itemId, fieldId }));
    });
  });
});
