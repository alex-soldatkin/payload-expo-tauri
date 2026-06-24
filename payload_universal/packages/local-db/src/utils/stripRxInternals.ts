/**
 * Strip RxDB-internal bookkeeping fields from a document.
 *
 * Local RxDB documents carry fields that must never leave the storage layer:
 *   _rev / _meta / _attachments  — RxDB revision + metadata
 *   _deleted                     — soft-delete flag
 *   _locallyModified             — our "needs push" marker
 *
 * Used by the replication push handler (before sending to the Payload REST
 * API) and by useValidatedMutations (before merging a partial patch over the
 * existing doc for validation/hooks).
 */
export const stripRxInternals = (
  doc: Record<string, unknown>,
): Record<string, unknown> => {
  const { _rev, _meta, _attachments, _deleted, _locallyModified, ...clean } = doc
  return clean
}
