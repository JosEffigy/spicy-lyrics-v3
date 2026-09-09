import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameLoop } from "./FrameLoop.ts";

test("idle, resume, repeated activation and disposal don't leak frames", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0, ticks = 0;
  const loop = createFrameLoop(() => ticks++, cb => {
    frames.set(++id, cb); return id;
  }, key => { frames.delete(key); });
  assert.equal(frames.size, 0);
  loop.setActive(true);
  loop.setActive(true);
  assert.equal(frames.size, 1);
  const [key, frame] = [...frames][0];
  frames.delete(key);
  frame(0);
  assert.equal(ticks, 1);
  assert.equal(frames.size, 1);
  loop.setActive(false);
  assert.equal(frames.size, 0);
  loop.setActive(true);
  loop.dispose();
  loop.setActive(true);
  assert.equal(frames.size, 0);
});
