// GENERATED — do not edit. Registers passthrough admin components
// (original web admin sources) into the desktop form registry.
import { registerFieldComponents } from '../../registry'
import { asPayloadField, asPayloadRowLabel } from '../../ui-shim/adapters'
import SlugField from './SlugField'
import ContentMetrics from './ContentMetrics'
import SEOPreview from './SEOPreview'
import ReadTimeChart from './ReadTimeChart'
import StatusDashboard from './StatusDashboard'
import PriceSummary from './PriceSummary'
import SessionRowLabel from './SessionRowLabel'
import FooterLinkRowLabel from './FooterLinkRowLabel'

registerFieldComponents('posts.slug', { Field: asPayloadField(SlugField) })
registerFieldComponents('posts.excerpt', { afterInput: asPayloadField(ContentMetrics) })
registerFieldComponents('posts.metaTitle', { Field: asPayloadField(SEOPreview) })
registerFieldComponents('posts.readTime', { afterInput: asPayloadField(ReadTimeChart) })
registerFieldComponents('posts.status', { afterInput: asPayloadField(StatusDashboard) })
registerFieldComponents('products.priceSummary', { Field: asPayloadField(PriceSummary) })
registerFieldComponents('events.sessions', { RowLabel: asPayloadRowLabel(SessionRowLabel) })
registerFieldComponents('footer.links', { RowLabel: asPayloadRowLabel(FooterLinkRowLabel) })
