export default function Footer() {
  return (
    <footer className="w-full bg-surface-container-low shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
      <div className="max-w-[1120px] mx-auto px-gutter py-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xs">
          <span className="font-headline-sm text-headline-sm text-primary">SaajhaRahat</span>
          <span className="font-caption text-caption text-on-surface-variant">
            • Crisis Relief Logistics Network
          </span>
        </div>
        <div className="font-caption text-caption text-on-surface-variant">
          © 2026 SaajhaRahat.
        </div>
      </div>
    </footer>
  );
}
