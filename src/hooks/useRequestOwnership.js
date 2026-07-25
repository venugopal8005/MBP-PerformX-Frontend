import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export default function useRequestOwnership(ownerKey = null) {
  const normalizedOwnerKey = String(ownerKey ?? "");
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeControllerRef = useRef(null);
  const ownerKeyRef = useRef(normalizedOwnerKey);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    ownerKeyRef.current = normalizedOwnerKey;
    generationRef.current += 1;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    return () => {
      generationRef.current += 1;
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, [normalizedOwnerKey]);

  const begin = useCallback(() => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = generationRef.current + 1;
    const requestOwnerKey = ownerKeyRef.current;
    generationRef.current = generation;
    activeControllerRef.current = controller;
    return {
      controller,
      generation,
      signal: controller.signal,
      isCurrent: () =>
        mountedRef.current &&
        !controller.signal.aborted &&
        ownerKeyRef.current === requestOwnerKey &&
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

  return { begin, finish, invalidate, mountedRef, ownerKeyRef };
}
