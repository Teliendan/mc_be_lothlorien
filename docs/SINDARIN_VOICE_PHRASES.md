# Sindarin voice phrase candidates

2026-10-16. Text proposal for the owner's local voice generator. Target mod:
Lothlorien, Bedrock 1.26.52. Researched against Eldamo's cited Tolkien material;
not reviewed by a Sindarin specialist, generated as audio, or tested in game.
No pack changes. Playback situations below are design candidates, not a claim
that each trigger already exists.

The systematic event proposal is now in
[`SINDARIN_VOICE_EVENTS.md`](SINDARIN_VOICE_EVENTS.md). Use that mapping for
production scope; the larger table below remains a vocabulary/candidate bank.

The joke is ordinary, meaningful elven speech taking the place of villager
murmurs. Prefer brief, conversational delivery. The loremaster teaches and gives
requests; the gardener, woodwright, healer and lamplighter trade and receive
deliveries. Wardens are elven guards, not the vanilla sculk Warden.

## Evidence labels

- **T**: Tolkien-attested Sindarin wording, including individually attested words
  and imperative forms. The proposed game context is ours.
- **E**: an exact excerpt from a longer Tolkien-attested Sindarin utterance.
  The shortened line and its new context are our selection.
- **N — Neo-Sindarin**: a modern composition or conventional modern usage.
  Most use Tolkien's vocabulary, but the complete line/use is not attested.
  These are proposals, not certified translations.

"Pure Sindarin" cannot supply a full modern shop/quest conversation without
reconstruction. The T/E rows are the conservative core. N is deliberately broad:
new syntax, new inflection and newly coined vocabulary are all disclosed.
English gives the spoken meaning rather than inventing an elaborate English line
behind a one-word Sindarin response.

## Candidate table

| Who | When | What (English) | What (Sindarin) |
| --- | --- | --- | --- |
| Any elf | Neutral greeting | Well met. | **Mae govannen.** — T |
| Any elf | Alternate greeting | Greetings. | **Suilad.** — N: attested noun, modern standalone salutation |
| Any elf | Greeting a recognised friend | Well met, friend. | **Mae govannen, mellon.** — N |
| Any elf | Friendly farewell | Farewell; be well. | **Novaer.** — N |
| Traders | Opening an interaction, inviting closer | Come. | **Tolo.** — T |
| Traders | Showing their wares | Look. | **Tiro.** — T |
| Traders / loremaster | Trade approved, delivery accepted, or deed acknowledged | Good! / That's right! | **Ma!** — T |
| Traders | Alternate approving response | Excellent. | **Mae.** — T |
| Traders | Receiving a requested delivery | I thank you. | **Annon allen.** — N: reconstructed thanking verb |
| Traders | Refusing service to a shunned player | I will not. | **Avon.** — T |
| Traders / loremaster | Parting, or asking the player to return with a task | Come back. | **Dandolo.** — N: reconstructed imperative of attested *dandol-* |
| Gardener | Proudly showing a flower | The flower is beautiful. | **I loth bain.** — N |
| Gardener | Alternate stock remark | Look at the flower. | **Tiro i loth.** — N |
| Woodwright | Proudly showing the bow | The bow is good. | **I gû maer.** — N |
| Woodwright | Selling elven rope | Elven rope for you. | **Hithlain allen.** — N |
| Lamplighter | Selling a lantern | Light for you. | **Calad allen.** — N |
| Lamplighter | Rare flourish while tending a light | Flame, light! | **Lacho calad!** — E |
| Healer | Asking a patient to approach and stop | Come and halt. | **Tolo a daro.** — N |
| Healer | Finishing a healing blessing | Live well. | **Cuio mae.** — N |
| Loremaster | Beginning a lesson, short variant | Listen. | **Lasto.** — T |
| Loremaster | Beginning a lesson, longer variant | Listen to the word of my tongue. | **Lasto beth lammen.** — E |
| Loremaster | Alternate invitation to a lesson | Come and listen. | **Tolo a lasto.** — N |
| Loremaster | Inviting the player to speak or report | Speak. | **Pedo.** — T |
| Loremaster | Giving a deed task | Do well. | **Caro mae.** — N |
| Loremaster | Introducing the Harmony lesson | Listen to the forest. | **Lasto i daur.** — N |
| Loremaster | Praising a completed deed | Well done. | **Mae garnen.** — N: *carnen* is reconstructed |
| Loremaster | Acknowledging a newly trusted friend | My friend. | **Mellon nín.** — N |
| Warden | Warning a player to stop | Halt! | **Daro!** — T |
| Warden | Sharp prohibition | Don't! | **Baw!** — T |
| Warden | Warning against a harmful action | Don't do it! | **Avo garo!** — T |
| Warden | Welcoming an authorised visitor into a village, if implemented | Enter. | **Minno.** — E |
| Warden | Warning a player to escape danger | Run swiftly! | **Noro lim!** — E |
| Warden | Urgent alternate warning | Flee! | **Drego!** — E |
| Warden | Optional, rare battle cry | Death to the Orc-host! | **Gurth an Glamhoth!** — T |

