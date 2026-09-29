import OpenAI from "openai";

const PRODUCT_CATALOG = {
  apple: {
    name: "りんご",
    nutritionBasis: "可食部100gあたりの目安",
    nutrition: [
      ["エネルギー", "53 kcal"],
      ["たんぱく質", "0.1 g"],
      ["脂質", "0.2 g"],
      ["炭水化物", "15.8 g"]
    ],
    recipes: ["焼きりんご", "りんごヨーグルト", "アップルパイ"],
    tip: "甘味や酸味、食感などを確認して選べます。"
  },
  avocado: {
    name: "アボカド",
    nutritionBasis: "可食部100gあたりの目安",
    nutrition: [
      ["エネルギー", "176 kcal"],
      ["たんぱく質", "2.1 g"],
      ["脂質", "17.5 g"],
      ["炭水化物", "7.9 g"]
    ],
    recipes: ["ワカモレ", "アボカドサラダ", "アボカド丼"],
    tip: "皮の色や硬さを確認して、食べ頃を選べます。"
  },
  egg: {
    name: "卵",
    nutritionBasis: "可食部100gあたりの目安",
    nutrition: [
      ["エネルギー", "142 kcal"],
      ["たんぱく質", "12.2 g"],
      ["脂質", "10.2 g"],
      ["炭水化物", "0.4 g"]
    ],
    recipes: ["親子丼", "オムライス", "卵サラダ"],
    tip: "パック表示の賞味期限や個数も確認できます。"
  }
};

const SYSTEM_PROMPT = `
あなたは「Zero UI XR スーパー買い物支援」の状況理解・意図推定エンジンです。
スマートフォンのカメラ映像から、ユーザーがスーパーでどの商品に注目しているかを推定してください。

目的:
- ユーザーが商品を「見ているだけ」なのか、「商品を検討している」のかを推定する。
- 商品への注目が十分に強いと判断した場合だけ、商品情報UIを表示する。
- UIはユーザーが明示的にボタンを押さなくても、状況に応じて自然に現れるZero UIを想定する。

商品ID:
- apple = りんご
- avocado = アボカド
- egg = 卵
- unknown = 対象外・判別不能

注目度の考え方:
- 商品が画面中央付近にあり、十分な大きさで写っている。
- 商品を連続して見ているように見える。
- 手に取る、近づける、角度を変えて確認するなど、購入検討につながる行動がある。
- ただし、単に背景に商品が写っているだけなら注目とは判定しない。
- カメラ映像だけでは視線を直接取得できないため、「注目」は画像からの推定である。

重要:
- 画像から確認できる事実と推定を区別する。
- 不確かな場合は unknown / false 寄りにする。
- 直前の推定結果がある場合は、今回の画像との変化も考慮する。
- 栄養価やレシピの具体的な内容は生成しない。商品IDだけを返し、アプリ側の商品マスタから表示する。
- JSONのみを返す。
`;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scene: { type: "string" },
    product_id: { type: "string", enum: ["apple", "avocado", "egg", "unknown"] },
    object: { type: "string" },
    action: { type: "string" },
    intent: { type: "string" },
    attention: { type: "boolean" },
    attention_score: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" } },
    show_ui: { type: "boolean" },
    ui_reason: { type: "string" }
  },
  required: [
    "scene", "product_id", "object", "action", "intent",
    "attention", "attention_score", "confidence", "evidence",
    "show_ui", "ui_reason"
  ]
};

function buildUi(result) {
  if (!result.show_ui || !result.attention || !PRODUCT_CATALOG[result.product_id]) {
    return { show: false };
  }

  const product = PRODUCT_CATALOG[result.product_id];
  return {
    show: true,
    type: "product_information",
    title: product.name,
    subtitle: "この商品に注目していると推定しました",
    nutritionBasis: product.nutritionBasis,
    nutrition: product.nutrition,
    recipes: product.recipes,
    tip: product.tip
  };
}

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
            text: "スーパーでの買い物支援を想定し、この画像からユーザーが注目している商品と意図を分析してください。"
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
          name: "zero_ui_shopping_scene",
          strict: true,
          schema
        }
      }
    });

    const result = JSON.parse(response.output_text);
    result.product_name = PRODUCT_CATALOG[result.product_id]?.name || "";
    result.suggested_ui = buildUi(result);

    // Server-side guard: the UI can only appear for a known product with sufficient attention.
    if (!(result.show_ui && result.attention && result.attention_score >= 0.75 && PRODUCT_CATALOG[result.product_id])) {
      result.show_ui = false;
      result.suggested_ui = { show: false };
    }

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "AI analysis failed"
    });
  }
}
