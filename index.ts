/**
 * pi-meep: audible cues for pi run state.
 *
 *   meep  - run finished successfully and pi is waiting for the operator
 *   error - run failed with no retries left and pi is waiting for the operator
 *   retry - an attempt failed and pi will retry automatically (shortest sound)
 *
 * Why not just `agent_end`: pi emits `agent_end` once per attempt, including
 * every failed attempt that it is about to auto-retry. Final sounds are played
 * on `agent_settled`, which fires exactly once when pi will not continue on its
 * own (no retry, compaction, or queued continuation pending).
 *
 * Extensions do not receive pi's internal `willRetry` flag or `auto_retry_*`
 * events, so the retry sound is played on `agent_end` using a prediction that
 * mirrors AgentSession._willRetryAfterAgentEnd(): retry enabled, attempts left,
 * error is retryable, and it is not a context overflow (handled by compaction).
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { isContextOverflow, isRetryableAssistantError } from "@earendil-works/pi-ai";
import { appendFileSync } from "node:fs";
import { ensureAllSounds, playSound, type SoundKind } from "./sounds.ts";

/** Set PI_MEEP_DEBUG=/path/to/log to record which sound each event produced. */
const DEBUG_LOG = process.env.PI_MEEP_DEBUG;

function debug(line: string): void {
  if (!DEBUG_LOG) return;
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore
  }
}

function play(kind: SoundKind, why: string): void {
  debug(`play ${kind}: ${why}`);
  playSound(kind);
}

function isAssistant(message: unknown): message is AssistantMessage {
  return (message as { role?: string } | undefined)?.role === "assistant";
}

function lastAssistantIn(messages: readonly unknown[]): AssistantMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isAssistant(messages[i])) return messages[i] as AssistantMessage;
  }
  return undefined;
}

function retrySettings(ctx: ExtensionContext): { enabled: boolean; maxRetries: number } {
  try {
    // Read fresh each time so /settings changes are honored. Read-only.
    return SettingsManager.create(ctx.cwd, undefined, {
      projectTrusted: ctx.isProjectTrusted(),
    }).getRetrySettings();
  } catch {
    return { enabled: true, maxRetries: 3 }; // pi defaults
  }
}

export default function (pi: ExtensionAPI) {
  /** Last assistant message of the current run (across retries/continuations). */
  let lastAssistant: AssistantMessage | undefined;
  /** Mirror of AgentSession._retryAttempt. */
  let retryAttempt = 0;
  /** The failed message for which we predicted (and announced) a retry. */
  let retryPendingFor: AssistantMessage | undefined;

  function resetRun(): void {
    lastAssistant = undefined;
    retryAttempt = 0;
    retryPendingFor = undefined;
  }

  pi.on("session_start", async () => {
    resetRun();
    try {
      ensureAllSounds();
    } catch {
      // Playback retries the write; never fail session start over a sound.
    }
  });

  pi.on("message_end", async (event) => {
    if (!isAssistant(event.message)) return;
    lastAssistant = event.message;
    // pi resets its retry counter on any non-error assistant message.
    if (event.message.stopReason !== "error") retryAttempt = 0;
  });

  pi.on("agent_end", async (event, ctx) => {
    const message = lastAssistantIn(event.messages) ?? lastAssistant;
    if (!message || message.stopReason !== "error") return;

    const settings = retrySettings(ctx);
    if (!settings.enabled || retryAttempt >= settings.maxRetries) return;
    if (isContextOverflow(message, ctx.model?.contextWindow ?? 0)) return;
    if (!isRetryableAssistantError(message)) return;

    retryAttempt++;
    retryPendingFor = message;
    play("retry", `attempt ${retryAttempt}/${settings.maxRetries}: ${message.errorMessage ?? "?"}`);
  });

  pi.on("agent_settled", async () => {
    const message = lastAssistant;
    const cancelledRetry = message !== undefined && message === retryPendingFor;
    resetRun();

    debug(`settled: stopReason=${message?.stopReason ?? "none"} cancelledRetry=${cancelledRetry}`);
    if (!message) return;
    // Esc/Ctrl-C: the operator is already at the keyboard.
    if (message.stopReason === "aborted") return;
    // We announced a retry for this exact failure but the run settled instead:
    // the operator aborted during the retry backoff. Stay quiet.
    if (cancelledRetry) return;

    if (message.stopReason === "error") play("error", message.errorMessage ?? "?");
    else play("meep", `stopReason=${message.stopReason}`);
  });
}
