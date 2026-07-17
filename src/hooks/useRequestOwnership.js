import { useCallback, useEffect, useRef } from "react";

export default function useRequestOwnership() {
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeControllerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, []);

  const begin = useCallback(() => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    activeControllerRef.current = controller;
    return {
      controller,
      generation,
      signal: controller.signal,
      isCurrent: () =>
        mountedRef.current &&
        !controller.signal.aborted &&
        generationRef.current === generation,
    };
  }, []);

  const finish = useCallback((request) => {
    if (activeControllerRef.current === request?.controller) {
      activeControllerRef.current = null;
    }
  }, []);

  const invalidate = useCallback(() => {
    generationRef.current += 1;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
  }, []);

  return { begin, finish, invalidate, mountedRef };
}
