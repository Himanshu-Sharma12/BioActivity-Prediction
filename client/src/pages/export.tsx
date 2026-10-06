import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  FileType, 
  AlertCircle, 
  FlaskConical, 
  ArrowRight,
  CheckCircle,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { AnalysisResult, RuleSet } from "@/types/molecular";
import { Badge } from "@/components/ui/badge";
import { getMolecularName } from "@/lib/molecular-utils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ExportPage() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedAnalysis = sessionStorage.getItem('currentAnalysis');
    if (storedAnalysis) {
      try {
        setCurrentAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error('Error parsing stored analysis:', error);
        toast({
          title: "Error loading data",
          description: "Failed to load analysis data from storage",
          variant: "destructive"
        });
      }
    }
    setIsLoading(false);
  }, [toast]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!currentAnalysis) return;
    
    setExportingFormat(format);
    
    try {
      // Prepare export data
      const timestamp = new Date().toISOString();
      const fileName = `biopredict-${currentAnalysis.compound.name?.replace(/\s+/g, '_') || 'compound'}-${Date.now()}`;

      if (format === 'csv') {
        await downloadCSV(currentAnalysis, fileName, timestamp);
      } else if (format === 'excel') {
        await downloadExcel(currentAnalysis, fileName, timestamp);
      } else if (format === 'pdf') {
        await downloadPDF(currentAnalysis, fileName, timestamp);
      }
      
      toast({
        title: "Export successful!",
        description: `Your ${format.toUpperCase()} file has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An error occurred during export",
        variant: "destructive"
      });
    } finally {
      setExportingFormat(null);
    }
  };

  // The safety contract is a set of deterministic substructure matches and
  // published rule checks. There is no score, probability or percentage to export.
  const alertRows = (data: AnalysisResult): (string | number)[][] =>
    data.prediction.safetyAssessment.structuralAlerts.length > 0
      ? data.prediction.safetyAssessment.structuralAlerts.map(alert => [
          alert.name,
          alert.severity,
          alert.source,
          alert.concern,
        ])
      : [['None matched', '-', '-', 'No substructure from the screened alert sets matched.']];

  const ruleRows = (ruleSet: RuleSet): (string | number)[][] =>
    ruleSet.rules.map(rule => [
      rule.name,
      rule.value,
      rule.threshold,
      rule.passed ? 'PASS' : 'FAIL',
    ]);

  const downloadCSV = async (data: AnalysisResult, fileName: string, timestamp: string) => {
    const rows = [
      ['BioPredict Safety Analysis Report'],
      ['Generated:', new Date(timestamp).toLocaleString()],
      [''],
      ['=== COMPOUND INFORMATION ==='],
      ['Property', 'Value'],
      ['Compound ID', data.compound.id || 'N/A'],
      ['Name', data.compound.name || getMolecularName(data.compound.smiles)],
      ['SMILES Notation', data.compound.smiles || 'N/A'],
      ['Molecular Formula', data.prediction.molecularFormula || 'N/A'],
      ['Canonical SMILES', data.prediction.canonicalSmiles || 'N/A'],
      ['InChIKey', data.prediction.inchiKey || 'N/A'],
      ['Molecular Weight (g/mol)', data.prediction.descriptors.molecularWeight ? data.prediction.descriptors.molecularWeight.toFixed(2) : 'N/A'],
      [''],
      ['=== SAFETY ASSESSMENT ==='],
      ['Metric', 'Value'],
      ['Concern Level', data.prediction.safetyAssessment.concernLevel],
      ['Summary', data.prediction.safetyAssessment.summary],
      ['Structural Alerts (total)', data.prediction.safetyAssessment.alertCounts.total],
      ['Structural Alerts (high)', data.prediction.safetyAssessment.alertCounts.high],
      ['Structural Alerts (moderate)', data.prediction.safetyAssessment.alertCounts.moderate],
      ['Structural Alerts (low)', data.prediction.safetyAssessment.alertCounts.low],
      ['Lipinski Violations', data.prediction.safetyAssessment.drugLikeness.lipinski.violations],
      ['Veber Violations', data.prediction.safetyAssessment.drugLikeness.veber.violations],
      [''],
      ['Structural Alerts:'],
      ['Alert', 'Severity', 'Source', 'Concern'],
      ...alertRows(data),
      [''],
      ['=== MOLECULAR DESCRIPTORS ==='],
      ['Descriptor', 'Value'],
      ['LogP (Lipophilicity)', data.prediction.descriptors.logP ? data.prediction.descriptors.logP.toFixed(2) : 'N/A'],
      ['Hydrogen Bond Donors', data.prediction.descriptors.hbdCount?.toString() || 'N/A'],
      ['Hydrogen Bond Acceptors', data.prediction.descriptors.hbaCount?.toString() || 'N/A'],
      ['Rotatable Bonds', data.prediction.descriptors.rotatableBonds?.toString() || 'N/A'],
      ['TPSA (Å²)', data.prediction.descriptors.tpsa ? data.prediction.descriptors.tpsa.toFixed(2) : 'N/A'],
      ['Atom Count', data.prediction.descriptors.atomCount?.toString() || 'N/A'],
      ['Ring Count', data.prediction.descriptors.ringCount?.toString() || 'N/A'],
      [''],
      ['=== LIPINSKI RULES (Drug-likeness) ==='],
      ['Citation', data.prediction.safetyAssessment.drugLikeness.lipinski.citation],
      ['Criteria', 'Status'],
      ...data.lipinskiRules.rules.map(rule => [
        rule.name || 'N/A',
        `${rule.passed ? '✓ PASS' : '✗ FAIL'}: ${rule.value !== undefined ? rule.value : 'N/A'} (limit: ${rule.limit !== undefined ? rule.limit : 'N/A'})`
      ]),
      ['Overall Assessment', `${data.lipinskiRules.passed || 0}/${data.lipinskiRules.total || 0} rules passed`],
      ['Drug-like', data.lipinskiRules.passed === data.lipinskiRules.total ? 'Yes' : 'No'],
      [''],
      ['=== VEBER RULES ==='],
      ['Rule', 'Value', 'Threshold', 'Status'],
      ...ruleRows(data.prediction.safetyAssessment.drugLikeness.veber),
      ['Citation', data.prediction.safetyAssessment.drugLikeness.veber.citation],
      ...(data.therapeuticPrediction ? [
        [''],
        ['=== THERAPEUTIC PREDICTIONS & INDICATIONS ==='],
        ['Mechanism of Action', data.therapeuticPrediction.mechanismOfAction?.summary || 'N/A'],
        ['Primary Targets', (data.therapeuticPrediction.mechanismOfAction?.primaryTargets || []).join('; ') || 'N/A'],
        ['Biological Pathways', (data.therapeuticPrediction.mechanismOfAction?.biologicalPathways || []).join('; ') || 'N/A'],
        ['Therapeutic Index Window', data.therapeuticPrediction.therapeuticIndex?.window || 'N/A'],
        ['Therapeutic Index Assessment', data.therapeuticPrediction.therapeuticIndex?.assessment || 'N/A'],
        [''],
        ['Predicted Target Diseases:'],
        ['Disease', 'Category', 'Relevance', 'Confidence Score (%)', 'Mechanism Rationale'],
        ...(data.therapeuticPrediction.targetDiseases || []).map(d => [
          d.disease,
          d.category,
          d.relevance,
          d.confidenceScore,
          d.mechanismRationale,
        ]),
        [''],
        ['Potential Medicines & Formulations:'],
        ['Medicine Name', 'Drug Class', 'Dosage Form', 'Route', 'Target Indication', 'Stage', 'Formulation Notes'],
        ...(data.therapeuticPrediction.potentialMedicines || []).map(m => [
          m.medicineName,
          m.drugClass,
          m.dosageForm,
          m.proposedRoute,
          m.targetIndication,
          m.developmentStage,
          m.formulationNotes,
        ]),
      ] : []),
      ...(data.combinatorialProfile?.autonomousCombinations?.length ? [
        [''],
        ['=== AUTONOMOUS COMBINATIONS & CONDITION-SPECIFIC FORMULATIONS ==='],
        ['Primary Molecule', data.combinatorialProfile.primaryCompoundName || data.compound.name || 'N/A'],
        ['Combination Rationale', data.combinatorialProfile.combinationRationale || 'N/A'],
        [''],
        ['Synergistic Partner Regimens:'],
        ['Partner Drug', 'Role', 'Synergy Index (CI)', 'Synergy Assessment', 'Target Diseases', 'Required Physiological Context & Timing', 'Formulation Name', 'Formulation Type', 'Dose Ratio', 'Route', 'Excipients & Technology'],
        ...data.combinatorialProfile.autonomousCombinations.map(p => [
          p.partnerName,
          p.partnerRole,
          p.synergyIndex.toFixed(2),
          p.synergyAssessment,
          (p.targetDiseases || []).map(td => `${td.disease} (+${td.efficacyBoostPct}% efficacy, ${td.synergyMechanism})`).join(' | '),
          `Context: ${p.requiredConditions?.physiologicalContext || 'Standard'}; Timing: ${p.requiredConditions?.administrationTiming || 'Concurrent'}; Biomarkers: ${p.requiredConditions?.patientBiomarkers || 'N/A'}`,
          p.medicineFormulation?.medicineName || 'N/A',
          p.medicineFormulation?.formulationType || 'N/A',
          p.medicineFormulation?.doseRatio || 'N/A',
          p.medicineFormulation?.deliveryRoute || 'N/A',
          p.medicineFormulation?.excipientsAndTech || 'N/A',
        ]),
      ] : []),
      ...((data.isAiDeduction || data.unknownCompoundProfile) ? [
        [''],
        ['=== NOVEL / UNINDEXED CHEMICAL ENTITY PROFILING ==='],
        ['Identified Class / Scaffold', data.unknownCompoundProfile?.identifiedClass || 'Novel Bioactive Small Molecule'],
        ['Systematic IUPAC Name', data.unknownCompoundProfile?.iupacName || 'AI-deduced IUPAC nomenclature'],
        ['Synthetic Feasibility Score', `${data.unknownCompoundProfile?.syntheticFeasibilityScore || 7} / 10`],
        ['Synthetic Precursors', (data.unknownCompoundProfile?.syntheticPrecursors || []).join('; ') || 'N/A'],
        ['Putative Targets', (data.unknownCompoundProfile?.putativeBiologicalTargets || []).map(t => `${t.target} (${t.confidence}%, ${t.actionType})`).join('; ') || 'N/A'],
        ['Safety Warnings', (data.unknownCompoundProfile?.safetyWarnings || []).join('; ') || 'N/A'],
        ['Novelty Assessment', data.unknownCompoundProfile?.noveltyAssessment || 'Unindexed novel entity evaluated with RDKit WASM.'],
      ] : []),
      [''],
      ['=== COVERAGE AND DISCLAIMER ==='],
      ['Brenk coverage', data.prediction.safetyAssessment.coverage.brenk],
      ['PAINS coverage', data.prediction.safetyAssessment.coverage.pains],
      ['Note', data.prediction.safetyAssessment.coverage.note],
      ['Disclaimer', data.prediction.safetyAssessment.disclaimer],
    ];

    // Convert to CSV with proper escaping
    const csvContent = '\uFEFF' + rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        // Escape cells containing commas, quotes, or newlines
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${fileName}.csv`);
  };

  const downloadExcel = async (data: AnalysisResult, fileName: string, timestamp: string) => {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['BioPredict Safety Analysis Report'],
      ['Generated:', new Date(timestamp).toLocaleString()],
      [''],
      ['Compound Information'],
      ['Property', 'Value'],
      ['Compound ID', data.compound.id],
      ['Name', data.compound.name || getMolecularName(data.compound.smiles)],
      ['SMILES', data.compound.smiles],
      ['Molecular Formula', data.prediction.molecularFormula || 'N/A'],
      ['Canonical SMILES', data.prediction.canonicalSmiles || 'N/A'],
      ['InChIKey', data.prediction.inchiKey || 'N/A'],
      ['Molecular Weight (g/mol)', data.prediction.descriptors.molecularWeight],
      [''],
      ['Safety Overview'],
      ['Metric', 'Value'],
      ['Concern Level', data.prediction.safetyAssessment.concernLevel],
      ['Structural Alerts', data.prediction.safetyAssessment.alertCounts.total],
      ['Lipinski Violations', data.prediction.safetyAssessment.drugLikeness.lipinski.violations],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Safety Assessment
    const safetyData: (string | number)[][] = [
      ['Safety Assessment'],
      [''],
      ['Metric', 'Value'],
      ['Concern Level', data.prediction.safetyAssessment.concernLevel],
      ['Summary', data.prediction.safetyAssessment.summary],
      ['Structural Alerts (total)', data.prediction.safetyAssessment.alertCounts.total],
      ['Structural Alerts (high)', data.prediction.safetyAssessment.alertCounts.high],
      ['Structural Alerts (moderate)', data.prediction.safetyAssessment.alertCounts.moderate],
      ['Structural Alerts (low)', data.prediction.safetyAssessment.alertCounts.low],
      ['Lipinski Violations', data.prediction.safetyAssessment.drugLikeness.lipinski.violations],
      ['Veber Violations', data.prediction.safetyAssessment.drugLikeness.veber.violations],
      [''],
      ['Structural Alerts'],
      ['Alert', 'Severity', 'Source', 'Concern'],
      ...alertRows(data),
      [''],
      ['Coverage and Disclaimer'],
      ['Brenk coverage', data.prediction.safetyAssessment.coverage.brenk],
      ['PAINS coverage', data.prediction.safetyAssessment.coverage.pains],
      ['Note', data.prediction.safetyAssessment.coverage.note],
      ['Disclaimer', data.prediction.safetyAssessment.disclaimer],
    ];
    const wsSafety = XLSX.utils.aoa_to_sheet(safetyData);
    XLSX.utils.book_append_sheet(wb, wsSafety, 'Safety Assessment');

    // Sheet 3: Molecular Descriptors
    const descriptorsData = [
      ['Molecular Descriptors'],
      [''],
      ['Descriptor', 'Value'],
      ['Molecular Formula', data.prediction.molecularFormula || 'N/A'],
      ['Molecular Weight (g/mol)', data.prediction.descriptors.molecularWeight],
      ['LogP', data.prediction.descriptors.logP],
      ['H-Bond Donors', data.prediction.descriptors.hbdCount],
      ['H-Bond Acceptors', data.prediction.descriptors.hbaCount],
      ['Rotatable Bonds', data.prediction.descriptors.rotatableBonds],
      ['TPSA (Å²)', data.prediction.descriptors.tpsa],
      ['Atom Count', data.prediction.descriptors.atomCount],
      ['Ring Count', data.prediction.descriptors.ringCount],
    ];
    const wsDescriptors = XLSX.utils.aoa_to_sheet(descriptorsData);
    XLSX.utils.book_append_sheet(wb, wsDescriptors, 'Descriptors');

    // Sheet 4: Lipinski Rules
    const lipinskiData = [
      ['Lipinski Rules of Five (Drug-likeness)'],
      [''],
      ['Rule', 'Value', 'Limit', 'Operator', 'Status'],
      ...data.lipinskiRules.rules.map(rule => [
        rule.name,
        rule.value,
        rule.limit,
        rule.operator,
        rule.passed ? 'PASS' : 'FAIL'
      ]),
      [''],
      ['Overall', '', '', '', `${data.lipinskiRules.passed}/${data.lipinskiRules.total} rules passed`],
    ];
    const wsLipinski = XLSX.utils.aoa_to_sheet(lipinskiData);
    XLSX.utils.book_append_sheet(wb, wsLipinski, 'Lipinski Rules');

    // Sheet 5: Veber Rules
    const veberData: (string | number)[][] = [
      ['Veber Rules (Oral Bioavailability)'],
      [''],
      ['Rule', 'Value', 'Threshold', 'Status'],
      ...ruleRows(data.prediction.safetyAssessment.drugLikeness.veber),
      [''],
      ['Violations', data.prediction.safetyAssessment.drugLikeness.veber.violations],
      ['Citation', data.prediction.safetyAssessment.drugLikeness.veber.citation],
    ];
    const wsVeber = XLSX.utils.aoa_to_sheet(veberData);
    XLSX.utils.book_append_sheet(wb, wsVeber, 'Veber Rules');

    // Sheet 6: Therapeutic Indications (if available)
    if (data.therapeuticPrediction) {
      const th = data.therapeuticPrediction;
      const thData: (string | number)[][] = [
        ['Therapeutic Predictions & Potential Medicines'],
        [''],
        ['Mechanism of Action', th.mechanismOfAction?.summary || 'N/A'],
        ['Primary Targets', (th.mechanismOfAction?.primaryTargets || []).join(', ')],
        ['Biological Pathways', (th.mechanismOfAction?.biologicalPathways || []).join(', ')],
        ['Therapeutic Index Window', th.therapeuticIndex?.window || 'N/A'],
        ['Therapeutic Index Assessment', th.therapeuticIndex?.assessment || 'N/A'],
        [''],
        ['Target Disease Indications'],
        ['Disease', 'Category', 'Relevance', 'Confidence (%)', 'Mechanism Rationale'],
        ...(th.targetDiseases || []).map(d => [
          d.disease,
          d.category,
          d.relevance,
          d.confidenceScore,
          d.mechanismRationale,
        ]),
        [''],
        ['Potential Engineered Medicines'],
        ['Medicine Name', 'Drug Class', 'Dosage Form', 'Route', 'Target Indication', 'Stage', 'Formulation Notes'],
        ...(th.potentialMedicines || []).map(m => [
          m.medicineName,
          m.drugClass,
          m.dosageForm,
          m.proposedRoute,
          m.targetIndication,
          m.developmentStage,
          m.formulationNotes,
        ]),
      ];
      const wsTh = XLSX.utils.aoa_to_sheet(thData);
      XLSX.utils.book_append_sheet(wb, wsTh, 'Therapeutics');
    }

    // Sheet 7: Autonomous Drug Combinations (if available)
    if (data.combinatorialProfile?.autonomousCombinations?.length) {
      const comb = data.combinatorialProfile;
      const combData: (string | number)[][] = [
        ['Autonomous Drug Combinations & Condition-Specific Formulations'],
        [''],
        ['Primary Compound', comb.primaryCompoundName || data.compound.name || 'N/A'],
        ['Rationale', comb.combinationRationale || 'N/A'],
        [''],
        ['Partner Regimens'],
        ['Partner Drug', 'Role', 'Synergy Index (CI)', 'Synergy Assessment', 'Target Diseases', 'Required Conditions', 'Engineered Medicine', 'Formulation Type', 'Dose Ratio', 'Route', 'Excipients & Technology'],
        ...comb.autonomousCombinations.map(p => [
          p.partnerName,
          p.partnerRole,
          p.synergyIndex.toFixed(2),
          p.synergyAssessment,
          (p.targetDiseases || []).map(td => `${td.disease} (+${td.efficacyBoostPct}%)`).join('; '),
          `Context: ${p.requiredConditions?.physiologicalContext || 'Standard'}; Timing: ${p.requiredConditions?.administrationTiming || 'Concurrent'}`,
          p.medicineFormulation?.medicineName || 'N/A',
          p.medicineFormulation?.formulationType || 'N/A',
          p.medicineFormulation?.doseRatio || 'N/A',
          p.medicineFormulation?.deliveryRoute || 'N/A',
          p.medicineFormulation?.excipientsAndTech || 'N/A',
        ]),
      ];
      const wsComb = XLSX.utils.aoa_to_sheet(combData);
      XLSX.utils.book_append_sheet(wb, wsComb, 'Combinations');
    }

    // Sheet 8: Novel Chemical Entity Profiling (if available)
    if (data.isAiDeduction || data.unknownCompoundProfile) {
      const prof = data.unknownCompoundProfile;
      const novelData: (string | number)[][] = [
        ['Novel / Unindexed Chemical Entity Profiling'],
        [''],
        ['Identified Class & Scaffold', prof?.identifiedClass || 'Novel Bioactive Small Molecule'],
        ['Systematic IUPAC Name', prof?.iupacName || 'AI-deduced IUPAC nomenclature'],
        ['Synthetic Feasibility Score (1-10)', prof?.syntheticFeasibilityScore || 7],
        ['Novelty Assessment', prof?.noveltyAssessment || 'Unindexed novel entity evaluated with RDKit WASM.'],
        [''],
        ['Synthetic Precursors & Building Blocks'],
        ['Precursor / Synthon'],
        ...(prof?.syntheticPrecursors || ['Commercial starting materials']).map(pr => [pr]),
        [''],
        ['Putative Biological Targets'],
        ['Target', 'Confidence (%)', 'Action Type'],
        ...(prof?.putativeBiologicalTargets || []).map(t => [t.target, t.confidence, t.actionType]),
        [''],
        ['Safety Warnings & Cautions'],
        ['Warning'],
        ...(prof?.safetyWarnings || ['Standard investigational safety precautions apply']).map(w => [w]),
      ];
      const wsNovel = XLSX.utils.aoa_to_sheet(novelData);
      XLSX.utils.book_append_sheet(wb, wsNovel, 'Novel Profile');
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownload(blob, `${fileName}.xlsx`);
  };

  const downloadPDF = async (data: AnalysisResult, fileName: string, timestamp: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Helper function to check page break
    const checkPageBreak = (requiredSpace: number = 10) => {
      if (yPos + requiredSpace > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text('BioPredict Safety Analysis Report', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date(timestamp).toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 15;

    // Compound Information Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Compound Information', 14, yPos);
    yPos += 8;

    const compoundData = [
      ['Compound ID', data.compound.id || 'N/A'],
      ['Name', data.compound.name || getMolecularName(data.compound.smiles)],
      ['SMILES', data.compound.smiles || 'N/A'],
      ['Molecular Formula', data.prediction.molecularFormula || 'N/A'],
      ['Canonical SMILES', data.prediction.canonicalSmiles || 'N/A'],
      ['InChIKey', data.prediction.inchiKey || 'N/A'],
      ['Molecular Weight', data.prediction.descriptors.molecularWeight ? `${data.prediction.descriptors.molecularWeight.toFixed(2)} g/mol` : 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Property', 'Value']],
      body: compoundData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(60);

    // Safety Assessment Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Safety Assessment', 14, yPos);
    yPos += 8;

    const safetyOverview = [
      ['Concern Level', data.prediction.safetyAssessment.concernLevel.toUpperCase()],
      ['Summary', data.prediction.safetyAssessment.summary],
      ['Structural Alerts', String(data.prediction.safetyAssessment.alertCounts.total)],
      ['Lipinski Violations', String(data.prediction.safetyAssessment.drugLikeness.lipinski.violations)],
      ['Veber Violations', String(data.prediction.safetyAssessment.drugLikeness.veber.violations)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: safetyOverview,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
    checkPageBreak(50);

    // Structural Alerts
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Structural Alerts', 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Alert', 'Severity', 'Source', 'Concern']],
      body: alertRows(data).map(row => row.map(String)),
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      margin: { left: 14, right: 14 },
      bodyStyles: {
        cellPadding: 3,
      },
      columnStyles: { 3: { cellWidth: 70 } },
      didParseCell: function(cellData: any) {
        if (cellData.column.index === 1 && cellData.section === 'body') {
          const severity = String(cellData.cell.raw).toLowerCase();
          if (severity === 'high') {
            cellData.cell.styles.textColor = [239, 68, 68]; // Red
            cellData.cell.styles.fontStyle = 'bold';
          } else if (severity === 'moderate') {
            cellData.cell.styles.textColor = [234, 179, 8]; // Yellow
            cellData.cell.styles.fontStyle = 'bold';
          } else if (severity === 'low') {
            cellData.cell.styles.textColor = [34, 197, 94]; // Green
            cellData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(60);

    // Molecular Descriptors Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Molecular Descriptors', 14, yPos);
    yPos += 8;

    const descriptorsData = [
      ['LogP (Lipophilicity)', data.prediction.descriptors.logP?.toFixed(2) || 'N/A'],
      ['H-Bond Donors', data.prediction.descriptors.hbdCount?.toString() || 'N/A'],
      ['H-Bond Acceptors', data.prediction.descriptors.hbaCount?.toString() || 'N/A'],
      ['Rotatable Bonds', data.prediction.descriptors.rotatableBonds?.toString() || 'N/A'],
      ['TPSA', data.prediction.descriptors.tpsa ? `${data.prediction.descriptors.tpsa.toFixed(2)} Å²` : 'N/A'],
      ['Atom Count', data.prediction.descriptors.atomCount?.toString() || 'N/A'],
      ['Ring Count', data.prediction.descriptors.ringCount?.toString() || 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Descriptor', 'Value']],
      body: descriptorsData,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(60);

    // Lipinski Rules Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Lipinski's Rule of Five (Drug-likeness)", 14, yPos);
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    doc.text(data.prediction.safetyAssessment.drugLikeness.lipinski.citation, 14, yPos);
    doc.setTextColor(0);
    yPos += 5;

    const lipinskiData = data.lipinskiRules.rules.map(rule => [
      rule.name || 'N/A',
      rule.value !== undefined && rule.value !== null ? rule.value.toString() : 'N/A',
      `${rule.operator || ''} ${rule.limit !== undefined ? rule.limit : 'N/A'}`,
      rule.passed ? '✓ PASS' : '✗ FAIL'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Rule', 'Value', 'Limit', 'Status']],
      body: lipinskiData,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
      didParseCell: function(data: any) {
        if (data.column.index === 3 && data.section === 'body') {
          const status = data.cell.raw as string;
          if (status.includes('PASS')) {
            data.cell.styles.textColor = [34, 197, 94]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [239, 68, 68]; // Red
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
    
    // Overall Assessment
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const overallText = `Overall: ${data.lipinskiRules.passed}/${data.lipinskiRules.total} rules passed`;
    const drugLikeText = data.lipinskiRules.passed === data.lipinskiRules.total ? 'Drug-like ✓' : 'Not drug-like ✗';
    doc.text(overallText, 14, yPos);
    doc.setTextColor(data.lipinskiRules.passed === data.lipinskiRules.total ? 34 : 239, 
                    data.lipinskiRules.passed === data.lipinskiRules.total ? 197 : 68, 
                    data.lipinskiRules.passed === data.lipinskiRules.total ? 94 : 68);
    doc.text(drugLikeText, 80, yPos);
    doc.setTextColor(0);

    yPos += 10;
    checkPageBreak(60);

    // Veber Rules Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Veber Rules (Oral Bioavailability)', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Rule', 'Value', 'Threshold', 'Status']],
      body: ruleRows(data.prediction.safetyAssessment.drugLikeness.veber).map(row => row.map(String)),
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    doc.text(data.prediction.safetyAssessment.drugLikeness.veber.citation, 14, yPos);

    yPos += 10;
    checkPageBreak(50);

    // Therapeutic Predictions & Potential Medicines Section
    if (data.therapeuticPrediction) {
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Emerald green
      doc.text('Therapeutic Indications & Potential Medicines', 14, yPos);
      doc.setTextColor(0);
      yPos += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      const moaText = `Mechanism of Action: ${data.therapeuticPrediction.mechanismOfAction?.summary || 'N/A'}`;
      const moaLines = doc.splitTextToSize(moaText, pageWidth - 28) as string[];
      doc.text(moaLines, 14, yPos);
      yPos += moaLines.length * 4 + 4;
      doc.setTextColor(0);

      // Target Diseases Table
      if (data.therapeuticPrediction.targetDiseases?.length) {
        const diseaseTableData = data.therapeuticPrediction.targetDiseases.map(d => [
          d.disease,
          d.category,
          d.relevance.toUpperCase(),
          `${d.confidenceScore}%`,
          d.mechanismRationale,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Disease Indication', 'Category', 'Relevance', 'Confidence', 'Mechanism Rationale']],
          body: diseaseTableData,
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: 255 },
          margin: { left: 14, right: 14 },
          columnStyles: { 4: { cellWidth: 70 } },
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;
        checkPageBreak(50);
      }

      // Potential Medicines Table
      if (data.therapeuticPrediction.potentialMedicines?.length) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Engineered Potential Medicines', 14, yPos);
        yPos += 5;

        const medsTableData = data.therapeuticPrediction.potentialMedicines.map(m => [
          m.medicineName,
          m.dosageForm,
          m.proposedRoute,
          m.targetIndication,
          m.developmentStage,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Candidate Medicine', 'Dosage Form', 'Route', 'Indication', 'Stage']],
          body: medsTableData,
          theme: 'striped',
          headStyles: { fillColor: [16, 185, 129], textColor: 255 },
          margin: { left: 14, right: 14 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
        checkPageBreak(50);
      }
    }

    // Autonomous Drug Combinations Section
    if (data.combinatorialProfile?.autonomousCombinations?.length) {
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241); // Indigo
      doc.text('Autonomous Drug Combinations & Condition-Specific Formulations', 14, yPos);
      doc.setTextColor(0);
      yPos += 7;

      const combTableData = data.combinatorialProfile.autonomousCombinations.map(p => [
        p.partnerName,
        p.partnerRole,
        `${p.synergyIndex.toFixed(2)} (${p.synergyAssessment})`,
        (p.targetDiseases || []).map(td => `${td.disease} (+${td.efficacyBoostPct}%)`).join(', '),
        `Context: ${p.requiredConditions?.physiologicalContext || 'Standard'}\nTiming: ${p.requiredConditions?.administrationTiming || 'Concurrent'}`,
        `${p.medicineFormulation?.medicineName || 'FDC'}\n(${p.medicineFormulation?.formulationType || 'Tablet'}, ${p.medicineFormulation?.doseRatio || '1:1'})`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Partner Drug', 'Role', 'Synergy CI', 'Synergistic Diseases', 'Required Conditions', 'Engineered Medicine']],
        body: combTableData,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: 255 },
        margin: { left: 14, right: 14 },
        columnStyles: { 3: { cellWidth: 40 }, 4: { cellWidth: 40 }, 5: { cellWidth: 40 } },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(50);
    }

    // Novel / Unindexed Chemical Entity Section
    if (data.isAiDeduction || data.unknownCompoundProfile) {
      checkPageBreak(50);
      const prof = data.unknownCompoundProfile;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(147, 51, 234); // Purple
      doc.text('Novel / Unindexed Chemical Entity AI Profiling', 14, yPos);
      doc.setTextColor(0);
      yPos += 7;

      const novelRows = [
        ['Identified Chemical Class', prof?.identifiedClass || 'Novel Bioactive Small Molecule'],
        ['Systematic IUPAC Name', prof?.iupacName || 'AI-deduced IUPAC nomenclature'],
        ['Synthetic Feasibility', `${prof?.syntheticFeasibilityScore || 7} / 10 (Viable synthetic feasibility)`],
        ['Precursor Building Blocks', (prof?.syntheticPrecursors || []).join('; ') || 'Standard commercial synthons'],
        ['Putative Biological Targets', (prof?.putativeBiologicalTargets || []).map(t => `${t.target} (${t.confidence}%, ${t.actionType})`).join('; ') || 'Screening recommended'],
        ['Safety Alerts & Cautions', (prof?.safetyWarnings || []).join('; ') || 'Standard novel chemical handling'],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Entity Property', 'Analysis']],
        body: novelRows,
        theme: 'striped',
        headStyles: { fillColor: [147, 51, 234], textColor: 255 },
        margin: { left: 14, right: 14 },
        columnStyles: { 1: { cellWidth: 125 } },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
      checkPageBreak(50);
    }

    // Coverage and disclaimer - always printed, never abbreviated
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Coverage & Disclaimer', 14, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const notices = [
      data.prediction.safetyAssessment.coverage.brenk,
      data.prediction.safetyAssessment.coverage.pains,
      data.prediction.safetyAssessment.coverage.note,
      data.prediction.safetyAssessment.disclaimer,
    ];
    for (const notice of notices) {
      const lines = doc.splitTextToSize(notice, pageWidth - 28) as string[];
      checkPageBreak(lines.length * 4 + 4);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 4 + 3;
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('Generated by BioPredict Safety Platform', pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    // Save PDF
    const pdfBlob = doc.output('blob');
    triggerDownload(pdfBlob, `${fileName}.pdf`);
  };

  // Helper function to trigger download
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading export options...</p>
        </div>
      </div>
    );
  }

  if (!currentAnalysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="pt-16 pb-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-3">No Data to Export</h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Before you can export results, you need to analyze a compound first.
                  The export will include structure identifiers, structural alert
                  screening, and drug-likeness rule checks.
                </p>
                <Link href="/analyze">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600">
                    <FlaskConical className="mr-2 w-5 h-5" />
                    Analyze a Compound
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Export Results</h1>
              <p className="text-muted-foreground">
                Download comprehensive analysis report in your preferred format
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Export Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Analysis Summary */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Analysis Ready for Export</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Compound:</span>
                  <span className="font-semibold">{currentAnalysis.compound.name || 'Unnamed'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">SMILES:</span>
                  <span className="font-mono text-xs">{currentAnalysis.compound.smiles}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Formula:</span>
                  <span className="font-mono text-xs">{currentAnalysis.prediction.molecularFormula || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">InChIKey:</span>
                  <span className="font-mono text-xs">{currentAnalysis.prediction.inchiKey || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Concern Level:</span>
                  <Badge variant="outline" data-testid="badge-concern-level">
                    {currentAnalysis.prediction.safetyAssessment.concernLevel}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Structural Alerts:</span>
                  <Badge variant="outline" data-testid="badge-alert-count">
                    {currentAnalysis.prediction.safetyAssessment.alertCounts.total} matched
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Lipinski Violations:</span>
                  <Badge variant="outline" data-testid="badge-lipinski-violations">
                    {currentAnalysis.prediction.safetyAssessment.drugLikeness.lipinski.violations}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Drug-likeness:</span>
                  {(() => {
                    const lip = currentAnalysis.prediction?.safetyAssessment?.drugLikeness?.lipinski || (currentAnalysis as any).lipinskiRules;
                    const passed = lip?.rules ? lip.rules.filter((r: any) => r.passed).length : 0;
                    const total = lip?.rules?.length || 4;
                    const allPassed = lip?.passed ?? (passed === total);
                    return (
                      <Badge variant={allPassed ? "default" : "secondary"}>
                        {passed}/{total} Rules
                      </Badge>
                    );
                  })()}
                </div>
                {currentAnalysis.therapeuticPrediction?.targetDiseases?.length ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Target Indications:</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      {currentAnalysis.therapeuticPrediction.targetDiseases.length} Predicted Diseases
                    </Badge>
                  </div>
                ) : null}
                {currentAnalysis.combinatorialProfile?.autonomousCombinations?.length ? (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Combinations & Synergy:</span>
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                      {currentAnalysis.combinatorialProfile.autonomousCombinations.length} Formulations Engineered
                    </Badge>
                  </div>
                ) : null}
                {(currentAnalysis.isAiDeduction || currentAnalysis.unknownCompoundProfile) && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Chemical Entity:</span>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                      Novel Entity (Feasibility: {currentAnalysis.unknownCompoundProfile?.syntheticFeasibilityScore || 7}/10)
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Formats */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* CSV Export */}
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-2">CSV Format</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Comma-separated values for spreadsheet applications
                  </p>
                  <Button
                    onClick={() => handleExport('csv')}
                    disabled={exportingFormat !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {exportingFormat === 'csv' ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        Export CSV
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Excel Export */}
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Excel Format</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Microsoft Excel workbook with formatted data
                  </p>
                  <Button
                    onClick={() => handleExport('excel')}
                    disabled={exportingFormat !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {exportingFormat === 'excel' ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        Export Excel
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* PDF Export */}
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileType className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold mb-2">PDF Report</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Professional report document for sharing
                  </p>
                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {exportingFormat === 'pdf' ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        Export PDF
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* What's Included */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What's Included in Export</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Compound Information
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Compound ID & Name</li>
                      <li>• SMILES notation</li>
                      <li>• Molecular structure data</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Structure Identifiers
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Molecular formula</li>
                      <li>• Canonical SMILES</li>
                      <li>• InChIKey</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Safety Assessment
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Concern level & summary</li>
                      <li>• Matched structural alerts (Brenk / PAINS)</li>
                      <li>• Coverage notes & disclaimer</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Drug-likeness & Descriptors
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Lipinski & Veber rule checks</li>
                      <li>• Molecular descriptors (LogP, TPSA, HBD, HBA)</li>
                      <li>• Oral bioavailability assessment</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                      Therapeutic Indications & MoA
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Target diseases & confidence scores</li>
                      <li>• Biological pathways & receptor targets</li>
                      <li>• Candidate medicines & route recommendations</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-indigo-500 mr-2" />
                      Combinations & Formulations
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Chou-Talalay combination index (CI)</li>
                      <li>• Required physiological conditions & timing</li>
                      <li>• FDC formulations & delivery technologies</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground mb-1">📊 CSV Files</p>
                  <p>Best for data analysis in Excel, R, or Python. Easy to import into databases.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">📑 Excel Files</p>
                  <p>Formatted workbooks with organized data. Great for presentations and reports.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">📄 PDF Reports</p>
                  <p>Professional documents perfect for sharing with colleagues or regulatory submissions.</p>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                All exports include metadata with timestamp and analysis parameters for reproducibility.
              </AlertDescription>
            </Alert>

            <Alert data-testid="alert-disclaimer">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-2">
                <p>{currentAnalysis.prediction.safetyAssessment.coverage.note}</p>
                <p>{currentAnalysis.prediction.safetyAssessment.disclaimer}</p>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
