const mutationConfirmation = "ISOLATED_TEST_PROJECT";
const isolatedEnvironment = "isolated-test";

export type MutationTargetInput = {
  confirmation?: string;
  environment?: string;
  projectId?: string;
  supabaseUrl?: string;
  productionProjectIds?: string;
};

export type SafeMutationTarget = Readonly<{
  environment: typeof isolatedEnvironment;
  projectId: string;
}>;

export class MutationTargetBlockedError extends Error {
  readonly code: string;

  constructor(code: string, required: readonly string[]) {
    super(
      `[PORTIA_E2E_TARGET_BLOCKED:${code}] Mutation-capable browser setup is blocked. Check: ${required.join(", ")}.`,
    );
    this.name = "MutationTargetBlockedError";
    this.code = code;
  }
}

function blocked(code: string, ...required: string[]): never {
  throw new MutationTargetBlockedError(code, required);
}

function parseProductionProjectIds(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function requireSafeMutationTarget(
  input: MutationTargetInput,
): SafeMutationTarget {
  if (input.confirmation !== mutationConfirmation) {
    blocked("confirmation", "PORTIA_E2E_MUTATION_CONFIRM");
  }
  if (input.environment !== isolatedEnvironment) {
    blocked("environment", "PORTIA_E2E_TARGET_ENVIRONMENT");
  }

  const projectId = input.projectId?.trim().toLowerCase();
  if (!projectId || !/^[a-z0-9]{20}$/.test(projectId)) {
    blocked("project-id", "PORTIA_E2E_TARGET_ID");
  }
  if (parseProductionProjectIds(input.productionProjectIds).has(projectId)) {
    blocked("production-project", "PORTIA_E2E_PRODUCTION_PROJECT_IDS");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(input.supabaseUrl ?? "");
  } catch {
    blocked("target-url", "PORTIA_E2E_SUPABASE_URL");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.port ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  ) {
    blocked("target-url", "PORTIA_E2E_SUPABASE_URL");
  }

  const expectedHost = `${projectId}.supabase.co`;
  if (endpoint.hostname.toLowerCase() !== expectedHost) {
    blocked(
      "identity-mismatch",
      "PORTIA_E2E_TARGET_ID",
      "PORTIA_E2E_SUPABASE_URL",
    );
  }

  return Object.freeze({ environment: isolatedEnvironment, projectId });
}

export function requireSafeMutationTargetFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return requireSafeMutationTarget({
    confirmation: environment.PORTIA_E2E_MUTATION_CONFIRM,
    environment: environment.PORTIA_E2E_TARGET_ENVIRONMENT,
    projectId: environment.PORTIA_E2E_TARGET_ID,
    supabaseUrl: environment.PORTIA_E2E_SUPABASE_URL,
    productionProjectIds: environment.PORTIA_E2E_PRODUCTION_PROJECT_IDS,
  });
}
