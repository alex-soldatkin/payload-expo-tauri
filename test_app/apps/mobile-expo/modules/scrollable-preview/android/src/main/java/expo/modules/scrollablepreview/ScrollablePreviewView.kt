package expo.modules.scrollablepreview

import android.app.Dialog
import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.GestureDetector
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Android counterpart of the iOS Telegram-style peek.
 *
 * Long-press on the trigger opens a full-screen [Dialog] with a dimmed backdrop and a
 * rounded container hosting the reparented RN content view, plus action rows below.
 * RN ScrollViews inside the content scroll natively (their touch handling does not
 * depend on the React root view). Dismissal: back button, tap outside, fling down.
 */

// MARK: Content marker — its RN children are shown inside the peek popup.
class ScrollablePreviewContentView(context: Context, appContext: AppContext) : ExpoView(context, appContext)

// MARK: Action marker — carries title/icon/destructive props for one action row.
class ScrollablePreviewActionView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var actionTitle: String? = null
  var iconName: String? = null // SF Symbol names do not map to Android; icons are skipped here.
  var isDestructive: Boolean = false
  internal val onActionPress by EventDispatcher()
}

// MARK: Trigger — wraps the visible row; long-press opens the peek, tap fires onPrimaryAction.
class ScrollablePreviewTriggerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  /** Preview size in dp (resolved by the JS layer; converted to px here). */
  var previewWidth: Float? = null
  var previewHeight: Float? = null
  var previewHeightFraction: Float? = null

  internal val onPrimaryAction by EventDispatcher()
  internal val onPreviewOpen by EventDispatcher()
  internal val onPreviewClose by EventDispatcher()

  private var contentView: ScrollablePreviewContentView? = null
  private val actionViews = mutableListOf<ScrollablePreviewActionView>()

  private var dialog: Dialog? = null
  private var contentOriginalParent: ViewGroup? = null

  private val gestureDetector = GestureDetector(
    context,
    object : GestureDetector.SimpleOnGestureListener() {
      override fun onDown(e: MotionEvent): Boolean = true

      override fun onSingleTapUp(e: MotionEvent): Boolean {
        if (dialog == null) {
          onPrimaryAction(mapOf<String, Any>())
        }
        return true
      }

      override fun onLongPress(e: MotionEvent) {
        performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        openPreview()
      }
    }
  )

  // ── Child management ──────────────────────────────────────────

  override fun onViewAdded(child: View) {
    super.onViewAdded(child)
    categoriseChildren()
  }

  override fun onViewRemoved(child: View) {
    super.onViewRemoved(child)
    categoriseChildren()
  }

  private fun categoriseChildren() {
    contentView = null
    actionViews.clear()
    for (i in 0 until childCount) {
      when (val child = getChildAt(i)) {
        is ScrollablePreviewContentView -> {
          contentView = child
          if (dialog == null) {
            child.visibility = View.GONE
          }
        }
        is ScrollablePreviewActionView -> {
          actionViews.add(child)
          child.visibility = View.GONE
        }
      }
    }
  }

  // ── Gestures: observe the whole stream without stealing it from RN children ──

  override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
    gestureDetector.onTouchEvent(ev)
    super.dispatchTouchEvent(ev)
    // Always claim the stream so the detector keeps receiving MOVE/UP events even when
    // no child consumes the DOWN. Ancestor scroll views can still intercept (which
    // delivers ACTION_CANCEL and resets the detector).
    return true
  }

  // ── Safety: trigger leaving the hierarchy while the peek is open ──

  override fun onDetachedFromWindow() {
    runCatching { dialog?.dismiss() }
    super.onDetachedFromWindow()
  }

  // ── Peek presentation ─────────────────────────────────────────

  private fun openPreview() {
    if (dialog != null) return
    val content = contentView ?: return
    val activity = appContext.activityProvider?.currentActivity ?: return
    if (activity.isFinishing || activity.isDestroyed) return

    val metrics = resources.displayMetrics
    val density = metrics.density
    val fraction = (previewHeightFraction ?: 0.65f).coerceIn(0.2f, 0.95f)
    val widthPx = previewWidth?.let { (it * density).roundToInt() }
      ?: (metrics.widthPixels * 0.92f).roundToInt()
    val heightPx = previewHeight?.let { (it * density).roundToInt() }
      ?: (metrics.heightPixels * fraction).roundToInt()

    // Resolve night mode from the *activity* configuration: the Dialog below is created
    // with the activity context, and RN's Appearance.setColorScheme ('system'|'light'|
    // 'dark' preference) drives AppCompatDelegate's night mode, which is reflected in
    // the activity's uiMode. All colors below are picked explicitly from this flag, so
    // the peek matches the app even when the app overrides the system scheme.
    val isDark = (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
      Configuration.UI_MODE_NIGHT_YES

    val dlg = Dialog(activity)
    dlg.requestWindowFeature(Window.FEATURE_NO_TITLE)

    // Root: full-screen, tap outside dismisses, fling down dismisses
    val root = FrameLayout(activity)
    root.isClickable = true
    root.setOnClickListener { dismissPreview() }

    val flingDetector = GestureDetector(
      activity,
      object : GestureDetector.SimpleOnGestureListener() {
        override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
          if (velocityY > 2500f && abs(velocityY) > abs(velocityX)) {
            dismissPreview()
            return true
          }
          return false
        }
      }
    )
    root.setOnTouchListener { _, ev ->
      flingDetector.onTouchEvent(ev)
      false
    }

    // Card: rounded container that preserves the RN-computed layout of the content
    val card = object : FrameLayout(activity) {
      override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(widthPx, heightPx)
      }

      override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        // RN (Yoga) already laid the content out at exactly widthPx x heightPx —
        // keep that layout instead of re-measuring the React subtree.
        for (i in 0 until childCount) {
          getChildAt(i).layout(0, 0, widthPx, heightPx)
        }
      }
    }
    card.background = GradientDrawable().apply {
      cornerRadius = 16f * density
      setColor(if (isDark) 0xFF1C1C1E.toInt() else 0xFFF6F4F1.toInt())
    }
    card.clipToOutline = true
    card.isClickable = true
    card.setOnClickListener {
      onPrimaryAction(mapOf<String, Any>())
      dismissPreview()
    }

    // Reparent the RN content into the card
    contentOriginalParent = content.parent as? ViewGroup
    contentOriginalParent?.removeView(content)
    content.visibility = View.VISIBLE
    card.addView(content, FrameLayout.LayoutParams(widthPx, heightPx))

    // Action rows (rounded pills, right-aligned below the card)
    val actionsColumn = LinearLayout(activity).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.END
    }
    for (action in actionViews) {
      val row = TextView(activity).apply {
        text = action.actionTitle ?: "Action"
        textSize = 16f
        setTextColor(
          when {
            // iOS systemRed has distinct light/dark variants — mirror both so the
            // destructive row keeps contrast against the matching pill background.
            action.isDestructive && isDark -> 0xFFFF453A.toInt() // systemRed (dark)
            action.isDestructive -> 0xFFFF3B30.toInt()           // systemRed (light)
            isDark -> Color.WHITE
            else -> 0xFF111111.toInt()
          }
        )
        setPadding(
          (20 * density).roundToInt(),
          (12 * density).roundToInt(),
          (20 * density).roundToInt(),
          (12 * density).roundToInt()
        )
        // Pill fill + explicit night-aware ripple (the dialog theme's ripple color is
        // not used here, so pass it ourselves); the mask clips the ripple to the pill.
        val pillFill = GradientDrawable().apply {
          cornerRadius = 23f * density
          setColor(if (isDark) 0xF22C2C2E.toInt() else 0xF2FFFFFF.toInt())
        }
        val pillMask = GradientDrawable().apply {
          cornerRadius = 23f * density
          setColor(Color.WHITE)
        }
        val rippleColor = if (isDark) 0x33FFFFFF else 0x1F000000
        background = RippleDrawable(ColorStateList.valueOf(rippleColor), pillFill, pillMask)
        isClickable = true
        setOnClickListener {
          action.onActionPress(mapOf<String, Any>())
          dismissPreview()
        }
      }
      val lp = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = (8 * density).roundToInt()
      }
      actionsColumn.addView(row, lp)
    }

    val column = LinearLayout(activity).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.END
    }
    column.addView(card, LinearLayout.LayoutParams(widthPx, heightPx))
    column.addView(
      actionsColumn,
      LinearLayout.LayoutParams(widthPx, ViewGroup.LayoutParams.WRAP_CONTENT)
    )
    root.addView(
      column,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER
      )
    )

    dlg.setContentView(
      root,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    )
    dlg.window?.apply {
      setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
      addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
      // Black scrim works in both schemes (no blur on Android, so a single heavier
      // dim provides the separation that iOS gets from blur + lighter dim).
      setDimAmount(0.55f)
    }
    dlg.setCanceledOnTouchOutside(true)
    dlg.setOnDismissListener {
      restoreContent()
      dialog = null
      runCatching { onPreviewClose(mapOf<String, Any>()) }
    }

    dialog = dlg
    onPreviewOpen(mapOf<String, Any>())
    dlg.show()
  }

  private fun dismissPreview() {
    runCatching { dialog?.dismiss() }
  }

  /** Return the RN content view to its original parent (if it still exists). */
  private fun restoreContent() {
    val content = contentView ?: return
    (content.parent as? ViewGroup)?.removeView(content)
    content.visibility = View.GONE
    val target = contentOriginalParent ?: this
    contentOriginalParent = null
    // Always reattach so RN's later unmount bookkeeping finds the child where it left it.
    runCatching { target.addView(content) }
  }
}
