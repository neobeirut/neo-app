import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";

export function AddItemModal({
  visible,
  onClose,
  productSearch,
  onSearchChange,
  products,
  onAddItem,
  colors,
}) {
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: "80%",
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Add Item to Order
          </Text>
          <TextInput
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: 8,
              padding: 12,
              width: "100%",
              marginBottom: 12,
            }}
            placeholder="Search for product..."
            placeholderTextColor={colors.textSecondary}
            value={productSearch}
            onChangeText={onSearchChange}
          />
          <ScrollView
            style={{ width: "100%", marginBottom: 12, maxHeight: 300 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {filteredProducts.length === 0 ? (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                No products found
              </Text>
            ) : (
              filteredProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => onAddItem(product.id)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    padding: 12,
                    width: "100%",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: colors.text,
                    }}
                  >
                    {product.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: colors.textSecondary,
                    }}
                  >
                    ${parseFloat(product.price).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
              width: "100%",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: colors.text,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
