#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

SIZES=(10 100 500 1000 5000)
LANGS=(ts tsx md)
RUNS=20

echo "=== Shiki highlight benchmark: cold start (worker + grammar load + tokenize) ==="
echo

for lang in "${LANGS[@]}"; do
  for size in "${SIZES[@]}"; do
    echo "--- $lang $size lines (cold) ---"
    hyperfine \
      --runs "$RUNS" \
      --warmup 1 \
      --style basic \
      "bun script/benchmark-highlight.ts ${size} ${lang} cold"
    echo
  done
done

echo "=== Shiki highlight benchmark: warm worker (grammar loaded, tokenize only) ==="
echo

for lang in "${LANGS[@]}"; do
  for size in "${SIZES[@]}"; do
    echo "--- $lang $size lines (warm-worker) ---"
    hyperfine \
      --runs "$RUNS" \
      --warmup 1 \
      --style basic \
      "bun script/benchmark-highlight.ts ${size} ${lang} warm-worker"
    echo
  done
done

echo "=== Shiki highlight benchmark: cached (cache lookup) ==="
echo

for lang in "${LANGS[@]}"; do
  for size in "${SIZES[@]}"; do
    echo "--- $lang $size lines (cached) ---"
    hyperfine \
      --runs "$RUNS" \
      --warmup 1 \
      --style basic \
      "bun script/benchmark-highlight.ts ${size} ${lang} cached"
    echo
  done
done
