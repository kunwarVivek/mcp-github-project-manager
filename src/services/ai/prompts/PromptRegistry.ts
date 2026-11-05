export interface PromptVersion {
  id: string;
  version: string;
  template: string;
  createdAt: string;
  description?: string;
}

/** Variables substituted into `{{name}}` placeholders. */
export type PromptVariables = Record<string, string>;

export interface PromptRenderOptions {
  /** Pin a specific version instead of the latest registered one. */
  version?: string;
}

/** Thrown when a prompt id (or a pinned version of it) is not registered. */
export class PromptNotFoundError extends Error {
  constructor(
    readonly promptId: string,
    readonly version?: string
  ) {
    super(
      version === undefined
        ? `Prompt '${promptId}' not found`
        : `Prompt '${promptId}' version '${version}' not found`
    );
    this.name = "PromptNotFoundError";
  }
}

/** Thrown when a template placeholder has no matching variable. */
export class PromptVariableError extends Error {
  constructor(
    readonly promptId: string,
    readonly version: string,
    readonly missing: string[]
  ) {
    super(
      `Prompt '${promptId}' version '${version}' is missing variable(s): ${missing.join(", ")}`
    );
    this.name = "PromptVariableError";
  }
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Registry for versioned prompt templates.
 * Templates use {{variable}} placeholders.
 */
export class PromptRegistry {
  private prompts = new Map<string, PromptVersion[]>();

  /** Register a new prompt version. Re-registering an existing id/version throws. */
  register(id: string, version: string, template: string, description?: string): void {
    let versions = this.prompts.get(id);
    if (!versions) {
      versions = [];
      this.prompts.set(id, versions);
    }
    if (versions.some((p) => p.version === version)) {
      throw new Error(`Prompt '${id}' version '${version}' is already registered`);
    }
    versions.push({
      id,
      version,
      template,
      description,
      createdAt: new Date().toISOString(),
    });
  }

  /** Get latest (most recently registered) version of a prompt. */
  getLatest(id: string): PromptVersion | undefined {
    const versions = this.prompts.get(id);
    return versions?.[versions.length - 1];
  }

  /** Get specific version. */
  getVersion(id: string, version: string): PromptVersion | undefined {
    return this.prompts.get(id)?.find((p) => p.version === version);
  }

  /**
   * Render a prompt template with variables.
   * @throws PromptNotFoundError for an unknown id/version
   * @throws PromptVariableError when a placeholder has no variable
   */
  render(id: string, variables: PromptVariables = {}, options: PromptRenderOptions = {}): string {
    const { version } = options;
    const prompt = version === undefined ? this.getLatest(id) : this.getVersion(id, version);
    if (!prompt) throw new PromptNotFoundError(id, version);

    const missing = new Set<string>();
    const rendered = prompt.template.replace(PLACEHOLDER, (_, key: string) => {
      const value = variables[key];
      if (value === undefined) {
        missing.add(key);
        return "";
      }
      return value;
    });
    if (missing.size > 0) throw new PromptVariableError(id, prompt.version, [...missing]);
    return rendered;
  }

  /** List all prompt IDs. */
  listPrompts(): string[] {
    return Array.from(this.prompts.keys());
  }

  /** List versions for a prompt. */
  listVersions(id: string): PromptVersion[] {
    return this.prompts.get(id) ?? [];
  }
}
