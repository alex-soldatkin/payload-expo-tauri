# Payload UI → Expo UI Parity Audit

## Overview
This document tracks the status of Payload CMS UI component ports to React Native/Expo, with a focus on achieving feature parity while adopting iOS 26 design patterns (liquid glass, etc.).

**Current Status:** Early implementation phase - Core field components ported, UI field support missing, advanced components not yet implemented.

---

## Field Components (FieldRenderer)

### ✅ Fully Implemented

#### Input Fields (5/5)
- `text` - TextField
- `email` - EmailField
- `number` - NumberField
- `textarea` - TextareaField
- `code` - CodeField
- `json` - JSONField
- `point` - PointField

#### Control Fields (2/2)
- `checkbox` - CheckboxField
- `date` - DateField

#### Picker Fields (4/4)
- `select` - SelectField
- `radio` - RadioField
- `relationship` - RelationshipField
- `upload` - UploadField

#### Structural Fields (6/6)
- `array` - ArrayField
- `blocks` - BlocksField
- `group` - GroupField
- `collapsible` - CollapsibleField
- `row` - RowField
- `tabs` - TabsField

#### Rich Text (1/1)
- `richText` - RichTextField

**Total Core Fields:** 21/21 field types have React Native implementations

---

## ❌ Missing Components

### 1. UI Field Support (CRITICAL)
**Status:** Currently skipped entirely (`if (field.type === 'ui') return null`)

**Payload UI Field Purpose:** Presentational-only field allowing developers to inject custom React components directly into forms. Enables:
- Custom messages/help text blocks
- Action buttons (refund, clear cache, etc.)
- Preview/link buttons
- Custom validation UI
- Analytics/custom functionality

**Expo Implementation Gap:** No native support for custom presenter components. This is foundational for extending the admin UI with business logic.

**Required Work:**
- [ ] Design custom component injection system for React Native
- [ ] Create UIField component renderer
- [ ] Support `admin.components.Field` configuration
- [ ] Handle async custom components
- [ ] Add error boundaries for failed custom components

---

### 2. Advanced UI Components (99+ missing)

#### Navigation & Layout (12 needed)
- AppHeader, Nav, NavGroup, Hamburger
- StickyToolbar, Gutter
- StepNav, Pagination, PerPage
- WindowInfo, Link, Tooltip

#### Modal & Dialog (8 needed)
- Modal, FullscreenModal, Drawer
- DrawerActionHeader, DrawerContentContainer
- ConfirmationModal, LeaveWithoutSaving
- CloseModalOnRouteChange, CloseModalButton

#### Data Display (15 needed)
- Table, RelationshipTable, ThumbnailCard
- Card, Banner, Pill, PillSelector
- ErrorPill, Status, Thumbnail
- ViewDescription, IDLabel, RenderTitle
- HTMLDiff, FieldDiffContainer, FieldDiffLabel

#### Forms & Input (8 needed)
- ReactSelect, Combobox, FieldSelect
- CodeEditor, DatePicker, TimezonePicker
- FileDetails, Upload, Dropzone

#### Lists & Selection (12 needed)
- ListHeader, ListControls, SearchBar, SearchFilter
- SelectRow, SelectAll, SelectMany
- ColumnSelector, SortColumn, SortHeader, SortRow
- ListSelection, ListDrawer

#### Document Operations (15 needed)
- DocumentControls, DocumentDrawer, DocumentFields
- SaveButton, SaveDraftButton, PublishButton
- PublishMany, DeleteDocument, DeleteMany
- UnpublishButton, UnpublishMany, RestoreButton, RestoreMany
- DuplicateDocument, DocumentTakeOver, DocumentLocked

#### Advanced Features (25+ needed)
- QueryPresets, WhereBuilder, GroupByBuilder
- BulkUpload, EditMany, EditUpload
- ArrayAction, AddNewRelation
- Autosave, Logout, StayLoggedIn
- Translation, Localizer, CopyLocaleData
- DefaultListViewTabs, FolderView, LivePreview
- PreviewButton, PreviewSizes
- ClipboardAction, CopyToClipboard
- BulkUpload, Pagination, PerPage
- RenderComponent, RenderCustomComponent, RenderServerComponent, RenderIfInViewport
- WithServerSideProps, withMergedProps
- And more...

