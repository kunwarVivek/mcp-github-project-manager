import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const execFileSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFileSync }));

const { GhCliSecretProvider } = await import(
  '../../../../infrastructure/secrets/GhCliSecretProvider'
);

describe('GhCliSecretProvider', () => {
  // NB: block bodies are required. An arrow with an implicit return hands the
  // mock back to Vitest, which treats a returned function as a teardown
  // callback and invokes it after the test — re-throwing the mocked error.
  beforeEach(() => {
    execFileSync.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the trimmed token from `gh auth token`', () => {
    execFileSync.mockReturnValue('gho_fromghcli\n');
    expect(new GhCliSecretProvider().get('GITHUB_TOKEN')).toBe('gho_fromghcli');
  });

  it('never shells out — uses execFileSync with an argument array', () => {
    execFileSync.mockReturnValue('gho_x\n');
    new GhCliSecretProvider().get('GITHUB_TOKEN');

    const [bin, args, opts] = execFileSync.mock.calls[0];
    expect(bin).toBe('gh');
    expect(args).toEqual(['auth', 'token']);
    // stderr discarded so a gh error can never reach stdout and corrupt the
    // MCP protocol stream; bounded so a hung binary can't stall startup.
    expect(opts.stdio).toEqual(['ignore', 'pipe', 'ignore']);
    expect(opts.timeout).toBeGreaterThan(0);
  });

  it('only answers for GITHUB_TOKEN', () => {
    execFileSync.mockReturnValue('gho_x\n');
    const provider = new GhCliSecretProvider();
    expect(provider.get('ANTHROPIC_API_KEY')).toBeUndefined();
    expect(provider.get('GITHUB_OWNER')).toBeUndefined();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('resolves to undefined when gh is missing or not logged in', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('command not found: gh');
    });
    expect(new GhCliSecretProvider().get('GITHUB_TOKEN')).toBeUndefined();
  });

  it('treats empty output as unavailable', () => {
    execFileSync.mockReturnValue('  \n');
    expect(new GhCliSecretProvider().get('GITHUB_TOKEN')).toBeUndefined();
  });

  it('invokes gh at most once per process, including after failure', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('not logged in');
    });
    const provider = new GhCliSecretProvider();
    provider.get('GITHUB_TOKEN');
    provider.get('GITHUB_TOKEN');
    provider.get('GITHUB_TOKEN');
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });
});
