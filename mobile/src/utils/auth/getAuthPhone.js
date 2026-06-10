import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/utils/auth/store";
import { phoneAuth } from "@/utils/auth/phoneAuth";

/**
 * Returns a phone number if we have it, regardless of auth method.
 *
 * IMPORTANT:
 * - For phone-auth users, the canonical phone is stored at auth.phone (top-level) and in phoneAuth (SecureStore).
 * - Some parts of the app previously only checked auth.user.phone, which can be undefined.
 * - On Android, SecureStore reads can briefly return null during heavy navigation; so we must also check in-memory/store.
 */
export async function getAuthPhone() {
  // Fast path: Zustand auth store (in-memory)
  const auth = useAuthStore.getState().auth;
  const phoneFromAuthTopLevel = auth?.phone;
  if (phoneFromAuthTopLevel) {
    return phoneFromAuthTopLevel;
  }

  const phoneFromAuthUser = auth?.user?.phone;
  if (phoneFromAuthUser) {
    return phoneFromAuthUser;
  }

  // Next: phoneAuth (SecureStore + in-memory cache)
  const phoneFromPhoneAuth = await phoneAuth.getUserPhone();
  if (phoneFromPhoneAuth) {
    return phoneFromPhoneAuth;
  }

  // Legacy fallback (older builds stored here)
  try {
    const legacy = await AsyncStorage.getItem("userPhone");
    return legacy || null;
  } catch (e) {
    return null;
  }
}
