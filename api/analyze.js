import OpenAI from "openai";

const SYSTEM_PROMPT = `
あなたはZero UI XRの状況理解エンジンです。
入力画像から、ユーザーが現在見ているもの、していること、しようとしていることを推定してください。

重要:
- 画像から直接確認できる事実と推定を区別する。
- 不確かな場合は断定しない。
- ユーザーの意図は「見えている対象」「身体・物体の状態」「直前のフレームとの変化」を総合して推定する。
- 画面に表示するUIは、ユーザーが今必要としそうな情報を1つだけ提案する。
- 人物の個人属性、感情、健康状態など、画像から根拠なく推定できないものは推定しない。
- JSONのみを返す。
`;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scene: { type: "string" },
    object: { type: "string" },
    action: { type: "string" },
    intent: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" } },
    suggested_ui: {
      type: "object",
      additionalProperties: false,
      properties: {
        show: { type: "boolean" },
        title: { type: "string" },
        body: { type: "string" }
      },
      required: ["show", "title", "body"]
    }
  },
  required: [
    "scene", "object", "action", "intent",
    "confidence", "evidence", "suggested_ui"
  ]
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, previous } = req.body || {};

    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "image is required" });
    }

    const previousText = previous
      ? `\n直前の推定結果:\n${JSON.stringify(previous)}\n今回の画像との変化も考慮してください。`
      : "";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: SYSTEM_PROMPT + previousText,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: "この画像から現在の状況を分析してください。"
          },
          {
            type: "input_image",
            image_url: image,
            detail: "low"
          }
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: "zero_ui_scene",
          strict: true,
          schema
        }
      }
    });

    res.status(200).json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "AI analysis failed"
    });
  }
}
