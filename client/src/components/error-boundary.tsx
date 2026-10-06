import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional replacement for the default fallback card. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors below it and shows a recoverable fallback instead
 * of a blank page.
 *
 * The error text is only rendered in development. In a production build the
 * page shows a generic message so stack traces and internal identifiers are not
 * leaked to the user.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always log to the console so the detail is recoverable in production
    // without putting it on the page.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        className="min-h-[60vh] w-full flex items-center justify-center p-4"
        data-testid="error-boundary-fallback"
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This page could not be displayed. No analysis result was lost — reloading
                  usually clears it.
                </p>
              </div>
            </div>

            {import.meta.env.DEV && (
              <pre
                className="mt-4 max-h-48 overflow-auto rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words"
                data-testid="error-boundary-detail"
              >
                {error.message}
              </pre>
            )}

            <Button className="mt-6 w-full" onClick={this.handleReload} data-testid="button-error-reload">
              <RotateCcw className="w-4 h-4" />
              Reload page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
