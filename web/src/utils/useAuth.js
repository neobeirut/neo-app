// This file is not used in the web app
// Web authentication is handled via phone auth in the signin/signup pages
// Mobile app uses its own auth hook at /apps/mobile/src/utils/auth/useAuth.js

function useAuth() {
  return {
    signInWithCredentials: () => {
      throw new Error(
        "useAuth is not available in the web app. Use /account/signin instead.",
      );
    },
    signUpWithCredentials: () => {
      throw new Error(
        "useAuth is not available in the web app. Use /account/signup instead.",
      );
    },
    signInWithGoogle: () => {
      throw new Error("useAuth is not available in the web app.");
    },
    signInWithFacebook: () => {
      throw new Error("useAuth is not available in the web app.");
    },
    signInWithTwitter: () => {
      throw new Error("useAuth is not available in the web app.");
    },
    signInWithApple: () => {
      throw new Error("useAuth is not available in the web app.");
    },
    signOut: () => {
      throw new Error(
        "useAuth is not available in the web app. Use /account/logout instead.",
      );
    },
  };
}

export default useAuth;
