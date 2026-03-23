import { and, asc, desc, eq, sql, count, max, inArray } from "drizzle-orm";
import { execSync } from "node:child_process";
import type { Db } from "@theagentcompany/db";
import {
  workflows,
  workflowVersions,
  workflowSteps,
  workflowRuns,
  workflowStepRuns,
  workflowTemplates,
  agents,
  heartbeatRuns,
  agentWakeupRequests,
} from "@theagentcompany/db";
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
  WorkflowStepPromptConfig,
  WorkflowStepApiConfig,
  WorkflowStepCliConfig,
  WorkflowStepSkillConfig,
  WorkflowStepToolUseConfig,
  WorkflowStepWorkflowConfig,
} from "@theagentcompany/shared";
import {
  WORKFLOW_DEFAULT_SYSTEM_CONCURRENCY,
  WORKFLOW_DEFAULT_AGENT_CONCURRENCY,
} from "@theagentcompany/shared";
import { notFound, badRequest, conflict, unprocessable } from "../errors.js";
import { logger } from "../middleware/logger.js";
import {
  compressStepOutput,
  evictLowPriorityOutputs,
  DEFAULT_CONTEXT_BUDGET,
} from "./context-compression.js";
import type { RetentionPriority, ContextBudget } from "@theagentcompany/shared";

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
          roleLabel: step.roleLabel ?? null,
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
            const cfg = resolvedInput as WorkflowStepPromptConfig;
            const promptText = cfg.prompt;
            if (!promptText) throw new Error("Prompt step is missing a 'prompt' field in config");

            const apiKey = process.env.OPENAI_API_KEY;
            if (apiKey) {
              // Direct LLM call via OpenAI-compatible API
              const model = cfg.model ?? "gpt-4o-mini";
              const timeoutMs = (step.timeoutSeconds ?? 120) * 1000;
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), timeoutMs);

              try {
                const resp = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model,
                    messages: [{ role: "user", content: promptText }],
                  }),
                  signal: controller.signal,
                });

                if (!resp.ok) {
                  const errBody = await resp.text().catch(() => "");
                  throw new Error(`LLM API returned ${resp.status}: ${errBody.slice(0, 500)}`);
                }

                const json = (await resp.json()) as {
                  choices?: Array<{ message?: { content?: string } }>;
                  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                };
                const responseText = json.choices?.[0]?.message?.content ?? "";
                const usage = json.usage ?? {};
                const inputTokens = usage.prompt_tokens ?? 0;
                const outputTokens = usage.completion_tokens ?? 0;
                const tokensUsed = usage.total_tokens ?? inputTokens + outputTokens;

                // Cost estimate: gpt-4o-mini ~$0.15/1M input, $0.60/1M output
                costCents =
                  Math.round(
                    (inputTokens * 0.015 + outputTokens * 0.06) / 1000,
                  ) || 0; // cents

                output = {
                  type: "prompt",
                  response: responseText,
                  model,
                  tokensUsed,
                  inputTokens,
                  outputTokens,
                };
              } finally {
                clearTimeout(timer);
              }
            } else {
              // No API key — try to queue via heartbeat for the workflow's agent
              const run = await db
                .select()
                .from(workflowRuns)
                .where(eq(workflowRuns.id, runId))
                .then((r) => r[0]);
              const agentId = run?.agentId;
              if (!agentId) {
                throw new Error(
                  "Prompt step failed: no OPENAI_API_KEY set and no agent assigned to the workflow run",
                );
              }

              const wakeupRequest = await db
                .insert(agentWakeupRequests)
                .values({
                  companyId: run.companyId,
                  agentId,
                  source: "automation",
                  triggerDetail: "system",
                  reason: `workflow_prompt:${runId}:${step.stepIndex}`,
                  payload: { prompt: promptText },
                  status: "pending",
                })
                .returning()
                .then((rows) => rows[0]!);

              const hbRun = await db
                .insert(heartbeatRuns)
                .values({
                  companyId: run.companyId,
                  agentId,
                  invocationSource: "automation",
                  triggerDetail: "system",
                  status: "queued",
                  wakeupRequestId: wakeupRequest.id,
                  contextSnapshot: {
                    source: "workflow",
                    workflowRunId: runId,
                    stepIndex: step.stepIndex,
                    wakeReason: promptText,
                  },
                })
                .returning()
                .then((rows) => rows[0]!);

              // Poll for completion (max timeout from step or 5 min)
              const maxWaitMs = (step.timeoutSeconds ?? 300) * 1000;
              const pollIntervalMs = 3000;
              const deadline = Date.now() + maxWaitMs;
              let completedRun: typeof hbRun | null = null;

              while (Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
                const current = await db
                  .select()
                  .from(heartbeatRuns)
                  .where(eq(heartbeatRuns.id, hbRun.id))
                  .then((r) => r[0] ?? null);

                if (current && current.status !== "queued" && current.status !== "running") {
                  completedRun = current;
                  break;
                }
              }

              if (!completedRun) {
                throw new Error(
                  `Prompt step timed out waiting for heartbeat run ${hbRun.id} after ${maxWaitMs / 1000}s`,
                );
              }

              if (completedRun.status === "failed" || completedRun.status === "error") {
                throw new Error(
                  `Heartbeat run ${hbRun.id} failed: ${completedRun.error ?? "unknown error"}`,
                );
              }

              output = {
                type: "prompt",
                response: completedRun.resultJson ?? completedRun.error ?? "",
                model: "agent",
                tokensUsed: 0,
                heartbeatRunId: hbRun.id,
              };
              costCents = 0;
            }
            break;
          }
          case "skill": {
            const cfg = resolvedInput as WorkflowStepSkillConfig;
            if (!cfg.skillId) throw new Error("Skill step is missing a 'skillId' in config");

            // Queue a heartbeat run for the workflow's agent with the skill instruction
            const run = await db
              .select()
              .from(workflowRuns)
              .where(eq(workflowRuns.id, runId))
              .then((r) => r[0]);
            const agentId = run?.agentId;
            if (!agentId) {
              throw new Error("Skill step failed: no agent assigned to the workflow run");
            }

            const wakeupRequest = await db
              .insert(agentWakeupRequests)
              .values({
                companyId: run.companyId,
                agentId,
                source: "automation",
                triggerDetail: "system",
                reason: `workflow_skill:${runId}:${step.stepIndex}`,
                payload: { skillId: cfg.skillId, params: cfg.params },
                status: "pending",
              })
              .returning()
              .then((rows) => rows[0]!);

            const hbRun = await db
              .insert(heartbeatRuns)
              .values({
                companyId: run.companyId,
                agentId,
                invocationSource: "automation",
                triggerDetail: "system",
                status: "queued",
                wakeupRequestId: wakeupRequest.id,
                contextSnapshot: {
                  source: "workflow",
                  workflowRunId: runId,
                  stepIndex: step.stepIndex,
                  skillId: cfg.skillId,
                  wakeReason: `Execute skill: ${cfg.skillId}`,
                  ...(cfg.params ? { skillParams: cfg.params } : {}),
                },
              })
              .returning()
              .then((rows) => rows[0]!);

            output = {
              type: "skill",
              skillId: cfg.skillId,
              status: "queued",
              runId: hbRun.id,
            };
            costCents = 0;
            break;
          }
          case "api": {
            const cfg = resolvedInput as WorkflowStepApiConfig;
            if (!cfg.url) throw new Error("API step is missing a 'url' in config");

            const method = (cfg.method ?? "GET").toUpperCase();
            const timeoutMs = (step.timeoutSeconds ?? 30) * 1000;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            try {
              const fetchOpts: RequestInit = {
                method,
                headers: {
                  ...(cfg.headers ?? {}),
                },
                signal: controller.signal,
              };

              if (cfg.body && method !== "GET" && method !== "HEAD") {
                const bodyStr = typeof cfg.body === "string" ? cfg.body : JSON.stringify(cfg.body);
                fetchOpts.body = bodyStr;
                // Set content-type if not already set
                const hdrs = fetchOpts.headers as Record<string, string>;
                if (!hdrs["Content-Type"] && !hdrs["content-type"]) {
                  hdrs["Content-Type"] = "application/json";
                }
              }

              const resp = await fetch(cfg.url, fetchOpts);

              const contentType = resp.headers.get("content-type") ?? "";
              let body: unknown;
              if (contentType.includes("application/json")) {
                body = await resp.json();
              } else {
                const text = await resp.text();
                // Cap response body at 50KB
                body = text.length > 50_000 ? text.slice(0, 50_000) + "...[truncated]" : text;
              }

              // Collect response headers
              const respHeaders: Record<string, string> = {};
              resp.headers.forEach((value, key) => {
                respHeaders[key] = value;
              });

              output = {
                type: "api",
                status: resp.status,
                statusText: resp.statusText,
                headers: respHeaders,
                body,
              };
              costCents = 0;

              // Treat 4xx/5xx as errors so retry logic can kick in
              if (!resp.ok) {
                throw new Error(
                  `API call to ${cfg.url} returned ${resp.status} ${resp.statusText}`,
                );
              }
            } finally {
              clearTimeout(timer);
            }
            break;
          }
          case "cli": {
            const cfg = resolvedInput as WorkflowStepCliConfig;
            if (!cfg.command) throw new Error("CLI step is missing a 'command' in config");

            // Basic security: block obviously destructive patterns
            const dangerousPatterns = [
              /\brm\s+(-rf?|--recursive)\s+\/\s*$/i,
              /\brm\s+(-rf?|--recursive)\s+\/\s/i,
              /\bmkfs\b/i,
              /\bdd\s+.*of=\/dev\//i,
              /:(){ :\|:& };:/,
              /\bfork\s*bomb\b/i,
            ];
            for (const pattern of dangerousPatterns) {
              if (pattern.test(cfg.command)) {
                throw new Error(
                  `CLI step blocked: command matches dangerous pattern — "${cfg.command.slice(0, 100)}"`,
                );
              }
            }

            const timeoutMs = (step.timeoutSeconds ?? 60) * 1000;
            const MAX_OUTPUT = 50 * 1024; // 50KB

            try {
              const stdout = execSync(cfg.command, {
                cwd: cfg.cwd || process.env.HOME || "/tmp",
                timeout: timeoutMs,
                maxBuffer: MAX_OUTPUT * 2,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
              });

              const trimmedStdout =
                stdout.length > MAX_OUTPUT
                  ? stdout.slice(0, MAX_OUTPUT) + "...[truncated]"
                  : stdout;

              output = {
                type: "cli",
                exitCode: 0,
                stdout: trimmedStdout,
                stderr: "",
              };
              costCents = 0;
            } catch (execErr: unknown) {
              const e = execErr as {
                status?: number;
                stdout?: string;
                stderr?: string;
                message?: string;
              };
              const stdoutStr = (e.stdout ?? "").toString();
              const stderrStr = (e.stderr ?? "").toString();

              output = {
                type: "cli",
                exitCode: e.status ?? 1,
                stdout:
                  stdoutStr.length > MAX_OUTPUT
                    ? stdoutStr.slice(0, MAX_OUTPUT) + "...[truncated]"
                    : stdoutStr,
                stderr:
                  stderrStr.length > MAX_OUTPUT
                    ? stderrStr.slice(0, MAX_OUTPUT) + "...[truncated]"
                    : stderrStr,
              };
              costCents = 0;

              // Non-zero exit is an error — let retry logic handle it
              throw new Error(
                `CLI command exited with code ${e.status ?? 1}: ${stderrStr.slice(0, 500) || stdoutStr.slice(0, 500)}`,
              );
            }
            break;
          }
          case "tool_use": {
            const cfg = resolvedInput as WorkflowStepToolUseConfig;
            if (!cfg.toolId) throw new Error("Tool use step is missing a 'toolId' in config");

            // Queue a heartbeat run for the workflow's agent
            const run = await db
              .select()
              .from(workflowRuns)
              .where(eq(workflowRuns.id, runId))
              .then((r) => r[0]);
            const agentId = run?.agentId;
            if (!agentId) {
              throw new Error("Tool use step failed: no agent assigned to the workflow run");
            }

            const wakeupRequest = await db
              .insert(agentWakeupRequests)
              .values({
                companyId: run.companyId,
                agentId,
                source: "automation",
                triggerDetail: "system",
                reason: `workflow_tool:${runId}:${step.stepIndex}`,
                payload: { toolId: cfg.toolId, params: cfg.params },
                status: "pending",
              })
              .returning()
              .then((rows) => rows[0]!);

            const hbRun = await db
              .insert(heartbeatRuns)
              .values({
                companyId: run.companyId,
                agentId,
                invocationSource: "automation",
                triggerDetail: "system",
                status: "queued",
                wakeupRequestId: wakeupRequest.id,
                contextSnapshot: {
                  source: "workflow",
                  workflowRunId: runId,
                  stepIndex: step.stepIndex,
                  toolId: cfg.toolId,
                  wakeReason: `Use tool: ${cfg.toolId}`,
                  ...(cfg.params ? { toolParams: cfg.params } : {}),
                },
              })
              .returning()
              .then((rows) => rows[0]!);

            output = {
              type: "tool_use",
              toolId: cfg.toolId,
              status: "queued",
              runId: hbRun.id,
            };
            costCents = 0;
            break;
          }
          case "workflow": {
            const cfg = resolvedInput as WorkflowStepWorkflowConfig;
            if (!cfg.workflowId) {
              throw new Error("Workflow step is missing a 'workflowId' in config");
            }

            // Get the current run to obtain companyId
            const currentRun = await db
              .select()
              .from(workflowRuns)
              .where(eq(workflowRuns.id, runId))
              .then((r) => r[0]);
            if (!currentRun) throw new Error("Current workflow run not found");

            // Trigger the nested workflow
            const nestedRun = await triggerRun(
              cfg.workflowId,
              currentRun.companyId,
              "event",
              {
                params: (cfg.params as Record<string, unknown>) ?? undefined,
                agentId: currentRun.agentId ?? undefined,
              },
            );

            // Poll for the nested workflow to complete
            const maxWaitMs = (step.timeoutSeconds ?? 600) * 1000;
            const pollIntervalMs = 3000;
            const deadline = Date.now() + maxWaitMs;
            let completedNestedRun: typeof currentRun | null = null;

            while (Date.now() < deadline) {
              await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
              const nr = await db
                .select()
                .from(workflowRuns)
                .where(eq(workflowRuns.id, nestedRun.id))
                .then((r) => r[0] ?? null);

              if (nr && (nr.status === "succeeded" || nr.status === "failed" || nr.status === "cancelled")) {
                completedNestedRun = nr;
                break;
              }
            }

            if (!completedNestedRun) {
              throw new Error(
                `Nested workflow ${cfg.workflowId} timed out after ${maxWaitMs / 1000}s (run: ${nestedRun.id})`,
              );
            }

            if (completedNestedRun.status === "failed") {
              throw new Error(
                `Nested workflow ${cfg.workflowId} failed: ${completedNestedRun.error ?? "unknown error"}`,
              );
            }

            if (completedNestedRun.status === "cancelled") {
              throw new Error(`Nested workflow ${cfg.workflowId} was cancelled`);
            }

            // Get the last step's output from the nested run
            const nestedStepRuns = await db
              .select()
              .from(workflowStepRuns)
              .where(eq(workflowStepRuns.workflowRunId, nestedRun.id))
              .orderBy(desc(workflowStepRuns.stepIndex));
            const lastStepOutput = nestedStepRuns[0]?.output ?? null;

            output = {
              type: "workflow",
              workflowId: cfg.workflowId,
              nestedRunId: nestedRun.id,
              status: completedNestedRun.status,
              output: lastStepOutput,
              totalCostCents: completedNestedRun.totalCostCents,
              totalDurationMs: completedNestedRun.totalDurationMs,
            };
            costCents = completedNestedRun.totalCostCents ?? 0;
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
