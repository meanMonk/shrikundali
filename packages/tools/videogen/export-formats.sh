#!/usr/bin/env bash
# Re-export a HyperFrames master render (1080x1920, 9:16) into every ad-platform
# format we need. Run after `npm run render:<name>` has produced the master file.
#
# Usage: ./export-formats.sh output/video1-anchor-offer-master.mp4
set -euo pipefail

MASTER="${1:?Usage: export-formats.sh <path-to-master.mp4>}"
DIR="$(dirname "$MASTER")"
BASE="$(basename "$MASTER" -master.mp4)"

# 9:16 Reels/Story — the master is already this shape, just re-encode for delivery.
ffmpeg -y -i "$MASTER" -vf "scale=1080:1920" -c:v libx264 -pix_fmt yuv420p -c:a aac \
  "$DIR/$BASE-9x16.mp4"

# 1:1 feed — center-crop the vertical master to square.
ffmpeg -y -i "$MASTER" -vf "crop=1080:1080:0:420,scale=1080:1080" -c:v libx264 -pix_fmt yuv420p -c:a aac \
  "$DIR/$BASE-1x1.mp4"

# 4:5 feed
ffmpeg -y -i "$MASTER" -vf "crop=1080:1350:0:285,scale=1080:1350" -c:v libx264 -pix_fmt yuv420p -c:a aac \
  "$DIR/$BASE-4x5.mp4"

# 16:9 PMax/YouTube — pad instead of crop so nothing important gets cut off.
ffmpeg -y -i "$MASTER" -vf "scale=608:1080,pad=1920:1080:656:0:color=#1a0f2e" -c:v libx264 -pix_fmt yuv420p -c:a aac \
  "$DIR/$BASE-16x9.mp4"

echo "Exported: $DIR/$BASE-{9x16,1x1,4x5,16x9}.mp4"
