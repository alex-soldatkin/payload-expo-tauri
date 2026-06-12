import ExpoModulesCore
import UIKit

// Telegram-style scrollable peek.
//
// Architecture (modelled on Telegram-iOS ContextUI/PeekController):
// - A custom UILongPressGestureRecognizer on the trigger view (NO UIContextMenuInteraction).
// - On begin: haptic + present a dedicated overlay UIWindow at .alert level with a
//   UIVisualEffectView blur + dim backdrop. Using a separate window means React Native
//   Modal/BottomSheet teardown can never reparent or kill the overlay (the old
//   UIContextMenuInteraction implementation crashed there).
// - The RN Content subview is reparented into a rounded container sized to the preview.
//   RN ScrollViews/FlatLists inside the content scroll natively while the peek is open
//   (UIScrollView pan recognizers do not depend on the RN root touch handler).
// - While the long-press finger is still down, moving it highlights action rows below the
//   preview (selection haptics, 12pt activation threshold like Telegram); lifting over a row
//   performs it, lifting elsewhere leaves the peek open in interactive mode.
// - Dismissal: tap on backdrop, swipe-down on the preview (translation-follow with spring
//   back / exit), tap on the preview content (fires onPrimaryAction), or programmatic.
// - Spring in/out animations morph from/to the trigger's on-screen rect (Telegram:
//   duration ~0.4, slight overshoot).

// MARK: - Trigger View (wraps the child, handles long press)

class ScrollablePreviewTriggerView: ExpoView {
  var previewWidth: CGFloat?
  var previewHeight: CGFloat?
  var previewHeightFraction: CGFloat?

  let onPrimaryAction = EventDispatcher()
  let onPreviewOpen = EventDispatcher()
  let onPreviewClose = EventDispatcher()

  private var longPress: UILongPressGestureRecognizer!
  private var tap: UITapGestureRecognizer!

  // Child views categorised at mount time
  private var triggerContent: UIView?   // first non-marker child (the visible row)
  private var previewContent: ScrollablePreviewContentView?
  private var actionViews: [ScrollablePreviewActionView] = []

  // Overlay presentation state (dedicated window, see header comment)
  private var overlayWindow: UIWindow?
  private weak var overlayVC: ScrollablePreviewOverlayVC?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = true

    longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
    longPress.minimumPressDuration = 0.35
    addGestureRecognizer(longPress)

    tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
    tap.require(toFail: longPress)
    addGestureRecognizer(tap)
  }

  // ── Child management ──────────────────────────────────────────

  override func insertSubview(_ view: UIView, at index: Int) {
    super.insertSubview(view, at: index)
    categoriseChildren()
  }

  override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    categoriseChildren()
  }

  private func categoriseChildren() {
    var content: UIView?
    var preview: ScrollablePreviewContentView?
    var actions: [ScrollablePreviewActionView] = []

    for sub in subviews {
      if let p = sub as? ScrollablePreviewContentView {
        preview = p
        if overlayVC == nil {
          p.isHidden = true  // hidden until preview opens
        }
      } else if let a = sub as? ScrollablePreviewActionView {
        actions.append(a)
        a.isHidden = true
      } else {
        content = sub
      }
    }
    triggerContent = content
    previewContent = preview
    actionViews = actions
  }

  // ── Safety: trigger leaving the hierarchy (e.g. RN Modal teardown) ──

  override func willMove(toWindow newWindow: UIWindow?) {
    super.willMove(toWindow: newWindow)
    if newWindow == nil, let overlay = overlayVC {
      // Restore the content view and tear down the overlay window synchronously,
      // before RN finishes unmounting this subtree.
      overlay.dismissImmediately()
    }
  }

  // ── Appearance: keep the open overlay in step with the app's scheme ──

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    // If the app's appearance override changes while a peek is open (e.g. the user
    // switches the in-app theme, or the system scheme flips under 'system'),
    // re-mirror the host window's override onto the overlay window.
    if let overlayWindow = overlayWindow, let hostWindow = self.window,
       overlayWindow.overrideUserInterfaceStyle != hostWindow.overrideUserInterfaceStyle {
      overlayWindow.overrideUserInterfaceStyle = hostWindow.overrideUserInterfaceStyle
    }
  }

  // ── Gestures ──────────────────────────────────────────────────

  @objc private func handleTap() {
    onPrimaryAction()
  }

  @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
    switch gesture.state {
    case .began:
      let generator = UIImpactFeedbackGenerator(style: .medium)
      generator.impactOccurred()

      // Brief scale-down acknowledgement on the source row (Telegram-style press response)
      UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseOut, animations: {
        self.triggerContent?.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
      }) { _ in
        UIView.animate(withDuration: 0.15) {
          self.triggerContent?.transform = .identity
        }
      }

      presentPreview()
    case .changed:
      // Pan-while-held: forward finger location for action-row highlighting.
      // Both windows are full-screen, so host-window coords map 1:1 to overlay coords.
      overlayVC?.updateHandoffHighlight(windowPoint: gesture.location(in: nil))
    case .ended:
      overlayVC?.finishHandoff(windowPoint: gesture.location(in: nil))
    case .cancelled, .failed:
      overlayVC?.cancelHandoff()
    default:
      break
    }
  }

  // ── Preview presentation (dedicated overlay window) ───────────

  private func presentPreview() {
    guard overlayWindow == nil else { return }
    guard let previewContent = previewContent else { return }
    guard let hostWindow = self.window else { return }

    let screenBounds = hostWindow.bounds
    let fraction = min(max(previewHeightFraction ?? 0.65, 0.2), 0.95)
    let width = previewWidth ?? floor(screenBounds.width * 0.92)
    let height = previewHeight ?? floor(screenBounds.height * fraction)

    // Source rect in window coordinates — used for the morph in/out animations.
    let sourceRect = self.convert(self.bounds, to: nil)

    let overlay = ScrollablePreviewOverlayVC(
      previewContent: previewContent,
      actionViews: actionViews,
      previewSize: CGSize(width: width, height: height),
      sourceRect: sourceRect,
      screenBounds: screenBounds
    )
    overlay.onPrimaryAction = { [weak self] in
      self?.onPrimaryAction()
    }
    overlay.onDismissed = { [weak self] in
      guard let self = self else { return }
      self.overlayWindow?.isHidden = true
      self.overlayWindow?.rootViewController = nil
      self.overlayWindow = nil
      self.onPreviewClose()
    }

    let window: UIWindow
    if let scene = hostWindow.windowScene {
      window = UIWindow(windowScene: scene)
    } else {
      window = UIWindow(frame: hostWindow.frame)
    }
    // Mirror the host window's frame so coordinates from the trigger's window
    // (source rect, pan-while-held locations) map 1:1 onto the overlay.
    window.frame = hostWindow.frame
    window.windowLevel = .alert
    window.backgroundColor = .clear
    // Inherit the app's interface style. The RN app applies its stored theme
    // preference ('system' | 'light' | 'dark') via Appearance.setColorScheme, which
    // sets overrideUserInterfaceStyle only on the windows that exist at that moment —
    // this freshly created overlay window would otherwise fall back to the
    // Info.plist/system style and could render in the wrong scheme.
    window.overrideUserInterfaceStyle = hostWindow.overrideUserInterfaceStyle
    window.rootViewController = overlay

    overlayWindow = window
    overlayVC = overlay

    NSLog("[PREVIEW-NATIVE] presentPreview → showing overlay window")
    onPreviewOpen()

    window.isHidden = false
    window.layoutIfNeeded()
    overlay.animateIn()
  }
}

// MARK: - Preview Content View (marker, holds RN children for the popup)

class ScrollablePreviewContentView: ExpoView {
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
  }
}

// MARK: - Action View (marker, holds title/icon/destructive props)

class ScrollablePreviewActionView: ExpoView {
  var actionTitle: String?
  var iconName: String?
  var isDestructive: Bool = false
  let onActionPress = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
  }
}

