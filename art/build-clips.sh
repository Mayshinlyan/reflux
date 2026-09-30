#!/usr/bin/env bash
# Builds the pet's clips from the green-screen MP4s in art/originals/.
# Needs: ffmpeg and the libwebp tools (brew install ffmpeg webp).
# Run from anywhere: art/build-clips.sh
#
# The pet is a still image most of the time; these clips play once on a tap
# (react_*) or a stage-up (celebrate), then it returns to its still poster.
#
# Per clip: crop to the dog, key out the green and its spill, drop audio, resample,
# scale. The react clips crossfade their tail into their head so they end on the same
# pose they start on (the poster), with no jump back to the still.
#
# Every frame is a full keyframe on a transparent background. Partial frames that
# "dispose to background" flashed the background on some players.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=app/assets/images/pet
# One shared crop (in the 1280x720 originals) so every clip lines up. It fits the dog
# in every frame; the celebrate sparkles spread wider and are trimmed at the edges.
CROP="crop=600:700:380:0"
W=540 H=630 FPS=12 XF=6 Q=60
mkdir -p "$OUT"
KEY="chromakey=0x4DB932:0.13:0.06,despill=type=green"
DELAY=$((1000 / FPS))

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

keyed_frames() { # name original.mp4 [extra filters]
  mkdir -p "$work/$1"
  ffmpeg -v error -y -i "art/originals/$2" \
    -vf "fps=$FPS,$CROP,$KEY,scale=$W:$H:flags=lanczos,format=rgba${3:+,$3}" "$work/$1/f_%03d.png"
}

# Fades the picture out over the last EDGE px at the left and right, so sparkles that spread
# past the crop disappear softly instead of being cut off in a straight line. Top and bottom
# stay sharp: the ears and the landing paws reach those edges.
EDGE=60
EDGE_FADE="geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*min(1,min(X,W-1-X)/$EDGE)'"

close_loop() { # name: crossfades the last XF frames into the first XF, writes $work/loop_name
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

start_at() { # name frame: re-numbers a closed loop so it starts (and ends) on that frame
  local n i src
  n=$(ls "$work/loop_$1" | wc -l | tr -d ' ')
  mkdir -p "$work/start_$1"
  for ((i = 0; i < n; i++)); do
    src=$(( (i + $2 - 1) % n + 1 ))
    cp "$work/loop_$1/$(printf 'f_%03d.png' "$src")" "$work/start_$1/$(printf 'f_%03d.png' $((i + 1)))"
  done
}

webp() { # dir out.webp: plays once; every frame is a whole picture that replaces the last
  local frames=()
  for png in "$work/$1"/f_*.png; do
    # Lossy alpha (quality 30) is about half the size of lossless and looks the same on fur.
    cwebp -quiet -q "$Q" -alpha_q 30 -alpha_filter best "$png" -o "${png%.png}.webp"
    # +duration+x+y+dispose(0 = keep)-b (no blend): no partial frames to composite.
    frames+=(-frame "${png%.png}.webp" "+$DELAY+0+0+0-b")
  done
  webpmux "${frames[@]}" -loop 1 -bgcolor 0,0,0,0 -o "$OUT/$2"
}

keyed_frames happy dog_happy.mp4
keyed_frames sad dog_sad.mp4
keyed_frames celebrate dog_celebrate.mp4 "$EDGE_FADE"

close_loop happy
close_loop sad
# The sad clip opens on a neutral face and droops a moment later; start on the droopy
# look (frame 20 of the original at 12 fps, 14 after close_loop trims XF) so the still
# looks unwell.
start_at sad 14

webp loop_happy react_happy.webp
webp start_sad react_unwell.webp
webp celebrate celebrate.webp

# The still pet: the first frame of each react clip, so a tap starts from the same pose.
cwebp -quiet -q 80 -alpha_q 100 "$work/loop_happy/f_001.png" -o "$OUT/poster_happy.webp"
cwebp -quiet -q 80 -alpha_q 100 "$work/start_sad/f_001.png" -o "$OUT/poster_unwell.webp"

for clip in react_happy react_unwell celebrate; do
  frames=$(webpinfo "$OUT/$clip.webp" | grep -c "Chunk ANMF")
  echo "$clip: $frames frames, $((frames * DELAY)) ms"
done
ls -l "$OUT"
