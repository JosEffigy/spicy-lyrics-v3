// deno-lint-ignore-file no-async-promise-executor no-explicit-any
import { RetrievePackage } from "../ImportPackage.ts";

let Analyzer: any;
let initialization: Promise<void> | undefined;
let retryAfter = 0;
export const init = (): Promise<void> => {
  if (Analyzer !== undefined) {
    return Promise.resolve();
  }
  if (Date.now() < retryAfter) return Promise.reject(new Error("Japanese analyzer retry cooldown"));

  return initialization ??= (async () => {
    let packageTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        RetrievePackage("Kuromoji", "1.0.0", "js"),
        new Promise((_, reject) => {
          packageTimeout = setTimeout(() => reject(new Error("Japanese package loading timed out")), 15000);
        }),
      ]);
    } finally {
      clearTimeout(packageTimeout);
    }
    const deadline = Date.now() + 15000;
    while (!(window as any).kuromoji) {
      if (Date.now() >= deadline) throw new Error("Japanese tokenizer failed to initialize");
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error("Japanese dictionary loading timed out"));
    }, 15000);
    (window as any).kuromoji.builder({
      dicPath: "https://kuromoji.pkgs.spikerko.org",
    }).build((error: any, analyzer: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        return reject(error);
      }

      Analyzer = analyzer;
      resolve();
    });
    });
  })().catch((error) => {
    retryAfter = Date.now() + 30000;
    initialization = undefined;
    throw error;
  });
};
export const parse = (text = ""): Promise<any> => {
  if (Analyzer === undefined) return Promise.reject(new Error("Japanese analyzer is not initialized"));
  if (text.trim() === "") {
    return Promise.resolve([]);
  }

  const result = Analyzer.tokenize(text) as any[];
  for (const token of result) {
    token.verbose = {
      word_id: token.word_id,
      word_type: token.word_type,
      word_position: token.word_position,
    };
    delete token.word_id;
    delete token.word_type;
    delete token.word_position;
  }

  return Promise.resolve(result);
};
