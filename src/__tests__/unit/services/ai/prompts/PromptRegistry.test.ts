import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDefaultPromptRegistry,
  defaultPromptRegistry,
  PromptNotFoundError,
  PromptRegistry,
  PromptVariableError,
} from "../../../../../services/ai/prompts";
import {
  duplicatePromptVariables,
  enrichmentPromptVariables,
  ISSUE_PROMPT_IDS,
  labelPromptVariables,
  relatedIssuePromptVariables,
} from "../../../../../services/ai/prompts/IssueIntelligencePrompts";
import {
  capacityPromptVariables,
  prioritizationPromptVariables,
  riskPromptVariables,
  SPRINT_PROMPT_IDS,
  sprintSuggestionPromptVariables,
} from "../../../../../services/ai/prompts/SprintPlanningPrompts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * [id, variables, sha256 of the rendering produced by the pre-registry template/formatter].
 * Variables are `<name>` placeholders; the old formatters substituted the same values.
 */
const HASHED: Array<[string, Record<string, string> | undefined, string]> = [
  ["prd.system", undefined, "f0fd819b961933979d3569d9711f9818c115772eadfee16a860b0cab195860f6"],
  [
    "prd.generate-from-idea",
    {
      projectIdea: "<projectIdea>",
      targetUsers: "<targetUsers>",
      timeline: "<timeline>",
      complexity: "<complexity>",
    },
    "993d0cadc2c2bdd7ae35dc9b498c07186e4f4f2fd7df0cf229c33a8bb63b826d",
  ],
  [
    "prd.enhance-existing",
    {
      currentPRD: "<currentPRD>",
      enhancementType: "<enhancementType>",
      focusAreas: "<focusAreas>",
    },
    "b2fbd1e481fc718cc4e37fe21042482114ce2db7b648e4f6c4a5bb597e0fa230",
  ],
  [
    "prd.extract-features",
    { prdContent: "<prdContent>" },
    "13bae264c40be4f631b5981f5ecb43d7c0951f08f7d1bec4ec06b008f8d08a8a",
  ],
  [
    "prd.validate-completeness",
    { prdContent: "<prdContent>" },
    "62ef8c202c202873cdbd9b5a5d63f2dd14a96d0bb4d68035a936b5f619c04f89",
  ],
  [
    "prd.generate-user-stories",
    {
      featureTitle: "<featureTitle>",
      featureDescription: "<featureDescription>",
      targetUsers: "<targetUsers>",
    },
    "2f52518028bf1533044466a7f9ed4202c41c6d41c8e505bb2ea67b0189a30ca1",
  ],
  ["task.system", undefined, "d45014297f869b62a302e6ac1ae2ea07671f6147f1e94d3368970eeebee6833e"],
  [
    "task.generate-from-prd",
    {
      prdContent: "<prdContent>",
      maxTasks: "<maxTasks>",
      includeSubtasks: "<includeSubtasks>",
      autoEstimate: "<autoEstimate>",
    },
    "7983ed42376c7a3b8d25dde289cda18344948e696ccb615c32cce1a6a9ea2e5b",
  ],
  [
    "task.expand-into-subtasks",
    {
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      currentComplexity: "<currentComplexity>",
      maxDepth: "<maxDepth>",
    },
    "8f5a4f1a06eae6efc9edc0fe9d06cccddb26d008efa227c1fba4ae9152c20a7e",
  ],
  [
    "task.analyze-complexity",
    {
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      currentEstimate: "<currentEstimate>",
    },
    "2f488116a1e065b2edcbbd9175d2e0c117571d4931143ba193ba5062f4f03cbc",
  ],
  [
    "task.suggest-dependencies",
    { taskList: "<taskList>" },
    "2baaf0447b99b0ff96b83f4dc223205eab43b2362106cdc8f09cf652695b8e48",
  ],
  [
    "task.prioritize",
    {
      taskList: "<taskList>",
      projectGoals: "<projectGoals>",
      timeline: "<timeline>",
      teamSize: "<teamSize>",
    },
    "82b11cd72a4ab022ce842c0d5cca61a60d3aeee57abe0fe98649f62b55c2c7e9",
  ],
  [
    "task.estimate-effort",
    {
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      complexity: "<complexity>",
      teamExperience: "<teamExperience>",
    },
    "54a23d95fdee7ff72387ea148a096cb615abc33024390214bdf4408b0d7caaca",
  ],
  ["feature.system", undefined, "c481700bdaad797fa1ad8a71d588e7687d1f0cad4aca33e3d723a5186fadea96"],
  [
    "feature.analyze-request",
    {
      featureIdea: "<featureIdea>",
      description: "<description>",
      existingPRD: "<existingPRD>",
      projectState: "<projectState>",
      businessJustification: "<businessJustification>",
      targetUsers: "<targetUsers>",
    },
    "4930c2c9a7792985b243e3f55e9faba5ace6cf894a2f1e3f3c8289e8004efdf6",
  ],
  [
    "feature.expand-to-tasks",
    {
      featureTitle: "<featureTitle>",
      featureDescription: "<featureDescription>",
      userStories: "<userStories>",
      acceptanceCriteria: "<acceptanceCriteria>",
      systemContext: "<systemContext>",
      integrationPoints: "<integrationPoints>",
    },
    "a9acbe43e2f312bafd10e8deeaaa008148895ad32b95b526d467371ff3ef23ff",
  ],
  [
    "feature.assess-impact",
    {
      newFeature: "<newFeature>",
      existingFeatures: "<existingFeatures>",
      userBase: "<userBase>",
      architecture: "<architecture>",
    },
    "275e46da056a77d758265bf9e2f1b62015a430bda8d3b91796ae76010d3f6a0a",
  ],
  [
    "feature.generate-roadmap",
    {
      currentRoadmap: "<currentRoadmap>",
      newFeature: "<newFeature>",
      timeline: "<timeline>",
      teamCapacity: "<teamCapacity>",
      businessPriorities: "<businessPriorities>",
    },
    "3d18c8a63068df97d88cc67f432cc821d342a3de55ea0f9f00a33d03a977c748",
  ],
  [
    "feature.track-lifecycle",
    {
      taskTitle: "<taskTitle>",
      currentPhase: "<currentPhase>",
      progressData: "<progressData>",
      blockers: "<blockers>",
      teamContext: "<teamContext>",
    },
    "cec3d962be2aa72db2fab231efbc47452aa059df17234011314884e52732ff0c",
  ],
  [
    "context.business.system",
    undefined,
    "bc23becb053bd18921aee168f8a64830e19f3ccaea2a6e338ba4028e9bc25052",
  ],
  [
    "context.business.user",
    {
      prdContent: "<prdContent>",
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      taskPriority: "<taskPriority>",
    },
    "9262b0d73e26da2c48c6f064214f1726593a564c4dd1fe1b9a1bd88e628bdb5b",
  ],
  [
    "context.technical.system",
    undefined,
    "6ef8a1e06739fa6017ee7c886df1941cf0dd776b1ba232427f4cd4625de846b3",
  ],
  [
    "context.technical.user",
    {
      prdContent: "<prdContent>",
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      taskComplexity: "<taskComplexity>",
    },
    "b0602990afa02ff4ad149fdc71a52785c3e3b1f4d79cb7d29f185dbe4fc2d5c1",
  ],
  [
    "context.implementation-guidance.system",
    undefined,
    "b8ebcc824d2073e2ab57484ffaf6f8ea9d296fd81e088710b6000d7b54bbef09",
  ],
  [
    "context.implementation-guidance.user",
    {
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      taskComplexity: "<taskComplexity>",
      taskPriority: "<taskPriority>",
      businessContext: "<businessContext>",
      technicalContext: "<technicalContext>",
    },
    "b14d0966390c3c6db178e1f415dd4d347eea665a21b6711a5920251b0b8abac6",
  ],
  [
    "context.references.system",
    undefined,
    "d704fbeecc70e3b29a28dc461d162e04c268ab2b2b2b1cff7c9ea8af6a95a0f1",
  ],
  [
    "context.references.user",
    { prdContent: "<prdContent>", taskTitle: "<taskTitle>", taskDescription: "<taskDescription>" },
    "edd69f21835551777f121dcfcb0e25c598a8381f6c85aa7272e389b7f75d1d6c",
  ],
  [
    "context.acceptance-criteria.system",
    undefined,
    "1ce90fc1bf6bc64b670dce011d8d84bedfafaab414a390f066cf0a94221c1ea6",
  ],
  [
    "context.acceptance-criteria.user",
    {
      taskTitle: "<taskTitle>",
      taskDescription: "<taskDescription>",
      taskPriority: "<taskPriority>",
      businessContext: "<businessContext>",
      technicalContext: "<technicalContext>",
    },
    "f97a7d3a3ecbbae5821cdbdf50cddd5abc797ff68861e1cd981032200f7ee605",
  ],
  [
    "confidence.self-assessment-suffix",
    undefined,
    "25fd5c22f849f29125057a38e0cd0c33c59f15529921b3e801e626395dc30aef",
  ],
  [
    "confidence.prd-section.system",
    undefined,
    "fd378c8c7f903e6ffff9b0d330bdbc34d7edd3eb2d6a48b6e53d609517216cc3",
  ],
  [
    "confidence.prd-section.user",
    { sectionName: "<sectionName>", content: "<content>", context: "<context>" },
    "2099d799fbb305ae2c9432eb6da9cae875c89b7b0840ec51c188e2d859cac6d8",
  ],
  [
    "confidence.task.system",
    undefined,
    "a8a18ed2012aae8d7377f2d240b1237f5052354c83c14d6e0bb3af1c5bd66f3a",
  ],
  [
    "confidence.task.user",
    {
      title: "<title>",
      description: "<description>",
      complexity: "<complexity>",
      effort: "<effort>",
      dependencies: "<dependencies>",
      acceptanceCriteria: "<acceptanceCriteria>",
      prdContext: "<prdContext>",
    },
    "5f038b7079e388baabfe1c623793f6eda7225b95d13a2a928e5037ac33990562",
  ],
  [
    "confidence.dependency.system",
    undefined,
    "c4d875a6989456f668a4e177e6e10966b3345f14050681c9d4ace51a4a1cb5be",
  ],
  [
    "confidence.dependency.user",
    { taskList: "<taskList>" },
    "951d6d6820f8671e6e3113c367609d469b4a036a5f5d5086f2f76f63a6988820",
  ],
  [
    "confidence.effort.system",
    undefined,
    "1f2d67016218c754a44bd0af88115625305c7aebb32d1e92a6e9804a5c6b690a",
  ],
  [
    "confidence.effort.user",
    {
      title: "<title>",
      description: "<description>",
      technicalContext: "<technicalContext>",
      historicalData: "<historicalData>",
    },
    "380506a099e074761466fb20627d14b1927e67b47f2a91e24d4bc13fa94e1f65",
  ],
  [
    "issue.enrichment.system",
    undefined,
    "3f69dc46f913f9f74223cfc9405b07934edc3c7befaaa64c0983e532f108e9df",
  ],
  [
    "issue.label-suggestion.system",
    undefined,
    "89e5737fdc21b810d1e7b75a20cbe1996d7cd2bb3d9a7654b51474476a6785eb",
  ],
  [
    "issue.duplicate-detection.system",
    undefined,
    "c1ff17f70197d26c43a4f609186d58ab1062bf97f711ce7fe2fde9e66d523be9",
  ],
  [
    "issue.related.system",
    undefined,
    "3eeb3f67a4ad82850d8f1e7d9583553c5312fd3fa1bd5851e3ba1fd8b350316c",
  ],
  [
    "sprint.capacity.system",
    undefined,
    "bb8039f342922462bfb59863efd056d2ec7dbd08f64e57a73de1a1ba173a46fb",
  ],
  [
    "sprint.prioritization.system",
    undefined,
    "1bb0d144d1d90c36f79b9608542b5d36443bfe8083564f6b4951d47f402b6bc5",
  ],
  [
    "sprint.risk.system",
    undefined,
    "62fc96270f9d5112afad29ac75f8586b72b80f777a927d22bf4dd1e3c2019063",
  ],
  [
    "sprint.suggestion.system",
    undefined,
    "0699fe0bac555e9f85c7e8bba0a3ed5d2e9e59a682dfa2a343b3e4a12f0eada2",
  ],
  ["roadmap.system", undefined, "6ad36e599f565a9e212042773b42bffd8392e59260935fd898a14be01ef8912b"],
  [
    "roadmap.requirements-parsing",
    undefined,
    "17d44439c9d2a0356d5200d1fcbb5e39a87d1a95aeba1ab935d60af17594cdce",
  ],
  [
    "roadmap.phase-sequencing",
    undefined,
    "de20d70db47f84ae1c5465359b63e059c81fc47dc012ad167110999efc0af666",
  ],
  [
    "roadmap.milestone-estimation",
    undefined,
    "ca290b1798863bf6c394da5e5d09af4cb9d2ab137b0efd8aa27de9d9ec82ea6c",
  ],
  [
    "roadmap.visualization-data",
    undefined,
    "be00860f5f9dd6196ba8d48823fcaf1d1fdd9a3dade144907f053121a420e219",
  ],
];

