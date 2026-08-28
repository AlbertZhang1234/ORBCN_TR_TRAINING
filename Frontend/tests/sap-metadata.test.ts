import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createSapODataClientFromEnv } from '../services/_server/sapODataDependencies.ts';
import { SUPER_MIRO_RESOURCE } from '../services/Sap/superMiro/resource.ts';

function loadLocalEnv(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const envPath = resolve(dirname(currentFile), '../.env.local');

  let content: string;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value.replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

loadLocalEnv();

test('SAP super_miro OData metadata is reachable', async () => {
  const client = createSapODataClientFromEnv({
    logger: {
      error(message, context) {
        console.error(message, context);
      },
    },
  });

  const metadata = await client.getMetadata(SUPER_MIRO_RESOURCE);

  assert.ok(metadata.trim().length > 0, 'SAP metadata response should not be empty');
  assert.match(
    metadata,
    /(?:<edmx:Edmx|<edmx\:Edmx|<\?xml)/i,
    'SAP metadata response should be XML',
  );

  console.log('SAP metadata reachable:', {
    service: SUPER_MIRO_RESOURCE.name,
    entitySet: SUPER_MIRO_RESOURCE.entitySet,
    metadataLength: metadata.length,
  });
});
