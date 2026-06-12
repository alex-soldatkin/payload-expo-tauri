import ExpoModulesCore

public class CalendarViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CalendarView")

    // NOTE: the native month grid (HorizonCalendar) was REMOVED. CalendarKit
    // and HorizonCalendar both export an ObjC-visible class named `DayView`;
    // Xcode appends each pod's generated `.Swift` compatibility submodule to
    // the product modulemap, and any compilation that loads both modules
    // hard-errors ("'DayView' has different definitions in different
    // modules", EAS builds 001040f7 / 26700d0c / 3decfce6 — header
    // suppression and modulemap stripping both failed because Xcode itself
    // regenerates the product modulemap). The month view is rendered by the
    // feature-complete JS MonthGridFallback (titled bars, ranges, dark mode)
    // in @payload-universal/admin-native instead; CalendarKit keeps the
    // irreplaceable native day timeline below.

    // ── Day timeline (CalendarKit) ───────────────────────────────
    View(CalendarDayView.self) {
      Events("onPressEvent", "onChangeDate")

      Prop("events") { (view: CalendarDayView, value: [[String: Any]]?) in
        view.setEvents(value ?? [])
      }

      Prop("date") { (view: CalendarDayView, value: String?) in
        view.setDate(value)
      }
    }
  }
}
