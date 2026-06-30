#!/usr/bin/env bash
#
# Deploy Mission Control to the VPS from a COMMITTED git ref — never the dirty
# working tree. This closes the drift hole where `docker compose up -d --build`
# was run against hand-applied, uncommitted edits, so the live image could not
# be traced back to any commit.
#
# How it stays safe:
#   * `git archive <ref>` exports ONLY the committed tree into a clean build dir,
#     so uncommitted/VPS-only edits are physically excluded from the image.
#   * `-p mission-control` pins the compose project name, so the SAME container
#     and the SAME data volume (mission-control_mc-data) are reused — the SQLite
#     DB is never orphaned by building from a different directory.
#   * Only gitignored runtime files (.env) are carried into the build context;
#     every tracked file (incl. docker-compose.override.yml) comes from the ref.
#   * The deployed SHA is recorded in .deployed-sha so git and the running
#     artifact can always be reconciled.
#
# Usage:
#   scripts/deploy-vps.sh [git-ref]      # default: origin/main
#
# Env overrides: MC_REPO_DIR (/opt/mission-control), MC_BUILD_DIR (/opt/mc-build)
#
set -euo pipefail

REPO_DIR="${MC_REPO_DIR:-/opt/mission-control}"
PROJECT="mission-control"          # MUST match the existing volume: mission-control_mc-data
REF="${1:-origin/main}"
RUNTIME_FILES=(.env)               # gitignored files to carry into the clean build context

cd "$REPO_DIR"
git fetch origin --quiet
SHA="$(git rev-parse --verify "${REF}^{commit}")"
SHORT="${SHA:0:9}"

# ── No-revert guard (added 30 Jun 2026) ──────────────────────────────────────
# Refuse to deploy a ref that does NOT contain the currently-live commit — doing
# so silently REVERTS whatever is live (the multi-session deploy ping-pong bug
# that reverted three sessions' work on 30 Jun). Fail-closed: if we cannot prove
# the new ref is a clean forward step, abort and name the commits that would be
# lost. To roll back deliberately, set ALLOW_REVERT=1.
LIVE_SHA="$(tr -d '[:space:]' < "$REPO_DIR/.deployed-sha" 2>/dev/null)"
if [ -n "$LIVE_SHA" ] && [ "$LIVE_SHA" != "$SHA" ]; then
  if git merge-base --is-ancestor "$LIVE_SHA" "$SHA" 2>/dev/null; then
    : # live is an ancestor of the new ref → clean forward, proceed
  elif [ "${ALLOW_REVERT:-0}" = "1" ]; then
    echo "⚠ ALLOW_REVERT=1 — deploying ${SHORT} although it does not contain live ${LIVE_SHA:0:9}"
  else
    echo "✋ ABORT: ${REF} (${SHORT}) does NOT contain the live commit ${LIVE_SHA:0:9}." >&2
    echo "   Deploying it would REVERT these live commit(s):" >&2
    git log --oneline "${SHA}..${LIVE_SHA}" 2>/dev/null | sed 's/^/      /' >&2
    echo "   → Reconcile (merge the lineages) first, or set ALLOW_REVERT=1 to roll back on purpose." >&2
    exit 1
  fi
fi

BUILD_ROOT="${MC_BUILD_DIR:-/opt/mc-build}"
BUILD_DIR="${BUILD_ROOT}/${SHORT}"
echo "▶ Deploying ${PROJECT} @ ${REF} (${SHORT}) from the committed tree"

# Warn (do not block) if the live working tree carries uncommitted edits — they
# are intentionally NOT shipped, but the operator should know they exist.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠ working tree has uncommitted changes — they will NOT be deployed (building from ${SHORT}):"
  git --no-pager diff --stat | sed 's/^/    /'
fi

# Export ONLY the committed tree. The dirty working tree is never the build context.
rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR"
git archive "$SHA" | tar -x -C "$BUILD_DIR"

# Carry gitignored runtime files (secrets / local-only) into the build context.
for f in "${RUNTIME_FILES[@]}"; do
  if [ -f "$REPO_DIR/$f" ]; then
    mkdir -p "$BUILD_DIR/$(dirname "$f")"
    cp -a "$REPO_DIR/$f" "$BUILD_DIR/$f"
  else
    echo "  (runtime file $f not present — skipping)"
  fi
done

cd "$BUILD_DIR"
docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.override.yml up -d --build

# Record provenance so git and the running artifact never silently drift again.
echo "$SHA" > "$REPO_DIR/.deployed-sha"
printf 'deployed_at=%sZ ref=%s sha=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%S)" "$REF" "$SHA" >> "$REPO_DIR/.deploy-log"

# Health check (/ returns 307 → login redirect when healthy).
PORT_HOST="$(grep -E '^MC_PORT=' "$REPO_DIR/.env" 2>/dev/null | cut -d= -f2 || true)"
PORT_HOST="${PORT_HOST:-4000}"
sleep 6
curl -fsS -o /dev/null -w "✓ health: HTTP %{http_code} in %{time_total}s\n" "http://127.0.0.1:${PORT_HOST}/" \
  || echo "⚠ health check did not return 2xx/3xx — inspect: docker logs ${PROJECT}"

echo "✓ Deployed ${SHORT} (recorded in ${REPO_DIR}/.deployed-sha)"

# Keep only the 3 most recent build dirs.
ls -1dt "${BUILD_ROOT}"/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf || true

# Reclaim Docker build cache beyond 2GB so disk does not creep (VPS is disk-bound).
# Keeps recent cache for fast rebuilds; prunes the rest. Added 30 Jun 2026.
docker builder prune -f --keep-storage 2GB >/dev/null 2>&1 || true
echo "✓ build cache pruned (kept 2GB)"
