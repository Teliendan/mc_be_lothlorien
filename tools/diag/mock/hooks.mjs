// Node resolve hook: the packs import "@minecraft/server" and "@minecraft/server-ui"; map both to the mocks beside this file.
const MAP = {
  "@minecraft/server": new URL("./server.mjs", import.meta.url).href,
  "@minecraft/server-ui": new URL("./server-ui.mjs", import.meta.url).href,
};
export function resolve(specifier, context, next) {
  return MAP[specifier] ? { url: MAP[specifier], shortCircuit: true } : next(specifier, context);
}
