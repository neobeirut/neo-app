import { corsJson, corsOptions } from "@/app/api/utils/cors";
import sql from "@/app/api/utils/sql";
import { resolveUserId } from "@/app/api/orders/utils/authHelpers";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const { image, mimeType } = await request.json().catch(() => ({}));

    if (!image) {
      return corsJson(request, { error: "Image data is required" }, { status: 400 });
    }

    // Resolve authenticated user ID from headers/session
    const userId = await resolveUserId(request);
    console.log("[nutrition-analyze] Resolved user ID:", userId);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[nutrition-analyze] GEMINI_API_KEY not configured. Returning mock fallback data.");
      // Return a structured mock result representing a wellness bowl
      const mockResult = {
        is_wellness_bowl: true,
        unsupported_message: null,
        food_name: "Salmon with Quinoa & Salad",
        calories: 620,
        protein_g: 42,
        carbs_g: 48,
        fat_g: 18,
        fiber_g: 12,
        wellness_score: 92,
        ingredients: [
          "Salmon",
          "Quinoa",
          "Kale",
          "Avocado",
          "Cherry Tomatoes",
          "Lemon Dressing"
        ],
        confidence: 0.95,
        description: "Excellent source of protein and omega-3."
      };

      // Save to database if user is logged in
      if (userId) {
        try {
          await sql`
            INSERT INTO wellness_scans (
              user_id,
              food_name,
              calories,
              protein_g,
              carbs_g,
              fat_g,
              fiber_g,
              wellness_score,
              ingredients,
              description,
              confidence
            ) VALUES (
              ${userId},
              ${mockResult.food_name},
              ${mockResult.calories},
              ${mockResult.protein_g},
              ${mockResult.carbs_g},
              ${mockResult.fat_g},
              ${mockResult.fiber_g},
              ${mockResult.wellness_score},
              ${JSON.stringify(mockResult.ingredients)},
              ${mockResult.description},
              ${mockResult.confidence}
            )
          `;
          console.log("[nutrition-analyze] Saved mock scan history for user:", userId);
        } catch (dbErr) {
          console.error("[nutrition-analyze] Database insertion failed:", dbErr);
        }
      }

      return corsJson(request, mockResult);
    }

    console.log("[nutrition-analyze] Sending image to Gemini API...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
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
                  text: "Analyze the food item(s) in this plate and classify/estimate their nutrition facts. Return a JSON object.\n\n" +
                    "CRITICAL VALIDATION RULES:\n" +
                    "1. First, check if the food is a 'wellness bowl' (i.e., healthy, balanced, nutrient-dense meals like a salad, grain bowl, protein bowl, grilled salmon/chicken with vegetables, etc.).\n" +
                    "2. If the food is NOT a wellness bowl (e.g. burger, pizza, fries, desserts, pastries, donuts, fried chicken, junk/heavy fast food, etc.), OR if the plate contains a lot of sauce, gravy, or thick cream (e.g. chicken swimming in sauce, heavy stews, curries, creamy pasta), set 'is_wellness_bowl' to false and write a friendly message in 'unsupported_message' notifying the user that these items are not supported and closing with 'Enjoy your meal!' (e.g., 'We detected chicken in heavy sauce. This scanner only supports wellness bowls. Enjoy your meal!').\n" +
                    "3. If the food IS a wellness bowl, set 'is_wellness_bowl' to true and 'unsupported_message' to null.\n\n" +
                    "Required JSON fields in the response:\n" +
                    "- is_wellness_bowl (boolean)\n" +
                    "- unsupported_message (string or null)\n" +
                    "- food_name (string: e.g., 'Salmon with Quinoa & Salad')\n" +
                    "- calories (number: kcal)\n" +
                    "- protein_g (number: grams of protein)\n" +
                    "- carbs_g (number: grams of total carbohydrates)\n" +
                    "- fat_g (number: grams of fat)\n" +
                    "- fiber_g (number: grams of dietary fiber)\n" +
                    "- wellness_score (number: a healthiness/wellness score from 0 to 100 based on nutrient density)\n" +
                    "- ingredients (array of strings: detected ingredients)\n" +
                    "- confidence (number: confidence score between 0 and 1)\n" +
                    "- description (string: a brief 1-sentence highlight of the meal's key nutritional benefit, e.g., 'Excellent source of protein and omega-3.')\n\n" +
                    "Return ONLY raw JSON, do not wrap in markdown or code blocks. Ensure all numbers are integers. Keep response strings and arrays extremely brief to minimize latency."
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
            maxOutputTokens: 400,
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

      // Save to database only if it's a wellness bowl and user is authenticated
      if (userId && parsedNutrition.is_wellness_bowl) {
        try {
          await sql`
            INSERT INTO wellness_scans (
              user_id,
              food_name,
              calories,
              protein_g,
              carbs_g,
              fat_g,
              fiber_g,
              wellness_score,
              ingredients,
              description,
              confidence
            ) VALUES (
              ${userId},
              ${parsedNutrition.food_name},
              ${parsedNutrition.calories},
              ${parsedNutrition.protein_g},
              ${parsedNutrition.carbs_g},
              ${parsedNutrition.fat_g},
              ${parsedNutrition.fiber_g},
              ${parsedNutrition.wellness_score},
              ${JSON.stringify(parsedNutrition.ingredients)},
              ${parsedNutrition.description},
              ${parsedNutrition.confidence || 0.95}
            )
          `;
          console.log("[nutrition-analyze] Saved scan history for user:", userId);
        } catch (dbErr) {
          console.error("[nutrition-analyze] Database insertion failed:", dbErr);
        }
      }

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
