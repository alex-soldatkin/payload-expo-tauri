import ExpoModulesCore

public class ScrollablePreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScrollablePreview")

    // ── Trigger view (wraps child content, shows preview on long press) ──
    View(ScrollablePreviewTriggerView.self) {
      Prop("previewWidth") { (view: ScrollablePreviewTriggerView, value: CGFloat?) in
        view.previewWidth = value
      }
      Prop("previewHeight") { (view: ScrollablePreviewTriggerView, value: CGFloat?) in
        view.previewHeight = value
      }
      Events("onPrimaryAction", "onPreviewOpen", "onPreviewClose")
    }

    // ── Preview content container (the scrollable content inside the popup) ──
    View(ScrollablePreviewContentView.self) {}

    // ── Action item ──
    View(ScrollablePreviewActionView.self) {
      Prop("title") { (view: ScrollablePreviewActionView, value: String?) in
        view.actionTitle = value
      }
      Prop("icon") { (view: ScrollablePreviewActionView, value: String?) in
        view.iconName = value
      }
      Prop("destructive") { (view: ScrollablePreviewActionView, value: Bool?) in
        view.isDestructive = value ?? false
      }
      Events("onActionPress")
    }
  }
}
