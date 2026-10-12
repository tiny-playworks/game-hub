#!/bin/sh
# Only check/status are read-only. Activation requires an explicitly authorised deployment.
set -eu

fail() { echo "$*" >&2; exit 1; }
operation=${1:-}
base=${2:-}
release=${3:-}
url=${4:-}
case "$base" in /*) ;; *) fail 'An absolute release base is required' ;; esac
[ "$base" != / ] || fail 'Refusing root directory'
case "$operation" in stage|check|status|activate|rollback) ;; *) fail 'Usage: nas-release.sh stage|check|status|activate|rollback BASE [RELEASE_ID] [BASE_URL]' ;; esac

validate_id() {
  case "$1" in ''|*[!A-Za-z0-9_-]*) fail 'Invalid release ID' ;; esac
}

check_release() {
  validate_id "$1"
  directory="$base/releases/$1"
  [ -d "$directory" ] && [ ! -L "$directory" ] || fail 'Missing release directory'
  [ -f "$directory/index.html" ] && [ -f "$directory/release.json" ] && [ -f "$directory/release.sha256" ] || fail 'Missing entry or manifest'
  grep -F "\"releaseId\": \"$1\"" "$directory/release.json" >/dev/null || fail 'Release metadata mismatch'
  [ -s "$directory/release.sha256" ] || fail 'Empty manifest'
  while IFS= read -r line; do
    hash=${line%% *}
    file=${line#*  }
    [ "${#hash}" -eq 64 ] || fail 'Invalid checksum'
    case "$hash" in *[!a-f0-9]*) fail 'Invalid checksum' ;; esac
    case "$file" in ''|/*|*..*|*[!A-Za-z0-9_./-]*) fail 'Unsafe manifest path' ;; esac
    [ -f "$directory/$file" ] && [ ! -L "$directory/$file" ] || fail "Missing or linked resource: $file"
  done < "$directory/release.sha256"
  for extension in js css wasm; do
    grep -E "\.$extension\$" "$directory/release.sha256" >/dev/null || fail "Missing $extension resources"
  done
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$directory" && sha256sum -c release.sha256) || fail 'Checksum mismatch'
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$directory" && shasum -a 256 -c release.sha256) || fail 'Checksum mismatch'
  else fail 'sha256sum or shasum is required'; fi
}

atomic_link() {
  target=$1
  name=$2
  temporary="$base/.$name.$$"
  [ ! -e "$base/$name" ] || [ -L "$base/$name" ] || fail "$name must be a symlink, not an existing directory"
  ln -s "$target" "$temporary"
  case "$(uname -s)" in
    Linux) mv -fT "$temporary" "$base/$name" ;;
    Darwin) mv -fh "$temporary" "$base/$name" ;;
    *) rm "$temporary"; fail 'Unsupported atomic symlink platform' ;;
  esac
}

probe() {
  curl -fsS --connect-timeout 5 --max-time 10 "$url/healthz" >/dev/null &&
    curl -fsS --connect-timeout 5 --max-time 10 "$url/release.json" |
      grep -F "\"releaseId\": \"$release\"" >/dev/null
}

# Retain hashed resources for tabs opened before the current release switched.
retain_assets() {
  directory="$base/releases/$release"
  while IFS= read -r line; do
    file=${line#*  }
    case "$file" in static/*|*.wasm)
      destination="$base/assets/$file"
      mkdir -p "$(dirname "$destination")"
      if [ -e "$destination" ]; then
        [ ! -L "$destination" ] && cmp -s "$directory/$file" "$destination" || fail "Immutable resource collision: $file"
      else
        cp "$directory/$file" "$destination.tmp.$$"
        mv "$destination.tmp.$$" "$destination"
      fi
      ;;
    esac
  done < "$directory/release.sha256"
}

if [ "$operation" = stage ]; then
  validate_id "$release"
  mkdir -p "$base/releases"
  mkdir "$base/releases/$release" || fail 'Release already exists; use a new release ID'
  exit 0
fi
if [ "$operation" = status ]; then
  for name in current previous; do
    if [ -L "$base/$name" ]; then echo "$name: $(readlink "$base/$name")";
    else echo "$name: not configured"; fi
  done
  exit 0
fi
if [ "$operation" = check ]; then check_release "$release"; exit 0; fi

case "$url" in http://*|https://*) ;; *) fail 'A health-check base URL is required' ;; esac
command -v curl >/dev/null 2>&1 || fail 'curl is required'
mkdir "$base/.release-lock" || fail 'Another release operation is running; inspect a stale lock before removing it'
old=''
switched=0
completed=0
cleanup() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ "$switched" -eq 1 ] && [ "$completed" -eq 0 ]; then
    if [ -n "$old" ]; then atomic_link "$old" current;
    elif [ -L "$base/current" ]; then rm "$base/current"; fi
  fi
  rmdir "$base/.release-lock"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
if [ "$operation" = rollback ]; then
  [ -L "$base/previous" ] || fail 'No previous release to roll back to'
  release=$(readlink "$base/previous")
  case "$release" in releases/*) release=${release#releases/} ;; *) fail 'Unexpected previous pointer' ;; esac
fi
check_release "$release"
retain_assets
if [ -L "$base/current" ]; then old=$(readlink "$base/current"); fi
case "$old" in ''|releases/*) ;; *) fail 'Unexpected current pointer; inspect existing configuration' ;; esac
if [ -n "$old" ]; then validate_id "${old#releases/}"; fi
switched=1
atomic_link "releases/$release" current
if ! probe; then
  if [ -n "$old" ]; then atomic_link "$old" current;
  else rm "$base/current"; fi
  switched=0
  fail 'Health check failed; current pointer restored. Existing site was not modified.'
fi
if [ -n "$old" ] && [ "$old" != "releases/$release" ]; then atomic_link "$old" previous; fi
completed=1
echo "Active release: $release"
