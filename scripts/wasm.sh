#!/usr/bin/env bash
# Refresh public/vale.wasm and lib/vendor/wasm_exec.js from a Vale checkout or a
# release archive (vale_<version>_wasm.tar.gz). Default: ../vale, built with
# `make wasm`.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-$here/../vale}"
# The loader is imported from lib/vendor and has to match the toolchain that
# built the module, so the two always move together.
if [[ -f "$src" && "$src" == *.tar.gz ]]; then
  tar -xzf "$src" -C "$here/public" vale.wasm
  tar -xzf "$src" -C "$here/lib/vendor" wasm_exec.js
elif [[ -d "$src" ]]; then
  (cd "$src" && make wasm)
  cp "$src/bin/vale.wasm" "$here/public/"
  cp "$src/bin/wasm_exec.js" "$here/lib/vendor/"
else
  echo "no Vale checkout or wasm archive at: $src" >&2; exit 1
fi
echo "public/vale.wasm: $(du -h "$here/public/vale.wasm" | cut -f1)"
