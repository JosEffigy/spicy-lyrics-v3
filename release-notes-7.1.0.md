Spicy Lyrics 7.1.0 for the Spicetify v3 module framework.

- Fixes lyrics API version compatibility independently of the fork's version.
- Uses this fork's update and support links.
- Rebuilds incomplete Japanese karaoke readings using full vocal phrases.
- Lazily loads the Japanese dictionary and caches repeated conversions.

Japanese readings remain dictionary-based: unknown kanji and fully romanized but incorrect provider readings may remain. Timing within words spanning karaoke segments is approximate.

Validation: three mapping tests, TypeScript checks, module-standard error checks, build, and ZIP structure verification passed. The module standard retains 36 advisory warnings.

SHA-256: f3ed1e3dfb7364d4f84f93df97815161b8f0242c5fdc16b2cde2d762fd8739a6
