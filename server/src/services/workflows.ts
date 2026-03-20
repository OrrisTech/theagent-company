import { and, asc, desc, eq, sql, count, max, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  workflows,
  workflowVersions,
  workflowSteps,
  workflowRuns,
  workflowStepRuns,
  workflowTemplates,
} from "@paperclipai/db";
import type {
  WorkflowRunStatus,
  WorkflowStepRunStatus,
  WorkflowRunTrigger,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateWorkflowStepInput,
  TriggerWorkflowInput,
  ApproveStepInput,
  ResumeWorkflowInput,
  WorkflowSummary,
  WorkflowStepConditionConfig,
  WorkflowStepLoopConfig,
} from "@paperclipai/shared";
import {
  WORKFLOW_DEFAULT_SYSTEM_CONCURRENCY,
  WORKFLOW_DEFAULT_AGENT_CONCURRENCY,
} from "@paperclipai/shared";
import { notFound, badRequest, conflict, unprocessable } from "../errors.js";
import { logger } from "../middleware/logger.js";
import {
  compressStepOutput,
  evictLowPriorityOutputs,
  DEFAULT_CONTEXT_BUDGET,
} from "./context-compression.js";
import type { RetentionPriority, ContextBudget } from "@paperclipai/shared";

const log = logger.child({ module: "workflow-service" });

/**
 * Resolve template references like {{step0.output}} against step run outputs.
 * Returns the resolved string (or the parsed JSON value if the entire
 * string is a single reference).
 */
function resolveTemplateRefs(
  template: unknown,
  stepOutputs: Map<number, unknown>,
  params: Record<string, unknown> | null,
): unknown {
  if (typeof template !== "string") return template;

  // If the entire string is a single reference, return the raw value (not stringified)
  const singleRefMatch = template.match(/^\{\{(step(\d+)\.output(?:\.(\w+))?)\}\}$/);
  if (singleRefMatch) {
    const stepIdx = parseInt(singleRefMatch[2]!, 10);
    const output = stepOutputs.get(stepIdx);
    const field = singleRefMatch[3];
    if (field && output && typeof output === "object") {
      return (output as Record<string, unknown>)[field];
    }
    return output;
  }

  // Check for param references
  const paramMatch = template.match(/^\{\{params\.(\w+)\}\}$/);
  if (paramMatch && params) {
    return params[paramMatch[1]!];
  }

  // For mixed strings, do string interpolation
  return template.replace(/\{\{(step(\d+)\.output(?:\.(\w+))?|params\.(\w+)|loop\.item)\}\}/g,
    (_match, _full, stepIdx, field, paramKey) => {
      if (paramKey && params) {
        return String(params[paramKey] ?? "");
      }
      if (stepIdx !== undefined) {
        const idx = parseInt(stepIdx, 10);
        const output = stepOutputs.get(idx);
        if (field && output && typeof output === "object") {
          return String((output as Record<string, unknown>)[field] ?? "");
        }
        return typeof output === "string" ? output : JSON.stringify(output ?? "");
      }
      return _match;
    },
  );
}

