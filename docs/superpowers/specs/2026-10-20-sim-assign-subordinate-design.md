# SIM Assign To (Subordinate / Actual User)

Ported from AMS-Test after confirmation.

## Goal

SIM Assign / Reassign / Edit Issue matches Asset Assign: Direct Employee plus optional Subordinate / Actual User.

## Assign modal

- Assign To (Direct Employee) * — official holder (`assignedTo`).
- Assign To (Subordinate / Actual User) — optional. Active employees, None, Other / Not in User Master (free text), + quick-add employee.
- Used In Mobile, Assignment Date, Remarks unchanged.

## Save

- Fields: `assignedTo`, `assignedToSubordinate`, `assignedSubText` (same as assets/mobiles).
- Return, Retire, Edit-to-Retired, Exit, and import Retired clear the subordinate fields.

## Display

- Table Assigned To: `Direct → Holder`.
- View and View CSV: Assigned To (Direct) and Assigned To (Subordinate).

## Print / Exit / counts

- Issue Form still keyed off the Direct employee.
- SIMs with a subordinate / actual user follow assets/mobiles: team (not owned), Issue Form “For Reference”, not “Issued”.
- Exit: all SIMs with `assignedTo` the leaving employee are returned (including those with an actual user). Team list is subordinates’ personally held SIMs. Snapshot stores subordinate fields, then they are cleared.

## Out of scope

- Bulk SIM import template stays without assignment columns.
