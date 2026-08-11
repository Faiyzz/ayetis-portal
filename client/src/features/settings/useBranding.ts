import { useEffect, useState } from 'react';
import type { BrandingConfigDto } from '@ayetis/shared';
import { fetchBranding } from '@/features/settings/api';

let cached: BrandingConfigDto | null = null;
let inflight: Promise<BrandingConfigDto> | null = null;

async function loadBranding(): Promise<BrandingConfigDto> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetchBranding()
      .then((data) => {
        cached = data;
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
        return fallback;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfigDto | null>(cached);

  useEffect(() => {
    let alive = true;
    void loadBranding().then((data) => {
      if (alive) setBranding(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return branding;
}
