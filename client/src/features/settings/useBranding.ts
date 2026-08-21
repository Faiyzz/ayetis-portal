import { useEffect, useState } from 'react';
import type { BrandingConfigDto } from '@ayetis/shared';
import { fetchBranding } from '@/features/settings/api';

let cached: BrandingConfigDto | null = null;
let inflight: Promise<BrandingConfigDto> | null = null;
const listeners = new Set<(data: BrandingConfigDto) => void>();

function notify(data: BrandingConfigDto) {
  for (const listener of listeners) {
    listener(data);
  }
}

async function loadBranding(force = false): Promise<BrandingConfigDto> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = fetchBranding()
    .then((data) => {
      cached = data;
      notify(data);
      return data;
    })
    .catch(() => {
      const fallback: BrandingConfigDto = {
        companyName: 'Ayetis Portal',
        loginLogoUrl: null,
        headerLogoUrl: null,
        footerLogoUrl: null,
        emailLogoUrl: null,
        notificationEmails: [],
        updatedAt: null,
      };
      cached = fallback;
      notify(fallback);
      return fallback;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Drop module cache and reload so AppShell / AuthLayout pick up logo changes. */
export function invalidateBrandingCache() {
  cached = null;
  return loadBranding(true);
}

export function setBrandingCache(data: BrandingConfigDto) {
  cached = data;
  notify(data);
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfigDto | null>(cached);

  useEffect(() => {
    let alive = true;
    const onUpdate = (data: BrandingConfigDto) => {
      if (alive) setBranding(data);
    };
    listeners.add(onUpdate);
    void loadBranding().then((data) => {
      if (alive) setBranding(data);
    });
    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return branding;
}
