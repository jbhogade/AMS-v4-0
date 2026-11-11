# Label/Pass Print Master

AMS-Test first. Port to AMS-v4-0 only after that is asked.

## Goal

System Admin master **Label/Pass Print Master** with two tabs: **Display ID Number** and **Gate Pass**. Admins pick Display IDs, set copies per section, hover for item details, and download an Excel file. Label/pass print size and printed text come in a later slice.

## Placement and access

- System Admin hub tab **Label/Pass Print Master** after Print Terms Master and before Access Rights Control Master.
- Page: `pages/label-pass-print.html`
- JS: `js/label-pass-print.js`
- CSS: `css/label-pass-print.css`
- Hub map: `AMS_ADMIN_TABS.labelPassPrint` -> `label-pass-print.html`
- Page title in `js/layout.js`: `label-pass-print` -> "Label/Pass Print Master"
- Role Access key `labelPassPrint`: Admin / Super Root / Supreme Root = `full`; Standard User / Viewer = `none`

## Display ID Number tab

Lists every record from Asset Master and Mobile Master.

- One section per **Asset Type** (Laptop, Desktop, Printer, Scanner first, then any other Asset Master types A-Z).
- A final **Mobiles** section for Mobile Master records.
- Each section is a **tile grid**. Each tile shows Display ID, Name, Model, Assigned to, and a checkbox.
- Each section has Select all and one **Copies** field (1-99, default 1).
- Hover a tile for the same details in a tooltip.
- Search filters Display ID, name, model, type, and employee.
- **Print** opens the selected tiles (Copies repeats each ID). Label size is a placeholder until specified.
- **Download** exports the checked rows as Excel: Display ID, Kind, Section, Assigned To, Name, Model, Copies.

## Gate Pass tab

Same picker, but only Asset Master records whose type is **Laptop**. Copies, hover, search, Print, and Download work the same way.

Printed Gate Pass text:

Laptop Gate Pass
The Laptop Serial No. &lt;Serial No.&gt;, Asset Code No. &lt;Display ID&gt;, is issued to
&lt;Employee Name&gt; (Employee ID &lt;Employee Code&gt;),
&lt;Company Address&gt;

Stamp &amp; Signature

## Out of scope (later)

- Print layout, paper size, and printed text
- Barcode / QR
- SIM cards, consumables, spare parts
- Per-company or per-site templates
- AMS-v4-0 until explicitly asked
