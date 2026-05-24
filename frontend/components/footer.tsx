export function Footer() {
  return (
    <footer className="border-t bg-background py-6">
      <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground md:flex-row">
        <p>
          RiftSense &middot; Community-powered seismic monitoring
        </p>
        <p>&copy; {new Date().getFullYear()} RiftSense</p>
      </div>
    </footer>
  );
}
