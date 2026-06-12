import CalendarKit
import ExpoModulesCore
import UIKit

// CalendarKit-backed day timeline.
//
// - DayView's TimelinePagerView gives horizontal swipe between days →
//   delegate `didMoveTo` → JS `onChangeDate`.
// - The built-in week-selector header is hidden: the JS layer owns date UI
//   (the `date` prop is the source of truth; programmatic moves are
//   loop-guarded so a controlled prop round-trip doesn't re-emit).
// - Events come from the `events` prop: timed events use their real interval,
//   point events (no `end`) render as 30-minute blocks. All-day events
//   (explicit `allDay: true` OR a date-only start — see CalendarEventParser)
//   get `isAllDay = true` plus a whole-day DateInterval (inclusive of the end
//   date, matching the month grid), so CalendarKit's TimelineView routes them
//   into its AllDayView header row on every covered day. Taps there work like
//   timeline taps: TimelineView.findEventView(at:) searches
//   allDayView.eventViews first and fires the same didTap delegate chain
//   (verified against CalendarKit 1.1.9 sources) → onPressEvent.
// - Hex `color` feeds CalendarKit's Event.color AFTER isAllDay is set — its
//   didSet derives dark-aware background/text colors per presentation.
// - CalendarKit styles use dynamic system colors throughout → dark mode works
//   without extra handling; prop changes call reloadData() on the pager.

final class CalendarDayView: ExpoView {
  let onPressEvent = EventDispatcher()
  let onChangeDate = EventDispatcher()

  private let dayCalendar = Calendar.current
  private let dayView: CalendarKit.DayView
  private var events: [ParsedCalendarEvent] = []
  /// Day key last set via the `date` prop (or last emitted) — used to break
  /// controlled-component feedback loops.
  private var lastDayKey: String?

  required init(appContext: AppContext? = nil) {
    dayView = CalendarKit.DayView(calendar: Calendar.current)
    super.init(appContext: appContext)
    clipsToBounds = true

    dayView.isHeaderViewVisible = false
    dayView.autoScrollToFirstEvent = true
    dayView.dataSource = self
    dayView.delegate = self
    if dayView.state == nil {
      dayView.state = DayViewState(date: Date(), calendar: dayCalendar)
    }
    addSubview(dayView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    dayView.frame = bounds
  }

  // MARK: Props

  func setEvents(_ raw: [[String: Any]]) {
    let parsed = CalendarEventParser.parse(raw)
    guard parsed != events else { return } // identical JS re-render — skip reload
    events = parsed
    dayView.reloadData()
  }

  func setDate(_ value: String?) {
    guard let value, let date = ISODateParser.parse(value) else { return }
    let key = ISODateParser.dayKey(from: date)
    guard key != lastDayKey else { return }
    lastDayKey = key

    let currentDate = dayView.state?.selectedDate ?? Date()
    if ISODateParser.dayKey(from: currentDate) != key {
      dayView.move(to: date)
    }
  }
}

// MARK: - EventDataSource

extension CalendarDayView: EventDataSource {
  func eventsForDate(_ date: Date) -> [EventDescriptor] {
    let dayStart = dayCalendar.startOfDay(for: date)
    guard let dayEnd = dayCalendar.date(byAdding: .day, value: 1, to: dayStart) else {
      return []
    }

    return events.compactMap { parsed -> EventDescriptor? in
      let interval = Self.displayInterval(for: parsed, calendar: dayCalendar)
      // Only events intersecting this day (strict: an interval ending exactly
      // at this midnight belongs to yesterday); CalendarKit clips drawing.
      guard interval.start < dayEnd, interval.end > dayStart else { return nil }

      let event = CalendarKit.Event()
      event.dateInterval = interval
      event.text = parsed.title.isEmpty ? parsed.id : parsed.title
      event.isAllDay = parsed.allDay
      event.userInfo = parsed.id
      if let color = parsed.uiColor {
        // Event.color's didSet derives dark-aware background/text colors —
        // set AFTER isAllDay so the all-day color treatment applies.
        event.color = color
      }
      return event
    }
  }

  /// Interval an event occupies on the timeline:
  ///  - allDay → whole days, startOfDay(start) … startOfDay(end) + 1 day
  ///    (end date INCLUSIVE, matching the month grid's strips/bars), so the
  ///    all-day header row shows the event on every covered day;
  ///  - timed point event (no `end`) → 30-minute block;
  ///  - inverted/zero-length ranges are clamped to 30 minutes (defensive —
  ///    `DateInterval(start:end:)` traps on negative durations).
  private static func displayInterval(
    for parsed: ParsedCalendarEvent,
    calendar: Calendar
  ) -> DateInterval {
    if parsed.allDay {
      let startDay = calendar.startOfDay(for: parsed.start)
      let lastDay = calendar.startOfDay(for: max(parsed.end ?? parsed.start, parsed.start))
      let end = calendar.date(byAdding: .day, value: 1, to: lastDay)
        ?? lastDay.addingTimeInterval(24 * 60 * 60)
      return DateInterval(start: startDay, end: max(end, startDay.addingTimeInterval(60)))
    }
    var end = parsed.end ?? parsed.start.addingTimeInterval(30 * 60)
    if end <= parsed.start {
      end = parsed.start.addingTimeInterval(30 * 60)
    }
    return DateInterval(start: parsed.start, end: end)
  }
}

// MARK: - DayViewDelegate

extension CalendarDayView: DayViewDelegate {
  func dayViewDidSelectEventView(_ eventView: EventView) {
    emitPress(for: eventView)
  }

  func dayViewDidLongPressEventView(_ eventView: EventView) {
    emitPress(for: eventView)
  }

  private func emitPress(for eventView: EventView) {
    guard let id = (eventView.descriptor as? CalendarKit.Event)?.userInfo as? String else {
      return
    }
    onPressEvent(["id": id])
  }

  func dayView(dayView: CalendarKit.DayView, didTapTimelineAt date: Date) {}

  func dayView(dayView: CalendarKit.DayView, didLongPressTimelineAt date: Date) {}

  func dayViewDidBeginDragging(dayView: CalendarKit.DayView) {}

  func dayViewDidTransitionCancel(dayView: CalendarKit.DayView) {}

  func dayView(dayView: CalendarKit.DayView, willMoveTo date: Date) {}

  func dayView(dayView: CalendarKit.DayView, didMoveTo date: Date) {
    let key = ISODateParser.dayKey(from: date)
    guard key != lastDayKey else { return } // programmatic move echo — skip
    lastDayKey = key
    onChangeDate(["date": key])
  }

  func dayView(dayView: CalendarKit.DayView, didUpdate event: EventDescriptor) {}
}
