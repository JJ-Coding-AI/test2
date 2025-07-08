# 将棋 AI アプリケーション

## セットアップ

1. 依存インストール
   ```bash
   pip install -r requirements.txt
   ```
2. `setup.sh` を実行し YaneuraOu と NNUE 評価関数を取得
   ```bash
   bash setup.sh
   ```
3. サーバー起動
   ```bash
   python ai_server.py
   # あるいは
   uvicorn ai_server:app --reload
   ```
4. ブラウザで `index.html` を開きます。

macOS では Homebrew で `brew install yaneuraou` も利用できます。`eval/` ディレクトリに NNUE ファイル `SuishoKai-NNUE.bin` を配置してください。
