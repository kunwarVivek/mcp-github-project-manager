import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSharedAgentStore,
  resetSharedServicesForTests,
} from "../../../../infrastructure/tools/shared-services";

vi.mock("../../../../infrastructure/tools/tool-factory", () => ({
  createGitHubFactory: vi.fn(() => ({})),
}));

describe("shared services", () => {
  beforeEach(() => {
    resetSharedServicesForTests();
  });

  it("memoizes the agent store per process", () => {
    expect(getSharedAgentStore()).toBe(getSharedAgentStore());
  });

  it("builds a fresh agent store after reset", () => {
    const first = getSharedAgentStore();
    resetSharedServicesForTests();
    expect(getSharedAgentStore()).not.toBe(first);
  });
});
