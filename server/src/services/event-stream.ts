import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AgentEventType, AgentTraceEvent } from "@paperclipai/shared";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "event-stream" });

// ---------------------------------------------------------------------------
// Event stream configuration
// ---------------------------------------------------------------------------

/** Directory where event stream JSONL files are stored. */
let _eventStreamDir: string | null = null;

/**
 * Configure the directory for event stream JSONL logs.
 * Must be called once at startup before any events are emitted.
 */
export function configureEventStreamDir(dir: string): void {
  _eventStreamDir = dir;
}

// ---------------------------------------------------------------------------
// Subscriber pattern — fan-out to multiple consumers
// ---------------------------------------------------------------------------

type EventSubscriber = (event: AgentTraceEvent) => void | Promise<void>;

const _subscribers: EventSubscriber[] = [];

/**
 * Subscribe to agent trace events.
 * Subscribers are called for every event (fan-out pattern).
 * Returns an unsubscribe function.
 */
export function subscribeToEvents(subscriber: EventSubscriber): () => void {
  _subscribers.push(subscriber);
  return () => {
    const idx = _subscribers.indexOf(subscriber);
    if (idx >= 0) _subscribers.splice(idx, 1);
  };
}

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

/**
 * Emit an agent trace event.
 *
 * The event is:
 * 1. Written to append-only JSONL file (durable storage)
 * 2. Published as a live event for real-time UI updates
 * 3. Fanned out to all registered subscribers (eval framework, activity log, etc.)
 */
export async function emitEvent(
  event: Omit<AgentTraceEvent, "id" | "timestamp">,
): Promise<AgentTraceEvent> {
  const fullEvent: AgentTraceEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  // 1. Append to JSONL file
  await writeEventToFile(fullEvent);

  // 2. Publish as live event for WebSocket consumers
  publishLiveEvent({
    companyId: fullEvent.companyId,
    type: "agent.trace",
    payload: fullEvent as unknown as Record<string, unknown>,
  });

  // 3. Fan-out to subscribers
  for (const subscriber of _subscribers) {
    try {
      await subscriber(fullEvent);
    } catch (err) {
      log.warn({ err, eventId: fullEvent.id }, "Event subscriber failed");
    }
  }

  return fullEvent;
}

// ---------------------------------------------------------------------------
// Convenience emitters for common event types
// ---------------------------------------------------------------------------

/** Emit a tool_start event when an agent begins using a tool. */
export function emitToolStart(
  companyId: string,
  agentId: string,
  toolName: string,
  opts?: { runId?: string; stepIndex?: number; metadata?: Record<string, unknown> },
): Promise<AgentTraceEvent> {
  return emitEvent({
    type: "tool_start",
    companyId,
    agentId,
    toolName,
    runId: opts?.runId,
    stepIndex: opts?.stepIndex,
    metadata: opts?.metadata,
  });
}

/** Emit a tool_end event when an agent finishes using a tool. */
export function emitToolEnd(
  companyId: string,
  agentId: string,
  toolName: string,
  durationMs: number,
  opts?: { runId?: string; stepIndex?: number; metadata?: Record<string, unknown> },
): Promise<AgentTraceEvent> {
  return emitEvent({
    type: "tool_end",
    companyId,
    agentId,
    toolName,
    durationMs,
    runId: opts?.runId,
    stepIndex: opts?.stepIndex,
    metadata: opts?.metadata,
  });
}

/** Emit a turn_end event when an agent completes a reasoning turn. */
export function emitTurnEnd(
  companyId: string,
  agentId: string,
  durationMs: number,
  opts?: { runId?: string; metadata?: Record<string, unknown> },
): Promise<AgentTraceEvent> {
  return emitEvent({
    type: "turn_end",
    companyId,
    agentId,
    durationMs,
    runId: opts?.runId,
    metadata: opts?.metadata,
  });
}

/** Emit a step_start event when a workflow step begins. */
export function emitStepStart(
  companyId: string,
  agentId: string,
  runId: string,
  stepIndex: number,
  metadata?: Record<string, unknown>,
): Promise<AgentTraceEvent> {
  return emitEvent({
    type: "step_start",
    companyId,
    agentId,
    runId,
    stepIndex,
    metadata,
  });
}

/** Emit a step_end event when a workflow step completes. */
export function emitStepEnd(
  companyId: string,
  agentId: string,
  runId: string,
  stepIndex: number,
  durationMs: number,
  metadata?: Record<string, unknown>,
): Promise<AgentTraceEvent> {
  return emitEvent({
    type: "step_end",
    companyId,
    agentId,
    runId,
    stepIndex,
    durationMs,
    metadata,
  });
}

// ---------------------------------------------------------------------------
// JSONL file writer
// ---------------------------------------------------------------------------

async function writeEventToFile(event: AgentTraceEvent): Promise<void> {
  const dir = _eventStreamDir ?? path.join(process.cwd(), "data", "events");

  try {
    await mkdir(dir, { recursive: true });

    // File name includes the date for daily rotation
    const date = event.timestamp.slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(dir, `agent-events-${date}.jsonl`);

    await appendFile(filePath, JSON.stringify(event) + "\n", "utf-8");
  } catch (err) {
    // Event logging must not crash the application
    log.error({ err, eventId: event.id }, "Failed to write event to file");
  }
}
