# Spicy Lyrics for Spicetify v3

Clean-history port of [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) to Spicetify's v3 module runtime and in-client Store format.

> Spicetify v3 is currently beta software. This port targets the published v3 module contract and requires the `stdlib` module declared in `metadata.json`.

## Build

Requires Node.js 24 and pnpm 10.28 or newer within the pnpm 10 release line.

```powershell
pnpm install
pnpm check
pnpm build
pnpm pack
```

The build is written to `dist/spicy-lyrics@7.0.0-beta.1/`; the packed Store artifact is a versioned ZIP with a printed SHA-256 checksum.

## Install online

After publishing `spicy-lyrics@7.0.0-beta.1.zip` as a GitHub release asset, replace `JosEffigy` with the repository owner's GitHub username:

```powershell
spicetify pkg install spicy-lyrics@7.0.0-beta.1 "https://github.com/JosEffigy/spicy-lyrics-v3/releases/download/v7.0.0-beta.1/spicy-lyrics@7.0.0-beta.1.zip"
spicetify pkg enable spicy-lyrics@7.0.0-beta.1
spicetify apply
```

The URL must point directly to the ZIP release asset, not the repository page.

## Install a local build

```powershell
spicetify pkg install spicy-lyrics@7.0.0-beta.1 ".\spicy-lyrics@7.0.0-beta.1.zip"
spicetify pkg enable spicy-lyrics@7.0.0-beta.1
spicetify apply
```

The module exposes the v3 `load(ctx)` lifecycle and registers cleanup with `ctx.defer`, allowing the runtime to unload or roll back the module.

## Port status

- TypeScript and the v3 module-standard error tier pass.
- The Store artifact builds and is structurally verified.
- The inherited feature code still uses classic `Spicetify.*` APIs and several Spotify DOM selectors. V3 currently provides compatibility shims for these, but the framework audit reports them as advisory coupling warnings.
- This has not been exercised in a live Spotify client. Treat `7.0.0-beta.1` as a source/build-valid beta, not runtime proof.

## License

AGPL-3.0-only. This is a derivative of Spicy Lyrics; upstream copyright and license terms are preserved in [LICENSE](LICENSE).
