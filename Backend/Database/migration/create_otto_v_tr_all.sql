ALTER TABLE otto_tr_t ADD COLUMN IF NOT EXISTS trchargeable BOOLEAN;
ALTER TABLE otto_tr_t ADD COLUMN IF NOT EXISTS txchargeable BOOLEAN;
ALTER TABLE otto_invoices ADD COLUMN IF NOT EXISTS originalamount NUMERIC;
ALTER TABLE otto_invoices ADD COLUMN IF NOT EXISTS originalcurrency TEXT;

CREATE OR REPLACE VIEW otto_v_tr_all AS
SELECT
  h.id AS tr_id,
  COALESCE(NULLIF(h.trno, ''), h.id::TEXT) AS trno,
  h.created_at AS tr_created_at,
  h.userid AS tr_userid,
  TRIM(CONCAT_WS(' ', applicant.firstname, applicant.lastname)) AS tr_user_name,
  h.projectid AS tr_projectid,
  p.description AS project_description,
  p.projectmanager AS project_manager_userid,
  TRIM(CONCAT_WS(' ', pm.firstname, pm.lastname)) AS project_manager_name,
  p.customerid,
  c.customername,
  h.approvalstatus,
  h.bookingstatus,
  h.approver AS approver_userid,
  TRIM(CONCAT_WS(' ', approver_u.firstname, approver_u.lastname)) AS approver_name,
  t.invoiceno,
  NULLIF(TRIM(t.tr_amount), '')::NUMERIC AS tr_amount,
  t.trchargeable AS line_trchargeable,
  t.txchargeable AS line_txchargeable,
  i.userid AS invoice_userid,
  TRIM(CONCAT_WS(' ', invoice_u.firstname, invoice_u.lastname)) AS invoice_user_name,
  i.travelid,
  te.fromdate AS travel_fromdate,
  te.todate AS travel_todate,
  te.destination AS travel_destination,
  i.invoicedate,
  i.totalnetamount,
  i.taxamount,
  i.grossamount,
  i.bookingcode,
  i.currency,
  i.status AS invoice_status,
  i.comment AS invoice_comment,
  i.description AS invoice_description,
  i.supplier AS invoice_supplier
FROM otto_tr_h h
LEFT JOIN otto_project p ON p.projectid = h.projectid
LEFT JOIN otto_customer c ON c.customerid = p.customerid
LEFT JOIN otto_user applicant ON applicant.userid = h.userid
LEFT JOIN otto_user pm ON pm.userid = p.projectmanager
LEFT JOIN otto_user approver_u ON approver_u.userid = h.approver
LEFT JOIN otto_tr_t t ON t.id = h.id
LEFT JOIN otto_invoices i ON i.invoiceno = t.invoiceno
LEFT JOIN otto_travelentry te ON te.travelid = i.travelid
LEFT JOIN otto_user invoice_u ON invoice_u.userid = i.userid;
