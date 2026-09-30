#!/usr/bin/env bash
# Builds the pet's clips from the green-screen MP4s in art/originals/.
# Needs: ffmpeg and the libwebp tools (brew install ffmpeg webp).
# Run from anywhere: art/build-clips.sh
#
# The pet is a still image most of the time; these clips play once on a tap
# (react_*) or a stage-up (celebrate), then it returns to its still poster.
#
# Per clip: crop to the dog, key out the green and its spill, drop audio, resample,
# scale. The react clips play forward and then back, so they end on the exact pose they
# start on (the still).
#
# Every frame is a full keyframe on a transparent background. Partial frames that
# "dispose to background" flashed the background on some players.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=app/assets/images/pet
# One shared crop (in the 1280x720 originals) so every clip lines up. It fits the dog
# in every frame; the celebrate sparkles spread wider and are trimmed at the edges.
CROP="crop=600:700:380:0"
FPS=12
# The still is on screen most of the time, so it (and each tap clip's first and last frame,
# which are the still) is encoded near-losslessly. Frames in motion use a lighter setting,
# where compression is much harder to see.
STILL_Q="-q 90 -alpha_q 100"
MOTION_Q="-q 80 -alpha_q 60 -alpha_filter best"
mkdir -p "$OUT"
# Full source resolution (no downscale), keyed, then lightly sharpened: the source video is
# a little soft, and the pet is drawn larger than this on 3x screens.
KEY="chromakey=0x4DB932:0.13:0.06,despill=type=green,unsharp=5:5:0.7:5:5:0"
DELAY=$((1000 / FPS))

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

keyed_frames() { # name original.mp4 [extra filters]
  mkdir -p "$work/$1"
  ffmpeg -v error -y -i "art/originals/$2" \
    -vf "fps=$FPS,$CROP,$KEY,format=rgba${3:+,$3}" "$work/$1/f_%03d.png"
}

# Fades the picture out over the last EDGE px at the left and right, so sparkles that spread
# past the crop disappear softly instead of being cut off in a straight line. Top and bottom
# stay sharp: the ears and the landing paws reach those edges.
EDGE=60
EDGE_FADE="geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*min(1,min(X,W-1-X)/$EDGE)'"

boomerang() { # name first count: plays count frames forward from first, then back to first
  local i n=0
  mkdir -p "$work/boom_$1"
  # Forward first..first+count-1, then back down to first, so the clip ends exactly on the
  # frame it starts on (the still). No blended frames: blending two poses made a corrupt
  # last frame that flashed just before the pet returned to its still.
  for ((i = $2; i < $2 + $3; i++)); do
    n=$((n + 1)); cp "$work/$1/$(printf 'f_%03d.png' "$i")" "$work/boom_$1/$(printf 'f_%03d.png' "$n")"
  done
  for ((i = $2 + $3 - 2; i >= $2; i--)); do
    n=$((n + 1)); cp "$work/$1/$(printf 'f_%03d.png' "$i")" "$work/boom_$1/$(printf 'f_%03d.png' "$n")"
  done
}

webp() { # dir out.webp [still-ends]: plays once; every frame is a whole picture replacing the last
  local frames=() pngs=("$work/$1"/f_*.png) i last q
  last=$((${#pngs[@]} - 1))
  for i in "${!pngs[@]}"; do
    q=$MOTION_Q
    # A tap clip starts and ends on the still, so those frames get the still's quality.
    if [[ "${3:-}" == still-ends && ($i -eq 0 || $i -eq $last) ]]; then q=$STILL_Q; fi
    # shellcheck disable=SC2086 # $q is a list of cwebp flags
    cwebp -quiet $q "${pngs[$i]}" -o "${pngs[$i]%.png}.webp"
    # +duration+x+y+dispose(0 = keep)-b (no blend): no partial frames to composite.
    frames+=(-frame "${pngs[$i]%.png}.webp" "+$DELAY+0+0+0-b")
  done
  webpmux "${frames[@]}" -loop 1 -bgcolor 0,0,0,0 -o "$OUT/$2"
}

keyed_frames happy dog_happy.mp4
keyed_frames sad dog_sad.mp4
keyed_frames celebrate dog_celebrate.mp4 "$EDGE_FADE"

# About 1.75 s of motion each way. The sad clip opens on a neutral face and droops a moment
# later, so it starts on the droopy look (frame 20 of the original at 12 fps).
boomerang happy 1 21
boomerang sad 20 21

webp boom_happy react_happy.webp still-ends
webp boom_sad react_unwell.webp still-ends
webp celebrate celebrate.webp

# The still pet is the clip's own first frame, pixel for pixel, so starting and ending a
# clip never shows a jump.
cp "$work/boom_happy/f_001.webp" "$OUT/poster_happy.webp"
cp "$work/boom_sad/f_001.webp" "$OUT/poster_unwell.webp"

for clip in react_happy react_unwell celebrate; do
  frames=$(webpinfo "$OUT/$clip.webp" | grep -c "Chunk ANMF")
  echo "$clip: $frames frames, $((frames * DELAY)) ms"
done
ls -l "$OUT"
