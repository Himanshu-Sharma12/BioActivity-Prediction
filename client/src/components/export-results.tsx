import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Code, FileImage } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnalysisResult } from "@/types/molecular";

interface ExportResultsProps {
  analysis: AnalysisResult | null;
  disabled: boolean;
}

export default function ExportResults({ analysis, disabled }: ExportResultsProps) {
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async ({ format }: { format: string }) => {
      if (!analysis) throw new Error("No analysis data available");
      
      const response = await apiRequest('POST', '/api/export', {
        format,
        compoundIds: [analysis.compound.id]
      });
      
      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prediction.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Results have been downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export results",
        variant: "destructive",
      });
    },
  });

  const handleExport = (format: string) => {
    exportMutation.mutate({ format });
  };

  return (
    <Card data-testid="card-export-results">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Download className="mr-2 text-primary" />
          Export Results
        </h3>
        
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => handleExport('csv')}
            disabled={disabled || exportMutation.isPending}
            data-testid="button-export-csv"
          >
            <div className="flex items-center">
              <div>
                <div className="font-medium text-sm text-left">CSV Report</div>
                <div className="text-xs text-muted-foreground text-left">Tabular data format</div>
              </div>
            </div>
            <FileText className="h-5 w-5 text-primary" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => handleExport('json')}
            disabled={disabled || exportMutation.isPending}
            data-testid="button-export-json"
          >
            <div className="flex items-center">
              <div>
                <div className="font-medium text-sm text-left">JSON Data</div>
                <div className="text-xs text-muted-foreground text-left">Machine-readable format</div>
              </div>
            </div>
            <Code className="h-5 w-5 text-primary" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={true}
            data-testid="button-export-pdf"
          >
            <div className="flex items-center">
              <div>
                <div className="font-medium text-sm text-left">PDF Report</div>
                <div className="text-xs text-muted-foreground text-left">Formatted document (Coming Soon)</div>
              </div>
            </div>
            <FileImage className="h-5 w-5 text-primary" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
