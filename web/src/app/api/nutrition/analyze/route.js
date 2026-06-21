import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const { image, mimeType } = await request.json().catch(() => ({}));

    if (!image) {
      return corsJson(request, { error: "Image data is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[nutrition-analyze] GEMINI_API_KEY not configured. Returning mock fallback data.");
      // Return a structured mock result so the user can test the UI immediately
      const mockResult = {
        food_name: "Grilled Chicken Salad (Mock)",
        calories: 350,
        protein_g: 28,
        carbs_g: 12,
        fat_g: 18,
        ingredients: [
          "Grilled chicken breast",
          "Romaine lettuce",
          "Cherry tomatoes",
          "Cucumber slices",
          "Olive oil dressing",
          "Parmesan cheese"
        ],
        confidence: 0.92,
        description: "Mock Result: A fresh green salad topped with grilled chicken breast, cherry tomatoes, and shaved parmesan cheese, dressed in olive oil."
      };
      return corsJson(request, mockResult);
    }

    console.log("[nutrition-analyze] Sending image to Gemini API...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Identify the food item(s) in this plate and estimate their nutrition facts. Return a JSON object with the following fields:\n" +
                    "- food_name (string: e.g., 'Chicken Caesar Salad' or a list of multiple items if there are many)\n" +
                    "- calories (number: kcal)\n" +
                    "- protein_g (number: grams)\n" +
                    "- carbs_g (number: grams)\n" +
                    "- fat_g (number: grams)\n" +
                    "- ingredients (array of strings: detected ingredients)\n" +
                    "- confidence (number: confidence score between 0 and 1)\n" +
                    "- description (string: brief summary of the meal and what was detected)\n\n" +
                    "Return ONLY raw JSON, do not wrap in markdown or code blocks. Ensure all numbers are integers."
                },
                {
                  inlineData: {
                    mimeType: mimeType || "image/jpeg",
                    data: image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[nutrition-analyze] Gemini API Error:", response.status, errorText);
      return corsJson(
        request,
        { error: `Gemini API returned error: ${response.status}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    
    // Parse the generated JSON response
    const candidateText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      console.error("[nutrition-analyze] Empty response from Gemini API:", JSON.stringify(result));
      return corsJson(request, { error: "Failed to parse food image" }, { status: 502 });
    }

    try {
      const parsedNutrition = JSON.parse(candidateText.trim());
      console.log("[nutrition-analyze] Successfully parsed nutrition facts:", parsedNutrition);
      return corsJson(request, parsedNutrition);
    } catch (parseErr) {
      console.error("[nutrition-analyze] Failed to parse JSON text from Gemini:", candidateText);
      return corsJson(request, { error: "Failed to format nutrition facts JSON" }, { status: 502 });
    }

  } catch (err) {
    console.error("[nutrition-analyze] Unexpected Error:", err);
    return corsJson(request, { error: err.message }, { status: 500 });
  }
}
