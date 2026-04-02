import ExpoModulesCore
import UIKit

// MARK: - Trigger View (wraps the child, handles long press)

class ScrollablePreviewTriggerView: ExpoView {
  var previewWidth: CGFloat?
  var previewHeight: CGFloat?

  let onPrimaryAction = EventDispatcher()
  let onPreviewOpen = EventDispatcher()
  let onPreviewClose = EventDispatcher()

  private var longPress: UILongPressGestureRecognizer!
  private var tap: UITapGestureRecognizer!

  // Child views categorised at mount time
  private var triggerContent: UIView?   // first non-marker child (the visible row)
  private var previewContent: ScrollablePreviewContentView?
  private var actionViews: [ScrollablePreviewActionView] = []

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
        p.isHidden = true  // hidden until preview opens
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

  // ── Gestures ──────────────────────────────────────────────────

  @objc private func handleTap() {
    onPrimaryAction()
  }

  @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
    guard gesture.state == .began else { return }

    // Haptic feedback
    let generator = UIImpactFeedbackGenerator(style: .medium)
    generator.impactOccurred()

    // Scale-down animation on the source view
    UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseOut, animations: {
      self.triggerContent?.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
    }) { _ in
      UIView.animate(withDuration: 0.15) {
        self.triggerContent?.transform = .identity
      }
    }

    presentPreview()
  }

  // ── Preview presentation ──────────────────────────────────────

  private func presentPreview() {
    guard let previewContent = previewContent else { return }
    guard let window = self.window else { return }
    guard let rootVC = window.rootViewController else { return }

    // Find the topmost presented VC
    var topVC = rootVC
    while let presented = topVC.presentedViewController {
      topVC = presented
    }

    let overlay = ScrollablePreviewOverlayVC(
      previewContent: previewContent,
      actionViews: actionViews,
      previewWidth: previewWidth ?? (window.bounds.width * 0.92),
      previewHeight: previewHeight ?? (window.bounds.height * 0.65)
    )
    overlay.onDismiss = { [weak self] in
      self?.onPreviewClose()
    }
    overlay.modalPresentationStyle = .overCurrentContext
    overlay.modalTransitionStyle = .crossDissolve

    onPreviewOpen()
    topVC.present(overlay, animated: false) {
      overlay.animateIn()
    }
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

// MARK: - Overlay ViewController (blur + floating content + actions)

class ScrollablePreviewOverlayVC: UIViewController, UIScrollViewDelegate {
  private let previewContentView: ScrollablePreviewContentView
  private let actionViewModels: [ScrollablePreviewActionView]
  private let previewW: CGFloat
  private let previewH: CGFloat

  var onDismiss: (() -> Void)?

  // UI elements
  private let blurView = UIVisualEffectView(effect: nil)
  private let containerView = UIView()
  private let contentWrapper = UIView()
  private let actionsWrapper = UIView()

  // Outer scroll (Telegram's "hidden scroller" trick for scrolling the whole popup)
  private let outerScroller = UIScrollView()

  init(
    previewContent: ScrollablePreviewContentView,
    actionViews: [ScrollablePreviewActionView],
    previewWidth: CGFloat,
    previewHeight: CGFloat
  ) {
    self.previewContentView = previewContent
    self.actionViewModels = actionViews
    self.previewW = previewWidth
    self.previewH = previewHeight
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError() }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear

    // ── Blur background ──
    blurView.frame = view.bounds
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(blurView)

    // Dismiss on tap
    let dimTap = UITapGestureRecognizer(target: self, action: #selector(dismissPreview))
    blurView.addGestureRecognizer(dimTap)

    // ── Container (holds content + actions, centered) ──
    view.addSubview(containerView)

    // ── Content wrapper (rounded, clips, holds the RN view) ──
    contentWrapper.layer.cornerRadius = 14
    contentWrapper.layer.cornerCurve = .continuous
    contentWrapper.clipsToBounds = true
    contentWrapper.backgroundColor = UIColor(red: 246/255, green: 244/255, blue: 241/255, alpha: 1)
    containerView.addSubview(contentWrapper)

    // Move the RN preview content into our wrapper
    previewContentView.isHidden = false
    previewContentView.frame = CGRect(x: 0, y: 0, width: previewW, height: previewH)
    contentWrapper.addSubview(previewContentView)

    // ── Actions wrapper ──
    actionsWrapper.layer.cornerRadius = 14
    actionsWrapper.layer.cornerCurve = .continuous
    actionsWrapper.clipsToBounds = true
    containerView.addSubview(actionsWrapper)

    // Blur behind actions
    let actionsBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
    actionsBlur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    actionsWrapper.addSubview(actionsBlur)

    // Build action buttons
    var yOffset: CGFloat = 0
    for (i, action) in actionViewModels.enumerated() {
      let btn = makeActionButton(
        title: action.actionTitle ?? "Action",
        icon: action.iconName,
        destructive: action.isDestructive,
        action: { [weak self, weak action] in
          action?.onActionPress()
          self?.dismissPreview()
        }
      )
      btn.frame = CGRect(x: 0, y: yOffset, width: previewW, height: 50)
      actionsBlur.contentView.addSubview(btn)

      if i < actionViewModels.count - 1 {
        let sep = UIView()
        sep.backgroundColor = UIColor.separator
        sep.frame = CGRect(x: 16, y: yOffset + 49.5, width: previewW - 32, height: 0.5)
        actionsBlur.contentView.addSubview(sep)
      }
      yOffset += 50
    }

    // Layout
    let actionsHeight = CGFloat(actionViewModels.count) * 50
    let totalHeight = previewH + 8 + actionsHeight
    let topY = (view.bounds.height - totalHeight) / 2

    containerView.frame = CGRect(
      x: (view.bounds.width - previewW) / 2,
      y: topY,
      width: previewW,
      height: totalHeight
    )
    contentWrapper.frame = CGRect(x: 0, y: 0, width: previewW, height: previewH)
    actionsWrapper.frame = CGRect(x: 0, y: previewH + 8, width: previewW, height: actionsHeight)

    // Start invisible for animate-in
    containerView.transform = CGAffineTransform(scaleX: 0.85, y: 0.85)
    containerView.alpha = 0
  }

  // ── Animation ──

  func animateIn() {
    UIView.animate(
      withDuration: 0.4,
      delay: 0,
      usingSpringWithDamping: 0.78,
      initialSpringVelocity: 0,
      options: [],
      animations: {
        self.blurView.effect = UIBlurEffect(style: .systemUltraThinMaterial)
        self.containerView.transform = .identity
        self.containerView.alpha = 1
      }
    )
  }

  @objc private func dismissPreview() {
    UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseIn, animations: {
      self.blurView.effect = nil
      self.containerView.alpha = 0
      self.containerView.transform = CGAffineTransform(scaleX: 0.9, y: 0.9)
    }) { _ in
      // Move preview content back to the trigger
      self.previewContentView.isHidden = true
      self.onDismiss?()
      self.dismiss(animated: false)
    }
  }

  // ── Action button factory ──

  private func makeActionButton(
    title: String,
    icon: String?,
    destructive: Bool,
    action: @escaping () -> Void
  ) -> UIButton {
    var config = UIButton.Configuration.plain()
    config.title = title
    config.baseForegroundColor = destructive ? .systemRed : .label
    config.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)

    if let icon = icon, let img = UIImage(systemName: icon) {
      config.image = img
      config.imagePlacement = .trailing
      config.imagePadding = 8
      config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(scale: .medium)
    }

    let btn = UIButton(configuration: config)
    btn.addAction(UIAction { _ in action() }, for: .touchUpInside)
    return btn
  }
}
