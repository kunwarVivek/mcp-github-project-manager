import { beforeEach, describe, expect, it } from "vitest";
import type { WorkProduct } from "../../../domain/agent-orchestration-types";
import { WORK_PRODUCT_MARKER } from "../../../domain/agent-orchestration-types";
import { WorkProductStore } from "../../../infrastructure/agent/WorkProductStore";
import { FakeGitHub } from "../../helpers/FakeGitHub";

/**
 * Work products are stored as issue comments: a human readable summary
 * followed by a hidden `<!-- agent-work-product: {...} -->` marker holding the
 * machine readable payload. Reading them back has to be resilient — an issue
 * thread also contains ordinary comments, and a marker block may be truncated
 * or hold a payload from a different (older) shape.
 */

const ISSUE_NUMBER = 42;
/** Mirrors `COMMENT_PAGE_SIZE` in `WorkProductStore`. */
const COMMENT_PAGE_SIZE = 100;

function makeWorkProduct(overrides: Partial<WorkProduct> = {}): WorkProduct {
  return {
    id: "wp-1",
    agentId: "agent-a",
    taskId: "42",
    branch: "feature/thing",
    prNumber: 7,
    prUrl: "https://github.com/test-owner/test-repo/pull/7",
    commitShas: ["abc1234"],
    filesChanged: ["src/index.ts"],
    testResults: { passed: 3, failed: 0, skipped: 1, total: 4, coverage: 88 },
    summary: "Implemented the thing",
    submittedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** A comment in the exact shape `WorkProductStore.submit` produces. */
function workProductComment(product: WorkProduct): string {
  return `## Agent Work Product\n\n**Agent:** \`${product.agentId}\`\n\n${WORK_PRODUCT_MARKER} ${JSON.stringify(product)} -->\n`;
}

describe("WorkProductStore", () => {
  let github: FakeGitHub;
  let store: WorkProductStore;

  beforeEach(() => {
    github = new FakeGitHub();
    store = new WorkProductStore(github.asFactory());
  });

  describe("listForIssue", () => {
    it("reads work products across multiple comment pages", async () => {
      const firstPageProduct = makeWorkProduct({ id: "wp-page-1" });
      const secondPageProduct = makeWorkProduct({ id: "wp-page-2", agentId: "agent-b" });

      // A full first page forces the store to request page 2.
      for (let index = 0; index < COMMENT_PAGE_SIZE; index++) {
        github.addComment(ISSUE_NUMBER, `plain comment ${index}`);
      }
      github.addComment(ISSUE_NUMBER, workProductComment(firstPageProduct));
      github.addComment(ISSUE_NUMBER, workProductComment(secondPageProduct));

      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products.map((product) => product.id)).toEqual(["wp-page-1", "wp-page-2"]);
      expect(github.commentPageRequests.map((request) => request.page)).toEqual([1, 2]);
    });

    it("returns a valid work-product comment with its fields", async () => {
      const product = makeWorkProduct();
      github.addComment(ISSUE_NUMBER, workProductComment(product));

      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products).toHaveLength(1);
      expect(products[0]).toEqual(product);
    });

    it("ignores a comment whose marker block is not valid JSON", async () => {
      github.addComment(ISSUE_NUMBER, `some notes\n\n${WORK_PRODUCT_MARKER} {not json} -->\n`);

      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products).toEqual([]);
    });

    it("ignores a comment whose JSON is valid but is not a work product", async () => {
      github.addComment(ISSUE_NUMBER, `${WORK_PRODUCT_MARKER} {"foo":"bar"} -->\n`);

      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products).toEqual([]);
    });

    it("ignores a comment without the work-product marker", async () => {
      github.addComment(ISSUE_NUMBER, "just a regular review comment");

      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products).toEqual([]);
    });

    it("keeps valid work products while ignoring the surrounding chatter", async () => {
      const product = makeWorkProduct();
      github.addComment(ISSUE_NUMBER, "first, ordinary comment");
      github.addComment(ISSUE_NUMBER, workProductComment(product));
      github.addComment(ISSUE_NUMBER, `${WORK_PRODUCT_MARKER} {oops -->\n`);
      github.addComment(ISSUE_NUMBER, "last, ordinary comment");

      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products).toHaveLength(1);
      expect(products[0].id).toBe(product.id);
    });
  });

  describe("submit", () => {
    it("stores a work product that can be read back", async () => {
      const product = makeWorkProduct();

      await store.submit(ISSUE_NUMBER, product);
      const products = await store.listForIssue(ISSUE_NUMBER);

      expect(products).toHaveLength(1);
      expect(products[0]).toEqual(product);
    });

    it("writes the work product as a comment on the issue", async () => {
      const product = makeWorkProduct();

      await store.submit(ISSUE_NUMBER, product);

      const comments = github.comments.get(ISSUE_NUMBER) ?? [];
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toContain(WORK_PRODUCT_MARKER);
      expect(comments[0].body).toContain(product.summary);
    });
  });
});
