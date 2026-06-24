/**
 * Default translate layer for built-in validators.
 *
 * Provides hardcoded English messages matching Payload's i18n keys, with an
 * optional t() override pulled from each validator's options for real i18n.
 */
import type { ClientValidateOptions, ClientTranslate } from '../types'

// ---------------------------------------------------------------------------
// Default translate — returns English messages matching Payload's keys
// ---------------------------------------------------------------------------

const defaultT: ClientTranslate = (key, vars) => {
  const messages: Record<string, string> = {
    'validation:required': 'This field is required.',
    'validation:shorterThanMax': `Value must be no longer than ${vars?.maxLength ?? '?'} characters.`,
    'validation:longerThanMin': `Value must be at least ${vars?.minLength ?? '?'} characters.`,
    'validation:greaterThanMax': `Value must be no greater than ${vars?.max ?? '?'}.`,
    'validation:lessThanMin': `Value must be no less than ${vars?.min ?? '?'}.`,
    'validation:enterNumber': 'Please enter a valid number.',
    'validation:emailAddress': 'Please enter a valid email address.',
    'validation:trueOrFalse': 'This field can only be true or false.',
    'validation:invalidSelection': 'This field has an invalid selection.',
    'validation:invalidSelections': 'This field has the following invalid selections:',
    'validation:requiresAtLeast': `Requires at least ${vars?.count ?? '?'} ${vars?.label ?? 'item(s)'}.`,
    'validation:requiresNoMoreThan': `Requires no more than ${vars?.count ?? '?'} ${vars?.label ?? 'item(s)'}.`,
    'validation:requiresTwoNumbers': 'This field requires two valid numbers (longitude, latitude).',
    'validation:invalidInput': 'This field has an invalid input.',
    'validation:notValidDate': `"${vars?.value ?? ''}" is not a valid date.`,
    'validation:longitudeOutOfBounds': 'Longitude must be between -180 and 180.',
    'validation:latitudeOutOfBounds': 'Latitude must be between -90 and 90.',
    'fields:passwordsDoNotMatch': 'Passwords do not match.',
    'general:value': 'Value',
    'general:rows': 'rows',
    'general:row': 'row',
  }
  return messages[key] ?? key
}

export function t(options: ClientValidateOptions, key: string, vars?: Record<string, unknown>): string {
  return (options.t ?? defaultT)(key, vars)
}
