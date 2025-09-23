import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator } from "lucide-react";
import { MolecularDescriptors } from "@/types/molecular";
import { formatLogP, formatMolecularWeight, formatTPSA } from "@/lib/molecular-utils";

interface MolecularDescriptorsProps {
  descriptors: MolecularDescriptors | null;
  isLoading: boolean;
}

export default function MolecularDescriptorsComponent({ descriptors, isLoading }: MolecularDescriptorsProps) {
  return (
    <Card data-testid="card-molecular-descriptors">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Calculator className="mr-2 text-primary" />
          Molecular Descriptors
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* LogP */}
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="descriptor-logp">
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="value-logp">
                {descriptors ? formatLogP(descriptors.logP) : '--'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">LogP</div>
            <div className="text-xs text-muted-foreground mt-1">Lipophilicity</div>
          </div>

          {/* Molecular Weight */}
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="descriptor-molecular-weight">
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="value-molecular-weight">
                {descriptors ? descriptors.molecularWeight.toFixed(2) : '--'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">MW (g/mol)</div>
            <div className="text-xs text-muted-foreground mt-1">Molecular Weight</div>
          </div>

          {/* TPSA */}
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="descriptor-tpsa">
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="value-tpsa">
                {descriptors ? descriptors.tpsa.toFixed(2) : '--'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">TPSA (Ų)</div>
            <div className="text-xs text-muted-foreground mt-1">Topological PSA</div>
          </div>

          {/* Rotatable Bonds */}
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="descriptor-rotatable-bonds">
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="value-rotatable-bonds">
                {descriptors ? descriptors.rotatableBonds : '--'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">Rotatable</div>
            <div className="text-xs text-muted-foreground mt-1">Bonds</div>
          </div>

          {/* HBD Count */}
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="descriptor-hbd">
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="value-hbd">
                {descriptors ? descriptors.hbdCount : '--'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">HBD</div>
            <div className="text-xs text-muted-foreground mt-1">H-Bond Donors</div>
          </div>

          {/* HBA Count */}
          <div className="bg-muted/50 p-4 rounded-lg" data-testid="descriptor-hba">
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="value-hba">
                {descriptors ? descriptors.hbaCount : '--'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">HBA</div>
            <div className="text-xs text-muted-foreground mt-1">H-Bond Acceptors</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
