import { Activity, CheckCircle, Github, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/60 backdrop-blur-md mt-16 transition-colors">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
              RDKit WASM & AI Active
            </span>
            <span>•</span>
            <span>BioPredict Safety Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <a 
              href="https://github.com/Himanshu-Sharma12/BioActivity-Prediction" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4 mr-1.5" />
              GitHub Repository
            </a>
            <span>•</span>
            <span className="flex items-center">
              <Activity className="w-4 h-4 text-emerald-500 mr-1.5" />
              API Status: Online
            </span>
          </div>
        </div>
        <div className="text-center mt-4 pt-4 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-center gap-1.5 flex-wrap">
          <span>Created & Developed by</span>
          <a
            href="https://github.com/Himanshu-Sharma12"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            Himanshu Sharma
          </a>
          <span>•</span>
          <span>BioPredict Safety — Advancing molecular intelligence and safety assessment</span>
        </div>
      </div>
    </footer>
  );
}
