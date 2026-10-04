import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { createTrpcClient, trpc } from "@/lib/trpc";
import Home from "@/pages/Home";
import "./index.css";

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, networkMode: "offlineFirst" },
          mutations: { networkMode: "always" },
        },
      }),
  );
  const [trpcClient] = useState(createTrpcClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Home />
        <Toaster />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: precached app shell + curriculum, cached API reads, queued learning events.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      onOfflineReady: () => toast("Lane works offline now", { description: "Lessons, review, and the SOS checklist are saved on this device." }),
      onNeedRefresh: () =>
        toast("A new version of Lane is ready", {
          duration: Infinity,
          action: { label: "Update", onClick: () => void updateSW(true) },
        }),
    });
  });
}
