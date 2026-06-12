Pod::Spec.new do |s|
  s.name           = 'ExpoCalendarView'
  s.version        = '1.0.0'
  s.summary        = 'Native iOS calendar views for the Payload admin'
  s.description    = 'Expo module exposing a HorizonCalendar-backed month grid (CalendarMonthView) and a CalendarKit-backed day timeline (CalendarDayView).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    # Expo SDK 56 minimum (was 15.1 on SDK 55)
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Day timeline (github.com/richardtop/CalendarKit, latest published pod: 1.1.9).
  # HorizonCalendar was removed: it and CalendarKit both export an
  # ObjC-visible `DayView` class and Xcode's generated `.Swift` compatibility
  # submodules collide in any compilation loading both ("'DayView' has
  # different definitions in different modules") — the month grid is the JS
  # MonthGridFallback in admin-native instead.
  s.dependency 'CalendarKit', '~> 1.1.9'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
