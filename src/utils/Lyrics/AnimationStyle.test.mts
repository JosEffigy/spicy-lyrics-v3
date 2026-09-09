import { test } from "node:test";
import assert from "node:assert/strict";
import { setAnimationStyle } from "./AnimationStyle.ts";
test("settled frames skip writes but changed and externally reset values update", () => {
  const values = new Map<string, string>();
  let writes = 0;
  const element = {style: {
    getPropertyValue: (key: string) => values.get(key) ?? "",
    setProperty: (key: string, value: string) => { values.set(key, value); writes++; },
  }};
  for (let i = 0; i < 120; i++) setAnimationStyle(element, "--gradient-position", "100%");
  assert.equal(writes, 1);
  setAnimationStyle(element, "--gradient-position", "50%");
  values.clear();
  setAnimationStyle(element, "--gradient-position", "50%");
  assert.equal(writes, 3);
});
