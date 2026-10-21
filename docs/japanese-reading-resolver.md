# Japanese reading resolver

The resolver is local. It introduces no remote AI calls or extra dictionary downloads. It still uses Kuromoji/IPADIC; this change replaces the reading policy and data flow, not the dictionary. Cross-line semantic interpretation and audio recognition are not implemented.

## Data flow

1. Normalize the complete lyric line with a map back to original UTF-16 offsets. Karaoke boundaries are absent from this step.
2. Obtain the tokenizer's sentence-selected path. Retain same-surface dictionary candidates with matching grammatical categories and conjugation. Optional dictionary internals are isolated in JapaneseDictionary.ts; builds without them retain the selected path.
3. Group grammatical parts into display words. Keep stems, negative auxiliaries, suffixes, contracted forms and dependent compound verbs together. Preserve particles, punctuation and explicit source gaps.
4. Resolve kana readings. Annotations have precedence; automatic romaji is accepted when it agrees with a bounded sequence of dictionary candidates. Otherwise use the contextual path. Unknown words and proper names may retain supplied text as an identified fallback.
5. Romanize full pronunciation groups, then project them onto original timing fragments. Internal timing remains approximate. Provider-supported text retains provider fragment allocation; whitespace repair does not change pronunciation.

## Evidence and limits

JapaneseResolution.words includes original spans, grammatical parts, kana, romaji, candidate readings, the selection reason and whether multiple candidates were found. Alternatives are dictionary possibilities, not exhaustive interpretations or numerical confidence scores. The tokenizer path uses connection costs; it can still choose the wrong meaning.

outputSource distinguishes analyzed output, a dictionary-supported provider reading, direct-source text, and provider fallback. If supplied text cannot be word-aligned, the inspector identifies its word table as dictionary analysis rather than pretending it describes the supplied pronunciation.

Direct LRCLIB matches retain the existing recording/timing checks and source priority. They are not described as verified sung readings.

Explicit annotations are optional input on a line or vocal group:

```json
{"SakuraReadingAnnotations":[{"start":0,"end":2,"text":"明日","kana":"アス"}]}
```

Offsets refer to original UTF-16 text, not normalized text or romaji. An annotation must match a whole analyzed word or grammatical part, contain only kana, and not overlap another accepted annotation. Malformed or stale annotations are rejected with a diagnostic note. No song-specific rules are bundled.

## Runtime

Analysis promises are shared through a 256-line LRU cache; failures are evicted so retries can recover. Source readings and annotations are applied to copies of cached plans. Candidate enumeration is bounded to eight readings per part, 32 combinations per word and 64 matching states. No work runs on animation frames.

Candidate combinations, romanized forms and comparison keys are prepared once per cached line. Annotation conversions live only for the current request. Returned diagnostics are detached from the cache. Use the benchmark:japanese package script for a repeatable local benchmark; it does not measure Spotify frame rates.

Fresh, cached, imported, main and background lyrics pass through the resolver. Original source readings remain in existing provenance fields; generated readings are not recaptured as source. Direct-source display is resolved separately. Diagnostics are stored with each processed line and available in Settings.

## Evaluation

Run `node --test src/utils/Lyrics/*.test.mts`. Coverage includes the actual dictionary, lexical alternatives, compounds, inflections, contractions, normalization, timing splits, provider conflicts, direct-source exceptions, invalid annotations, missing dictionary internals, analyzer outages and source-span checks.

These checks establish behavior and invariants, not unrestricted song-reading accuracy. The inspector still needs a live Spotify UI check before release.
