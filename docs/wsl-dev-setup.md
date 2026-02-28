# WSL2 Dev Setup Notes

## Prerequisites (Ubuntu/Debian packages)

The Rust backend requires these system packages to compile:

```bash
sudo apt-get install -y libssl-dev pkg-config libclang-dev
```

- `libssl-dev` - OpenSSL headers for TLS compilation
- `pkg-config` - helps the build system locate OpenSSL
- `libclang-dev` - required by `bindgen` for SQLite (`libsqlite3-sys`)

## Cargo tooling

```bash
cargo install cargo-watch sqlx-cli
```

## WSL2 memory limits

WSL2 defaults to half the host RAM. With 16GB and Chrome running, the Rust debug build can get OOM-killed (SIGKILL, signal 9).

### Quick fix - limit parallel compile jobs

```bash
CARGO_BUILD_JOBS=2 pnpm run dev
```

If that still gets killed, drop to `CARGO_BUILD_JOBS=1`.

### Permanent fix - increase WSL memory and swap

Create or edit `C:\Users\<username>\.wslconfig`:

```ini
[wsl2]
memory=8GB
swap=4GB
```

Then restart WSL from PowerShell:

```powershell
wsl --shutdown
```

Reopen your terminal and run `pnpm run dev` normally.

## Running the dev server

```bash
source ~/.cargo/env   # if cargo isn't on PATH
pnpm run dev          # starts backend (cargo-watch) + frontend (Vite)
```

First build takes several minutes. Subsequent builds are incremental and much faster.

## Verification (onboarding flow)

After the dev server is running:

1. Open `http://localhost:<port>/` (port shown in terminal output)
2. Landing page shows agent/editor/sound selection
3. Click "Continue" - should go to `/workspaces/create`, NOT `/onboarding/sign-in`
4. Refresh - should stay on the main app (not redirected back to onboarding)
