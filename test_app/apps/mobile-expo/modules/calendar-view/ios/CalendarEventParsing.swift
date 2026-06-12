import UIKit

// Shared event parsing for both calendar views.
//
// Props arrive from JS as JSON-able arrays of dictionaries. Parsing is defensive:
// entries with a missing/invalid `id` or `start` are silently skipped — bad input
// must never crash the admin.

/// Parsed representation of the JS `CalendarEvent` shape:
/// `{ id, title, start (ISO), end? (ISO), allDay?, color? (hex) }`
struct ParsedCalendarEvent: Equatable {
  let id: String
  let title: String
  let start: Date
  /// `nil` = point event (month grid: dot; day timeline: 30-minute block).
  let end: Date?
  /// True when JS sent `allDay: true` OR the `start` was a bare date-only
  /// string (`yyyy-MM-dd` names a calendar day, not an instant) — both route
  /// to CalendarKit's all-day row in the day timeline.
  let allDay: Bool
  let colorHex: String?

  var uiColor: UIColor? {
    colorHex.flatMap { UIColor(calendarHex: $0) }
  }
}

enum CalendarEventParser {
  static func parse(_ raw: [[String: Any]]) -> [ParsedCalendarEvent] {
    raw.compactMap { dict in
      guard
        let id = dict["id"] as? String, !id.isEmpty,
        let startString = dict["start"] as? String,
        let start = ISODateParser.parse(startString)
      else {
        return nil // bad/missing id or start date — skip, never crash
      }
      let end = (dict["end"] as? String).flatMap { ISODateParser.parse($0) }
      // Explicit `allDay: true` OR a date-only start (defense in depth — the
      // JS mapping layer normally sends `allDay` itself) marks an all-day event.
      let explicitAllDay = (dict["allDay"] as? Bool) ?? false
      return ParsedCalendarEvent(
        id: id,
        title: (dict["title"] as? String) ?? "",
        start: start,
        end: end,
        allDay: explicitAllDay || ISODateParser.isDateOnly(startString),
        colorHex: dict["color"] as? String
      )
    }
  }
}

/// Tolerant ISO 8601 parsing: full datetimes with/without fractional seconds
/// (JS `Date.prototype.toISOString`) and bare `yyyy-MM-dd` dates (interpreted
/// in the device's local time zone, matching the month grid's day keys).
enum ISODateParser {
  static let isoWithFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  static let iso: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  static let dateOnly: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone.current
    return formatter
  }()

  static func parse(_ string: String) -> Date? {
    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    return isoWithFractionalSeconds.date(from: trimmed)
      ?? iso.date(from: trimmed)
      ?? dateOnly.date(from: trimmed)
  }

  /// Local-timezone `yyyy-MM-dd` string — the canonical "day key" used for
  /// selection comparison and for the `date` payload of JS events.
  static func dayKey(from date: Date) -> String {
    dateOnly.string(from: date)
  }

  /// True for bare `yyyy-MM-dd` values (no time component) — these name a
  /// calendar day, so the parser treats them as all-day events.
  static func isDateOnly(_ string: String) -> Bool {
    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.count == 10 && dateOnly.date(from: trimmed) != nil
  }
}

extension UIColor {
  /// Parses `#RGB`, `#RRGGBB` or `#RRGGBBAA` (leading `#` optional).
  /// Returns nil for anything else — callers fall back to a system color.
  convenience init?(calendarHex: String) {
    var hex = calendarHex.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
      hex.removeFirst()
    }
    if hex.count == 3 {
      hex = hex.map { "\($0)\($0)" }.joined()
    }
    guard hex.count == 6 || hex.count == 8 else { return nil }
    var value: UInt64 = 0
    guard Scanner(string: hex).scanHexInt64(&value) else { return nil }

    let red: CGFloat
    let green: CGFloat
    let blue: CGFloat
    let alpha: CGFloat
    if hex.count == 8 {
      red = CGFloat((value & 0xff00_0000) >> 24) / 255
      green = CGFloat((value & 0x00ff_0000) >> 16) / 255
      blue = CGFloat((value & 0x0000_ff00) >> 8) / 255
      alpha = CGFloat(value & 0x0000_00ff) / 255
    } else {
      red = CGFloat((value & 0xff0000) >> 16) / 255
      green = CGFloat((value & 0x00ff00) >> 8) / 255
      blue = CGFloat(value & 0x0000ff) / 255
      alpha = 1
    }
    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }

  /// Linear RGBA blend toward `other` (`ratio` 0 = self … 1 = other) — used
  /// to derive readable bar-title colors from event tints in both color
  /// schemes (darken on light backgrounds, lighten on dark). Callers pass
  /// already-resolved colors; non-RGB-convertible colors return `self`.
  func calendarBlended(with other: UIColor, ratio: CGFloat) -> UIColor {
    var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
    var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
    guard
      getRed(&r1, green: &g1, blue: &b1, alpha: &a1),
      other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
    else { return self }
    let t = min(max(ratio, 0), 1)
    return UIColor(
      red: r1 + (r2 - r1) * t,
      green: g1 + (g2 - g1) * t,
      blue: b1 + (b2 - b1) * t,
      alpha: a1 + (a2 - a1) * t
    )
  }
}
