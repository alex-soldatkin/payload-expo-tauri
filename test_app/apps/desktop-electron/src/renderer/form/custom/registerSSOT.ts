// Side-effect module: registers the DOM ports of the SSOT Payload admin custom
// components into the form registry. Imported once from Workspace.
//
// IMPORTANT: these keys must track the SSOT config (admin.components in
// apps/server). Paths are runtime form paths — unnamed tabs/rows/collapsibles
// are transparent, so e.g. `metaTitle` sits at the document root.
import { registerFieldComponents } from '../registry'
import { SlugField } from './SlugField'
import { SEOPreview } from './SEOPreview'
import { ContentMetrics } from './ContentMetrics'
import { ReadTimeChart } from './ReadTimeChart'
import { StatusDashboard } from './StatusDashboard'
import { PriceSummary } from './PriceSummary'
import { SessionRowLabel } from './SessionRowLabel'
import { FooterLinkRowLabel } from './FooterLinkRowLabel'

registerFieldComponents('posts.slug', { Field: SlugField })
registerFieldComponents('posts.metaTitle', { Field: SEOPreview })
registerFieldComponents('posts.excerpt', { afterInput: ContentMetrics })
registerFieldComponents('posts.readTime', { afterInput: ReadTimeChart })
registerFieldComponents('posts.status', { afterInput: StatusDashboard })
registerFieldComponents('products.priceSummary', { Field: PriceSummary })
registerFieldComponents('events.sessions', { RowLabel: SessionRowLabel })
registerFieldComponents('footer.links', { RowLabel: FooterLinkRowLabel })
