/**
 * ClientValidatorProvider — React context that holds the app's client-side
 * validation and hooks configuration.
 *
 * Mount this at the app root (alongside LocalDBProvider) and pass in the
 * app-specific ClientHooksConfig. The useValidatedMutations hook reads it
 * automatically.
 */
import { type ReactNode } from 'react';
import type { ClientHooksConfig } from '@payload-universal/client-validators';
export type ClientValidatorProviderProps = {
    config: ClientHooksConfig;
    children: ReactNode;
};
export declare function ClientValidatorProvider({ config, children }: ClientValidatorProviderProps): import("react/jsx-runtime").JSX.Element;
/**
 * Access the client-side hooks/validation config from context.
 * Returns null if no provider is mounted (validation will still run built-in validators).
 */
export declare function useClientValidatorConfig(): ClientHooksConfig | null;
