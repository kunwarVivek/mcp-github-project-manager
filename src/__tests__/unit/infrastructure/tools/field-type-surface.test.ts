import { describe, expect, it } from "vitest";
import type { FieldType, ViewLayout } from "../../../../domain/types";
import { mapToGraphQLViewLayout } from "../../../../infrastructure/github/graphql-types";
import {
  CREATABLE_FIELD_TYPES,
  mapFromGraphQLFieldType,
  mapToGraphQLFieldType,
} from "../../../../infrastructure/github/util/graphql-helpers";
import { manageProjectSchema } from "../../../../infrastructure/tools/compound/compound-schemas";
import {
  createProjectFieldSchema,
  createProjectViewSchema,
  updateProjectViewSchema,
} from "../../../../infrastructure/tools/schemas/core-tool-schemas";
import { ToolRegistry } from "../../../../infrastructure/tools/ToolRegistry";

/**
 * The public surface must only advertise what GitHub's API can actually do.
 *
 * `ProjectV2CustomFieldType` knows exactly six field types — TEXT, NUMBER,
 * DATE, SINGLE_SELECT, MULTI_SELECT and ITERATION. Every other project field
 * (Assignees, Labels, Milestone, Repository, Tracked by, Tracks) is a built-in
 * field GitHub adds to every project itself; asking the API to create one is
 * a schema error. `ProjectV2ViewLayout` knows exactly three layouts — BOARD,
 * TABLE and ROADMAP; there is no timeline layout.
 *
 * These tests fail if a non-creatable field type or a `timeline` layout ever
 * reappears in an advertised schema.
 */

/** The field types GitHub CANNOT create — the built-in project fields. */
const NON_CREATABLE_FIELD_TYPES = [
  "milestone",
  "assignees",
  "labels",
  "repository",
  "tracked_by",
  "tracks",
];

/** The layouts GitHub's `ProjectV2ViewLayout` does not have. */
const NON_EXISTENT_LAYOUTS = ["timeline"];

/** The layouts GitHub's `ProjectV2ViewLayout` has. */
const VIEW_LAYOUTS = ["board", "table", "roadmap"];

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** The domain `FieldType` union is the creatable set — nothing more. */
type FieldTypeIsTheCreatableSet = Equal<
  FieldType,
  "text" | "number" | "date" | "single_select" | "multi_select" | "iteration"
>;

/** The domain `ViewLayout` union is the three layouts GitHub has. */
type ViewLayoutIsTheThreeLayouts = Equal<ViewLayout, "board" | "table" | "roadmap">;

/** A JSON Schema property that may constrain its value to a fixed set. */
interface SchemaProperty {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
}

/**
 * Collect the `enum` of every property with the given name, at any depth.
 *
 * Only the properties named `type` and `layout` carry a field type or a view
 * layout; other `type` properties (an issue type, a content type, …) hold
 * unrelated values.
 */
function enumsNamed(schema: SchemaProperty, name: string): unknown[][] {
  const found: unknown[][] = [];
  const visit = (node: SchemaProperty | undefined): void => {
    if (!node) return;
    for (const [key, value] of Object.entries(node.properties ?? {})) {
      if (key === name && Array.isArray(value.enum)) {
        found.push(value.enum);
      }
      visit(value);
      visit(value.items);
    }
  };
  visit(schema);
  return found;
}

describe("creatable field types", () => {
  it("are exactly the six types GitHub's ProjectV2CustomFieldType knows", () => {
    expect([...CREATABLE_FIELD_TYPES]).toEqual([
      "text",
      "number",
      "date",
      "single_select",
      "multi_select",
      "iteration",
    ]);
  });

  it("are the whole domain FieldType union", () => {
    // A compile-time pin: the assignments fail to compile if the domain
    // union drifts away from the creatable set.
    const fieldTypeIsTheCreatableSet: FieldTypeIsTheCreatableSet = true;
    const viewLayoutIsTheThreeLayouts: ViewLayoutIsTheThreeLayouts = true;

    expect(fieldTypeIsTheCreatableSet && viewLayoutIsTheThreeLayouts).toBe(true);
  });

  it("are the only types create_project_field accepts", () => {
    for (const type of CREATABLE_FIELD_TYPES) {
      const result = createProjectFieldSchema.safeParse({
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A field",
        type,
      });
      expect(result.success, `type "${type}" must be accepted`).toBe(true);
    }

    for (const type of NON_CREATABLE_FIELD_TYPES) {
      const result = createProjectFieldSchema.safeParse({
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A field",
        type,
      });
      expect(result.success, `type "${type}" must be rejected`).toBe(false);
    }
  });

  it("are the only types the compound manage_project schema accepts", () => {
    for (const type of NON_CREATABLE_FIELD_TYPES) {
      const result = manageProjectSchema.safeParse({
        action: "create_field",
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A field",
        type,
      });
      expect(result.success, `type "${type}" must be rejected`).toBe(false);
    }

    for (const type of CREATABLE_FIELD_TYPES) {
      const result = manageProjectSchema.safeParse({
        action: "create_field",
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A field",
        type,
      });
      expect(result.success, `type "${type}" must be accepted`).toBe(true);
    }
  });
});

