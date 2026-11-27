#!/usr/bin/env bash
# Refresh public/vale.wasm and lib/vendor/wasm_exec.js, and record which Vale
# they are in vale.json. The source is a Vale release by version (3.29.0),
# which is what a release of the extension ships; or, for development, a
# release archive (vale_<version>_wasm.tar.gz) or a Vale checkout, built
# with `make wasm`. Default: ../vale.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-$here/../vale}"
releases="https://github.com/vale-cli/vale/releases/download"

# The loader is imported from lib/vendor and has to match the toolchain that
# built the module, so the two always move together.
unpack() {
  tar -xzf "$1" -C "$here/public" vale.wasm
  tar -xzf "$1" -C "$here/lib/vendor" wasm_exec.js
}

if [[ "$src" =~ ^v?([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  version="${BASH_REMATCH[1]}"
  archive="vale_${version}_wasm.tar.gz"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL --max-time 300 -o "$tmp/$archive" "$releases/v$version/$archive"
  curl -fsSL --max-time 60 -o "$tmp/checksums.txt" "$releases/v$version/vale_${version}_checksums.txt"
  (cd "$tmp" && grep " $archive\$" checksums.txt | shasum -a 256 -c -)
  unpack "$tmp/$archive"
elif [[ -f "$src" && "$src" =~ vale_([0-9]+\.[0-9]+\.[0-9]+)_wasm\.tar\.gz$ ]]; then
  version="${BASH_REMATCH[1]}"
  unpack "$src"
elif [[ -d "$src" ]]; then
  # A checkout is no release: like a development build of Vale, it meets
  # every package's floor.
  version="master"
  (cd "$src" && make wasm)
  cp "$src/bin/vale.wasm" "$here/public/"
  cp "$src/bin/wasm_exec.js" "$here/lib/vendor/"
else
  echo "not a Vale version, wasm archive, or checkout: $src" >&2; exit 1
fi

printf '{ "version": "%s" }\n' "$version" > "$here/vale.json"
echo "public/vale.wasm: Vale $version, $(du -h "$here/public/vale.wasm" | cut -f1)"
