// Scripted arm swing for actions whose native click is cancelled (cancelling also cancels the engine's swing, and
// Script API 2.8.0 cannot start one). RP animations/swing.animation.json copies the vanilla swing formulas on its own
// 0.3 s clock (generator: .claude/skills/bedrock-scripting/scripts/gen_swing_animation.py). Call it from the
// privileged callback that performed the action, only when the action happened. Other players see it too.
const SWING = "animation.lothlorien.swing";
const OPTIONS = { controller: "lothlorien.swing", stopExpression: "query.all_animations_finished", blendOutTime: 0 };

export function swingArm(player) {
  player.playAnimation(SWING, OPTIONS);
}