// MARK: - Overlay ViewController (blur + dim backdrop, preview container, action capsules)

class ScrollablePreviewOverlayVC: UIViewController, UIGestureRecognizerDelegate {
  private let previewContentView: ScrollablePreviewContentView
  private let actionModels: [ScrollablePreviewActionView]
  private let previewSize: CGSize
  private let sourceRect: CGRect
  private let screenBounds: CGRect

  // Restore info for the reparented RN content view
  private weak var originalParent: UIView?
  private var originalFrame: CGRect = .zero

  var onPrimaryAction: (() -> Void)?
  var onDismissed: (() -> Void)?

  // UI elements
  private let blurView = UIVisualEffectView(effect: nil)
  private let dimView = UIView()
  private let shadowContainer = UIView()    // carries shadow + transforms
  private let contentWrapper = UIView()     // rounded, clips the RN content
  private let actionsContainer = UIView()   // stack of capsule rows
  private var actionRowViews: [UIView] = []

  // Swipe-down state
  private var dismissPan: UIPanGestureRecognizer!
  private weak var trackedScrollView: UIScrollView?
  private var isDraggingDown = false

  // Pan-while-held (gesture handoff from the trigger) state
  private var handoffInitialPoint: CGPoint?
  private var handoffActive = false
  private var highlightedActionIndex: Int?
  private let selectionFeedback = UISelectionFeedbackGenerator()

  private var isTornDown = false

  private let rowHeight: CGFloat = 46
  private let rowGap: CGFloat = 8

  init(
    previewContent: ScrollablePreviewContentView,
    actionViews: [ScrollablePreviewActionView],
    previewSize: CGSize,
    sourceRect: CGRect,
    screenBounds: CGRect
  ) {
    self.previewContentView = previewContent
    self.actionModels = actionViews
    self.previewSize = previewSize
    self.sourceRect = sourceRect
    self.screenBounds = screenBounds
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError() }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear

    // ── Backdrop: blur + dim, tap to dismiss ──
    // (The blur effect itself — .systemUltraThinMaterial, set in animateIn — is one of
    // the adaptive system materials, so it re-renders for light/dark automatically.)
    blurView.frame = view.bounds
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(blurView)

    dimView.frame = view.bounds
    dimView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    // Dynamic color: black dim reads correctly in both schemes, but dark mode needs a
    // heavier alpha for the preview to separate from already-dark content behind it.
    dimView.backgroundColor = UIColor { trait in
      trait.userInterfaceStyle == .dark
        ? UIColor(white: 0.0, alpha: 0.35)
        : UIColor(white: 0.0, alpha: 0.18)
    }
    dimView.alpha = 0
    view.addSubview(dimView)