describe("view layouts", () => {
  it("are exactly the three layouts GitHub's ProjectV2ViewLayout knows", () => {
    for (const layout of VIEW_LAYOUTS) {
      const created = createProjectViewSchema.safeParse({
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A view",
        layout,
      });
      expect(created.success, `layout "${layout}" must be accepted`).toBe(true);

      const updated = updateProjectViewSchema.safeParse({
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        viewId: "PVV_lADOLhQ7gc4AOEbHzM4AOAL9",
        layout,
      });
      expect(updated.success, `layout "${layout}" must be accepted`).toBe(true);
    }
  });

  it("are rejected when GitHub has no such layout", () => {
    for (const layout of NON_EXISTENT_LAYOUTS) {
      const created = createProjectViewSchema.safeParse({
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A view",
        layout,
      });
      expect(created.success, `layout "${layout}" must be rejected`).toBe(false);

      const updated = updateProjectViewSchema.safeParse({
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        viewId: "PVV_lADOLhQ7gc4AOEbHzM4AOAL9",
        layout,
      });
      expect(updated.success, `layout "${layout}" must be rejected`).toBe(false);

      const compound = manageProjectSchema.safeParse({
        action: "create_view",
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "A view",
        layout,
      });
      expect(compound.success, `layout "${layout}" must be rejected`).toBe(false);
    }
  });
});

describe("advertised MCP tool schemas", () => {
  const tools = ToolRegistry.getInstance().getToolsForMCP();

  it("publish the field type and the view layout as fixed sets", () => {
    const project = tools.find((tool) => tool.name === "manage_project");
    if (!project) {
      throw new Error("manage_project is not registered");
    }

    const schema = project.inputSchema as SchemaProperty;
    const typeEnum = schema.properties?.type?.enum;
    const layoutEnum = schema.properties?.layout?.enum;

    expect([...(typeEnum ?? [])].sort()).toEqual([...CREATABLE_FIELD_TYPES].sort());
    expect([...(layoutEnum ?? [])].sort()).toEqual([...VIEW_LAYOUTS].sort());
  });

  it("never advertise a field type GitHub cannot create", () => {
    const offenders: string[] = [];

    for (const tool of tools) {
      for (const values of enumsNamed(tool.inputSchema as SchemaProperty, "type")) {
        const advertised = values.filter((value): value is string => typeof value === "string");
        // Only a `type` enum that carries field types is a field-type enum.
        if (
          !advertised.some((value) => (CREATABLE_FIELD_TYPES as readonly string[]).includes(value))
        ) {
          continue;
        }
        for (const forbidden of NON_CREATABLE_FIELD_TYPES) {
          if (advertised.includes(forbidden)) {
            offenders.push(`${tool.name}: type enum contains "${forbidden}"`);
          }
        }
      }
    }

    expect(
      offenders,
      `tools advertising a non-creatable field type: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("never advertise a view layout GitHub does not have", () => {
    const offenders: string[] = [];

    for (const tool of tools) {
      for (const values of enumsNamed(tool.inputSchema as SchemaProperty, "layout")) {
        const advertised = values.filter((value): value is string => typeof value === "string");
        for (const forbidden of NON_EXISTENT_LAYOUTS) {
          if (advertised.includes(forbidden)) {
            offenders.push(`${tool.name}: layout enum contains "${forbidden}"`);
          }
        }
      }
    }

    expect(offenders, `tools advertising an impossible layout: ${offenders.join(", ")}`).toEqual(
      []
    );
  });
});

describe("runtime guards", () => {
  it("refuse a field type that bypassed the public schema", () => {
    // A stored or hand-built argument — the schema did not vet it.
    const notCreatable = "milestone" as unknown as FieldType;

    expect(() => mapToGraphQLFieldType(notCreatable)).toThrow(/cannot create a "milestone" field/);
    expect(() => mapToGraphQLFieldType(notCreatable)).toThrow(/single_select/);
  });

  it("refuse to read a built-in project field as a custom field", () => {
    expect(() => mapFromGraphQLFieldType("ASSIGNEES")).toThrow(/built-in GitHub project field/);
    expect(() => mapFromGraphQLFieldType("MILESTONE")).toThrow(/built-in GitHub project field/);
  });

  it("refuse a layout that bypassed the public schema", () => {
    // A stored or hand-built argument — the schema did not vet it.
    const notALayout = "timeline" as unknown as ViewLayout;

    expect(() => mapToGraphQLViewLayout(notALayout)).toThrow(
      /GitHub Projects has no "timeline" view layout/
    );
  });

  it("map every creatable field type to its GraphQL type", () => {
    expect(mapToGraphQLFieldType("text")).toBe("TEXT");
    expect(mapToGraphQLFieldType("number")).toBe("NUMBER");
    expect(mapToGraphQLFieldType("date")).toBe("DATE");
    expect(mapToGraphQLFieldType("single_select")).toBe("SINGLE_SELECT");
    expect(mapToGraphQLFieldType("multi_select")).toBe("MULTI_SELECT");
    expect(mapToGraphQLFieldType("iteration")).toBe("ITERATION");
  });
});
