import { MCPResponseFormatter } from "../../../../infrastructure/mcp/MCPResponseFormatter";
import { MCPContentType } from "../../../../domain/mcp-types";

describe("MCPResponseFormatter", () => {
  const testData = {
    name: "Test Project",
    description: "A test project",
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-03-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should format JSON data correctly", () => {
    const response = MCPResponseFormatter.format(testData, MCPContentType.JSON);

    expect(response).toEqual({
      content: [
        {
          type: "json",
          text: JSON.stringify(testData, null, 2),
          contentType: MCPContentType.JSON,
        },
      ],
      metadata: {
        timestamp: "2025-03-01T12:00:00.000Z",
        status: 200,
      },
    });
  });

  it("should format text data correctly", () => {
    const textData = "Hello World";
    const response = MCPResponseFormatter.format(textData, MCPContentType.TEXT);

    expect(response).toEqual({
      content: [
        {
          type: "text",
          text: textData,
          contentType: MCPContentType.TEXT,
        },
      ],
      metadata: {
        timestamp: "2025-03-01T12:00:00.000Z",
        status: 200,
      },
    });
  });

  it("should format multiple content pieces correctly", () => {
    const contents = [
      { data: testData, contentType: MCPContentType.JSON },
      { data: "Hello World", contentType: MCPContentType.TEXT },
    ];

    const response = MCPResponseFormatter.formatMultiple(contents);

    expect(response).toEqual({
      content: [
        {
          type: "json",
          text: JSON.stringify(testData, null, 2),
          contentType: MCPContentType.JSON,
        },
        {
          type: "text",
          text: "Hello World",
          contentType: MCPContentType.TEXT,
        },
      ],
      metadata: {
        timestamp: "2025-03-01T12:00:00.000Z",
        status: 200,
      },
    });
  });

  it("should include pagination metadata when using paginated method", () => {
    const response = MCPResponseFormatter.paginated([testData], 1, 5);

    expect(response.metadata).toEqual({
      timestamp: "2025-03-01T12:00:00.000Z",
      status: 200,
      pagination: {
        page: 1,
        totalPages: 5,
      },
    });
  });

  it("should include request ID in metadata when provided", () => {
    const requestId = "test-123";
    const response = MCPResponseFormatter.success(testData, MCPContentType.JSON, requestId);

    expect(response.metadata.requestId).toBe(requestId);
  });
});