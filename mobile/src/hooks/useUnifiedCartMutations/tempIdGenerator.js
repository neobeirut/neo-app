import { useRef } from "react";

export function useTempIdGenerator() {
  const tempIdRef = useRef(-1);

  const nextTempId = () => {
    const next = tempIdRef.current;
    tempIdRef.current -= 1;
    return next;
  };

  return { nextTempId };
}
