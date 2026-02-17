import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing localStorage with React state synchronization.
 * 
 * This hook provides a type-safe way to store and retrieve values from localStorage,
 * with automatic serialization/deserialization and error handling.
 * 
 * @template T The type of the value stored in localStorage
 * @param key The localStorage key
 * @param defaultValue The default value if key doesn't exist or parsing fails
 * @param transformer Optional function to transform/validate/sanitize values when loading from storage
 *                   AND when setting new values. This serves dual purpose:
 *                   1. Parse/transform values loaded from localStorage (e.g., clamp numbers to range)
 *                   2. Validate/sanitize values before saving to localStorage (e.g., prevent invalid values)
 * @returns A tuple of [value, setValue] similar to useState
 * 
 * @example
 * ```tsx
 * const [name, setName] = useLocalStorage('username', 'Guest');
 * const [count, setCount] = useLocalStorage('count', 0, (val) => Math.max(0, Number(val) || 0));
 * // Transformer ensures count is always >= 0, both when loading and setting
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  transformer?: (value: unknown) => T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize state from localStorage or use default
  const [value, setValue] = useState<T>(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }

      // First, try to parse the stored value as JSON (current format)
      try {
        const parsed = JSON.parse(item);

        // Apply transformer if provided
        if (transformer) {
          return transformer(parsed);
        }

        return parsed as T;
      } catch (error) {
        console.warn(`Error parsing localStorage key "${key}" as JSON:`, error);

        // Fallback: treat the stored value as a raw string (legacy format)
        try {
          if (transformer) {
            return transformer(item);
          }

          return item as unknown as T;
        } catch (transformError) {
          console.warn(
            `Error transforming localStorage key "${key}" from raw string:`,
            transformError
          );
          return defaultValue;
        }
      }
    } catch (error) {
      console.warn(`Error loading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  // Update localStorage whenever value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  }, [key, value]);

  // Wrapped setValue that supports function updates
  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prevValue) => {
        const valueToStore = newValue instanceof Function ? newValue(prevValue) : newValue;

        // Apply transformer for validation/sanitization before saving
        if (!transformer) {
          return valueToStore;
        }

        try {
          return transformer(valueToStore as unknown);
        } catch (error) {
          console.warn(`Error transforming value for localStorage key "${key}":`, error);
          return prevValue;
        }
      });
    },
    [transformer, key]
  );

  return [value, setStoredValue];
}
