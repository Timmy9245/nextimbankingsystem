import loadingLogo from "@/assets/loading_logo.jpg.asset.json";

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <img
        src={loadingLogo.url}
        alt="NexTim loading"
        className="h-24 w-24 animate-pulse object-contain"
      />
      <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}