    let dimTap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap))
    dimView.addGestureRecognizer(dimTap)

    // ── Preview container: shadow wrapper + rounded clipping wrapper ──
    shadowContainer.layer.shadowColor = UIColor.black.cgColor  // black shadow is correct in both schemes
    shadowContainer.layer.shadowRadius = 30
    shadowContainer.layer.shadowOffset = CGSize(width: 0, height: 10)
    applyShadowAppearance()
    view.addSubview(shadowContainer)

    contentWrapper.layer.cornerRadius = 16
    contentWrapper.layer.cornerCurve = .continuous
    contentWrapper.clipsToBounds = true
    // Dynamic color: dark = systemGray6-dark card tone, light = the app's paper tone.
    contentWrapper.backgroundColor = UIColor { trait in
      trait.userInterfaceStyle == .dark
        ? UIColor(red: 28/255, green: 28/255, blue: 30/255, alpha: 1)
        : UIColor(red: 246/255, green: 244/255, blue: 241/255, alpha: 1)
    }
    shadowContainer.addSubview(contentWrapper)

    // Tap on the preview content = primary action (like committing a peek)
    let contentTap = UITapGestureRecognizer(target: self, action: #selector(handleContentTap))
    contentTap.cancelsTouchesInView = false
    contentWrapper.addGestureRecognizer(contentTap)

    // ── Reparent the RN content view ──
    originalParent = previewContentView.superview
    originalFrame = previewContentView.frame

    previewContentView.isHidden = false
    previewContentView.removeFromSuperview()
    previewContentView.frame = CGRect(origin: .zero, size: previewSize)
    contentWrapper.addSubview(previewContentView)
    // The JS layer sizes the Content subtree to exactly previewSize (absolute position),
    // so Yoga layout matches this frame and inner ScrollViews have correct content sizes.
    previewContentView.setNeedsLayout()
    previewContentView.layoutIfNeeded()

    // ── Action capsules ──
    buildActionRows()

    // ── Static layout (Telegram: content block vertically biased above centre) ──
    let actionsSize = actionsContainerSize()
    let totalHeight = previewSize.height + (actionsSize.height > 0 ? rowGap + actionsSize.height : 0)
    let topY = max(60, (screenBounds.height - totalHeight) / 2)
    let contentX = (screenBounds.width - previewSize.width) / 2

    shadowContainer.frame = CGRect(x: contentX, y: topY, width: previewSize.width, height: previewSize.height)
    contentWrapper.frame = shadowContainer.bounds

    // Actions: right-aligned under the content (like iOS system menus)
    actionsContainer.frame = CGRect(
      x: contentX + previewSize.width - actionsSize.width,
      y: topY + previewSize.height + rowGap,
      width: actionsSize.width,
      height: actionsSize.height
    )
    view.addSubview(actionsContainer)
    layoutActionRows()

    // ── Swipe-down to dismiss (cooperates with inner scroll views) ──
    dismissPan = UIPanGestureRecognizer(target: self, action: #selector(handleDismissPan(_:)))
    dismissPan.delegate = self
    view.addGestureRecognizer(dismissPan)

    selectionFeedback.prepare()
  }

  // ── Appearance ──

  /// The shadow lives on a CALayer (CGColor is resolved, not dynamic), so its
  /// scheme-dependent opacity must be re-applied by hand on trait changes.
  private func applyShadowAppearance() {
    shadowContainer.layer.shadowOpacity = traitCollection.userInterfaceStyle == .dark ? 0.5 : 0.25
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if traitCollection.userInterfaceStyle != previousTraitCollection?.userInterfaceStyle {
      applyShadowAppearance()
    }
  }

  // ── Action rows (rounded glass capsules, SF Symbol + title) ──

  private var actionsWidth: CGFloat = 0

  private func buildActionRows() {
    guard !actionModels.isEmpty else { return }

    let hPad: CGFloat = 16
    let iconSpace: CGFloat = 32
    var maxTextWidth: CGFloat = 0
    let attrs: [NSAttributedString.Key: Any] = [
      .font: UIFont.systemFont(ofSize: 17, weight: .regular)
    ]
    for action in actionModels {
      let title = action.actionTitle ?? "Action"
      let size = (title as NSString).size(withAttributes: attrs)
      maxTextWidth = max(maxTextWidth, size.width)
    }
    actionsWidth = min(ceil(maxTextWidth + iconSpace + hPad * 2 + 16), previewSize.width)

    for (index, action) in actionModels.enumerated() {
      let capsule = UIView()
      capsule.layer.cornerRadius = rowHeight / 2
      capsule.layer.cornerCurve = .continuous
      capsule.clipsToBounds = true

      let rowBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
      rowBlur.frame = CGRect(x: 0, y: 0, width: actionsWidth, height: rowHeight)
      rowBlur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      capsule.addSubview(rowBlur)

      // .label / .systemRed are dynamic system colors — they re-resolve on trait changes.
      let color: UIColor = action.isDestructive ? .systemRed : .label

      let label = UILabel()
      label.text = action.actionTitle ?? "Action"
      label.font = .systemFont(ofSize: 17, weight: .regular)
      label.textColor = color
      label.frame = CGRect(x: hPad + 4, y: 0, width: actionsWidth - 56, height: rowHeight)
      rowBlur.contentView.addSubview(label)

      if let iconName = action.iconName, let img = UIImage(systemName: iconName) {
        // Template rendering + tintColor (rather than baking the resolved color into
        // the image) so the dynamic color re-resolves when the scheme changes.
        let iv = UIImageView(image: img.withRenderingMode(.alwaysTemplate))
        iv.tintColor = color
        iv.contentMode = .scaleAspectFit
        iv.frame = CGRect(x: actionsWidth - hPad - 22, y: (rowHeight - 20) / 2, width: 20, height: 20)
        rowBlur.contentView.addSubview(iv)
      }

      // Highlight overlay (used by both direct touches and pan-while-held)
      let highlight = UIView()
      highlight.frame = CGRect(x: 0, y: 0, width: actionsWidth, height: rowHeight)
      highlight.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      // Dynamic: light-on-dark / dark-on-light wash over the capsule material.
      highlight.backgroundColor = UIColor { trait in
        trait.userInterfaceStyle == .dark
          ? UIColor(white: 1.0, alpha: 0.12)
          : UIColor(white: 0.0, alpha: 0.12)
      }
      highlight.alpha = 0
      highlight.tag = 991
      rowBlur.contentView.addSubview(highlight)

      let btn = UIButton(frame: CGRect(x: 0, y: 0, width: actionsWidth, height: rowHeight))
      btn.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      btn.backgroundColor = .clear
      btn.addAction(UIAction { [weak self] _ in
        self?.performAction(at: index)
      }, for: .touchUpInside)
      btn.addAction(UIAction(identifier: .init("down-\(index)")) { [weak self] _ in
        self?.setRowHighlighted(index, highlighted: true)
      }, for: .touchDown)
      btn.addAction(UIAction(identifier: .init("up-\(index)")) { [weak self] _ in
        self?.setRowHighlighted(index, highlighted: false)
      }, for: [.touchUpInside, .touchUpOutside, .touchCancel])
      rowBlur.contentView.addSubview(btn)

      actionRowViews.append(capsule)
      actionsContainer.addSubview(capsule)
    }
  }

  private func actionsContainerSize() -> CGSize {
    guard !actionModels.isEmpty else { return .zero }
    let count = CGFloat(actionModels.count)
    return CGSize(width: actionsWidth, height: count * rowHeight + (count - 1) * rowGap)
  }

  private func layoutActionRows() {
    var y: CGFloat = 0
    for capsule in actionRowViews {
      capsule.frame = CGRect(x: 0, y: y, width: actionsWidth, height: rowHeight)
      y += rowHeight + rowGap
    }
  }

  private func setRowHighlighted(_ index: Int?, highlighted: Bool) {
    guard let index = index, index >= 0, index < actionRowViews.count else { return }
    // The highlight overlay lives inside the row's blur content view
    if let blur = actionRowViews[index].subviews.first as? UIVisualEffectView,
       let highlight = blur.contentView.viewWithTag(991) {
      highlight.alpha = highlighted ? 1 : 0
    }
  }

  private func performAction(at index: Int) {
    guard index >= 0, index < actionModels.count else { return }
    NSLog("[PREVIEW-NATIVE] action \(index) pressed → firing onActionPress + dismiss")
    actionModels[index].onActionPress()
    dismissPreview()
  }

  // ── Pan-while-held (handoff from the trigger's long-press) ──

  private func actionIndex(at viewPoint: CGPoint) -> Int? {
    let pointInActions = view.convert(viewPoint, to: actionsContainer)
    guard actionsContainer.bounds.insetBy(dx: -8, dy: -8).contains(pointInActions) else { return nil }
    for (index, capsule) in actionRowViews.enumerated() {
      if capsule.frame.contains(pointInActions) {
        return index
      }
    }
    return nil
  }

  func updateHandoffHighlight(windowPoint: CGPoint) {
    guard !isTornDown else { return }
    let point = view.convert(windowPoint, from: nil)
    if handoffInitialPoint == nil {
      handoffInitialPoint = point
    }
    guard let initial = handoffInitialPoint else { return }

    if !handoffActive {
      let dx = point.x - initial.x
      let dy = point.y - initial.y
      // Telegram: only start highlighting after moving away from the press point
      if dx * dx + dy * dy > 12.0 * 12.0 {
        handoffActive = true
      } else {
        return
      }
    }

    let index = actionIndex(at: point)
    if index != highlightedActionIndex {
      if let previous = highlightedActionIndex {
        setRowHighlighted(previous, highlighted: false)
      }
      if let index = index {
        setRowHighlighted(index, highlighted: true)
        selectionFeedback.selectionChanged()
        selectionFeedback.prepare()
      }
      highlightedActionIndex = index
    }
  }

  func finishHandoff(windowPoint: CGPoint) {
    guard !isTornDown else { return }
    let point = view.convert(windowPoint, from: nil)
    let index = handoffActive ? actionIndex(at: point) : nil
    if let previous = highlightedActionIndex {
      setRowHighlighted(previous, highlighted: false)
    }
    highlightedActionIndex = nil
    handoffInitialPoint = nil
    handoffActive = false
    if let index = index {
      performAction(at: index)
    }
    // Otherwise the finger lifted elsewhere → peek stays open in interactive mode.
  }

  func cancelHandoff() {
    if let previous = highlightedActionIndex {
      setRowHighlighted(previous, highlighted: false)
    }
    highlightedActionIndex = nil
    handoffInitialPoint = nil
    handoffActive = false
  }

  // ── Animations (Telegram: spring morph from/to the source rect) ──

  func animateIn() {
    view.layoutIfNeeded()

    let targetCenter = shadowContainer.center
    let scale = min(max(sourceRect.width / max(previewSize.width, 1), 0.2), 1.0)
    let dx = sourceRect.midX - targetCenter.x
    let dy = sourceRect.midY - targetCenter.y

    shadowContainer.transform = CGAffineTransform(translationX: dx, y: dy).scaledBy(x: scale, y: scale)
    shadowContainer.alpha = 0
    actionsContainer.transform = CGAffineTransform(translationX: dx * 0.5, y: dy * 0.5).scaledBy(x: 0.4, y: 0.4)
    actionsContainer.alpha = 0

    let springIn = UIViewPropertyAnimator(duration: 0.42, dampingRatio: 0.8) {
      self.shadowContainer.transform = .identity
      self.shadowContainer.alpha = 1
      self.actionsContainer.transform = .identity
      self.actionsContainer.alpha = 1
    }
    springIn.startAnimation()

    UIView.animate(withDuration: 0.3) {
      self.blurView.effect = UIBlurEffect(style: .systemUltraThinMaterial)
      self.dimView.alpha = 1
    }
  }

  @objc private func handleBackdropTap() {
    dismissPreview()
  }

  @objc private func handleContentTap() {
    NSLog("[PREVIEW-NATIVE] content tap → firing onPrimaryAction + dismiss")
    onPrimaryAction?()
    dismissPreview()
  }

  // ── Swipe-down dismissal ──

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    return true
  }

  private func findScrollView(at viewPoint: CGPoint) -> UIScrollView? {
    let pointInWrapper = view.convert(viewPoint, to: contentWrapper)
    guard contentWrapper.bounds.contains(pointInWrapper) else { return nil }
    var candidate: UIView? = contentWrapper.hitTest(pointInWrapper, with: nil)
    while let current = candidate, current !== contentWrapper {
      if let scrollView = current as? UIScrollView {
        return scrollView
      }
      candidate = current.superview
    }
    return nil
  }

  @objc private func handleDismissPan(_ pan: UIPanGestureRecognizer) {
    switch pan.state {
    case .began:
      trackedScrollView = findScrollView(at: pan.location(in: view))
      isDraggingDown = false
    case .changed:
      let translation = pan.translation(in: view)
      if !isDraggingDown {
        let scrollAtTop: Bool
        if let scrollView = trackedScrollView {
          scrollAtTop = scrollView.contentOffset.y <= -scrollView.adjustedContentInset.top + 1.0
        } else {
          scrollAtTop = true
        }
        if translation.y > 8.0 && abs(translation.y) > abs(translation.x) && scrollAtTop {
          isDraggingDown = true
          // Cancel the inner scroll pan so the preview follows the finger exclusively
          if let scrollView = trackedScrollView {
            scrollView.panGestureRecognizer.isEnabled = false
            scrollView.panGestureRecognizer.isEnabled = true
          }
          pan.setTranslation(.zero, in: view)
        }
      } else {
        let dy = max(0, pan.translation(in: view).y)
        let transform = CGAffineTransform(translationX: 0, y: dy)
        shadowContainer.transform = transform
        actionsContainer.transform = transform
        let progress = min(dy / 300.0, 1.0)
        dimView.alpha = 1.0 - 0.6 * progress
      }
    case .ended, .cancelled:
      guard isDraggingDown else { break }
      isDraggingDown = false
      let dy = pan.translation(in: view).y
      let vy = pan.velocity(in: view).y
      if dy > 140 || vy > 900 {
        dismissDownward(velocityY: vy)
      } else {
        let springBack = UIViewPropertyAnimator(duration: 0.35, dampingRatio: 0.8) {
          self.shadowContainer.transform = .identity
          self.actionsContainer.transform = .identity
          self.dimView.alpha = 1
        }
        springBack.startAnimation()
      }
    default:
      break
    }
  }

  // ── Dismissal paths ──

  @objc func dismissPreview() {
    guard !isTornDown else { return }
    isTornDown = true
    view.isUserInteractionEnabled = false
    NSLog("[PREVIEW-NATIVE] dismissPreview → morphing back to source")

    let targetCenter = shadowContainer.center
    let scale = min(max(sourceRect.width / max(previewSize.width, 1), 0.2), 1.0)
    let dx = sourceRect.midX - targetCenter.x
    let dy = sourceRect.midY - targetCenter.y

    UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn, animations: {
      self.blurView.effect = nil
      self.dimView.alpha = 0
      self.shadowContainer.transform = CGAffineTransform(translationX: dx, y: dy).scaledBy(x: scale, y: scale)
      self.shadowContainer.alpha = 0
      self.actionsContainer.transform = CGAffineTransform(translationX: dx * 0.5, y: dy * 0.5).scaledBy(x: 0.4, y: 0.4)
      self.actionsContainer.alpha = 0
    }) { _ in
      self.teardown()
    }
  }

  private func dismissDownward(velocityY: CGFloat) {
    guard !isTornDown else { return }
    isTornDown = true
    view.isUserInteractionEnabled = false
    NSLog("[PREVIEW-NATIVE] dismissDownward → sliding out")

    let currentY = shadowContainer.transform.ty
    let exitY = screenBounds.height - shadowContainer.frame.origin.y + currentY

    UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn, animations: {
      self.blurView.effect = nil
      self.dimView.alpha = 0
      self.shadowContainer.transform = CGAffineTransform(translationX: 0, y: exitY)
      self.actionsContainer.transform = CGAffineTransform(translationX: 0, y: exitY)
      self.actionsContainer.alpha = 0
    }) { _ in
      self.teardown()
    }
  }

  /// Synchronous teardown without animation — used when the trigger leaves the
  /// view hierarchy (e.g. an enclosing RN Modal/BottomSheet is being closed).
  func dismissImmediately() {
    guard !isTornDown else { return }
    isTornDown = true
    NSLog("[PREVIEW-NATIVE] dismissImmediately (trigger left hierarchy)")
    teardown()
  }

  private func teardown() {
    restoreContent()
    NSLog("[PREVIEW-NATIVE] teardown → firing onDismissed (JS onPreviewClose)")
    onDismissed?()
  }

  /// Return the RN content view to its original parent (if it still exists).
  private func restoreContent() {
    previewContentView.removeFromSuperview()
    previewContentView.frame = originalFrame
    previewContentView.isHidden = true
    if let parent = originalParent {
      parent.addSubview(previewContentView)
    }
  }
}
