import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CostBreakdown, QuoteInput, fmt } from "./calculator";

const ORANGE: [number, number, number] = [255, 129, 33];

function header(doc: jsPDF, title: string, input: QuoteInput) {
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AgileInternet", 14, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 22);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(input.schoolName || "—", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.postcode || "", 14, 46);
  doc.text(new Date().toLocaleDateString("en-GB"), 196, 40, { align: "right" });
}

export function generateInternalPDF(input: QuoteInput, b: CostBreakdown) {
  const doc = new jsPDF();
  header(doc, "Internal Quote Breakdown", input);

  autoTable(doc, {
    startY: 54,
    head: [["Connection", ""]],
    body: [
      ["Carrier", input.carrier],
      ["Speed", `${input.speedMbps} Mbps`],
      ["Bearer", `${input.bearerMbps} Mbps`],
      ["Backup", input.backup],
      ["Netsweeper", input.includeNetsweeper ? `Yes (${input.pupils} pupils)` : "No"],
    ],
    theme: "striped",
    headStyles: { fillColor: ORANGE },
  });

  autoTable(doc, {
    head: [["Cost (3 years)", "Amount"]],
    body: [
      ["Leased line (£" + input.monthlyLeasedLine + "/mo × 36)", fmt(b.leasedLine3yr)],
      ["FortiGate", fmt(b.fortigate)],
      ["Setup (internal)", fmt(b.setup)],
      ["Carrier install", fmt(b.carrierInstall)],
      ["Netsweeper setup", fmt(b.netsweeperSetup)],
      ["Netsweeper licences", fmt(b.netsweeperLicences)],
      ["Backup line (3 yrs)", fmt(b.backupCost3yr)],
      [{ content: "Total cost (3 yrs)", styles: { fontStyle: "bold" } }, { content: fmt(b.totalCost3yr), styles: { fontStyle: "bold" } }],
    ],
    theme: "striped",
    headStyles: { fillColor: ORANGE },
  });

  autoTable(doc, {
    head: [["Pricing", "Amount"]],
    body: [
      ["Marginable annual cost", fmt(b.annualMarginableCost)],
      [`Margin applied`, `${input.marginPct}%`],
      ["Annual price (marginable, rounded to £5)", fmt(b.annualPriceMarginable)],
      ["Backup annual price (fixed)", fmt(b.backupAnnualPrice)],
      [{ content: "Final annual price", styles: { fontStyle: "bold" } }, { content: fmt(b.finalAnnualPrice), styles: { fontStyle: "bold" } }],
      [{ content: "Total over 3 years", styles: { fontStyle: "bold" } }, { content: fmt(b.total3yrPrice), styles: { fontStyle: "bold" } }],
      [{ content: "Profit (3 yrs)", styles: { fontStyle: "bold", textColor: ORANGE } }, { content: fmt(b.profit3yr), styles: { fontStyle: "bold", textColor: ORANGE } }],
    ],
    theme: "striped",
    headStyles: { fillColor: ORANGE },
  });

  doc.save(`AgileInternet-INTERNAL-${input.schoolName || "quote"}.pdf`);
}

export function generateCustomerPDF(input: QuoteInput, b: CostBreakdown) {
  const doc = new jsPDF();
  header(doc, "Connectivity Quotation", input);

  const included: string[][] = [
    [`${input.carrier} dedicated leased line`, `${input.speedMbps} Mbps over ${input.bearerMbps} Mbps bearer`],
    ["FortiGate firewall", "Included"],
    ["Installation & setup", "Included"],
  ];
  if (input.includeNetsweeper) included.push(["Netsweeper web filtering", `${input.pupils} pupils, 3-year licence`]);
  if (input.backup !== "None") included.push([`Backup internet (${input.backup})`, "Included"]);

  autoTable(doc, {
    startY: 54,
    head: [["What's included", ""]],
    body: included,
    theme: "striped",
    headStyles: { fillColor: ORANGE },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  doc.setFillColor(...ORANGE);
  doc.rect(14, finalY, 182, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Your annual price", 22, finalY + 12);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(b.finalAnnualPrice), 22, finalY + 26);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`3-year contract — total ${fmt(b.total3yrPrice)}`, 22, finalY + 34);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.text(
    "Quote valid for 30 days. Subject to site survey. AgileInternet — connecting UK schools.",
    14,
    285,
  );

  doc.save(`AgileInternet-${input.schoolName || "quote"}.pdf`);
}