---

## Theme & Styling Status

### ✅ Implemented
- **Theme System:** Basic theme tokens defined in `theme.ts`
  - Color palette (background, surface, text, error, success, warning, etc.)
  - Spacing scale (xs-xxl: 4, 8, 12, 16, 24, 32)
  - Border radius (8, 12, 16, 20)
  - Font sizes (11-24)

- **Styling Libraries:**
  - `nativewind` (4.2.1) - Tailwind CSS for React Native
  - `lucide-react-native` (1.7.0) - Icon library
  - `react-native-reanimated` (4.2.1) - Animations
  - `react-native-gesture-handler` (2.30.0) - Gestures

### ❌ iOS 26 Design System Integration

**Current Gap:** No explicit iOS 26 (liquid glass) design patterns implemented yet

**Expo Resources Available:**
- `expo-glass-effect` (55.0.4) - Already installed! Provides platform native glass morphism
- `expo-system-ui` (55.0.4) - System UI integration

**Required Work:**
- [ ] Design tokens for iOS 26 liquid glass effects
  - [ ] Semi-transparent glassmorphism backgrounds
  - [ ] Blur effect intensities (light, medium, dark)
  - [ ] Backdrop color mixing
  - [ ] Animation curves aligned to iOS motion
- [ ] Apply glass effects to modals, sheets, and overlays
- [ ] Implement system color semantics (iOS semantic colors)
- [ ] Adopt SF Pro typography
- [ ] Create shadow depth system (iOS consistent)
- [ ] Add haptic feedback integration

---

## Architecture & Implementation Notes

### Current Field Registry (admin-native/src/fields/index.ts)
```
Inputs: text, email, number, textarea, code, json, point
Controls: checkbox, date
Pickers: select, radio, relationship, upload
Structural: array, blocks, group, collapsible, row, tabs
RichText: richText
Fallback: FallbackField (for unimplemented types)
```

### Component File Structure
```
payload_universal/packages/admin-native/src/
├── FieldRenderer.tsx          # Dispatches field types to components
├── fields/
│   ├── index.ts              # Registry + exports
│   ├── inputs.tsx            # Text, Email, Number, Textarea, Code, JSON, Point
│   ├── controls.tsx          # Checkbox, Date
│   ├── pickers.tsx           # Select, Radio, Relationship, Upload
│   ├── structural.tsx        # Array, Blocks, Group, Collapsible, Row, Tabs
│   ├── richtext.tsx          # RichTextField
│   └── fallback.tsx          # Fallback for unimplemented types
├── theme.ts                   # Theme tokens
├── PayloadNativeProvider.tsx   # Auth & schema provider
└── ... (Toast, DocumentForm, DocumentList, etc.)
```

### Fallback Behavior
Unimplemented field types fall back to `FallbackField`, which displays the field's `name` and a message that it's not yet implemented.

---

## Payload UI Components Reference

### Total Components in Payload
- **Element Components:** 120+ (see `payload-main/packages/ui/src/elements/`)
- **Field Components:** 20+ dedicated field renderers
- **Form Components:** 10+ form-specific utilities
- **Provider Components:** 8+ context providers
- **Utility Functions:** 30+ helpers

### Component Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Navigation** | 8 | AppHeader, Nav, NavGroup, Hamburger, StepNav |
| **Modal/Overlay** | 10 | Modal, FullscreenModal, Drawer, ConfirmationModal |
| **Data Display** | 18 | Table, Card, List, Pagination, Status |
| **Form Elements** | 12 | DatePicker, CodeEditor, Combobox, FileUpload |
| **Document Ops** | 15 | SaveButton, PublishButton, Delete, Restore |
| **Advanced** | 45+ | QueryPresets, WhereBuilder, LivePreview, Autosave |
| **Utilities** | 30+ | Loading, Toast, Tooltip, Translation |

