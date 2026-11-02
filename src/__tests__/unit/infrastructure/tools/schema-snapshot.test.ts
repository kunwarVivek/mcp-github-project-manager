import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSchemaSnapshot,
  type SchemaSnapshot,
} from "../../../../infrastructure/tools/compound/schema-snapshot";
import {
  schemaVersionOf,
  TOOL_SCHEMA_VERSIONS,
} from "../../../../infrastructure/tools/compound/schema-version";

const committed: SchemaSnapshot = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "compound-schema-snapshot.json"), "utf8")
);
const current = buildSchemaSnapshot();

const HOW_TO_FIX =
  "Bump the tool's version in schema-version.ts (minor for additive, major for breaking) and run `npm run schema:snapshot`.";

describe("compound tool schema snapshot", () => {
  it("has the same set of tools as the committed snapshot", () => {
    const missingFromSnapshot = Object.keys(current).filter((t) => !(t in committed));
    const missingFromCode = Object.keys(committed).filter((t) => !(t in current));
    expect({ missingFromSnapshot, missingFromCode }, `Tool set changed. ${HOW_TO_FIX}`).toEqual({
      missingFromSnapshot: [],
      missingFromCode: [],
    });
  });

  it("every tool has a semver version", () => {
    for (const tool of Object.keys(current)) {
      expect(schemaVersionOf(tool), tool).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(Object.keys(TOOL_SCHEMA_VERSIONS).sort()).toEqual(Object.keys(current).sort());
  });

  it("changes a tool's schema only together with a version bump", () => {
    const problems: string[] = [];
    for (const [tool, now] of Object.entries(current)) {
      const was = committed[tool];
      if (!was) {
        continue;
      }
      if (now.hash !== was.hash && now.version === was.version) {
        problems.push(
          `${tool}: input schema changed but version is still ${was.version}. ${HOW_TO_FIX}`
        );
      } else if (now.hash === was.hash && now.version !== was.version) {
        problems.push(
          `${tool}: version changed to ${now.version} but the schema did not. Run \`npm run schema:snapshot\`.`
        );
      } else if (now.version !== was.version) {
        problems.push(`${tool}: snapshot is stale. Run \`npm run schema:snapshot\`.`);
      }
    }
    expect(problems).toEqual([]);
  });
});
