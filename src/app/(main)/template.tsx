// Re-mounts on every navigation, so each page fades in.
// Opacity only, on purpose: animating `transform` here would make every `position: fixed`
// popup inside the page (confirm dialogs, success screens) stick to this wrapper instead of
// the screen, so popups could open off-screen while the page scroll is locked.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
