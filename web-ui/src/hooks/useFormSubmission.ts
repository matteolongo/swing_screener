import { useCallback } from 'react';
import { UseMutationResult } from '@tanstack/react-query';

/**
 * Standardized form submission handling with React Query mutations.
 * 
 * Wraps React Query mutations to provide consistent error handling and success callbacks
 * for form submissions across the application.
 * 
 * @template TData The type of data returned by the mutation
 * @template TError The type of error returned by the mutation
 * @template TVariables The type of variables passed to the mutation
 * @param mutation React Query mutation hook result
 * @param onSuccess Optional callback when mutation succeeds
 * @returns Object with handleSubmit, isSubmitting, and error
 * 
 * @example
 * ```tsx
 * const createOrderMutation = useCreateOrderMutation();
 * const submission = useFormSubmission(
 *   createOrderMutation,
 *   () => {
 *     toast.success('Order created');
 *     onClose();
 *   }
 * );
 * 
 * <form onSubmit={form.handleSubmit(submission.handleSubmit)}>
 *   {submission.error && <ErrorMessage>{submission.error}</ErrorMessage>}
 *   <Button type="submit" disabled={submission.isSubmitting}>
 *     {submission.isSubmitting ? 'Creating...' : 'Create Order'}
 *   </Button>
 * </form>
 * ```
 */
export function useFormSubmission<
  TData = unknown,
  TError = Error,
  TVariables = void
>(
  mutation: UseMutationResult<TData, TError, TVariables>,
  onSuccess?: (data: TData) => void
) {
  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (variables: TVariables) => {
      try {
        const result = await mutation.mutateAsync(variables);
        onSuccess?.(result);
        return result;
      } catch (error) {
        // Error is already tracked in mutation.error
        // React Query will handle error state
        console.error('Form submission error:', error);
        throw error;
      }
    },
    [mutation, onSuccess]
  );

  /**
   * Get error message from mutation error
   */
  const getErrorMessage = (): string | null => {
    if (!mutation.error) return null;

    const error = mutation.error as any;
    
    // Handle different error formats
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.message) {
      return error.message;
    }
    
    if (error.detail) {
      return error.detail;
    }

    return 'An error occurred during submission';
  };

  return {
    /**
     * Submit handler to pass to form onSubmit
     */
    handleSubmit,
    
    /**
     * Whether the form is currently submitting
     */
    isSubmitting: mutation.isPending,
    
    /**
     * Error message from the mutation, if any
     */
    error: getErrorMessage(),
    
    /**
     * Reset the mutation state (clears errors)
     */
    reset: mutation.reset,

    /**
     * Whether the submission was successful
     */
    isSuccess: mutation.isSuccess,
  };
}

/**
 * Type for form submission hook return value
 */
export type UseFormSubmissionReturn<T = unknown, E = Error, V = void> = ReturnType<
  typeof useFormSubmission<T, E, V>
>;
