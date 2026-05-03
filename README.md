# AdCut Studio — 広告動画編集 × Adobe 連携 デモ

広告制作向けの動画編集 SaaS のランディング & 簡易エディタのデモページです。
ブラウザ上でテンプレ・字幕・カット編集を行い、Premiere Pro / After Effects へ
書き出して仕上げる、という想定のワークフローを表現しています。

## 構成

```
.
├── index.html   # ランディング + デモエディタ UI
├── styles.css   # スタイル
└── app.js       # デモエディタの操作ロジック
```

## 起動方法

ビルド不要の静的ページです。次のいずれかで開けます。

```bash
# 1) そのままブラウザで開く
open index.html        # macOS
xdg-open index.html    # Linux

# 2) 簡易サーバーを立てる
python3 -m http.server 8080
# → http://localhost:8080
```

## デモエディタでできること

- 左サイドの素材 / テキスト / テンプレタブの切り替え
- 素材をタイムラインのレーンへドラッグ & ドロップで配置
- 再生 / 一時停止と、タイムラインクリックでのシーク
- プレビューのアスペクト比切り替え (16:9 / 1:1 / 9:16)
- "Premiere Pro へ送る" / "After Effects へ送る" ボタン (デモトースト)

## 想定する Adobe 連携 (デモ)

- AdCut で組んだ編集データを `.prproj` / `.aep` / `.psd` として書き出し
- Creative Cloud Libraries 経由での素材同期
- Adobe Sensei による自動カット・自動カラー
- 仕上げ後のデータを再取り込みしてマルチサイズ書き出し

> 本ページは UI / UX デモ用であり、実際の Adobe 連携機能は実装していません。