describe("default prompt registry byte-identical rendering", () => {
  it.each(HASHED)("%s", (id, vars, expectedSha) => {
    expect(sha(defaultPromptRegistry.render(id, vars))).toBe(expectedSha);
  });

  it("registers every prompt at version 1.0.0", () => {
    for (const id of defaultPromptRegistry.listPrompts()) {
      expect(defaultPromptRegistry.listVersions(id).map((p) => p.version)).toEqual(["1.0.0"]);
    }
    expect(defaultPromptRegistry.listPrompts()).toEqual(
      expect.arrayContaining(HASHED.map(([id]) => id))
    );
  });

  describe("enrichment", () => {
    const cases = [
      {
        input: {
          issueTitle: "Login fails",
          issueDescription: "Users cannot log in\nafter reset",
          projectContext: "Auth service",
          preserveOriginal: true,
          repositoryLabels: ["bug", "auth"],
        },
        expected:
          "Analyze and enrich the following issue:\n\nIssue Title: Login fails\n\nIssue Description:\nUsers cannot log in\nafter reset\n\nProject Context:\nAuth service\n\nAvailable repository labels: bug, auth\n\nInstructions:\n- The original description is substantial. Preserve it and add structured sections below it.\n- Generate structured sections: Problem, Solution, Context, Impact, Acceptance Criteria\n- Provide confidence scores (0-1) for each section\n- Suggest relevant labels from the available repository labels\n- Only suggest assignees if domain expertise is clearly apparent\n\nOutput a JSON object matching the EnrichedIssue schema.",
      },
      {
        input: { issueTitle: "T", issueDescription: "", preserveOriginal: false },
        expected:
          "Analyze and enrich the following issue:\n\nIssue Title: T\n\nIssue Description:\n(No description provided)\n\n\n\nInstructions:\n- The original description is brief. Create a comprehensive rewrite integrating all available information.\n- Generate structured sections: Problem, Solution, Context, Impact, Acceptance Criteria\n- Provide confidence scores (0-1) for each section\n- Suggest relevant labels from the available repository labels\n- Only suggest assignees if domain expertise is clearly apparent\n\nOutput a JSON object matching the EnrichedIssue schema.",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            ISSUE_PROMPT_IDS.enrichmentUser,
            enrichmentPromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("label", () => {
    const cases = [
      {
        input: {
          issueTitle: "Crash on save",
          issueDescription: "Stack trace...",
          existingLabels: [{ name: "bug", description: "Something broken" }, { name: "ui" }],
          issueHistory: [
            { title: "Old crash", labels: ["bug", "p1"] },
            { title: "Layout", labels: ["ui"] },
          ],
        },
        expected:
          'Suggest labels for the following issue:\n\nIssue Title: Crash on save\n\nIssue Description:\nStack trace...\n\nAvailable Repository Labels:\n- bug: Something broken\n- ui\n\nIssue History (learn from past patterns):\n1. "Old crash" -> [bug, p1]\n2. "Layout" -> [ui]\n\nInstructions:\n- Select the most appropriate labels from the available list\n- Group suggestions by confidence tier (high >= 0.8, medium >= 0.5, low < 0.5)\n- Provide rationale and matched patterns for each suggestion\n- Only propose new labels if no existing label fits AND the pattern is common\n\nOutput a JSON object matching the LabelSuggestionResult schema.',
      },
      {
        input: { issueTitle: "T", issueDescription: "", existingLabels: [] },
        expected:
          "Suggest labels for the following issue:\n\nIssue Title: T\n\nIssue Description:\n(No description provided)\n\nAvailable Repository Labels:\n(No labels defined)\n\n\nInstructions:\n- Select the most appropriate labels from the available list\n- Group suggestions by confidence tier (high >= 0.8, medium >= 0.5, low < 0.5)\n- Provide rationale and matched patterns for each suggestion\n- Only propose new labels if no existing label fits AND the pattern is common\n\nOutput a JSON object matching the LabelSuggestionResult schema.",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            ISSUE_PROMPT_IDS.labelSuggestionUser,
            labelPromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("duplicate", () => {
    const cases = [
      {
        input: {
          sourceIssue: { title: "Src", body: "Body text", labels: ["bug"] },
          candidateIssues: [
            {
              id: "I1",
              number: 12,
              title: "Cand one",
              body: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
              labels: ["bug", "ui"],
            },
            { id: "I2", number: 13, title: "Cand two", body: "" },
          ],
        },
        expected:
          "Analyze the following issue for potential duplicates:\n\nSource Issue:\nTitle: Src\nDescription: Body text\nLabels: bug\n\nCandidate Issues:\n1. [#12] Cand one\n   Description: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...\n   Labels: bug, ui\n\n2. [#13] Cand two\n   Description: \n\nInstructions:\n- Calculate semantic similarity (0-1) between source and each candidate\n- Classify as duplicate (>=0.92), near-duplicate (0.75-0.92), related (0.5-0.75), or distinct (<0.5)\n- Provide reasoning for each similarity assessment\n- Recommend action for each candidate\n\nOutput a JSON object matching the DuplicateDetectionResult schema.",
      },
      {
        input: { sourceIssue: { title: "Src", body: "" }, candidateIssues: [] },
        expected:
          "Analyze the following issue for potential duplicates:\n\nSource Issue:\nTitle: Src\nDescription: (No description)\n\nCandidate Issues:\n\n\nInstructions:\n- Calculate semantic similarity (0-1) between source and each candidate\n- Classify as duplicate (>=0.92), near-duplicate (0.75-0.92), related (0.5-0.75), or distinct (<0.5)\n- Provide reasoning for each similarity assessment\n- Recommend action for each candidate\n\nOutput a JSON object matching the DuplicateDetectionResult schema.",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            ISSUE_PROMPT_IDS.duplicateDetectionUser,
            duplicatePromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("related", () => {
    const cases = [
      {
        input: {
          sourceIssue: { id: "S1", title: "Src", body: "Body", labels: ["api"] },
          candidateIssues: [
            {
              id: "I1",
              number: 5,
              title: "Cand",
              body: "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
              labels: ["api"],
              state: "open",
            },
            { id: "I2", number: 6, title: "Cand2", body: "", state: "closed" },
          ],
          componentHints: ["auth", "db"],
        },
        expected:
          "Analyze the following issue for related issues:\n\nSource Issue:\nID: S1\nTitle: Src\nDescription: Body\nLabels: api\n\nKnown Components:\n- auth\n- db\n\nCandidate Issues:\n1. [#5] Cand (open)\n   ID: I1\n   Description: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy...\n   Labels: api\n\n2. [#6] Cand2 (closed)\n   ID: I2\n   Description: \n\nInstructions:\n- Detect relationships: semantic, dependency, component\n- For dependency relationships, identify subtype: blocks, blocked_by, related_to\n- Provide relevance score (0-1) and confidence for each relationship\n- Include reasoning explaining why the relationship exists\n\nOutput a JSON object matching the RelatedIssueResult schema.",
      },
      {
        input: { sourceIssue: { id: "S1", title: "Src", body: "" }, candidateIssues: [] },
        expected:
          "Analyze the following issue for related issues:\n\nSource Issue:\nID: S1\nTitle: Src\nDescription: (No description)\n\n\nCandidate Issues:\n\n\nInstructions:\n- Detect relationships: semantic, dependency, component\n- For dependency relationships, identify subtype: blocks, blocked_by, related_to\n- Provide relevance score (0-1) and confidence for each relationship\n- Include reasoning explaining why the relationship exists\n\nOutput a JSON object matching the RelatedIssueResult schema.",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            ISSUE_PROMPT_IDS.relatedUser,
            relatedIssuePromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("capacity", () => {
    const cases = [
      {
        input: {
          velocity: 21,
          sprintDurationDays: 10,
          teamSize: 5,
          availabilityFactor: 0.85,
          historicalSprintsCount: 4,
        },
        expected:
          "Calculate sprint capacity for the following parameters:\n\nTeam Configuration:\n- Team size: 5 members\n- Sprint duration: 10 days\n- Average availability: 85%\n\nVelocity Data:\n- Current velocity: 21 points/sprint\n- Historical sprints available: 4\n\nPlease provide:\n1. Recommended sprint capacity in story points\n2. Suggested buffer percentage with reasoning\n3. Confidence level in the recommendation\n4. Any flags or concerns",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            SPRINT_PROMPT_IDS.capacityUser,
            capacityPromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("risk", () => {
    const cases = [
      {
        input: {
          sprintItems: [
            { id: "A", title: "Alpha", points: 5, dependencies: ["B", "C"] },
            { id: "B", title: "Beta" },
          ],
          totalPoints: 8,
          recommendedCapacity: 10,
          dependencyCount: 1,
        },
        expected:
          "Assess risks for this sprint composition:\n\nSprint Metrics:\n- Total points: 8\n- Recommended capacity: 10\n- Utilization: 80%\n- Items with dependencies: 1\n\nSprint Items:\n1. [A] Alpha (5 pts)\n   Dependencies: B, C\n2. [B] Beta (3 pts)\n\nPlease identify:\n1. Key risks (scope, dependency, capacity, technical, external)\n2. Probability and impact for each risk\n3. Specific mitigation strategies\n4. Overall sprint risk level",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            SPRINT_PROMPT_IDS.riskUser,
            riskPromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("suggestion", () => {
    const cases = [
      {
        input: {
          availableItems: [
            { id: "A", title: "Alpha", points: 5, priority: "high" },
            { id: "B", title: "Beta" },
          ],
          capacity: 20,
          businessGoals: ["Ship"],
          riskTolerance: "low",
        },
        expected:
          "Suggest optimal sprint composition:\n\nCapacity: 20 story points\nRisk tolerance: low\n\nBusiness Goals:\n1. Ship\n\nAvailable Backlog Items:\n1. [A] Alpha (5 pts, high priority)\n2. [B] Beta (3 pts, medium priority)\n\nPlease suggest:\n1. Items to include in the sprint (respecting capacity)\n2. Reasoning for each inclusion\n3. Key items excluded and why\n4. Overall sprint theme/goal\n5. Risks and recommended mitigations",
      },
      {
        input: {
          availableItems: [{ id: "A", title: "Alpha" }],
          capacity: 10,
          riskTolerance: "high",
        },
        expected:
          "Suggest optimal sprint composition:\n\nCapacity: 10 story points\nRisk tolerance: high\n\n\nAvailable Backlog Items:\n1. [A] Alpha (3 pts, medium priority)\n\nPlease suggest:\n1. Items to include in the sprint (respecting capacity)\n2. Reasoning for each inclusion\n3. Key items excluded and why\n4. Overall sprint theme/goal\n5. Risks and recommended mitigations",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            SPRINT_PROMPT_IDS.suggestionUser,
            sprintSuggestionPromptVariables(c.input as never)
          )
        ).toBe(c.expected);
      }
    );
  });

  describe("prioritization", () => {
    const cases = [
      {
        items: [
          { id: "A", title: "Alpha", description: "desc", priority: "high", labels: ["x", "y"] },
          { id: "B", title: "Beta" },
        ],
        goals: ["Grow", "Retain"],
        expected:
          "Score the business value of each backlog item.\n\nBusiness Goals:\n1. Grow\n2. Retain\n\nBacklog Items:\n1. [A] Alpha\n   Description: desc\n   Current priority: high\n   Labels: x, y\n\n2. [B] Beta\n\nFor each item, provide:\n1. Business value score (0.0 to 1.0)\n2. Brief reasoning for the score\n\nAlso identify any key tradeoffs between items.",
      },
      {
        items: [
          { id: "A", title: "Alpha", description: "desc", priority: "high", labels: ["x", "y"] },
          { id: "B", title: "Beta" },
        ],
        goals: [],
        expected:
          "Score the business value of each backlog item.\n\n\nBacklog Items:\n1. [A] Alpha\n   Description: desc\n   Current priority: high\n   Labels: x, y\n\n2. [B] Beta\n\nFor each item, provide:\n1. Business value score (0.0 to 1.0)\n2. Brief reasoning for the score\n\nAlso identify any key tradeoffs between items.",
      },
    ];
    it.each(cases.map((c, i) => [i, c] as const))(
      "case %i matches the previous formatter output",
      (_, c) => {
        expect(
          defaultPromptRegistry.render(
            SPRINT_PROMPT_IDS.prioritizationUser,
            prioritizationPromptVariables(c.items, c.goals)
          )
        ).toBe(c.expected);
      }
    );
  });
});

describe("PromptRegistry", () => {
  it("resolves the latest registered version and pinned versions", () => {
    const registry = new PromptRegistry();
    registry.register("greet", "1.0.0", "Hello {{name}}");
    registry.register("greet", "2.0.0", "Hi {{name}}!");

    expect(registry.getLatest("greet")?.version).toBe("2.0.0");
    expect(registry.getVersion("greet", "1.0.0")?.template).toBe("Hello {{name}}");
    expect(registry.render("greet", { name: "Ada" })).toBe("Hi Ada!");
    expect(registry.render("greet", { name: "Ada" }, { version: "1.0.0" })).toBe("Hello Ada");
    expect(registry.listVersions("greet")).toHaveLength(2);
  });

  it("does not re-expand placeholders inside substituted values", () => {
    const registry = new PromptRegistry();
    registry.register("p", "1.0.0", "{{a}}|{{b}}");
    expect(registry.render("p", { a: "{{b}}", b: "$& x" })).toBe("{{b}}|$& x");
  });

  it("throws PromptNotFoundError for an unknown id or version", () => {
    const registry = new PromptRegistry();
    registry.register("greet", "1.0.0", "Hello");
    expect(() => registry.render("nope")).toThrow(PromptNotFoundError);
    expect(() => registry.render("greet", {}, { version: "9.9.9" })).toThrow(
      "Prompt 'greet' version '9.9.9' not found"
    );
  });

  it("throws PromptVariableError naming every missing variable", () => {
    const registry = new PromptRegistry();
    registry.register("p", "1.0.0", "{{a}} {{b}} {{a}}");
    const error = (() => {
      try {
        registry.render("p", { a: "x" });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(PromptVariableError);
    expect((error as PromptVariableError).missing).toEqual(["b"]);
    expect(registry.render("p", { a: "", b: "" })).toBe("  ");
  });

  it("rejects registering the same id and version twice", () => {
    const registry = new PromptRegistry();
    registry.register("p", "1.0.0", "a");
    expect(() => registry.register("p", "1.0.0", "b")).toThrow("already registered");
  });

  it("creates independent default registries", () => {
    const a = createDefaultPromptRegistry();
    a.register("prd.system", "2.0.0", "override");
    expect(a.render("prd.system")).toBe("override");
    expect(defaultPromptRegistry.getLatest("prd.system")?.version).toBe("1.0.0");
  });
});
