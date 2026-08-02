import React from "react";
import { View, Text } from "react-native";

// Parse nutritional info to extract key values
const parseNutritionalInfo = (info) => {
  if (!info) return null;

  const nutrients = [];
  const caloriesMatch = info.match(/(\d+)\s*(cal|calories|kcal)/i);
  const proteinMatch = info.match(/(\d+\.?\d*)\s*g?\s*protein/i);
  const fatMatch = info.match(/(\d+\.?\d*)\s*g?\s*(fat|fats)/i);
  const carbsMatch = info.match(
    /(\d+\.?\d*)\s*g?\s*(carb|carbs|carbohydrate)/i,
  );
  const fiberMatch = info.match(/(\d+\.?\d*)\s*g?\s*fiber/i);
  const sugarMatch = info.match(/(\d+\.?\d*)\s*g?\s*sugar/i);

  if (caloriesMatch)
    nutrients.push({ label: "Calories", value: caloriesMatch[1], unit: "" });
  if (proteinMatch)
    nutrients.push({ label: "Protein", value: proteinMatch[1], unit: "g" });
  if (fatMatch) nutrients.push({ label: "Fat", value: fatMatch[1], unit: "g" });
  if (carbsMatch)
    nutrients.push({ label: "Carbs", value: carbsMatch[1], unit: "g" });
  if (fiberMatch)
    nutrients.push({ label: "Fiber", value: fiberMatch[1], unit: "g" });
  if (sugarMatch)
    nutrients.push({ label: "Sugar", value: sugarMatch[1], unit: "g" });

  return nutrients.length > 0
    ? { nutrients, raw: info }
    : { nutrients: [], raw: info };
};

export function NutritionalInfo({ product, colors, isAvailable }) {
  if (!product.ingredients && !product.nutritional_info) {
    return null;
  }

  return (
    <View
      style={{
        paddingHorizontal: 24,
        marginBottom: 32,
        opacity: isAvailable ? 1 : 0.6,
      }}
    >
      {product.ingredients && (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 16,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Ingredients
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: colors.textSecondary,
              lineHeight: 18,
            }}
          >
            {product.ingredients}
          </Text>
        </View>
      )}

      {product.nutritional_info &&
        (() => {
          const parsed = parseNutritionalInfo(product.nutritional_info);
          return (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <Text
                style={{
                  fontFamily: "PlayfairDisplay_500Medium",
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 16,
                }}
              >
                Nutritional Info
              </Text>

              {parsed?.nutrients && parsed.nutrients.length > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  {parsed.nutrients.map((nutrient, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: colors.cream,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        minWidth: 100,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: colors.separator,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 20,
                          color: colors.primary,
                          marginBottom: 4,
                        }}
                      >
                        {nutrient.value}
                        {nutrient.unit}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 10,
                          color: colors.textSecondary,
                        }}
                      >
                        {nutrient.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: colors.textSecondary,
                    lineHeight: 18,
                  }}
                >
                  {product.nutritional_info}
                </Text>
              )}
            </View>
          );
        })()}
    </View>
  );
}