## Translation and delivery notes

- **Suilad** is Tolkien's noun for a greeting, attested in the King's Letter
  (SD/129). Bare spoken "hello" is a modern application, so it is labelled N.
- **Ma** is expressly attested as an approving interjection (PE17/162), avoiding
  an invented universal Sindarin "yes". **Mae** is attested as "well; excellent,
  admirable"; its conversational placement here is a proposed use.
- **Avon** is refusal ("I won't"), not a factual negative. **Baw** is a sharp
  prohibition. Keep the former for refusing service and the latter for guards.
- **Annon allen** uses a Neo-Sindarin "give thanks" verb; ordinary *anna-* "give"
  is Tolkien-attested, but that does not attest the thanking sense. Eldamo
  recommends this modern convention over **Hannon le**, another, older
  Neo-Sindarin construction. Neither is pure Tolkien Sindarin.
- **Mae garnen**, not *mae carnen*, follows Eldamo's recommended adverb-triggered
  soft mutation. The participle *carnen* itself is Neo-Sindarin. Postverbal *mae*
  in **caro mae** and **cuio mae** is left unmutated under the same grammar model.
- In **i gû**, *cû* "bow" is softened after the article. **I loth bain** and
  **i gû maer** are statements with an omitted "is", so their predicate
  adjectives remain unmutated. They are not the noun phrases "beautiful flower"
  and "good bow" (which would have *vain* and *vaer*).
- **Allen** "to/for you" is a modern dative formation; every line using it is N.
  **Hithlain** is an attested name for grey elven rope, literally "mist thread".
- **Lacho calad** comes from a martial cry, reused as a rare lamplighter flourish.
  **Glamhoth** means Orcs, literally "din-horde"; applying the battle cry to
  Minecraft monsters would be a poetic adaptation, not their literal species.
- Keep lore clips as short openings/acknowledgements; English/localised UI
  continues to explain the actual task. Do not play "well done" on mere reading
  or opening a menu. Hated players retain the established civilian silence.
- Rotate by situation. A shared greeting pool does not make approval, refusal
  and thanks interchangeable. Wardens should speak rarely; battle cries need
  separation from individual arrow shots.
- Before audio production, prepare a separate pronunciation sheet. Preserve
  vowel length, doubled consonants and stress. For this initial set, useful
  examples are go-VAN-nen, LAS-to, PE-do and TO-lo. Listen to the output rather
  than treating ordinary-language transcription as a Sindarin acceptance test.

## Sources and confidence

Sources consulted 2026-10-16. Eldamo is Paul Strack's scholarly compilation and
analysis, not Tolkien himself; T/E claims rely on the primary references it
identifies. Research order here concerns Tolkien's language, not a Bedrock
component or engine issue, so a Minecraft changelog does not resolve it.

- [Mae govannen](https://eldamo.org/content/words/word-2338511755.html):
  LotR/209, Letters/308, PE17/16-17, 157-158.
- [Sindarin imperatives](https://eldamo.org/content/words/word-3326716807.html):
  attested forms and primary references for the short commands, including
  *tolo* (VT44/25), *daro* (LotR/342), *pedo* and *minno* (LotR/305), *tiro*
  (RGEO/64), *noro* (LotR/213), *drego* (UT/65).
- [Ma](https://eldamo.org/content/words/word-2354944799.html): PE17/162.
  [Mae](https://eldamo.org/content/words/word-3420722951.html): PE17/163 and others.
- [Ava- and avon](https://eldamo.org/content/words/word-3865426267.html):
  PE17/143, WJ/371-372; also *avo garo*.
- [Suilad](https://eldamo.org/content/words/word-2372353107.html): SD/129.
- [Moria gate utterance](https://eldamo.org/content/words/word-1341071759.html):
  *lasto beth lammen*, LotR/307, PE17/45-46.
- [Light/night cry](https://eldamo.org/content/words/word-1991569541.html): UT/65.
  [Orc-host cry](https://eldamo.org/content/words/word-2627828621.html): UT/39.
- [Neo-Sindarin thanking verb](https://eldamo.org/content/words/word-2772556329.html):
  history and reconstruction of *annon allen* and *hannon le*.
- [Novaer](https://eldamo.org/content/words/word-3716135431.html) and
  [carnen](https://eldamo.org/content/words/word-179318099.html): explicitly
  classified as Neo-Sindarin.
- [Basic grammar](https://eldamo.org/content/words/word-1765108261.html):
  modern grammar model used for the N compositions; explicitly speculative in
  parts. [Dandol-](https://eldamo.org/content/words/word-601692547.html):
  attested verb, not attestation of the proposed imperative.
- [Sindarin word index](https://eldamo.org/content/word-indexes/words-s.html):
  pointers for *hithlain*, *loth*, *bain*, *cû*, *maer*, *calad*, *mellon* and
  other inherited vocabulary; N combinations remain our compositions.

Next review: choose the lines, obtain specialist checking for the selected N
lines if desired, then prepare pronunciation and voice takes. No sounds have
been generated or deployed by this phrase-table task.
