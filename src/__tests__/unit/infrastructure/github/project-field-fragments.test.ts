import { describe, expect, it } from "vitest";
import {
  PROJECT_FIELD_UNION_MEMBERS,
  projectFieldUnionSelection,
} from "../../../../infrastructure/github/project-field-fragments";

/**
 * The `ProjectV2FieldConfiguration` union has exactly four members, and a
 * selection that omits one of them fails as a whole:
 *
 *   "Could not resolve to a Unions::ProjectV2FieldConfiguration with the name
 *    PVTSSF_..."
 *
 * That is how a project with a multi-select field broke the field listing,
 * and how `setup_agent_fields` failed on every project that has the
 * agent_status single-select field. The fragments are shared now, so the
 * coverage cannot drift apart again.
 */
describe("projectFieldUnionSelection", () => {
  it("covers every member of the union", () => {
    const selection = projectFieldUnionSelection();
    for (const member of PROJECT_FIELD_UNION_MEMBERS) {
      expect(selection, `missing fragment for ${member}`).toContain(`... on ${member} {`);
    }
  });

  it("adds the extra fields a caller asks for", () => {
    const selection = projectFieldUnionSelection({
      singleSelect: "options { id name }",
      iteration: "configuration { duration }",
    });
    expect(selection).toContain("options { id name }");
    expect(selection).toContain("configuration { duration }");
    // ...without losing the member coverage.
    for (const member of PROJECT_FIELD_UNION_MEMBERS) {
      expect(selection).toContain(`... on ${member} {`);
    }
  });

  it("lists exactly the four members the schema has", () => {
    expect([...PROJECT_FIELD_UNION_MEMBERS].sort()).toEqual([
      "ProjectV2Field",
      "ProjectV2IterationField",
      "ProjectV2MultiSelectField",
      "ProjectV2SingleSelectField",
    ]);
  });
});
