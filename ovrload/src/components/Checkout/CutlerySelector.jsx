import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export function CutlerySelector({ needCutlery, setNeedCutlery, colors }) {
  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: colors.text,
          marginBottom: 12,
        }}
      >
        Cutlery Needed?
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {/* Yes */}
        <TouchableOpacity
          onPress={() => setNeedCutlery(true)}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: needCutlery === true ? colors.primary : colors.separator,
            backgroundColor:
              needCutlery === true ? colors.primary + "15" : colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              color:
                needCutlery === true ? colors.primary : colors.textSecondary,
            }}
          >
            Yes
          </Text>
        </TouchableOpacity>

        {/* No */}
        <TouchableOpacity
          onPress={() => setNeedCutlery(false)}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 2,
            borderColor:
              needCutlery === false ? colors.primary : colors.separator,
            backgroundColor:
              needCutlery === false ? colors.primary + "15" : colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              color:
                needCutlery === false ? colors.primary : colors.textSecondary,
            }}
          >
            No
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
