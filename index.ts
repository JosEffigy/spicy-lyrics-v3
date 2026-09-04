/*
 * Spicy Lyrics for the Spicetify v3 module runtime.
 * Original project: https://github.com/Spikerko/spicy-lyrics
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ModuleRuntimeContext } from "/modules/stdlib/mod.ts";

export async function load(ctx: ModuleRuntimeContext) {
  const { start } = await import("./src/app.tsx");
  await start(ctx);
}
