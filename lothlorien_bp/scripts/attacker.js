// The player behind a hit: the direct attacker (melee; arrows already name their shooter), or the thrower of the
// projectile that dealt it. A thrown Grenade (gm:grenade_projectile) is its own blast's source, so its kills name the
// grenade; its projectile owner is the player. Read inside after events: the grenade stays valid for that tick.
const PLAYER_ID = "minecraft:player";

export function attackingPlayer(damageSource) {
  try {
    const direct = damageSource.damagingEntity;
    if (direct?.typeId === PLAYER_ID) return direct;
    const owner = (damageSource.damagingProjectile ?? direct)?.getComponent("minecraft:projectile")?.owner;
    return owner?.typeId === PLAYER_ID ? owner : undefined;
  } catch {
    return undefined; // projectile already gone
  }
}
