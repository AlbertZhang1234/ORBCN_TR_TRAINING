import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSapODataClient } from '../services/SapOData/client.ts';
import { SUPER_MIRO_RESOURCE } from '../services/Sap/superMiro/resource.ts';

test('SAP OData write requests fetch and reuse CSRF token and cookies', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });

    if (calls.length === 1) {
      assert.equal(init.method, 'GET');
      assert.equal(new Headers(init.headers).get('X-CSRF-Token'), 'Fetch');
      return new Response(JSON.stringify({ d: {} }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-test-token',
          'Set-Cookie': 'SAP_SESSIONID_TEST=abc123; Path=/; HttpOnly',
        },
      });
    }

    return new Response(JSON.stringify({ d: { accepted: true } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = createSapODataClient({
    baseUrl: 'https://sap.example.com',
    fetch: fetchMock,
    auth: {
      async getHeaders() {
        return { Authorization: 'Basic test' };
      },
    },
  });

  const result = await client.post(
    SUPER_MIRO_RESOURCE,
    SUPER_MIRO_RESOURCE.entitySet,
    { Vatno: 'INV-001' },
  );
  const secondResult = await client.post(
    SUPER_MIRO_RESOURCE,
    SUPER_MIRO_RESOURCE.entitySet,
    { Vatno: 'INV-002' },
  );

  assert.deepEqual(result, { accepted: true });
  assert.deepEqual(secondResult, { accepted: true });
  assert.equal(calls.length, 3);
  assert.equal(
    calls[0].url,
    'https://sap.example.com/sap/opu/odata/sap/ZZD_API_EINVOICE_SRV',
  );
  assert.equal(
    calls[1].url,
    'https://sap.example.com/sap/opu/odata/sap/ZZD_API_EINVOICE_SRV/einvoiceDataSet',
  );
  assert.equal(new Headers(calls[1].init.headers).get('X-CSRF-Token'), 'csrf-test-token');
  assert.equal(new Headers(calls[1].init.headers).get('Accept'), 'application/json');
  assert.equal(new Headers(calls[1].init.headers).get('Cache-Control'), 'no-cache');
  assert.equal(new Headers(calls[1].init.headers).get('DataServiceVersion'), '2.0');
  assert.equal(new Headers(calls[1].init.headers).get('MaxDataServiceVersion'), '2.0');
  assert.equal(
    new Headers(calls[1].init.headers).get('Content-Type'),
    'application/json',
  );
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { Vatno: 'INV-001' });
  assert.equal(
    new Headers(calls[1].init.headers).get('Cookie'),
    'SAP_SESSIONID_TEST=abc123',
  );
  assert.equal(new Headers(calls[1].init.headers).get('Authorization'), 'Basic test');
  assert.equal(new Headers(calls[2].init.headers).get('X-CSRF-Token'), 'csrf-test-token');
  assert.equal(
    new Headers(calls[2].init.headers).get('Cookie'),
    'SAP_SESSIONID_TEST=abc123',
  );
});

test('SAP CSRF errors explain DNS failures instead of returning generic fetch failed', async () => {
  const fetchMock: typeof fetch = async () => {
    const error = new Error('fetch failed') as Error & {
      cause?: { code?: string };
    };
    error.cause = { code: 'ENOTFOUND' };
    throw error;
  };

  const client = createSapODataClient({
    baseUrl: 'https://sap.internal.example.com',
    fetch: fetchMock,
  });

  await assert.rejects(
    () =>
      client.post(
        SUPER_MIRO_RESOURCE,
        SUPER_MIRO_RESOURCE.entitySet,
        { Vatno: 'INV-DNS' },
      ),
    /Cannot resolve SAP host sap\.internal\.example\.com/,
  );
});
