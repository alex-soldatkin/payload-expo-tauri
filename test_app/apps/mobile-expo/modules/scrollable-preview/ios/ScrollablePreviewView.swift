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

class ScrollablePreviewOverlayVC: UIViewController {
  private let previewContentView: ScrollablePreviewContentView
  private let actionViewModels: [ScrollablePreviewActionView]
  private let previewW: CGFloat
  private let previewH: CGFloat
  private weak var originalParent: UIView?
  private var originalFrame: CGRect = .zero
  private var originalHidden: Bool = true

  var onDismiss: (() -> Void)?

  // UI elements
  private let blurView = UIVisualEffectView(effect: nil)
  private let contentWrapper = UIView()
  private let actionsWrapper = UIView()

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

    // ── Blur background (dismiss on tap) ──
    blurView.frame = view.bounds
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(blurView)

    let dimTap = UITapGestureRecognizer(target: self, action: #selector(dismissPreview))
    blurView.addGestureRecognizer(dimTap)

    // ── Content wrapper (rounded, clips, holds the RN view) ──
    contentWrapper.layer.cornerRadius = 14
    contentWrapper.layer.cornerCurve = .continuous
    contentWrapper.clipsToBounds = true
    contentWrapper.backgroundColor = UIColor(red: 246/255, green: 244/255, blue: 241/255, alpha: 1)
    view.addSubview(contentWrapper)

    // Save original parent so we can return the view on dismiss
    originalParent = previewContentView.superview
    originalFrame = previewContentView.frame
    originalHidden = previewContentView.isHidden

    // Reparent the RN content into our wrapper
    previewContentView.isHidden = false
    previewContentView.removeFromSuperview()
    previewContentView.frame = CGRect(x: 0, y: 0, width: previewW, height: previewH)
    contentWrapper.addSubview(previewContentView)

    // Force RN to relayout for the new frame
    previewContentView.setNeedsLayout()
    previewContentView.layoutIfNeeded()
    // Also tell Yoga about the new size
    for sub in previewContentView.subviews {
      sub.frame = CGRect(x: 0, y: 0, width: previewW, height: previewH)
      sub.setNeedsLayout()
      sub.layoutIfNeeded()
    }

    // ── Actions wrapper (auto-sized, rounded, blur-backed) ──
    actionsWrapper.layer.cornerRadius = 14
    actionsWrapper.layer.cornerCurve = .continuous
    actionsWrapper.clipsToBounds = true
    view.addSubview(actionsWrapper)

    let actionsBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
    actionsBlur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    actionsWrapper.addSubview(actionsBlur)

    // ── Measure action buttons to determine width ──
    let ROW_HEIGHT: CGFloat = 46
    let H_PAD: CGFloat = 16
    var maxTextWidth: CGFloat = 0
    let iconSpace: CGFloat = 32  // icon + padding

    for action in actionViewModels {
      let title = action.actionTitle ?? "Action"
      let attrs: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: 17, weight: .regular),
      ]
      let size = (title as NSString).size(withAttributes: attrs)
      maxTextWidth = max(maxTextWidth, size.width)
    }

    let actionsW = min(ceil(maxTextWidth + iconSpace + H_PAD * 2 + 16), previewW)
    let actionsHeight = CGFloat(actionViewModels.count) * ROW_HEIGHT

    // ── Build action rows ──
    var yOffset: CGFloat = 0
    for (i, action) in actionViewModels.enumerated() {
      let row = makeActionRow(
        title: action.actionTitle ?? "Action",
        icon: action.iconName,
        destructive: action.isDestructive,
        width: actionsW,
        height: ROW_HEIGHT,
        action: { [weak self, weak action] in
          action?.onActionPress()
          self?.dismissPreview()
        }
      )
      row.frame = CGRect(x: 0, y: yOffset, width: actionsW, height: ROW_HEIGHT)
      actionsBlur.contentView.addSubview(row)

      // Separator between rows
      if i < actionViewModels.count - 1 {
        let sep = UIView()
        sep.backgroundColor = UIColor.separator
        sep.frame = CGRect(x: H_PAD, y: yOffset + ROW_HEIGHT - 0.5, width: actionsW - H_PAD * 2, height: 0.5)
        actionsBlur.contentView.addSubview(sep)
      }
      yOffset += ROW_HEIGHT
    }

    // ── Layout ──
    let totalHeight = previewH + 8 + actionsHeight
    let topY = max(60, (view.bounds.height - totalHeight) / 2)
    let contentX = (view.bounds.width - previewW) / 2

    contentWrapper.frame = CGRect(x: contentX, y: topY, width: previewW, height: previewH)
    // Actions: right-aligned under the content (like iOS system menus)
    actionsWrapper.frame = CGRect(
      x: contentX + previewW - actionsW,
      y: topY + previewH + 8,
      width: actionsW,
      height: actionsHeight
    )

    // Start invisible for animate-in
    contentWrapper.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
    contentWrapper.alpha = 0
    actionsWrapper.transform = CGAffineTransform(scaleX: 0.5, y: 0.5)
    actionsWrapper.alpha = 0
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
        self.contentWrapper.transform = .identity
        self.contentWrapper.alpha = 1
      }
    )
    // Actions spring in slightly delayed
    UIView.animate(
      withDuration: 0.35,
      delay: 0.05,
      usingSpringWithDamping: 0.72,
      initialSpringVelocity: 0,
      options: [],
      animations: {
        self.actionsWrapper.transform = .identity
        self.actionsWrapper.alpha = 1
      }
    )
  }

  @objc private func dismissPreview() {
    UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseIn, animations: {
      self.blurView.effect = nil
      self.contentWrapper.alpha = 0
      self.contentWrapper.transform = CGAffineTransform(scaleX: 0.92, y: 0.92)
      self.actionsWrapper.alpha = 0
      self.actionsWrapper.transform = CGAffineTransform(scaleX: 0.5, y: 0.5)
    }) { _ in
      // Return RN view to its original parent
      self.previewContentView.removeFromSuperview()
      self.previewContentView.frame = self.originalFrame
      self.previewContentView.isHidden = true
      self.originalParent?.addSubview(self.previewContentView)
      self.onDismiss?()
      self.dismiss(animated: false)
    }
  }

  // ── Action row factory (text left, icon right) ──

  private func makeActionRow(
    title: String,
    icon: String?,
    destructive: Bool,
    width: CGFloat,
    height: CGFloat,
    action: @escaping () -> Void
  ) -> UIView {
    let container = UIView()
    container.backgroundColor = .clear

    let color: UIColor = destructive ? .systemRed : .label

    // Title label (left-aligned)
    let label = UILabel()
    label.text = title
    label.font = .systemFont(ofSize: 17, weight: .regular)
    label.textColor = color
    label.frame = CGRect(x: 16, y: 0, width: width - 56, height: height)
    container.addSubview(label)

    // Icon (right-aligned)
    if let iconName = icon, let img = UIImage(systemName: iconName)?.withTintColor(color, renderingMode: .alwaysOriginal) {
      let iv = UIImageView(image: img)
      iv.contentMode = .scaleAspectFit
      iv.frame = CGRect(x: width - 16 - 20, y: (height - 20) / 2, width: 20, height: 20)
      container.addSubview(iv)
    }

    // Tap handler
    let btn = UIButton(frame: CGRect(x: 0, y: 0, width: width, height: height))
    btn.backgroundColor = .clear
    btn.addAction(UIAction { _ in action() }, for: .touchUpInside)
    // Highlight on touch
    btn.addAction(UIAction(identifier: .init("down")) { _ in
      UIView.animate(withDuration: 0.1) { container.backgroundColor = UIColor.systemGray5 }
    }, for: .touchDown)
    btn.addAction(UIAction(identifier: .init("up")) { _ in
      UIView.animate(withDuration: 0.15) { container.backgroundColor = .clear }
    }, for: [.touchUpInside, .touchUpOutside, .touchCancel])
    container.addSubview(btn)

    return container
  }
}
