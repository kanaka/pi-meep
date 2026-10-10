/**
 * Exercise sounds.ts without pi (requires Node with TypeScript type stripping,
 * i.e. Node >= 22.18 / 23.6).
 *
 *   node scripts/render.ts           write meep/error/retry files to ./out/
 *   node scripts/render.ts --check   render in memory, validate, print durations
 *   node scripts/render.ts --play    play meep, retry, error in sequence
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderError, renderRetry, playSound } from "../sounds.ts";

function wavSeconds(buf: Buffer): number {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a WAV");
  }
  const byteRate = buf.readUInt32LE(28);
  const dataBytes = buf.readUInt32LE(40);
  if (dataBytes + 44 !== buf.length) throw new Error("bad WAV data size");
  return dataBytes / byteRate;
}

const mode = process.argv[2];
const sounds = { error: renderError(), retry: renderRetry() };

if (mode === "--play") {
  const order = ["meep", "retry", "error"] as const;
  order.forEach((kind, i) => setTimeout(() => {
    console.log(kind);
    playSound(kind);
  }, i * 1500));
} else {
  for (const [name, buf] of Object.entries(sounds)) {
    console.log(`${name}: ${wavSeconds(buf).toFixed(2)}s`);
  }
  if (sounds.retry.length >= sounds.error.length) throw new Error("retry must be shorter than error");
  if (mode !== "--check") {
    mkdirSync("out", { recursive: true });
    for (const [name, buf] of Object.entries(sounds)) writeFileSync(join("out", `${name}.wav`), buf);
    console.log("wrote out/error.wav out/retry.wav");
  }
  console.log("ok");
}
