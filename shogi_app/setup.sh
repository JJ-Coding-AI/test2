#!/bin/bash
set -e
mkdir -p eval
if [ ! -f yaneuraou ]; then
  echo "Downloading YaneuraOu..."
  curl -L -o yaneuraou.tar.bz2 https://github.com/yaneurao/YaneuraOu/releases/latest/download/YaneuraOu-linux.zip || true
  # 展開処理（簡略化）
fi
if [ ! -f eval/SuishoKai-NNUE.bin ]; then
  echo "Downloading NNUE..."
  wget -O eval/SuishoKai-NNUE.bin https://example.com/SuishoKai-NNUE.bin || true
fi
chmod +x yaneuraou
