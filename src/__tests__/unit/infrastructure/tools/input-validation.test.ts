import { describe, expect, it } from "vitest";
import { requireArray, requireValue } from "../../../../infrastructure/tools/input-validation";

/**
 * The compound schemas are flat, so an action's own parameters are optional
 * there - which means a call like `{"action": "calculate_capacity"}` reaches
 * the handler. These guards are what turn that into an actionable message
 * instead of `TypeError: Cannot read properties of undefined (reading 'map')`.
 */
describe("compound tool input guards", () => {
  describe("requireArray", () => {
    it("returns the array when it is present", () => {
      expect(requireArray([1, 2], "teamMembers", "calculate_capacity")).toEqual([1, 2]);
    });

    it("names the parameter and the action when it is missing", () => {
      expect(() => requireArray(undefined, "teamMembers", "calculate_capacity")).toThrow(
        "teamMembers is required for calculate_capacity"
      );
    });

    it("rejects a non-array value", () => {
      expect(() =>
        requireArray("nope" as unknown as string[], "backlogItems", "prioritize_backlog")
      ).toThrow("backlogItems is required for prioritize_backlog");
    });
  });

  describe("requireValue", () => {
    it("returns the value when it is present", () => {
      expect(requireValue("a requirement", "requirements", "generate_roadmap")).toBe(
        "a requirement"
      );
    });

    it("rejects undefined, null and blank strings", () => {
      expect(() => requireValue(undefined, "requirements", "generate_roadmap")).toThrow(
        "requirements is required for generate_roadmap"
      );
      expect(() => requireValue(null, "requirements", "generate_roadmap")).toThrow(
        "requirements is required for generate_roadmap"
      );
      expect(() => requireValue("   ", "requirements", "generate_roadmap")).toThrow(
        "requirements is required for generate_roadmap"
      );
    });
  });
});
