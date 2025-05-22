import { describe, expect, it } from '@jest/globals';
import { MCPResponseFormatter } from '../../../../infrastructure/mcp/MCPResponseFormatter';
import { MCPContentType } from '../../../../domain/mcp-types';

describe('MCPResponseFormatter', () => {
  // We're testing the format method, which is the core functionality
  describe('format', () => {
    it('should correctly format a successful response', () => {
      // Arrange
      const data = { name: 'Test Project', id: '123' };
      const metadata = { requestId: 'test-request-123' };
      
      // Act
      const response = MCPResponseFormatter.format(data, MCPContentType.JSON, metadata);
      
      // Assert
      expect(response.status).toBe('success');
      expect(response.requestId).toBe('test-request-123');
      expect(response.output).toBeDefined();
      expect(response.output.content).toBeDefined();
      expect(response.output.format).toBeDefined();
      expect(response.output.format?.type).toBe('json');
    });
    
    it('should work without a request ID', () => {
      // Arrange
      const data = { name: 'Test Project', id: '123' };
      
      // Act
      const response = MCPResponseFormatter.format(data);
      
      // Assert
      expect(response.status).toBe('success');
      expect(response.requestId).toBeDefined(); // Should generate a requestId
      expect(response.output).toBeDefined();
      expect(response.output.format?.type).toBe('json');
    });
  });
});