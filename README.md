# ITクイズ メンテナンス用リポジトリ

[![Test and Release](https://github.com/hakatashi/it-quiz/actions/workflows/release.yaml/badge.svg?branch=main&event=push)](https://github.com/hakatashi/it-quiz/actions/workflows/release.yaml)

[![GitHub Release](https://img.shields.io/github/v/release/hakatashi/it-quiz)](https://github.com/hakatashi/it-quiz/releases/latest)
[![IT Quiz Count](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/hakatashi/aa01f1504a83ba2df07c92c6550d2f42/raw/it-quiz-count.json)](it-quiz.yaml)
[![News Quiz Count](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/hakatashi/aa01f1504a83ba2df07c92c6550d2f42/raw/news-quiz-count.json)](news-quiz.yaml)

アプリ「みんなで早押しクイズ」で出題したITクイズの過去問をまとめたものです。

見やすく編集したデータ版/紙版の問題集も合わせてご利用ください。

- データ版: https://hakatashi.booth.pm/items/5866918
- 紙版: https://hakatashi.booth.pm/items/5867193

## ファイル一覧

- [it-quiz.yaml](it-quiz.yaml): メインファイル。ITクイズが収録されています。
- [news-quiz.yaml](news-quiz.yaml): 時事問題です。時事性の強く出題価値の低くなった問題が収録されています。

## 問題ファイルの構造

問題リストがYAMLファイルで記述されています。YAMLは問題を表すデータの配列になっており、各キーは以下の意味を表します。

- `question`: 問題文。特に読み上げに適した問題文になるようにしています。また、ルビや強調する部分がHTMLでマークアップされています。
- `answer`: 正答。別解がある場合は特にメインのものを選んでいます。
- `paperQuestion` (optional): より「みんはや」出題時の問題文に近い問題文がある場合、それが記載されています。
- `alternativeAnswers` (optional): 別解がある場合、配列の形でそれが記載されています。
- `description` (optional): 問題に関する追加のメモがある場合、それが記載されています。

スキーマは [JSON Schema](https://json-schema.org/) で定義されています。[quizzes.schema.json](quizzes.schema.json)をご覧ください。

## 問題不備などを見つけた場合は

問題不備や誤植、より良い問題文にするための提案、別解の追加提案などがあれば、[GitHubのIssue機能](https://github.com/hakatashi/it-quiz/issues/new/choose)を使って新たなIssueを作成してください。

また、直接プルリクエストを作成しても構いません (マージされないこともあります)。
