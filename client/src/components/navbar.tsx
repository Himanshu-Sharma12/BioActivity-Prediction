import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Atom, Home, FlaskConical, Shield, FileText, Menu, Pill, Sun, Moon, Sparkles, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "next-themes";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/analyze", label: "Bioactivity Prediction", icon: FlaskConical },
    { path: "/iot-analysis", label: "Medicine Analysis", icon: Pill },
    { path: "/safety", label: "Safety Assessment", icon: Shield },
    { path: "/export", label: "Export Results", icon: FileText },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-colors">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-3 cursor-pointer group shrink-0"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 rounded-xl blur-md opacity-70 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-inner border border-white/20">
                <Atom className="w-5 h-5 text-white animate-spin-slow" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                  BioPredict
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  AI Safety
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:block tracking-wide">
                Deterministic Molecular Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 bg-muted/30 p-1 rounded-xl border border-border/40">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-white dark:bg-card text-foreground shadow-xs border border-border font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-card/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Actions: Status Badge + Theme Switcher + Mobile Menu */}
          <div className="flex items-center space-x-2">
            {/* Engine Status Badge */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>RDKit WASM Active</span>
            </div>

            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-9 h-9 p-0 rounded-xl hover:bg-muted/60 transition-colors"
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700 transition-transform rotate-0 scale-100" />
                )}
              </Button>
            )}

            {/* GitHub Repository Link */}
            <a
              href="https://github.com/Himanshu-Sharma12/BioActivity-Prediction"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 p-0 rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="View on GitHub: Himanshu-Sharma12/BioActivity-Prediction"
              aria-label="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>

            {/* Quick Action Button */}
            <Link
              href="/analyze"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Lab</span>
            </Link>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden w-9 h-9 p-0 rounded-xl">
                  <Menu className="w-5 h-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[360px] bg-background/95 backdrop-blur-xl border-border/60">
                <SheetTitle className="text-left font-bold text-lg mb-6 flex items-center gap-2">
                  <Atom className="w-5 h-5 text-primary" />
                  <span>BioPredict Navigation</span>
                </SheetTitle>
                <div className="flex flex-col space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                          active
                            ? "bg-primary text-primary-foreground font-semibold shadow-md"
                            : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span>Engine Status</span>
                    <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      RDKit + ChEMBL Online
                    </span>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
