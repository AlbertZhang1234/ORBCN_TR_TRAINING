import type { SapODataServiceDefinition } from '../../SapOData';

export const SUPER_MIRO_RESOURCE = {
  name: 'super-miro',
  serviceRoot: '/sap/opu/odata/sap/ZZD_API_EINVOICE_SRV',
  entitySet: 'einvoiceDataSet',
  version: 'v2',
  csrf: 'required',
} as const satisfies SapODataServiceDefinition & { entitySet: string };
