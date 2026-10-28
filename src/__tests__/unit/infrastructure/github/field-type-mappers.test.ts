import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as graphqlTypes from "../../../../infrastructure/github/graphql-types";
import {
  mapFromGraphQLFieldType,
  mapToGraphQLFieldType,
} from "../../../../infrastructure/github/util/graphql-helpers";

/**
 * The field type mappers live in exactly one place.
 *
 * `src/infrastructure/github/field-types.ts` and the copies of the mappers in
 * `src/infrastructure/github/graphql-types.ts` were duplicates of
 * `src/infrastructure/github/util/graphql-helpers.ts` - the module the
 * repository actually imports them from. They are gone, and nothing may import
 * them again.
 */

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const SRC_ROOT = join(REPO_ROOT, "src");
const REMOVED_MODULE = join(SRC_ROOT, "infrastructure", "github", "field-types.ts");

/** Every TypeScript source file below `dir`. */
function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === "node_modules") continue;
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(path);
      continue;
    }
    if (!entry.includes(".")) {
      files.push(...sourceFiles(path));
    }
  }
  return files;
}

describe("field type mappers", () => {
  it("no longer ships the duplicate module", () => {
    expect(existsSync(REMOVED_MODULE)).toBe(false);
  });

  it("leaves no import of the removed module behind", () => {
    const dangling = sourceFiles(SRC_ROOT).filter((file) =>
      /from\s+["'][^"']*field-types["']/.test(readFileSync(file, "utf-8"))
    );

    expect(dangling).toEqual([]);
  });

  it("exports the mappers from the shared helper only", () => {
    const exporting = sourceFiles(SRC_ROOT).filter((file) =>
      /export\s+(?:function|const)\s+map(?:To|From)GraphQLFieldType/.test(
        readFileSync(file, "utf-8")
      )
    );

    expect(exporting).toEqual([
      join(SRC_ROOT, "infrastructure", "github", "util", "graphql-helpers.ts"),
    ]);
  });

  it("does not export the mappers from graphql-types anymore", () => {
    expect("mapToGraphQLFieldType" in graphqlTypes).toBe(false);
    expect("mapFromGraphQLFieldType" in graphqlTypes).toBe(false);
  });

  it("maps the field types through the shared helper", () => {
    expect(mapToGraphQLFieldType("text")).toBe("TEXT");
    expect(mapToGraphQLFieldType("single_select")).toBe("SINGLE_SELECT");
    expect(mapFromGraphQLFieldType("TEXT")).toBe("text");
    expect(mapFromGraphQLFieldType("SINGLE_SELECT")).toBe("single_select");
  });
});
