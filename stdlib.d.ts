export interface ModuleRuntimeContext {
  spotifyVersion: string;
  identifier: string;
  defer: (fn: () => void | Promise<void>) => void;
}
