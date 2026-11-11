// One entityLoad and one entitySpawn subscription for the whole pack; those events take no filter in 2.8.0.
// Routes are keyed by entity type id; a handler only sees entities of the types it registered for. Handlers of one event
// run in registration order and are isolated: a throwing handler never stops the next one.
export function createEntityRouter(world, warn = message => console.warn(message)) {
  const routes = { load: new Map(), spawn: new Map() };
  let subscribed = false;
  function dispatch(map, event) {
    let handlers;
    try { handlers = map.get(event.entity.typeId); } catch { return; } // removed before delivery
    if (!handlers) return;
    for (const handler of handlers) {
      try { handler(event); } catch (error) { warn(`[lothlorien] entity event: ${error}`); }
    }
  }
  function on(types, handlers) {
    if (!subscribed) {
      subscribed = true;
      world.afterEvents.entityLoad.subscribe(event => dispatch(routes.load, event));
      world.afterEvents.entitySpawn.subscribe(event => dispatch(routes.spawn, event));
    }
    for (const type of [].concat(types)) for (const kind of ["load", "spawn"]) {
      if (!handlers[kind]) continue;
      if (!routes[kind].has(type)) routes[kind].set(type, []);
      routes[kind].get(type).push(handlers[kind]);
    }
  }
  function reset() { routes.load.clear(); routes.spawn.clear(); subscribed = false; }
  return { on, reset };
}
