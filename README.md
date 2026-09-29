# Zero UI XR - Generative AI Shopping Assistant

スーパーでの買い物を想定したZero UI XRプロトタイプです。

## 構成

Camera → Browser → `/api/analyze` → OpenAI Responses API → Structured JSON → 商品情報UI

OpenAIの画像入力とStructured Outputsを使い、カメラ画像から「どの商品に注目しているか」「何をしているか」「購入を検討している可能性があるか」を推定します。

## 現在の対象商品

- りんご
- アボカド
- 卵

商品を背景として認識しただけではUIを表示せず、AIが商品への注目を推定し、同じ商品への注目が複数回連続して確認された場合に商品情報UIを表示します。

## UIの内容

- 商品名
- 栄養価（可食部100gあたりの目安）
- 作れる料理の例
- 商品選びの補助コメント

栄養価はプロトタイプ用の静的な商品マスタから取得します。生成AIに数値を自由生成させないことで、表示値の揺れを抑えています。

## デプロイ

VercelにGitHubリポジトリをImportし、Environment Variablesに以下を設定してください。

```text
OPENAI_API_KEY=あなたのOpenAI APIキー
OPENAI_MODEL=gpt-5-mini
```

`main`へのpush後、VercelのProduction Deploymentが更新されます。

## 注意

- カメラ映像から視線を直接取得しているわけではありません。「注目」は画像内の商品位置・大きさ・行動・時間的な変化からのAI推定です。
- 栄養価はプロトタイプ用の目安です。実際の商品パッケージの表示値を確認してください。
- APIキーはGitHubへコミットしないでください。
