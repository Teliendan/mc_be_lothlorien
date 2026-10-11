# M3 shops: acceptance and regression checklist

Built 2026-10-11; implementation commit: `Implement M3 elven shops and request trade flow`.
Offline checks cover rules, generated assets, localization and event/timer glue.
Owner accepted M3 on 2026-10-11: "It all works" (commit 7f86c87), target Bedrock
1.26.52, server 2.8.0, server-ui 2.1.0. Individual engine-question answers were
not recorded separately. The checklist below remains useful for regressions.
Follow-up 9cdd1a0, `Explain the second elf click on the Trade button`, adds grey
guidance after a newline in the label, matching the Loremaster's quest-status
button. The owner reports that the quest status appears on hover; confirm that
hovering Trade likewise shows "Then click the elf again".

Leave and re-enter the world after deployment. Existing M1 elves gain shops;
M3 needs no new world. A village generated before M1 has no civilian elves.

Commands:

```text
/scriptevent lothlorien:harmony 10
/scriptevent lothlorien:harmony 5
/scriptevent lothlorien:harmony -5
/scriptevent lothlorien:harmony -20
/scriptevent lothlorien:harmony -40
/scriptevent lothlorien:renown points 0
/scriptevent lothlorien:renown points 3
/scriptevent lothlorien:renown points 8
/scriptevent lothlorien:renown points 15
/scriptevent lothlorien:trade
```

The Harmony values above select Friend, Guest, Uneasy, Shunned and Hated.
For a gardener request, use `renown chapter 3`, then `renown offer g_bonemeal`
(the same scriptevent prefix), and accept at the Loremaster.

| Check | Expected |
|---|---|
| Guest, points 0, gardener | Native Gardener screen. Acorns 1 emerald -> 2, Elanor/Niphredil 1 -> 3, golden fern 1 -> 4, Athelas 2 -> 1. Buys: bone meal/seeds 32 -> 1 emerald, flowers 8 -> 1. |
| Guest, points 3 then 8 | Blossom and corn seed unlock at 3; nectar bloom at 8 (4 emeralds). Woodwright adds rope at 3, arrows wait for M5. |
| Friend, points 15, healer | Healing 2 emeralds, Regeneration 4, Slow Falling 3, Miruvor 8. Check names/icons, then drink each potion for the right effect. |
| Uneasy, each shop | Only starting stock, higher prices: acorn 1 -> 1, logs 1 -> 4. |
| Shunned/Hated, including matching request | Refusal chat, no form/screen; no Trade prompt once the table updates. |
| Change band and click before the next half-second update | Mismatch cancels, chat asks for another use, next click shows correct prices. |
| Matching gardener request, lacking items | Request/progress form with Trade and Farewell, no Hand over. |
| Matching request with 16 bone meal | Hand over appears and completes the request as in M2. Later clicks trade directly. |
| Select Trade, then click within 10 seconds | Native trade screen. Close and click again: request form. Select Trade, wait over 10 seconds: request form. |
| Hold use on form/native trade click | No repeated forms/chat and no indefinitely renewable Trade pass. |
| Lead/name tag on a trader | Leash/rename normally; no trade screen. |
| Loremaster/warden | Loremaster dialog unchanged; neither trades. |
| Sell 30 bone-meal stacks, buy 20 log offers | No price drift, locks, restocking, XP or levelling. |
| Open native screen | Elf stops and faces the trading player. |
| Two players with different bands/ranks | Nearest sets prices. A trading pins A's prices while near, even when B comes closer. B's mismatched click swaps and asks for another use. Pin releases when A leaves six blocks or after 30 seconds. |
| Led-away elf, reload/join after unused pass | Transported elf still trades. Reload/rejoin does not keep a stale request bypass. |
| Czech locale | Profession title, chat, Trade button translated. |

For future engine investigations, distinguish these cases:

1. Does the before-interaction event fire for native trades, and does cancellation stop the screen?
2. Does a matching delivery interact open the form, and does the pass tag allow the native screen?
3. Does `persist_trades: false` rebuild prices/stock after component-group changes?
4. Does changing the table with a screen open close it, keep old offers or update live?
5. Does `set_potion` produce the right potion? If not, test item data suffixes 21/28/40.
6. Does Hero of the Village change prices? Does the single tier show an unwanted level badge?
7. Do lead and name tag work while a trade table is present?

Balance note: nectar bloom production paying for itself is intended production,
not a buy/sell arbitrage loop. Final items and Galadhrim arrows are absent until M5.
