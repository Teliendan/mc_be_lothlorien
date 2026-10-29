# Lothlórien: tester brief (pre-release 0.8.0)

## 1. Welcome

Thank you for helping! This is a **private test** of Lothlórien 0.8.0 for Minecraft Bedrock Edition. It adds a rare, peaceful Lothlórien forest biome: golden Mallorn trees, elven villages built in their crowns, gentle wildlife, and elves who remember how you treat their forest. It is a behavior pack plus a resource pack.

The wiki ([teliendan.com/wiki/lothlorien](https://teliendan.com/wiki/lothlorien/)) is still being set up and may be incomplete.

## 2. Install

1. Download `lothlorien-0.8.0.mcaddon` from the [Releases page](https://github.com/Teliendan/mc_be_lothlorien/releases). It is listed as a pre-release.
2. Open the file with Minecraft. It imports both packs.
3. Create a world and enable the Lothlórien **behavior pack**; the resource pack follows it.

Needs Bedrock Edition **1.26.50 or newer**. No experimental toggles.

If you have an older Lothlórien copy installed, remove it first (Settings > Storage). The new one has the same pack id.

## 3. World advice

- **Use a new world.** The biome and its buildings appear only in newly generated chunks. Adding the pack to an old world changes nothing in explored areas. If you try an existing world anyway, back it up first.
- **Finding the biome.** It is rare. Use `/locate biome lothlorien:lothlorien`: it points to the nearest part of the biome, often its edge, sometimes shallow water, so walk inland to see the centre. `/locate structure` does **not** find flower gardens or forest memorials; look for them in open, level woodland inside the biome.
- A **Creative scouting world** (same seed idea, or just a fresh one) is a good way to find the biome fast, then play Survival in another new world.

## 4. What to test

Play normally and tell us what feels wrong, broken, boring or unclear. Especially:

- **Survival.** Play a fresh Survival world as you would any other, not from Creative. Is it balanced? Do you get stuck anywhere?
- **The Loremaster.** Work through the full path to Elf-friend, including all 12 requests. Try talking to elves at low Harmony. If you can, have **two players use the same firefly**.
- **Translations.** If you speak one of these as a native language, please read the texts: Czech, Spanish (Spain), Spanish (Mexico), Portuguese (Portugal), Portuguese (Brazil), German, French, Polish. They are AI drafts and have not been reviewed by native speakers.
- **The land.** Is the biome too small or too big? What do caves under it look like? Do shrines, flower gardens, memorials and villages sit naturally in the terrain, or are they floating, buried or cut off?
- **Performance.** Especially on weaker devices and tablets: frame rate and lag near villages and large trees.

## 5. Known issues (no need to report)

- Mallorn and golden leaves flicker at some angles. This is z-fighting between leaf faces; the known fixes look worse.
- Where separate world generation starts overlap, a build can be cut off. The engine allows no better.
- Some vanilla features cannot be done for custom content on Bedrock (for example the axe swing when stripping logs, or a wall arm next to a Mallorn gate).
- Elves killed by zombies or illagers are **not** replaced. This is intended. (Reports of how it plays out are welcome, just not as a bug.)

## 6. How to report

Open a [GitHub issue](https://github.com/Teliendan/mc_be_lothlorien/issues) or write to [hello@teliendan.com](mailto:hello@teliendan.com). Please include:

- Minecraft version and device/platform.
- New or existing world.
- Coordinates (turn on Show Coordinates in the world settings).
- A screenshot or video.
- For errors or missing things, the **Content Log**: turn on the Content Log GUI under Settings > Creator, and note what it shows.

## 7. Thanks

Every report, even a small one, helps shape the release. Thank you for walking the golden woods with us.
