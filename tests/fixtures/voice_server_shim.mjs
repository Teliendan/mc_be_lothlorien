// The shared @minecraft/server mock plus the few enums/classes elven_warden.js and entity_util.js import at load; used by voice_glue.mjs and entity_util.mjs.
export * from "../../../../.claude/skills/bedrock-scripting/scripts/mock_server.mjs";
export const EntityInitializationCause = { Loaded: "Loaded" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
export class ItemStack {}
export const GameMode = { Survival: "Survival", Adventure: "Adventure", Creative: "Creative", Spectator: "Spectator" };
