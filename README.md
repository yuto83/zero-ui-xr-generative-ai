# Zero UI XR — Generative AI / GitHub + Vercel

カメラ画像を生成AIに送り、生成AI自身に
「何を見ているか」「何をしているか」「何をしようとしているか」
を推定させるZero UI XRプロトタイプです。

## アーキテクチャ

iPhone / PC Browser
→ Camera
→ `public/app.js`
→ `/api/analyze`
→ OpenAI Responses API
→ JSON
→ Zero UI overlay

この版では MediaPipe HandPose / TensorFlow.js による物体・手の認識は使用しません。

## GitHub + Vercelへの公開手順

### 1. GitHub

このフォルダの中身を新しいGitHubリポジトリへアップロードします。

例:
`zero-ui-xr-generative-ai`

### 2. Vercel

Vercelで「Add New Project」からGitHubリポジトリをImportします。

Build Commandは基本的に不要です。
Framework PresetはOtherで構いません。

### 3. Environment Variables

VercelのProject Settings → Environment Variablesに以下を設定します。

`OPENAI_API_KEY`
→ OpenAI APIキー

`OPENAI_MODEL`
→ `gpt-5-mini`

APIキーはGitHubへ絶対にコミットしないでください。

### 4. Deploy

DeployするとHTTPSのURLが発行されます。

例:
`https://zero-ui-xr-generative-ai.vercel.app`

このURLをiPhoneのSafariで開き、
「カメラを開始」→カメラを許可
で使用できます。

## 注意

カメラ画像は、AI解析のために `/api/analyze` を経由してOpenAI APIへ送信されます。

現在は約1.5秒ごとに1枚の画像を解析します。
実験時は「AI解析間隔」を1秒、1.5秒、2秒、3秒から選択できます。

## APIキーについて

APIキーはブラウザへ送信されません。
Vercelのサーバー側FunctionでOpenAI APIを呼び出します。

## 意図推定

直前のAI推定結果を次の解析にも渡します。

例:

1. スーパーの商品棚を見ている
2. 卵に注目している
3. 卵を手に取っている
4. パッケージを確認している
5. 購入を検討している可能性

これにより、単純な物体認識ではなく、
時系列の状況変化を利用した意図推定を実験できます。
