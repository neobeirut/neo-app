import React, { useRef, useEffect } from "react";
import { Platform, Keyboard, Animated } from "react-native";

const KeyboardAvoidingAnimatedView = React.forwardRef((props, ref) => {
  const {
    children,
    behavior = Platform.OS === "ios" ? "padding" : "height",
    keyboardVerticalOffset = 0,
    style,
    enabled = true,
    onLayout,
    ...leftoverProps
  } = props;

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    const keyboardWillShowSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        const { duration, endCoordinates } = event;
        Animated.timing(animatedValue, {
          toValue: endCoordinates.height - keyboardVerticalOffset,
          duration: duration || 250,
          useNativeDriver: false,
        }).start();
      },
    );

    const keyboardWillHideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (event) => {
        const { duration } = event;
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: duration || 250,
          useNativeDriver: false,
        }).start();
      },
    );

    return () => {
      keyboardWillShowSub.remove();
      keyboardWillHideSub.remove();
    };
  }, [keyboardVerticalOffset, enabled, animatedValue]);

  const animatedStyle =
    behavior === "padding"
      ? { paddingBottom: animatedValue }
      : behavior === "height"
        ? { marginBottom: animatedValue }
        : { bottom: animatedValue };

  return (
    <Animated.View
      ref={ref}
      style={[style, animatedStyle]}
      onLayout={onLayout}
      {...leftoverProps}
    >
      {children}
    </Animated.View>
  );
});

KeyboardAvoidingAnimatedView.displayName = "KeyboardAvoidingAnimatedView";

export default KeyboardAvoidingAnimatedView;
