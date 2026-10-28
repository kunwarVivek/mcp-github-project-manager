import type { ProjectFieldSetup } from "../../infrastructure/agent/ProjectFieldSetup";

/** The agent_* fields could not be provisioned because the token may not administer the project. */
export class AgentFieldProvisioningError extends Error {
  readonly projectId: string;

  constructor(projectId: string, cause: string) {
    super(
      `Project ${projectId} is missing agent_* fields and they could not be created automatically (${cause}). ` +
        `The token needs project admin rights: run agent_manage with action "setup_fields" and projectId ` +
        `"${projectId}" with an admin token, then retry.`
    );
    this.name = "AgentFieldProvisioningError";
    this.projectId = projectId;
  }
}

const PERMISSION_PATTERN =
  /forbidden|permission|not accessible|insufficient|unauthori[sz]ed|\b40[13]\b/i;

/** Projects already healed in this process. Services are built per call, so the state is shared. */
const healed = new Set<string>();
/** First-call provisioning in flight, shared by concurrent callers. */
const inFlight = new Map<string, Promise<void>>();

/** Forget every healed project (tests). */
export function clearProvisionedAgentProjects(): void {
  healed.clear();
  inFlight.clear();
}

/**
 * Additively provisions the `agent_*` project fields the first time a project
 * is used by checkout or heartbeat in this process.
 *
 * `ProjectFieldSetup.ensureFields` creates only what is missing, so a project
 * that already has every field is a single read. A type conflict on an existing
 * field is a hard error (propagated unchanged); a permission failure becomes an
 * {@link AgentFieldProvisioningError} with the actionable remedy. A failed
 * provisioning is not cached, so the next call tries again.
 */
export class AgentFieldProvisioner {
  constructor(private readonly setup: Pick<ProjectFieldSetup, "ensureFields">) {}

  /** Provision once per process; later calls for a healed project do no I/O. */
  ensure(projectId: string): Promise<void> {
    if (healed.has(projectId)) return Promise.resolve();
    const pending = inFlight.get(projectId);
    if (pending) return pending;

    const run = this.provision(projectId).finally(() => {
      inFlight.delete(projectId);
    });
    inFlight.set(projectId, run);
    return run;
  }

  /**
   * A field the process believed present turned out to be missing (deleted
   * since): forget the project and provision again.
   */
  heal(projectId: string): Promise<void> {
    if (!inFlight.has(projectId)) healed.delete(projectId);
    return this.ensure(projectId);
  }

  private async provision(projectId: string): Promise<void> {
    try {
      await this.setup.ensureFields(projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (PERMISSION_PATTERN.test(message))
        throw new AgentFieldProvisioningError(projectId, message);
      throw error;
    }
    healed.add(projectId);
  }
}
