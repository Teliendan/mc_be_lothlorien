// Node module-loader hook: resolves @minecraft/server to voice_server_shim.mjs (the shared mock with the missing exports).
const SHIM = new URL("./voice_server_shim.mjs", import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@minecraft/server") return { url: SHIM, shortCircuit: true };
  return nextResolve(specifier, context);
}
