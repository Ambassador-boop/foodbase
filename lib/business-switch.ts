"use client";

/**
 * Triggers a business switch on the server (sets the active_business_id
 * cookie so every API route resolves to the new business) and plays a
 * brand-aware transition animation if both businesses have a logo.
 */
export type SwitchBusinessTarget = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
};

const ANIMATION_MS = 1600;

export async function switchBusiness(
  from: SwitchBusinessTarget | null | undefined,
  to: SwitchBusinessTarget,
): Promise<void> {
  if (typeof window === "undefined") return;

  const showAnimation = Boolean(from?.logo_url && to?.logo_url) && from?.id !== to?.id;

  if (showAnimation) {
    window.dispatchEvent(
      new CustomEvent("business:switching", {
        detail: {
          from: { name: from!.name, logoUrl: from!.logo_url },
          to: { name: to.name, logoUrl: to.logo_url },
        },
      }),
    );
  }

  try {
    const res = await fetch("/api/user/switch-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ businessId: to.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to switch business");
    }

    // Persist on the client too so legacy code that still reads
    // localStorage keeps working.
    try {
      localStorage.setItem("currentBusinessId", to.id);
    } catch {}

    // Wait for the transition animation to play out, then do a hard
    // reload so every server component, every SWR cache, and every
    // dashboard route refetches against the newly-active business.
    if (showAnimation) {
      await new Promise((r) => setTimeout(r, ANIMATION_MS));
    } else {
      await new Promise((r) => setTimeout(r, 200));
    }

    window.location.reload();
  } catch (err) {
    // Hide overlay on failure
    window.dispatchEvent(new CustomEvent("business:switching:cancel"));
    throw err;
  }
}