---

## Recommended Implementation Priority

### Phase 1: UI Field Support (Foundation)
**Effort:** High | **Impact:** Critical
- Implement custom component injection system
- Create UIField renderer with error handling
- Support client-side component loading
- Document patterns for custom UI fields in mobile

### Phase 2: Essential UI Components (Mobile-first)
**Effort:** Medium | **Impact:** High
- ✅ Button (action buttons in custom fields)
- Modal / BottomSheet (forms, dialogs)
- Toast / Alert (feedback)
- Loading / Spinner
- Empty states
- Card containers
- Simple list headers

### Phase 3: iOS 26 Design System
**Effort:** Medium | **Impact:** High
- Integrate `expo-glass-effect` into components
- Create glass morphism theme utilities
- Update modal/sheet designs with liquid glass
- Add haptic feedback feedback patterns
- Implement system color semantics

### Phase 4: Advanced Features
**Effort:** High | **Impact:** Medium
- Document operations (publish, delete, etc.)
- QueryPresets, WhereBuilder
- Bulk operations
- Advanced filtering/sorting
- Live preview
- Search functionality

### Phase 5: Data Visualization
**Effort:** High | **Impact:** Low (for mobile)
- Table components (may be simplified)
- Charts (if needed)
- Relationship visualization
- Diff viewing

---

## Expo SDK Features to Leverage

### Already Available
- ✅ `expo-glass-effect` - Liquid glass effects
- ✅ `expo-system-ui` - System UI integration
- ✅ `expo-sensors` - Shake-to-undo (already implemented!)
- ✅ `expo-notifications` - Push/in-app notifications
- ✅ `expo-secure-store` - Secure token storage
- ✅ `react-native-reanimated` - Smooth animations
- ✅ `lucide-react-native` - Comprehensive icons

### Recommended for Implementation
- `expo-haptics` (if added) - Haptic feedback
- `expo-audio` (if needed) - Audio feedback
- `react-native-gesture-handler` - Swipe gestures (already in use!)
- `nativewind` - Consistent styling

---

## Open Questions / Design Decisions

1. **Custom Component Loading:** How should mobile handle dynamic component loading for UI fields?
   - Option A: String paths resolved at build time
   - Option B: Component references via context
   - Option C: Simplified built-in UI field presets

2. **iOS Glass Effect Scope:** Apply to all modals/overlays, or selectively?
   - Consideration: Performance impact, user preference

3. **Advanced Features Priority:** Table component essential for mobile or can be replaced with card-based views?

4. **Feature Completeness:** Ship with 80% of Payload UI features, or wait for 100%?
   - Trade-off: MVP speed vs. parity assurance

---

## Files to Reference

### Payload Main (Reference)
- `payload-main/docs/fields/ui.mdx` - UI field documentation
- `payload-main/packages/ui/src/fields/UI/index.tsx` - Payload's UIField implementation
- `payload-main/packages/ui/src/forms/RenderFields/RenderField.tsx` - Field dispatch logic

### This Project
- `payload_universal/packages/admin-native/src/FieldRenderer.tsx` - Current dispatch
- `payload_universal/packages/admin-native/src/fields/index.ts` - Registry
- `payload_universal/packages/admin-native/src/theme.ts` - Theme tokens
- Test app: `test_app/apps/mobile-expo/` - Integration point

---

## Summary

| Aspect | Status | Progress |
|--------|--------|----------|
| **Core Field Types** | ✅ Complete | 21/21 (100%) |
| **UI Field Support** | ❌ Missing | 0/1 (0%) |
| **UI Components** | ⏳ In Progress | ~5/100+ (5%) |
| **Theme System** | ✅ Partial | Tokens exist, iOS 26 pending |
| **iOS 26 Design** | ❌ Pending | 0% (expo-glass-effect available) |
| **Overall Parity** | 🟡 ~15-20% | Core fields done, UI layer missing |

