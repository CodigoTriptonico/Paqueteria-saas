-- A custody signature without a note, photo or other proof is not evidence.

alter table public.package_custody_handoffs
  add constraint package_custody_handoff_evidence_required
  check (jsonb_typeof(evidence) = 'object' and evidence <> '{}'::jsonb);

alter table public.package_custody_handoffs
  add constraint package_custody_receive_evidence_required
  check (
    status <> 'accepted'
    or (jsonb_typeof(receive_evidence) = 'object' and receive_evidence <> '{}'::jsonb)
  );

alter table public.operational_exceptions
  add constraint operational_exception_evidence_required
  check (jsonb_typeof(evidence) = 'object' and evidence <> '{}'::jsonb);
