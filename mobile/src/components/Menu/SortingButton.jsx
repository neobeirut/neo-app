import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { ArrowUpDown, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

const sortingOptions = [
  { id: "default", label: "Default Sorting" },
  { id: "price_low", label: "Lowest Price" },
  { id: "price_high", label: "Highest Price" },
  { id: "title", label: "By Title" },
];

export function SortingButton({ colors, selectedSort, onSortChange }) {
  const [modalVisible, setModalVisible] = React.useState(false);

  const handlePress = async () => {
    await Haptics.selectionAsync();
    setModalVisible(true);
  };

  const handleSelectSort = async (sortId) => {
    await Haptics.selectionAsync();
    onSortChange(sortId);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          gap: 6,
        }}
        onPress={handlePress}
      >
        <ArrowUpDown size={16} color={colors.text} />
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color: colors.text,
          }}
        >
          Sort
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              width: "80%",
              maxWidth: 320,
              padding: 20,
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Sort Products
            </Text>

            {sortingOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
                onPress={() => handleSelectSort(option.id)}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 15,
                    color: colors.text,
                  }}
                >
                  {option.label}
                </Text>
                {selectedSort === option.id && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
