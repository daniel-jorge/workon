import { EventEmitter } from "node:events";

// ink-testing-library v3 creates a fake Stdin that extends EventEmitter (not Readable).
// Ink v5 calls stdin.ref() and stdin.unref() when registering useInput handlers,
// but EventEmitter has no such methods. Patch the prototype here so all EventEmitter
// instances (including the fake Stdin) satisfy ink v5's requirements.
(EventEmitter.prototype as unknown as Record<string, unknown>)["ref"] ??= function (
  this: EventEmitter,
) {
  return this;
};
(EventEmitter.prototype as unknown as Record<string, unknown>)["unref"] ??= function (
  this: EventEmitter,
) {
  return this;
};
