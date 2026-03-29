# SKILLS.md

Use this file as a checklist for multi platform work in this workspace.

Schema and codegen
- You keep Payload config in one place and export it for server and tools.
- You run payload generate:types and keep the output path stable for all apps.
- You generate client config and field schema maps for admin clients.

Admin core
- You keep form state and validation in a platform neutral package.
- You keep routing, modals, and DOM work in platform specific packages.

Web admin
- You reuse the existing Payload UI components and views.
- You isolate Next specific code in the Next layer only.

Tauri admin
- You run the web admin build in a Tauri wrapper.
- You use a small adapter for file dialogs and OS features.

Mobile admin
- You use Expo and NativeWind.
- You translate web field components to React Native.
- You keep file upload and image pickers behind a native adapter.

Data access
- You use @payloadcms/sdk in all client apps.
- You do not duplicate API shapes in mobile or desktop.
