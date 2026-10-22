#!/usr/bin/env bash
# Probe-Reel "Er meldet sich": vier Szenen-Posts nacheinander, Jingle nur am Ende. Ergebnis: probe-mini-szene/reel.mp4
set -euo pipefail
HIER=$(cd "$(dirname "$0")" && pwd); AP="$HIER/../autopilot"; TB="$HIER/../tagebuch"
n=$(jq length "$HIER/szenen.json"); : > "$HIER/liste.txt"
cp "$TB/eintraege.json" "$HIER/eintraege.bak"
for k in $(seq 0 $((n-1))); do
  id="probe-mini-$k"; mkdir -p "$TB/$id"
  jq ".[$k] + {id:\"$id\",datum:\"2026-10-23\",slot:\"16\"}" "$HIER/szenen.json" > "$TB/$id/eintrag.json"
  node "$AP/render.mjs" "$id"
  if [ "$k" -lt $((n-1)) ]; then JINGLE=aus node "$AP/video.mjs" "$id"; else JINGLE=an node "$AP/video.mjs" "$id"; fi
  cp "$TB/$id/reel.mp4" "$HIER/teil-$k.mp4"; echo "file 'teil-$k.mp4'" >> "$HIER/liste.txt"
  rm -rf "$TB/$id"
done
mv "$HIER/eintraege.bak" "$TB/eintraege.json"
cd "$HIER" && ffmpeg -y -loglevel error -f concat -safe 0 -i liste.txt -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 reel.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 reel.mp4
