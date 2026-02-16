import { useState, useCallback } from 'react';

/**
 * Generic modal state management hook.
 * 
 * Provides a clean API for managing modal open/close state and optional modal data.
 * Handles cleanup of data after modal closes (with delay for animations).
 * 
 * @template T The type of data passed to the modal
 * @returns Object with isOpen flag, data, and open/close methods
 * 
 * @example
 * ```tsx
 * // Simple modal without data
 * const confirmModal = useModal();
 * <ConfirmDialog isOpen={confirmModal.isOpen} onClose={confirmModal.close} />
 * 
 * // Modal with data
 * const editModal = useModal<User>();
 * <EditUserModal 
 *   isOpen={editModal.isOpen} 
 *   user={editModal.data}
 *   onClose={editModal.close}
 * />
 * // Open with data
 * editModal.open(selectedUser);
 * ```
 */
export function useModal<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  /**
   * Open the modal, optionally with data
   */
  const open = useCallback((payload?: T) => {
    if (payload !== undefined) {
      setData(payload as T);
    }
    setIsOpen(true);
  }, []);

  /**
   * Close the modal and clear data after animation
   */
  const close = useCallback(() => {
    setIsOpen(false);
    // Clear data after a short delay to allow closing animation
    setTimeout(() => {
      setData(null);
    }, 200);
  }, []);

  /**
   * Toggle the modal state
   */
  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
  };
}

/**
 * Type for modal hook return value
 */
export type UseModalReturn<T = void> = ReturnType<typeof useModal<T>>;
