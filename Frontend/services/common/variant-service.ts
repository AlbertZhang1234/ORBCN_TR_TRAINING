import type { IVariantService, VariantMetadata } from 'orbcafe-ui';

const STORAGE_PREFIX = 'pc_variant_';

function getStorageKey(appId: string, tableKey = 'default'): string {
  return `${STORAGE_PREFIX}${appId}__${tableKey}`;
}

function getLegacyStorageKey(appId: string): string {
  return `${STORAGE_PREFIX}${appId}`;
}

function readVariants(appId: string, tableKey = 'default'): VariantMetadata[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const scopedKey = getStorageKey(appId, tableKey);
  const raw = window.localStorage.getItem(scopedKey) ?? window.localStorage.getItem(getLegacyStorageKey(appId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVariants(appId: string, variants: VariantMetadata[], tableKey = 'default'): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getStorageKey(appId, tableKey), JSON.stringify(variants));
}

function uniqueById(variants: VariantMetadata[]): VariantMetadata[] {
  const map = new Map<string, VariantMetadata>();
  for (const variant of variants) {
    map.set(variant.id, variant);
  }
  return Array.from(map.values());
}

export const variantService: IVariantService = {
  async getVariants(appId: string, tableKey?: string): Promise<VariantMetadata[]> {
    const variants = readVariants(appId, tableKey);
    return variants.sort((a, b) => a.name.localeCompare(b.name));
  },

  async saveVariant(variant: VariantMetadata, appId: string, tableKey?: string): Promise<void> {
    const existing = readVariants(appId, tableKey);
    const merged = uniqueById([...existing, variant]).map((item) => {
      if (!variant.isDefault || item.id === variant.id) {
        return item;
      }
      return { ...item, isDefault: false };
    });
    writeVariants(appId, merged, tableKey);
  },

  async deleteVariant(id: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const variants = JSON.parse(raw);
        if (Array.isArray(variants)) {
          const next = variants.filter((v: VariantMetadata) => v.id !== id);
          window.localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        continue;
      }
    }
  },

  async setDefaultVariant(id: string, appId: string, tableKey?: string): Promise<void> {
    const existing = readVariants(appId, tableKey);
    const next = existing.map((variant) => ({
      ...variant,
      isDefault: variant.id === id,
    }));
    writeVariants(appId, next, tableKey);
  },
};
