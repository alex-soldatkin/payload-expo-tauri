import type { AnyField, ClientHooksConfig, ValidationErrors } from '@payload-universal/client-validators';
import type { PayloadLocalDB } from '../database';
export type ValidatedMutationSuccess = {
    success: true;
    id?: string;
};
export type ValidatedMutationFailure = {
    success: false;
    errors: ValidationErrors;
};
export type ValidatedMutationResult = ValidatedMutationSuccess | ValidatedMutationFailure;
export type UseValidatedMutationsResult = {
    /**
     * Insert a new document. Runs hooks + validation before writing.
     * Returns `{ success: true, id }` or `{ success: false, errors }`.
     */
    create: (data: Record<string, unknown>) => Promise<ValidatedMutationResult>;
    /**
     * Update a document. Runs hooks + validation before writing.
     * Returns `{ success: true }` or `{ success: false, errors }`.
     */
    update: (id: string, data: Record<string, unknown>, originalDoc?: Record<string, unknown>) => Promise<ValidatedMutationResult>;
    /**
     * Soft-delete a document. No validation needed.
     */
    remove: (id: string) => Promise<void>;
    /** Current validation errors (cleared on next successful mutation). */
    errors: ValidationErrors;
    /** Manually clear validation errors (e.g. when user edits a field). */
    clearErrors: () => void;
    /** Clear a single field's error. */
    clearFieldError: (fieldPath: string) => void;
};
/**
 * Validated mutations hook.
 *
 * @param localDB - The local RxDB database instance.
 * @param slug - The collection slug.
 * @param fields - The root-level client field definitions from the admin schema.
 *                 Used to drive built-in validation (required, min, max, etc.).
 * @param hooksConfigOverride - Optional override for the hooks config.
 *                              If not provided, reads from ClientValidatorProvider context.
 */
export declare function useValidatedMutations(localDB: PayloadLocalDB | null, slug: string, fields?: AnyField[], hooksConfigOverride?: ClientHooksConfig): UseValidatedMutationsResult;
