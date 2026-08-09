import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/ai/AIServiceFactory', () => {
  const mockFactory = {
    getMainModel: vi.fn(),
    getFallbackModel: vi.fn(),
    getModel: vi.fn(),
    getBestAvailableModel: vi.fn(),
    getPRDModel: vi.fn(),
    getResearchModel: vi.fn(),
  };
  return {
    AIServiceFactory: {
      getInstance: vi.fn().mockReturnValue(mockFactory),
    },
  };
});

import { AIServiceFactory } from '../../services/ai/AIServiceFactory';

describe('Mock test', () => {
  it('should have getInstance as a mock', () => {
    console.log('AIServiceFactory:', AIServiceFactory);
    console.log('getInstance:', AIServiceFactory.getInstance);
    console.log('getInstance type:', typeof AIServiceFactory.getInstance);
    console.log('getInstance._isMock:', (AIServiceFactory.getInstance as any)._isMockFunction);
    expect(typeof AIServiceFactory.getInstance).toBe('function');
  });
});
