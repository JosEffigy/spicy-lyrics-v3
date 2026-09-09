# Sakura Lyrics

An unofficial fork of [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) for Spicetify v3, maintained by [JosEffigy](https://github.com/JosEffigy).

**Spicy Lyrics was created by [Spikerko](https://github.com/Spikerko).** Sakura Lyrics builds on that work; it is not an official Spikerko release or an endorsed replacement. The original renderer, design and much of the feature code come from Spicy Lyrics.

This fork is **vibe-coded**: changes are developed with substantial AI assistance. Its focus is Japanese romaji—readings, small tsu, word spacing and karaoke segments—plus reducing unnecessary rendering work. Tests are not a guarantee of correct readings or bug-free playback. Live CPU/GPU savings have not been measured.

## Install online

Requires Spicetify v3. Store admission is pending review; the release can be installed directly:

```powershell
spicetify pkg install sakura-lyrics@7.2.0 "https://github.com/JosEffigy/spicy-lyrics-v3/releases/download/v7.2.0/sakura-lyrics@7.2.0.zip"
spicetify pkg enable sakura-lyrics@7.2.0
spicetify apply
```

If upgrading from this repository's old package, disable it first with
`spicetify pkg disable spicy-lyrics`. Do not enable both packages together.
Internal settings keys are retained; the repository URL stays the same.

## What changed

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

Output: `dist/sakura-lyrics@7.2.0/` and `sakura-lyrics@7.2.0.zip`.

## Credits and license

Original project and creator: **Spicy Lyrics by Spikerko**, with its upstream contributors.
Fork maintenance and AI-assisted changes: **JosEffigy**.
The listing preview is inherited Spicy Lyrics artwork, not an original Sakura design.

AGPL-3.0-only. Original copyright notices and the [license](LICENSE) are preserved.
