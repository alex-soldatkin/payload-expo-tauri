package expo.modules.scrollablepreview

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScrollablePreviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScrollablePreview")

    // ── Trigger view (wraps row content, opens the peek dialog on long press) ──
    View(ScrollablePreviewTriggerView::class) {
      Prop("previewWidth") { view: ScrollablePreviewTriggerView, value: Float? ->
        view.previewWidth = value
      }
      Prop("previewHeight") { view: ScrollablePreviewTriggerView, value: Float? ->
        view.previewHeight = value
      }
      Prop("previewHeightFraction") { view: ScrollablePreviewTriggerView, value: Float? ->
        view.previewHeightFraction = value
      }
      Events("onPrimaryAction", "onPreviewOpen", "onPreviewClose")
    }

    // ── Preview content container (the scrollable content inside the popup) ──
    View(ScrollablePreviewContentView::class) {}

    // ── Action item ──
    View(ScrollablePreviewActionView::class) {
      Prop("title") { view: ScrollablePreviewActionView, value: String? ->
        view.actionTitle = value
      }
      Prop("icon") { view: ScrollablePreviewActionView, value: String? ->
        view.iconName = value
      }
      Prop("destructive") { view: ScrollablePreviewActionView, value: Boolean? ->
        view.isDestructive = value ?: false
      }
      Events("onActionPress")
    }
  }
}
