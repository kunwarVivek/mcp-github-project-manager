export interface PromptVersion {
  id: string;
  version: string;
  template: string;
  createdAt: string;
  description?: string;
}

/**
 * Registry for versioned prompt templates.
 * Templates use {{variable}} placeholders.
 */
export class PromptRegistry {
  private prompts = new Map<string, PromptVersion[]>();

  /** Register a new prompt version. */
  register(id: string, version: string, template: string, description?: string): void {
    if (!this.prompts.has(id)) {
      this.prompts.set(id, []);
    }
    this.prompts.get(id)!.push({
      id, version, template, description,
      createdAt: new Date().toISOString(),
    });
  }

  /** Get latest version of a prompt. */
  getLatest(id: string): PromptVersion | undefined {
    const versions = this.prompts.get(id);
    return versions?.[versions.length - 1];
  }

  /** Get specific version. */
  getVersion(id: string, version: string): PromptVersion | undefined {
    return this.prompts.get(id)?.find(p => p.version === version);
  }

  /** Render a prompt template with variables. */
  render(id: string, variables: Record<string, string>, version?: string): string {
    const prompt = version ? this.getVersion(id, version) : this.getLatest(id);
    if (!prompt) throw new Error(`Prompt '${id}' not found`);
    return prompt.template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
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
