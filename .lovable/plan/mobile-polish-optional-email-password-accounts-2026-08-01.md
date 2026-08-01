# Mobile polish + optional email/password accounts

## 1. Mobile-first chat experience

Today the thread sidebar is desktop-only (`hidden md:flex`), so on a phone there is no way to reach past chats or start a new one. Fix the layout for small screens:

- Add a mobile top bar with a menu button that opens the conversation list in a slide-in drawer, plus the current thread title and a "New chat" button.
- Reuse one thread list in both the drawer (mobile) and the fixed column (desktop).
- Tapping a conversation or creating a new one closes the drawer automatically.
- Use `100dvh` instead of `100vh` so the composer is never hidden behind mobile browser toolbars, and respect iPhone safe areas at the bottom.
- Composer: full-width on phones, 16px textarea font (prevents iOS zoom-on-focus), larger tap targets for attach/send, keyboard-safe padding.
- Messages: tighter horizontal padding on phones, comfortable max-width on desktop, code blocks and generated images scale/scroll instead of overflowing, attachment thumbnails wrap.
- Thread delete buttons are always visible on touch devices (hover-only controls are unreachable on a phone).

## 2. Mobile-first landing page

- Fluid type scale for the hero, single-column capability cards on phones, two columns from tablet up.
- Buttons stack full-width on small screens; no horizontal overflow from the glow background.
- Viewport/theme-color meta so the dark theme extends into the mobile status bar.

## 3. Optional email + password accounts

Guest access stays the default — nobody is forced to sign in. On top of it:

- A "Save your chats" action in the sidebar/menu opens a small dialog with email + password.
- For a guest, submitting attaches that email and password to their existing account, so all conversations they already have are kept — no data loss, no second account.
- A "Sign in" tab lets someone with an existing account log in on another device or browser and see their conversations there.
- Accounts work immediately after sign-up (no confirmation email needed), matching how the app already behaves.
- Once an account is attached, the menu shows the email plus a "Sign out" action; signing out returns the visitor to a fresh guest session.
- Inline errors for wrong password, already-used email, and weak password (minimum 6 characters).

## Technical notes

- New `AccountDialog` using existing shadcn `Dialog`/`Tabs`/`Input`; guest upgrade via `supabase.auth.updateUser({ email, password })`, sign-in via `signInWithPassword`, and an auth-state listener to refresh threads and router state afterwards.
- Sidebar refactor: extract `ThreadList` from `ThreadSidebar`; render it inside a `Sheet` for mobile and the aside for desktop; add `ChatTopBar`.
- Layout: `h-[100dvh]`, `min-w-0` on flex children, `pb-[env(safe-area-inset-bottom)]` on the composer wrapper.
- No database migration needed; anonymous users already own their threads and keep the same user id after adding credentials.