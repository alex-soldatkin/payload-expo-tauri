/**
 * useDocumentInfo — Native implementation.
 *
 * Reads document metadata from FormDataContext (slug) and
 * combines with PayloadNativeProvider context.
 */
import { useFormData, useAdminSchema } from '@payload-universal/admin-native'

export type UseDocumentInfoReturn = {
  id: string | undefined
  collectionSlug: string | undefined
  globalSlug: string | undefined
  slug: string
  title: string
  publishedDoc: Record<string, unknown> | null
  unpublishedVersions: unknown[]
  docPermissions: Record<string, unknown>
}

export function useDocumentInfo(): UseDocumentInfoReturn {
  const formData = useFormData()
  const schema = useAdminSchema()
  const slug = formData?.slug ?? ''
  const id = formData?.formData?.id as string | undefined

  // Determine if this is a collection or global
  const isGlobal = schema
    ? !!(schema as any)?.menuModel?.globals?.find?.((g: any) => g.slug === slug)
    : false

  return {
    id,
    collectionSlug: isGlobal ? undefined : slug,
    globalSlug: isGlobal ? slug : undefined,
    slug,
    title: (formData?.formData?.title as string) ?? '',
    publishedDoc: null,
    unpublishedVersions: [],
    docPermissions: {},
  }
}