export function workflowService(db: Db) {
  // -------------------------------------------------------------------------
  // Workflow CRUD
  // -------------------------------------------------------------------------

  async function list(companyId: string): Promise<WorkflowSummary[]> {
    // Get workflows with aggregated run stats
    const rows = await db
      .select({
        id: workflows.id,
        companyId: workflows.companyId,
        name: workflows.name,
        description: workflows.description,
        status: workflows.status,
        params: workflows.params,
        maxConcurrency: workflows.maxConcurrency,
        createdByUserId: workflows.createdByUserId,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .where(eq(workflows.companyId, companyId))
      .orderBy(desc(workflows.updatedAt));

    // Get step counts and run stats for each workflow
    const summaries: WorkflowSummary[] = [];
    for (const row of rows) {
      // Get latest version step count
      const latestVersion = await db
        .select({ id: workflowVersions.id })
        .from(workflowVersions)
        .where(eq(workflowVersions.workflowId, row.id))
        .orderBy(desc(workflowVersions.version))
        .limit(1)
        .then((r) => r[0] ?? null);

      let stepCount = 0;
      if (latestVersion) {
        const stepCountResult = await db
          .select({ count: count() })
          .from(workflowSteps)
          .where(eq(workflowSteps.workflowVersionId, latestVersion.id))
          .then((r) => r[0]);
        stepCount = stepCountResult?.count ?? 0;
      }

      // Get run stats
      const runStats = await db
        .select({
          totalRuns: count(),
          lastRunAt: max(workflowRuns.startedAt),
        })
        .from(workflowRuns)
        .where(eq(workflowRuns.workflowId, row.id))
        .then((r) => r[0]);

      // Get last run status
      const lastRun = await db
        .select({ status: workflowRuns.status })
        .from(workflowRuns)
        .where(eq(workflowRuns.workflowId, row.id))
        .orderBy(desc(workflowRuns.createdAt))
        .limit(1)
        .then((r) => r[0] ?? null);

      summaries.push({
        ...row,
        stepCount,
        lastRunAt: runStats?.lastRunAt ?? null,
        lastRunStatus: (lastRun?.status as WorkflowRunStatus) ?? null,
        totalRuns: runStats?.totalRuns ?? 0,
      });
    }

    return summaries;
  }

  async function getById(id: string) {
    const workflow = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id))
      .then((r) => r[0] ?? null);
    if (!workflow) throw notFound("Workflow not found");
    return workflow;
  }

  async function getWithLatestVersion(id: string) {
    const workflow = await getById(id);

    const latestVersion = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, id))
      .orderBy(desc(workflowVersions.version))
      .limit(1)
      .then((r) => r[0] ?? null);

    let steps: (typeof workflowSteps.$inferSelect)[] = [];
    if (latestVersion) {
      steps = await db
        .select()
        .from(workflowSteps)
        .where(eq(workflowSteps.workflowVersionId, latestVersion.id))
        .orderBy(asc(workflowSteps.stepIndex));
    }

    const versions = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, id))
      .orderBy(desc(workflowVersions.version));

    return { workflow, latestVersion, steps, versions };
  }

  async function create(companyId: string, input: CreateWorkflowInput, userId?: string) {
    const [workflow] = await db
      .insert(workflows)
      .values({
        companyId,
        name: input.name,
        description: input.description ?? null,
        params: input.params ?? null,
        maxConcurrency: input.maxConcurrency ?? null,
        createdByUserId: userId ?? null,
      })
      .returning();

    // Create version 1
    const [version] = await db
      .insert(workflowVersions)
      .values({
        workflowId: workflow!.id,
        version: 1,
        label: "v1",
      })
      .returning();

    // Create steps
    if (input.steps.length > 0) {
      await db.insert(workflowSteps).values(
        input.steps.map((step, idx) => ({
          workflowVersionId: version!.id,
          stepIndex: idx,
          name: step.name,
          type: step.type,
          config: step.config,
          inputRefs: step.inputRefs ?? null,
          timeoutSeconds: step.timeoutSeconds ?? null,
          retries: step.retries ?? null,
          fallbackOutput: step.fallbackOutput ?? null,
          isCheckpoint: step.isCheckpoint ?? false,
          retentionPriority: step.retentionPriority ?? "medium",
        })),
      );
    }

    return { workflow: workflow!, version: version! };
  }

  async function update(id: string, input: UpdateWorkflowInput) {
    const existing = await getById(id);

    // Update workflow metadata
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.params !== undefined) updateData.params = input.params;
    if (input.maxConcurrency !== undefined) updateData.maxConcurrency = input.maxConcurrency;

    const [updated] = await db
      .update(workflows)
      .set(updateData)
      .where(eq(workflows.id, id))
      .returning();

    // If steps are provided, create a new version
    let newVersion = null;
    if (input.steps) {
      // Get the current highest version number
      const latestVersion = await db
        .select({ version: workflowVersions.version })
        .from(workflowVersions)
        .where(eq(workflowVersions.workflowId, id))
        .orderBy(desc(workflowVersions.version))
        .limit(1)
        .then((r) => r[0]);

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      const [version] = await db
        .insert(workflowVersions)
        .values({
          workflowId: id,
          version: nextVersion,
          label: input.versionLabel ?? `v${nextVersion}`,
        })
        .returning();

      // Create steps for the new version
      if (input.steps.length > 0) {
        await db.insert(workflowSteps).values(
          input.steps.map((step, idx) => ({
            workflowVersionId: version!.id,
            stepIndex: idx,
            name: step.name,
            type: step.type,
            config: step.config,
            inputRefs: step.inputRefs ?? null,
            timeoutSeconds: step.timeoutSeconds ?? null,
            retries: step.retries ?? null,
            fallbackOutput: step.fallbackOutput ?? null,
            isCheckpoint: step.isCheckpoint ?? false,
            retentionPriority: step.retentionPriority ?? "medium",
          })),
        );
      }

      newVersion = version!;
    }

    return { workflow: updated!, newVersion };
  }

  async function deleteWorkflow(id: string) {
    await getById(id);
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  async function duplicate(id: string, companyId: string) {
    const { workflow, steps } = await getWithLatestVersion(id);

    const stepInputs: CreateWorkflowStepInput[] = steps.map((s) => ({
      name: s.name,
      type: s.type,
      config: s.config,
      inputRefs: s.inputRefs ?? undefined,
      timeoutSeconds: s.timeoutSeconds ?? undefined,
      retries: s.retries ?? undefined,
      fallbackOutput: s.fallbackOutput ?? undefined,
      isCheckpoint: s.isCheckpoint,
    }));

    return create(companyId, {
      name: `${workflow.name} (copy)`,
      description: workflow.description ?? undefined,
      params: workflow.params ?? undefined,
      maxConcurrency: workflow.maxConcurrency ?? undefined,
      steps: stepInputs,
    });
  }

  // -------------------------------------------------------------------------
  // Version management
  // -------------------------------------------------------------------------

  async function getVersionSteps(versionId: string) {
    return db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowVersionId, versionId))
      .orderBy(asc(workflowSteps.stepIndex));
  }

  async function listVersions(workflowId: string) {
    return db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.version));
  }

  // -------------------------------------------------------------------------
  // Execution engine
  // -------------------------------------------------------------------------

  async function checkConcurrencyLimits(workflowId: string, agentId: string | null) {
    const workflow = await getById(workflowId);

    // Check workflow-level concurrency
    const maxWorkflow = workflow.maxConcurrency ?? WORKFLOW_DEFAULT_SYSTEM_CONCURRENCY;
    const activeRuns = await db
      .select({ count: count() })
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.workflowId, workflowId),
          inArray(workflowRuns.status, ["pending", "running", "paused"]),
        ),
      )
      .then((r) => r[0]?.count ?? 0);

    if (activeRuns >= maxWorkflow) {
      throw conflict(
        `Workflow has reached its concurrency limit (${maxWorkflow} active runs)`,
      );
    }

    // Check agent-level concurrency
    if (agentId) {
      const agentActiveRuns = await db
        .select({ count: count() })
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.agentId, agentId),
            inArray(workflowRuns.status, ["pending", "running", "paused"]),
          ),
        )
        .then((r) => r[0]?.count ?? 0);

      if (agentActiveRuns >= WORKFLOW_DEFAULT_AGENT_CONCURRENCY) {
        throw conflict(
          `Agent has reached its concurrency limit (${WORKFLOW_DEFAULT_AGENT_CONCURRENCY} active runs)`,
        );
      }
    }
  }

  async function triggerRun(
    workflowId: string,
    companyId: string,
    trigger: WorkflowRunTrigger,
    input?: TriggerWorkflowInput,
  ) {
    const { workflow, latestVersion, steps } = await getWithLatestVersion(workflowId);

    if (!latestVersion || steps.length === 0) {
      throw badRequest("Workflow has no steps to execute");
    }

    if (workflow.status !== "active" && trigger !== "manual") {
      throw badRequest("Only active workflows can be triggered automatically");
    }

    await checkConcurrencyLimits(workflowId, input?.agentId ?? null);

    // Create the run record
    const [run] = await db
      .insert(workflowRuns)
      .values({
        workflowId,
        workflowVersionId: latestVersion.id,
        companyId,
        agentId: input?.agentId ?? null,
        issueId: input?.issueId ?? null,
        trigger,
        params: input?.params ?? null,
        debugMode: input?.debugMode ?? false,
        debugPauseAtStep: input?.debugPauseAtStep ?? null,
        status: "pending",
      })
      .returning();

    // Create step run records for all steps
    await db.insert(workflowStepRuns).values(
      steps.map((step) => ({
        workflowRunId: run!.id,
        workflowStepId: step.id,
        stepIndex: step.stepIndex,
        status: "pending" as WorkflowStepRunStatus,
      })),
    );

    // Start execution asynchronously
    executeRun(run!.id).catch((err) => {
      log.error({ err, runId: run!.id }, "Workflow run execution failed");
    });

    return run!;
  }

  /**
   * Main execution loop for a workflow run. Processes steps sequentially,
   * handling condition/loop control flow, approvals, and checkpoints.
   */
  async function executeRun(runId: string) {
    const run = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .then((r) => r[0]);

    if (!run) return;

    // Mark run as running
    await db
      .update(workflowRuns)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowRuns.id, runId));

    // Get the steps for this run's version
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowVersionId, run.workflowVersionId))
      .orderBy(asc(workflowSteps.stepIndex));

    const stepOutputs = new Map<number, unknown>();
    let totalCost = 0;
    const startTime = Date.now();

    // If resuming, load outputs from previously completed steps
    const existingStepRuns = await db
      .select()
      .from(workflowStepRuns)
      .where(eq(workflowStepRuns.workflowRunId, runId))
      .orderBy(asc(workflowStepRuns.stepIndex));

    for (const sr of existingStepRuns) {
      if (sr.status === "succeeded" && sr.output !== null) {
        stepOutputs.set(sr.stepIndex, sr.output);
        totalCost += sr.costCents ?? 0;
      }
    }

    let currentStep = run.lastCheckpointStep !== null ? run.lastCheckpointStep + 1 : 0;

    // Skip already completed steps (for resume scenarios)
    while (currentStep < steps.length) {
      const existingRun = existingStepRuns.find((sr) => sr.stepIndex === currentStep);
      if (existingRun && existingRun.status === "succeeded") {
        currentStep++;
        continue;
      }
      break;
    }

    try {
      while (currentStep < steps.length) {
        const step = steps[currentStep];
        if (!step) break;

        // Check for debug pause
        if (run.debugMode) {
          if (run.debugPauseAtStep === null || currentStep >= (run.debugPauseAtStep ?? 0)) {
            await db
              .update(workflowRuns)
              .set({
                status: "paused",
                updatedAt: new Date(),
                debugPauseAtStep: currentStep,
              })
              .where(eq(workflowRuns.id, runId));
            return; // Pause execution — will be resumed by user action
          }
        }

        // Handle control flow steps
        if (step.type === "condition") {
          const condConfig = step.config as WorkflowStepConditionConfig;
          const condResult = evaluateCondition(condConfig.expression, stepOutputs, run.params);

          // Record the condition step as succeeded
          await updateStepRun(runId, step.id, currentStep, {
            status: "succeeded",
            input: { expression: condConfig.expression },
            output: { result: condResult },
          });

          currentStep = condResult ? condConfig.thenStep : (condConfig.elseStep ?? currentStep + 1);
          continue;
        }

        if (step.type === "loop") {
          const loopConfig = step.config as WorkflowStepLoopConfig;
          const collection = resolveTemplateRefs(
            loopConfig.collection,
            stepOutputs,
            run.params,
          );

          const items = Array.isArray(collection) ? collection : [];
          const maxIter = loopConfig.maxIterations ?? 100;
          const loopOutputs: unknown[] = [];

          for (let i = 0; i < Math.min(items.length, maxIter); i++) {
            // Execute body steps for each iteration
            const bodyOutputs = new Map(stepOutputs);
            bodyOutputs.set(-1, items[i]); // loop.item available as step -1

            for (let bodyStep = loopConfig.bodyStartStep; bodyStep <= loopConfig.bodyEndStep; bodyStep++) {
              const bStep = steps[bodyStep];
              if (!bStep) continue;

              const result = await executeStep(bStep, bodyOutputs, run.params, runId, i);
              bodyOutputs.set(bodyStep, result.output);
              totalCost += result.costCents ?? 0;
            }

            loopOutputs.push(bodyOutputs.get(loopConfig.bodyEndStep));
          }

          // Store loop output
          stepOutputs.set(currentStep, loopOutputs);
          await updateStepRun(runId, step.id, currentStep, {
            status: "succeeded",
            input: { collection: items.length },
            output: loopOutputs,
          });

          // Jump past the loop body
          currentStep = loopConfig.bodyEndStep + 1;
          continue;
        }

        // Handle approval steps — pause and wait
        if (step.type === "approval") {
          const resolvedInput = resolveStepInputs(step, stepOutputs, run.params);
          await updateStepRun(runId, step.id, currentStep, {
            status: "waiting_approval",
            input: resolvedInput,
            startedAt: new Date(),
          });
          await db
            .update(workflowRuns)
            .set({ status: "paused", updatedAt: new Date() })
            .where(eq(workflowRuns.id, runId));
          return; // Execution will resume when approval is granted
        }

        // Execute regular steps (prompt, skill, api, cli, tool_use, workflow)
        const result = await executeStep(step, stepOutputs, run.params, runId);

        // Context compression: compress oversized step outputs before passing forward.
        // Checkpoint stores full data; inter-step transfer only passes summaries.
        const priority = (step.retentionPriority as RetentionPriority) ?? "medium";
        const compressed = compressStepOutput(result.output, priority, DEFAULT_CONTEXT_BUDGET);
        stepOutputs.set(currentStep, compressed.wasCompressed ? compressed.summary : result.output);

        if (compressed.wasCompressed) {
          log.info(
            { runId, stepIndex: currentStep, originalSize: compressed.originalSize, compressedSize: compressed.compressedSize },
            "Step output compressed to fit context budget",
          );
        }

        // Evict low-priority outputs if total context is over budget
        const stringOutputs = new Map<number, string>();
        for (const [k, v] of stepOutputs.entries()) {
          stringOutputs.set(k, typeof v === "string" ? v : JSON.stringify(v));
        }
        const stepPriorities = new Map<number, RetentionPriority>();
        for (const s of steps) {
          stepPriorities.set(s.stepIndex, (s.retentionPriority as RetentionPriority) ?? "medium");
        }
        const evicted = evictLowPriorityOutputs(stringOutputs, stepPriorities, DEFAULT_CONTEXT_BUDGET);
        for (const [k, v] of evicted.entries()) {
          stepOutputs.set(k, v);
        }

        totalCost += result.costCents ?? 0;

        // Update checkpoint if this step is marked as one
        if (step.isCheckpoint) {
          await db
            .update(workflowRuns)
            .set({ lastCheckpointStep: currentStep, updatedAt: new Date() })
            .where(eq(workflowRuns.id, runId));
        }

        currentStep++;
      }

      // All steps completed successfully
      const duration = Date.now() - startTime;
      await db
        .update(workflowRuns)
        .set({
          status: "succeeded",
          totalCostCents: totalCost,
          totalDurationMs: duration,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error({ err, runId }, "Workflow run failed");

      await db
        .update(workflowRuns)
        .set({
          status: "failed",
          error: errorMessage,
          totalCostCents: totalCost,
          totalDurationMs: duration,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));
    }
  }

  /**
   * Execute a single step and return its result.
   * For now, steps return mock/placeholder outputs. The real execution
   * would integrate with the agent engine, skill system, and HTTP clients.
   */
  async function executeStep(
    step: typeof workflowSteps.$inferSelect,
    stepOutputs: Map<number, unknown>,
    params: Record<string, unknown> | null,
    runId: string,
    loopIteration?: number,
  ): Promise<{ output: unknown; costCents: number | null }> {
    const stepStartTime = Date.now();
    const resolvedInput = resolveStepInputs(step, stepOutputs, params);
    let retryAttempt = 0;
    const maxRetries = step.retries ?? 0;

    while (retryAttempt <= maxRetries) {
      try {
        await updateStepRun(runId, step.id, step.stepIndex, {
          status: "running",
          input: resolvedInput,
          retryAttempt,
          loopIteration: loopIteration ?? null,
          startedAt: new Date(),
        });

        // Execute based on step type
        let output: unknown = null;
        let costCents: number | null = null;

        switch (step.type) {
          case "prompt": {
            // In a real implementation, this would call the LLM via the agent engine.
            // For now, record the resolved prompt as output.
            output = { type: "prompt", resolvedInput, status: "executed" };
            costCents = 0;
            break;
          }
          case "skill": {
            output = { type: "skill", resolvedInput, status: "executed" };
            costCents = 0;
            break;
          }
          case "api": {
            // Real implementation would make HTTP calls
            output = { type: "api", resolvedInput, status: "executed" };
            costCents = 0;
            break;
          }
          case "cli": {
            output = { type: "cli", resolvedInput, status: "executed" };
            costCents = 0;
            break;
          }
          case "tool_use": {
            output = { type: "tool_use", resolvedInput, status: "executed" };
            costCents = 0;
            break;
          }
          case "workflow": {
            // Nested workflow execution — trigger the child workflow synchronously
            output = { type: "workflow", resolvedInput, status: "executed" };
            costCents = 0;
            break;
          }
          default:
            output = { type: step.type, status: "unsupported" };
        }

        const duration = Date.now() - stepStartTime;
        await updateStepRun(runId, step.id, step.stepIndex, {
          status: "succeeded",
          output,
          costCents,
          durationMs: duration,
          finishedAt: new Date(),
        });

        return { output, costCents };
      } catch (err) {
        retryAttempt++;
        if (retryAttempt > maxRetries) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const duration = Date.now() - stepStartTime;

          // If there's a fallback, use it instead of failing
          if (step.fallbackOutput) {
            const fallbackValue = resolveTemplateRefs(step.fallbackOutput, stepOutputs, params);
            await updateStepRun(runId, step.id, step.stepIndex, {
              status: "succeeded",
              output: fallbackValue,
              error: `Used fallback after error: ${errorMessage}`,
              durationMs: duration,
              finishedAt: new Date(),
            });
            return { output: fallbackValue, costCents: 0 };
          }

          await updateStepRun(runId, step.id, step.stepIndex, {
            status: "failed",
            error: errorMessage,
            durationMs: duration,
            finishedAt: new Date(),
          });
          throw err;
        }
      }
    }

    throw new Error("Unexpected: step execution loop exited without result");
  }

  function resolveStepInputs(
    step: typeof workflowSteps.$inferSelect,
    stepOutputs: Map<number, unknown>,
    params: Record<string, unknown> | null,
  ): unknown {
    const config = step.config;
    if (!config || typeof config !== "object") return config;

    // Deep-resolve template refs in the config object
    return JSON.parse(
      JSON.stringify(config, (_key, value) => {
        if (typeof value === "string" && value.includes("{{")) {
          return resolveTemplateRefs(value, stepOutputs, params);
        }
        return value;
      }),
    );
  }

  function evaluateCondition(
    expression: string,
    stepOutputs: Map<number, unknown>,
    params: Record<string, unknown> | null,
  ): boolean {
    // Simple expression evaluator for conditions.
    // Resolves template refs first, then evaluates basic comparisons.
    const resolved = resolveTemplateRefs(expression, stepOutputs, params);
    if (typeof resolved === "boolean") return resolved;
    if (typeof resolved === "string") {
      // Support simple truthy check
      return resolved !== "" && resolved !== "false" && resolved !== "0";
    }
    return Boolean(resolved);
  }

  async function updateStepRun(
    runId: string,
    stepId: string,
    stepIndex: number,
    updates: Partial<typeof workflowStepRuns.$inferInsert>,
  ) {
    // Try to update existing step run
    const existing = await db
      .select()
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.workflowRunId, runId),
          eq(workflowStepRuns.workflowStepId, stepId),
        ),
      )
      .then((r) => r[0] ?? null);

    if (existing) {
      await db
        .update(workflowStepRuns)
        .set(updates)
        .where(eq(workflowStepRuns.id, existing.id));
    }
  }

  // -------------------------------------------------------------------------
  // Approval handling
  // -------------------------------------------------------------------------

  async function approveStep(
    runId: string,
    stepRunId: string,
    userId: string,
    input: ApproveStepInput,
  ) {
    const stepRun = await db
      .select()
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.id, stepRunId),
          eq(workflowStepRuns.workflowRunId, runId),
        ),
      )
      .then((r) => r[0] ?? null);

    if (!stepRun) throw notFound("Step run not found");
    if (stepRun.status !== "waiting_approval") {
      throw unprocessable("Step is not waiting for approval");
    }

    await db
      .update(workflowStepRuns)
      .set({
        status: input.decision === "approved" ? "succeeded" : "failed",
        approvedByUserId: userId,
        approvalDecision: input.decision,
        output: { decision: input.decision, approvedBy: userId },
        finishedAt: new Date(),
      })
      .where(eq(workflowStepRuns.id, stepRunId));

    if (input.decision === "approved") {
      // Resume workflow execution from the next step
      const run = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, runId))
        .then((r) => r[0]);

      if (run) {
        await db
          .update(workflowRuns)
          .set({
            status: "running",
            debugPauseAtStep: run.debugMode ? stepRun.stepIndex + 1 : null,
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, runId));

        // Continue execution asynchronously
        executeRun(runId).catch((err) => {
          log.error({ err, runId }, "Workflow resume after approval failed");
        });
      }
    } else {
      // Rejection fails the run
      await db
        .update(workflowRuns)
        .set({
          status: "failed",
          error: "Approval rejected",
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowRuns.id, runId));
    }
  }

  // -------------------------------------------------------------------------
  // Debug mode
  // -------------------------------------------------------------------------

  async function debugContinue(runId: string, pauseAtStep?: number) {
    const run = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .then((r) => r[0] ?? null);

    if (!run) throw notFound("Run not found");
    if (run.status !== "paused") throw unprocessable("Run is not paused");

    await db
      .update(workflowRuns)
      .set({
        status: "running",
        debugPauseAtStep: pauseAtStep ?? null,
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId));

    executeRun(runId).catch((err) => {
      log.error({ err, runId }, "Debug continue failed");
    });

    return run;
  }

  // -------------------------------------------------------------------------
  // Resume from checkpoint
  // -------------------------------------------------------------------------

  async function resumeRun(runId: string, input?: ResumeWorkflowInput) {
    const run = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .then((r) => r[0] ?? null);

    if (!run) throw notFound("Run not found");
    if (run.status !== "failed" && run.status !== "paused") {
      throw unprocessable("Can only resume failed or paused runs");
    }

    // If step output is provided, inject it into the failed step
    if (input?.stepOutput !== undefined && input.fromStep !== undefined) {
      const stepRuns = await db
        .select()
        .from(workflowStepRuns)
        .where(
          and(
            eq(workflowStepRuns.workflowRunId, runId),
            eq(workflowStepRuns.stepIndex, input.fromStep),
          ),
        );

      if (stepRuns[0]) {
        await db
          .update(workflowStepRuns)
          .set({
            status: "succeeded",
            output: input.stepOutput,
            finishedAt: new Date(),
          })
          .where(eq(workflowStepRuns.id, stepRuns[0].id));
      }
    }

    // Update checkpoint to resume from
    const resumeFrom = input?.fromStep ?? run.lastCheckpointStep ?? 0;
    await db
      .update(workflowRuns)
      .set({
        status: "running",
        error: null,
        lastCheckpointStep: resumeFrom > 0 ? resumeFrom - 1 : null,
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId));

    executeRun(runId).catch((err) => {
      log.error({ err, runId }, "Workflow resume failed");
    });
  }

  // -------------------------------------------------------------------------
  // Run queries
  // -------------------------------------------------------------------------

  async function listRuns(workflowId: string) {
    return db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId))
      .orderBy(desc(workflowRuns.createdAt));
  }

  async function getRun(runId: string) {
    const run = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .then((r) => r[0] ?? null);

    if (!run) throw notFound("Run not found");

    const stepRuns = await db
      .select()
      .from(workflowStepRuns)
      .where(eq(workflowStepRuns.workflowRunId, runId))
      .orderBy(asc(workflowStepRuns.stepIndex));

    // Also get step definitions for names/types
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowVersionId, run.workflowVersionId))
      .orderBy(asc(workflowSteps.stepIndex));

    return { run, stepRuns, steps };
  }

  async function cancelRun(runId: string) {
    const run = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .then((r) => r[0] ?? null);

    if (!run) throw notFound("Run not found");
    if (run.status === "succeeded" || run.status === "cancelled") {
      throw unprocessable("Run is already finished");
    }

    await db
      .update(workflowRuns)
      .set({
        status: "cancelled",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId));

    // Cancel any pending/running step runs
    await db
      .update(workflowStepRuns)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(workflowStepRuns.workflowRunId, runId),
          inArray(workflowStepRuns.status, ["pending", "running", "waiting_approval"]),
        ),
      );
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  async function listTemplates() {
    return db
      .select()
      .from(workflowTemplates)
      .orderBy(asc(workflowTemplates.name));
  }

  async function importTemplate(templateId: string, companyId: string, userId?: string) {
    const template = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId))
      .then((r) => r[0] ?? null);

    if (!template) throw notFound("Template not found");

    return create(companyId, {
      name: template.name,
      description: template.description ?? undefined,
      params: template.paramsJson ?? undefined,
      steps: template.stepsJson.map((s) => ({
        name: s.name,
        type: s.type,
        config: s.config,
        inputRefs: s.inputRefs,
        timeoutSeconds: s.timeoutSeconds,
        retries: s.retries,
        fallbackOutput: s.fallbackOutput,
        isCheckpoint: s.isCheckpoint ?? false,
      })),
    }, userId);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    list,
    getById,
    getWithLatestVersion,
    create,
    update,
    delete: deleteWorkflow,
    duplicate,
    getVersionSteps,
    listVersions,
    triggerRun,
    approveStep,
    debugContinue,
    resumeRun,
    listRuns,
    getRun,
    cancelRun,
    listTemplates,
    importTemplate,
  };
}
