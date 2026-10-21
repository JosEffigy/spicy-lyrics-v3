# Sakura Lyrics

An unofficial fork of [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) for Spicetify v3, maintained by [JosEffigy](https://github.com/JosEffigy).

**Spicy Lyrics was created by [Spikerko](https://github.com/Spikerko).** Sakura Lyrics builds on that work; it is not an official Spikerko release or an endorsed replacement. The original renderer, design and much of the feature code come from Spicy Lyrics.

This fork is **vibe-coded**: changes are developed with substantial AI assistance. Its focus is Japanese romaji—readings, small tsu, word spacing and karaoke segments—plus reducing unnecessary rendering work. Tests are not a guarantee of correct readings or bug-free playback. Live CPU/GPU savings have not been measured.

## Install online

Requires Spicetify v3. Store admission is pending review; the release can be installed directly:

```powershell
spicetify pkg install sakura-lyrics@7.2.3 "https://github.com/JosEffigy/spicy-lyrics-v3/releases/download/v7.2.3/sakura-lyrics@7.2.3.zip"
spicetify pkg enable sakura-lyrics@7.2.3
spicetify apply
```

If upgrading from this repository's old package, disable it first with
`spicetify pkg disable spicy-lyrics`. Do not enable both packages together.
Internal settings keys are retained; the repository URL stays the same.

## What changed

### Japanese reading resolver (unreleased)

The working tree analyzes a complete line into words, grammatical parts and kana readings before assigning anything to karaoke timestamps. It retains dictionary alternatives, accepts matching supplied readings, and records unresolved words instead of fabricating readings. Negative endings and compound verbs are grouped from the Japanese analysis.

Settings → **Inspect Japanese readings** shows chosen kana, dictionary candidates, reading sources and fallback notes for each loaded line. This explains the analysis; it does not guarantee an ambiguous reading is correct. See [the resolver design](docs/japanese-reading-resolver.md).

### Direct romaji

Source readings are stored separately from generated output. The unreleased resolver checks automatic provider romaji against analyzed words and dictionary candidates. Matched direct-source lyrics retain their reading priority; unresolved words and names can also retain supplied readings with an explicit fallback note.

When synced Japanese lyrics lack complete supplied romaji, the client can search [LRCLIB](https://lrclib.net) using the track title and artist. It checks duration, line timing and broad phonetic agreement before accepting a result. This is conservative matching, not a guarantee of correct sung readings. Conflicting or mismatched results are skipped.

Accepted LRCLIB text appears only in romaji mode, with line-level highlighting and provider credit. The original Japanese view stays intact. Requests have a five-second timeout, a bounded cache and rate-limit backoff. Local imported lyrics are not searched.

- Phrase-based Japanese readings and word spacing, independent of karaoke timing.
- Small-tsu handling across segments, including half-width kana.
- Shared dictionary work, loading timeouts and fallbacks that keep lyrics visible.
- Fewer idle animation frames and redundant style writes.

Readings still depend on a dictionary. Unusual names, sung readings and word boundaries can be wrong; timing within a word is approximate. Lyrics still use upstream provider services, so availability depends on them. Fork update/support links point here.

## Build

Requires Node.js 24 and pnpm 10.

```powershell
pnpm install
pnpm check
pnpm build
pnpm run pack
pnpm run verify
```

Output: `dist/sakura-lyrics@7.2.3/` and `sakura-lyrics@7.2.3.zip`.

Production builds minify JavaScript and CSS while retaining license notices. Debug source maps stay in the local build directory and are excluded from release ZIPs. The development command remains unminified.

## Credits and license

Original project and creator: **Spicy Lyrics by Spikerko**, with its upstream contributors.
Fork maintenance and AI-assisted changes: **JosEffigy**.
The listing preview is inherited Spicy Lyrics artwork, not an original Sakura design.

AGPL-3.0-only. Original copyright notices and the [license](LICENSE) are preserved.
