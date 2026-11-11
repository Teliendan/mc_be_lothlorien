// Client-side translation: each player uses their selected game language.
// Object arguments remain RawMessages, allowing nested translated labels.
// A message without arguments omits `with` entirely: the engine rejects an empty container.
export function createMessages(prefix) {
  return function message(key, ...values) {
    if (values.length === 0) return { translate: prefix + key };
    const args = values.map(value => typeof value === "object" && value !== null ? value : { text: String(value) });
    return { translate: prefix + key, with: { rawtext: args } };
  };
}
