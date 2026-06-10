import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Haptics from "expo-haptics";

export function BirthdayPicker({ visible, onConfirm, onClose, insets }) {
  const currentYear = new Date().getFullYear();

  // Default to 20 years ago (reasonable default for adult users)
  const defaultYear = currentYear - 20;
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  // Generate year options (13-120 years old)
  const minYear = currentYear - 120;
  const maxYear = currentYear - 13;
  const years = [];
  for (let year = maxYear; year >= minYear; year--) {
    years.push(year);
  }

  // Month names
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Get days in selected month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Adjust day if it's out of range for the selected month
  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    const newDaysInMonth = new Date(selectedYear, month + 1, 0).getDate();
    if (selectedDay > newDaysInMonth) {
      setSelectedDay(newDaysInMonth);
    }
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
    const newDaysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    if (selectedDay > newDaysInMonth) {
      setSelectedDay(newDaysInMonth);
    }
  };

  const handleConfirm = async () => {
    await Haptics.selectionAsync();
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    onConfirm(date);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <TouchableOpacity
              onPress={async () => {
                await Haptics.selectionAsync();
                onClose();
              }}
            >
              <Text style={{ fontSize: 16, color: "#357AFF" }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "600" }}>
              Select Birthday
            </Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: "#357AFF" }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Native Wheel Pickers */}
          <View
            style={{
              flexDirection: "row",
              height: 216,
              paddingHorizontal: 20,
            }}
          >
            {/* Month Picker */}
            <View style={{ flex: 2 }}>
              <Picker
                selectedValue={selectedMonth}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  handleMonthChange(value);
                }}
                itemStyle={{
                  height: 216,
                  fontSize: 20,
                  color: "#000000",
                }}
              >
                {months.map((month, index) => (
                  <Picker.Item key={index} label={month} value={index} />
                ))}
              </Picker>
            </View>

            {/* Day Picker */}
            <View style={{ flex: 1 }}>
              <Picker
                selectedValue={selectedDay}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  setSelectedDay(value);
                }}
                itemStyle={{
                  height: 216,
                  fontSize: 20,
                  color: "#000000",
                }}
              >
                {days.map((day) => (
                  <Picker.Item key={day} label={String(day)} value={day} />
                ))}
              </Picker>
            </View>

            {/* Year Picker */}
            <View style={{ flex: 1.3 }}>
              <Picker
                selectedValue={selectedYear}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  handleYearChange(value);
                }}
                itemStyle={{
                  height: 216,
                  fontSize: 20,
                  color: "#000000",
                }}
              >
                {years.map((year) => (
                  <Picker.Item key={year} label={String(year)} value={year} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Selected Date Preview */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 15,
                color: "#6B7280",
                textAlign: "center",
              }}
            >
              Selected: {months[selectedMonth]} {selectedDay}, {selectedYear}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
