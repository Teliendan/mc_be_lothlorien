# Sindarin voice phrases

Language provenance for the elf voice lines. Researched 2026-10-16 against
Eldamo's cited Tolkien material; not reviewed by a Sindarin specialist. Audio,
respelling and settings: [`SINDARIN_VOICE.md`](SINDARIN_VOICE.md). Pools and
triggers: [`SINDARIN_VOICE_EVENTS.md`](SINDARIN_VOICE_EVENTS.md).

Ordinary, meaningful elven speech replaces villager murmurs. Lines are short.
Wardens are elven guards, not the vanilla sculk Warden.

## Labels

- **T**: Tolkien-attested wording, including single attested words and
  imperatives. The game context is ours.
- **E**: an exact excerpt from a longer attested utterance.
- **N**: Neo-Sindarin, a modern composition or usage, mostly from Tolkien's
  vocabulary. A proposal, not a certified translation.

## Selected texts (20, all recorded)

| Sindarin | English | Label | Pool(s) |
| --- | --- | --- | --- |
| Mae govannen. | Well met. | T | opening_neutral |
| Suilad. | Greetings. | N (attested noun, modern salutation) | opening_neutral |
| Tolo. | Come. | T | opening_neutral |
| Mae govannen, mellon. | Well met, friend. | N | opening_warm |
| Suilad, mellon. | Greetings, friend. | N | opening_warm |
| Tolo, mellon. | Come, friend. | N | opening_warm |
| Ma! | Good! / That's right! | T | trade_positive, completion |
| Mae. | Excellent. | T | trade_positive, completion |
| Lasto. | Listen. | T | explain |
| Lasto beth lammen. | Listen to the word of my tongue. | E | explain |
| Tolo a lasto. | Come and listen. | N | explain |
| Caro mae. | Do well. | N | task_taken |
| Dandolo. | Come back. | N (reconstructed imperative) | task_taken |
| Mae garnen. | Well done. | N (*carnen* reconstructed) | completion |
| Avon. | I will not. | T | refuse_speak |
| Avam. | We will not. | T | refuse_speak |
| Daro! | Halt! | T | combat_start |
| Baw! | Don't! | T | combat_start |
| Avo garo! | Don't do it! | T | combat_start |
| Cuio mae. | Live well. | N | healing |

## Vocabulary bank (not recorded)

Candidates for later lines. Who / when is a suggestion.

| Sindarin | English | Label | Suggested use |
| --- | --- | --- | --- |
| Novaer. | Farewell; be well. | N | any elf, farewell |
| Tiro. | Look. | T | trader showing wares |
| Annon allen. | I thank you. | N | receiving a requested delivery |
| I loth bain. | The flower is beautiful. | N | gardener |
| Tiro i loth. | Look at the flower. | N | gardener |
| I gû maer. | The bow is good. | N | woodwright |
| Hithlain allen. | Elven rope for you. | N | woodwright |
| Calad allen. | Light for you. | N | lamplighter |
| Lacho calad! | Flame, light! | E | lamplighter, rare flourish |
| Tolo a daro. | Come and halt. | N | healer, calling a patient |
| Pedo. | Speak. | T | loremaster, inviting a report |
| Lasto i daur. | Listen to the forest. | N | loremaster, Harmony lesson |
| Mellon nín. | My friend. | N | newly trusted friend |
| Minno. | Enter. | E | warden admitting a visitor |
| Noro lim! | Run swiftly! | E | warden, escape danger |
| Drego! | Flee! | E | warden, urgent warning |
| Gurth an Glamhoth! | Death to the Orc-host! | T | warden, rare battle cry |

## Translation notes

- **Suilad** is Tolkien's noun for a greeting (King's Letter, SD/129). Using it
  as a bare "hello" is modern, hence N.
- **Ma** is attested as an approving interjection (PE17/162); no invented
  universal "yes". **Mae** is attested as "well; excellent, admirable"; its use
  as a reply is ours.
- **Avon**/**Avam** are refusals ("I/we won't"), not factual negatives. **Baw**
  is a sharp prohibition: refusals for traders, Baw for guards.
- **Mae garnen**, not *mae carnen*: Eldamo's recommended adverb-triggered soft
  mutation. Postverbal *mae* in **caro mae** and **cuio mae** stays unmutated
  under the same model.
- **Annon allen** uses a Neo-Sindarin thanking verb (*anna-* "give" is attested,
  the thanking sense is not). Eldamo prefers it to the older **Hannon le**.
  **Allen** "to/for you" is a modern dative, so every line with it is N.
- **I gû** softens *cû* "bow" after the article. **I loth bain** and **i gû maer**
  are statements with an omitted "is", so the adjectives stay unmutated (the noun
  phrases would be *vain*, *vaer*).
- **Hithlain** is attested grey elven rope, "mist thread". **Lacho calad** is a
  martial cry reused as a flourish. **Glamhoth** means Orcs ("din-horde");
  using it against all monsters is poetic adaptation, so not a default cry.
- Lines open or acknowledge; the localised UI still explains the task. No "well
  done" for merely reading. Hated players get civilian silence.

## Sources

Consulted 2026-10-16. Eldamo is Paul Strack's scholarly compilation, not Tolkien;
T/E claims rest on the primary references it cites.

- [Mae govannen](https://eldamo.org/content/words/word-2338511755.html): LotR/209, Letters/308, PE17/16-17, 157-158.
- [Imperatives](https://eldamo.org/content/words/word-3326716807.html): *tolo* VT44/25, *daro* LotR/342, *pedo*, *minno* LotR/305, *tiro* RGEO/64, *noro* LotR/213, *drego* UT/65.
- [Ma](https://eldamo.org/content/words/word-2354944799.html): PE17/162. [Mae](https://eldamo.org/content/words/word-3420722951.html): PE17/163.
- [Ava-, avon, avam, avo garo](https://eldamo.org/content/words/word-3865426267.html): PE17/143, WJ/371-372.
- [Suilad](https://eldamo.org/content/words/word-2372353107.html): SD/129.
- [Lasto beth lammen](https://eldamo.org/content/words/word-1341071759.html): LotR/307, PE17/45-46.
- [Lacho calad](https://eldamo.org/content/words/word-1991569541.html): UT/65. [Gurth an Glamhoth](https://eldamo.org/content/words/word-2627828621.html): UT/39.
- [Thanking verb](https://eldamo.org/content/words/word-2772556329.html): *annon allen*, *hannon le*.
- [Novaer](https://eldamo.org/content/words/word-3716135431.html), [carnen](https://eldamo.org/content/words/word-179318099.html): classified Neo-Sindarin.
- [Basic grammar](https://eldamo.org/content/words/word-1765108261.html): model for the N lines, speculative in parts. [Dandol-](https://eldamo.org/content/words/word-601692547.html): attested verb, not the imperative.
- [Word index](https://eldamo.org/content/word-indexes/words-s.html): *hithlain*, *loth*, *bain*, *cû*, *maer*, *calad*, *mellon*.
