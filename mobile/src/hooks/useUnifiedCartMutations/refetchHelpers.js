import { cartKey } from "./cartKeyHelpers";

export const safeRefetch = async (queryClient, branchId, delay = 200) => {
  const key = cartKey(branchId, true);
  return new Promise((resolve) => {
    setTimeout(async () => {
      await queryClient.refetchQueries({ queryKey: key, type: "active" });
      resolve();
    }, delay);
  });
};
