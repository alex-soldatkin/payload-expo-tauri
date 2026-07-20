// Passthrough-action manifest — the single source of truth for the modal sweep,
// mirrored verbatim from src/renderer/form/custom/gen/register.gen.ts's
// registerActionComponents(slug, kind, [...]) entries. Regenerate by re-parsing
// that file if the codegen changes.
//
// `components` lists the registered component names in registration order. The
// live DOM decides how many actually render (RBAC / no-doc components return
// null), so specs iterate the rendered `.selection-action.passthrough` /
// `.doc-menu-passthrough` nodes rather than trusting these counts blindly — the
// names are here for reporting and to know WHICH collections to visit.

export type PassthroughEntry = {
  slug: string
  kind: 'list' | 'edit'
  components: string[]
}

export const LIST_ACTIONS: PassthroughEntry[] = [
  { slug: 'accounting-periods', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'ai-audit-log', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'ai-drafts', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'backbone-modifications', kind: 'list', components: ['SeedButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'branded-documents', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'bug-reports', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'carts', kind: 'list', components: ['PrepareShipmentsListButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'categories', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'citations', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'comments', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'conversations', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'credit-transactions', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'cycles', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'deprotection-methods', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'fixed-assets', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'form-submissions', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'forms', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'guides', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'hplc-presets', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'inventory', kind: 'list', components: ['SeedInventoryButton', 'BulkPubChemLookupButton', 'BulkRenderStructuresButton', 'LinkReagentsMonomersButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'invoices', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'invoices-payable', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'lcms-presets', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'locations', kind: 'list', components: ['FinderViewButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'magic-link-tokens', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'message-feedback', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'messages', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'monomers', kind: 'list', components: ['ImportCsvButton', 'SeedMonomersButton', 'SeedMonomerSvgsButton', 'BulkCalculateExtinctionButton', 'SeedFluorescenceButton', 'BulkRenderStructuresButton', 'LinkReagentsMonomersButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'notifications', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'oligo-combinations', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'oligo-remakes', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'opportunities', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'opportunity-files', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'opportunity-progress', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'order-items', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'order-progress', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'orders', kind: 'list', components: ['SelfAssignAndPlanListButton', 'BatchPrintOrderLabelsListButton', 'GenerateRemakesListButton', 'SynthesiserSequences', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'pages', kind: 'list', components: ['SeedMarketingButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'payroll', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'posts', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'projects', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'purification', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'purification-methods', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'qc-reports', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'quotations', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'reagent-orders', kind: 'list', components: ['KanbanViewButton', 'BatchPrintReagentLabelsListButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'reagent-purchase-orders', kind: 'list', components: ['KanbanViewButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'redirects', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'rent-contracts', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'search', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'services', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'shipments', kind: 'list', components: ['BatchGenerateLabelsButton', 'OpenShippingDocumentsListButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'skills', kind: 'list', components: ['SeedSkillsButton', 'RunReflectionButton', 'ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'suppliers', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'synthesis-planner-reports', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'synthesiser-reagent-log', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'synthesisers', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'tags', kind: 'list', components: ['ResetColumnsButton', 'EditModeToggle'] },
  { slug: 'transactions', kind: 'list', components: ['FilterUnpaidPayrollButton', 'PayOutSelectedButton', 'ResetColumnsButton', 'EditModeToggle'] },
]

export const EDIT_ACTIONS: PassthroughEntry[] = [
  { slug: 'carts', kind: 'edit', components: ['PrepareShipmentButton'] },
  { slug: 'opportunities', kind: 'edit', components: ['CalculatePricesButton'] },
  { slug: 'orders', kind: 'edit', components: ['GenerateRunFileButton', 'PushToSynthesiserButton', 'GenerateRemakeButton', 'CombineOrdersButton'] },
  { slug: 'quotations', kind: 'edit', components: ['UnlockAcceptedQuotation', 'CalculatePricesButton'] },
  { slug: 'reagent-orders', kind: 'edit', components: ['ViewPurchaseOrderButton'] },
  { slug: 'shipments', kind: 'edit', components: ['ShippingDocumentsMenuItem'] },
  { slug: 'synthesisers', kind: 'edit', components: ['PortLabelsBatchButton'] },
  { slug: 'transactions', kind: 'edit', components: ['BusinessCardButton'] },
  { slug: 'users', kind: 'edit', components: ['BusinessCardButton'] },
]
