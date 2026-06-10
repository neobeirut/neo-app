import { useRef, useState } from "react";

export function useMutationLock() {
  const mutationLockRef = useRef(false);
  const [isMutating, setIsMutating] = useState(false);

  const acquireLock = async (operationType) => {
    if (mutationLockRef.current) {
      console.log(
        `[CART ${operationType}] ⚠️ Mutation locked - ignoring request`,
      );
      return false;
    }
    mutationLockRef.current = true;
    setIsMutating(true);
    return true;
  };

  const releaseLock = (operationType) => {
    mutationLockRef.current = false;
    setIsMutating(false);
  };

  const isLocked = () => mutationLockRef.current;

  return {
    acquireLock,
    releaseLock,
    isLocked,
    isMutating,
  };
}
