# SAP business services

Business-specific SAP integrations are organized by business scenario. The
shared OData protocol client remains in `services/SapOData`.

## SuperMiro

The first business integration is under `services/Sap/superMiro`:

```text
resource.ts  SAP service root and entity set
sapTypes.ts  raw SAP OData fields and SAP names
types.ts     application-facing DTOs and query input
mapper.ts    raw SAP DTO to application DTO conversion
service.ts   query construction and OData calls
index.ts     public exports
```

The registered resource is:

```text
/sap/opu/odata/sap/ZZD_API_EINVOICE_SRV/einvoiceDataSet
```

The server API is:

```text
GET /api/sap/super-miro
POST /api/sap/super-miro
```

The POST body is passed directly to SAP as the `einvoiceDataSet` payload. The
business layer does not enforce required fields; SAP performs its own payload
validation. The shared OData client handles the CSRF token and session Cookie
before sending the write request.

### Type 03 reimbursement posting

`POST /api/sap/super-miro/reimbursements` accepts selected reimbursement
references and posts one `einvoiceDataSet` entity per reimbursement invoice
line. The route requires finance or admin permission.

The pure type 03 mapping is in `superMiro/type03Payload.ts`; batch orchestration
is in `superMiro/reimbursementPosting.ts`; concrete database and SAP
dependencies are assembled in `_server/superMiroReimbursementDependencies.ts`.
The mapping sends `UnitPrice` and `Netwr` from `otto_tr_t.tr_amount`, leaves
`Taxrate` empty, sends the reimbursement number as `Seqno`, the invoice number
as `Vatno`, and formats `IssueDate` as `YYYY-MM-DD`. It sends the invoice's own
gross amount (`otto_invoices.grossamount`) as `TotalAmt`, and repeats
`SumTotal`, `SumNetwr`, and `SumTax` on every line. SAP decimal fields are serialized as
two-decimal strings, matching the OData V2 payload format expected by SAP.
The reimbursement loader formats PostgreSQL `date` values in SQL before they
reach JavaScript, so timezone conversion cannot shift the invoice date.
After every invoice line for a reimbursement is accepted by SAP, the local
`otto_tr_h.bookingstatus` is updated to `已回传SAP系统`. A partial SAP failure
does not update the local status.

Supported query parameters are `code`, `vatno`, `seqno`, `bukrs`, `lifnr`,
`pono`, `belnr`, `gjahr`, `gtstat`, `select`, `top`, `skip` and `count=true`.
The `select` parameter uses SAP field names, such as `Vatno,Bukrs,TotalAmt`.

SAP metadata identifies `Mandt`, `Code`, `Vatno` and `Seqno` as the entity key.
`Mandt` is retained in the SAP type and mapped DTO even though it was not in
the original business field list.

For a new business scenario, add another business directory with the same
boundaries. Do not add business rules to `SapOData/client.ts`.
