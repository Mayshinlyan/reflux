#!/usr/bin/env bash
# Builds the pet's animated WebP clips from the green-screen MP4s in art/originals/.
# Needs: ffmpeg (brew install ffmpeg) and img2webp (brew install webp).
# Run from anywhere: art/build-clips.sh
#
# Per clip: crop to the dog, key out the green and its spill, drop audio, resample, scale,
# then (idle clips only) crossfade the tail into the head so the loop has no jump.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=app/assets/images/pet
W=380 H=360 FPS=15 XF=8 Q=60
CROP="crop=760:720:270:0"                 # one shared crop; the celebrate sparkles are the widest
KEY="chromakey=0x4DB932:0.13:0.06,despill=type=green"
DELAY=$((1000 / FPS))

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

keyed_frames() { # name original.mp4
  mkdir -p "$work/$1"
  ffmpeg -v error -y -i "art/originals/$2" \
    -vf "fps=$FPS,$CROP,$KEY,scale=$W:$H:flags=lanczos,format=rgba" "$work/$1/f_%03d.png"
}

loopify() { # name: crossfades the last XF frames into the first XF, writes $work/loop_name
  local n
  n=$(ls "$work/$1" | wc -l | tr -d ' ')
  mkdir -p "$work/loop_$1"
  ffmpeg -v error -y -framerate "$FPS" -i "$work/$1/f_%03d.png" -filter_complex "\
[0]trim=start_frame=$((n - XF)):end_frame=$n,setpts=PTS-STARTPTS[t];\
[0]trim=end_frame=$XF,setpts=PTS-STARTPTS[h];\
[0]trim=start_frame=$XF:end_frame=$((n - XF)),setpts=PTS-STARTPTS[b];\
[t][h]blend=all_expr='A*(1-(N+1)/$XF)+B*((N+1)/$XF)'[x];\
[b][x]concat=n=2:v=1:a=0,format=rgba" "$work/loop_$1/f_%03d.png"
}

webp() { # dir loopcount out.webp
  img2webp -loop "$2" -d "$DELAY" -lossy -q "$Q" -m 6 "$work/$1"/f_*.png -o "$OUT/$3"
}

keyed_frames happy dog_happy.mp4
keyed_frames sad dog_sad.mp4
keyed_frames idle dog_idle.mp4
keyed_frames celebrate dog_celebrate.mp4

loopify happy
loopify sad
loopify idle

webp loop_happy 0 idle_happy.webp
webp loop_sad 0 idle_unwell.webp
webp loop_idle 0 idle_neutral.webp
webp celebrate 1 celebrate.webp

# Still frames for reduced motion and while a clip loads.
cp "$work/happy/f_001.png" "$OUT/poster_happy.png"
cp "$work/sad/f_001.png" "$OUT/poster_unwell.png"

ls -l "$OUT"
