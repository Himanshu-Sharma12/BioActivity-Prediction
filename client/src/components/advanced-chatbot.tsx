import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Send, 
  X, 
  Minimize2, 
  Maximize2,
  ChevronUp,
  ChevronDown,
  Mic,
  MicOff,
  Bot,
  User,
  Sparkles,
  Copy,
  Paintbrush,
  Zap,
  CheckCircle2,
  Trash2,
  Atom,
  HelpCircle,
  Loader2,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatAction {
  label: string;
  type: "load_smiles" | "analyze" | "draw" | "quick_reply";
  payload?: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  suggestedSmiles?: string;
  suggestedCompoundName?: string;
  chemicalRationale?: string;
  actions?: ChatAction[];
}

interface AdvancedChatbotProps {
  className?: string;
}

const CHEMISTRY_QUICK_REPLIES = [
  { text: "🎨 How to draw a molecule?", prompt: "How do I draw a molecule and edit SMILES notation in this app?" },
  { text: "🧬 Draw Aspirin with Fluorine", prompt: "Can you generate the SMILES for an aspirin analog with a fluorine atom on the benzene ring?" },
  { text: "⬡ Design Ibuprofen Scaffold", prompt: "Generate the canonical SMILES for Ibuprofen and explain its key pharmacophores." },
  { text: "🛡️ Reduce Liver Toxicity", prompt: "What structural modifications reduce hepatotoxicity and PAINS alerts in drug candidates?" },
  { text: "⚡ Explain Lipinski Rule of 5", prompt: "Explain the Lipinski Rule of 5 thresholds and why they matter for oral bioavailability." },
];

export default function AdvancedChatbot({ className }: AdvancedChatbotProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      text: "Hello! I am your AI Chemistry & SMILES Specialist. I can design molecules, convert chemical names to SMILES, suggest bioisosteric modifications, and explain safety alerts.\n\nAsk me to draw or modify any molecule!",
      sender: 'bot',
      timestamp: new Date(),
      actions: [
        { label: "🎨 Open Drawing Studio", type: "draw" },
        { label: "🧬 Draw Paracetamol", type: "load_smiles", payload: "CC(=O)Nc1ccc(O)cc1" },
        { label: "⬡ Draw Benzene Scaffold", type: "load_smiles", payload: "c1ccccc1" },
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Detect active compound from URL params
  const [activeContext, setActiveContext] = useState<{ smiles?: string; name?: string }>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const smiles = params.get("smiles") || "";
      const name = params.get("name") || "";
      if (smiles || name) {
        setActiveContext({ smiles, name });
      }
    }
  }, [isOpen]);

  // Speech Recognition initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputValue(transcript);
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch {
        // Speech recognition unavailable
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      // Build conversation history for API
      const historyPayload = messages.slice(-6).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        content: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          context: {
            smiles: activeContext.smiles,
            compoundName: activeContext.name,
          },
        }),
      });

      const data = await res.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply || "I analyzed your query.",
        sender: 'bot',
        timestamp: new Date(),
        suggestedSmiles: data.suggestedSmiles,
        suggestedCompoundName: data.suggestedCompoundName,
        chemicalRationale: data.chemicalRationale,
        actions: data.actions,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "I am having trouble connecting to the chemistry server. Please verify the local service is running.",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    if (action.type === "load_smiles" && action.payload) {
      // Navigate to /analyze with draw tab and smiles pre-populated
      setLocation(`/analyze?smiles=${encodeURIComponent(action.payload)}&name=${encodeURIComponent(action.payload)}`);
      toast({
        title: "Loaded into Workspace",
        description: `Structure transferred to Drawing Studio: ${action.payload}`,
      });
      setIsMinimized(true);
    } else if (action.type === "analyze" && action.payload) {
      setLocation(`/analyze?smiles=${encodeURIComponent(action.payload)}`);
      toast({
        title: "Analyzing Compound",
        description: `Running safety and bioactivity evaluation for ${action.payload}`,
      });
      setIsMinimized(true);
    } else if (action.type === "draw") {
      const url = action.payload ? `/draw?smiles=${encodeURIComponent(action.payload)}` : `/draw`;
      window.open(url, "_blank");
      toast({
        title: "Drawing Studio Launched",
        description: "Opened full-screen molecular studio in a new tab.",
      });
      setIsMinimized(true);
    } else if (action.type === "quick_reply" && action.payload) {
      handleSendMessage(action.payload);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice Not Supported",
        description: "Voice recognition is not supported in this browser. Please type your question.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        text: "Conversation cleared. How can I assist with your molecular structures or safety analysis?",
        sender: 'bot',
        timestamp: new Date(),
      }
    ]);
    toast({ title: "Chat Cleared" });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Floating trigger button
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:scale-105 transition-all z-50",
          "bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground hover:opacity-95 p-0 border border-white/20",
          className
        )}
        title="Open AI Chemistry Copilot"
      >
        <Sparkles className="h-6 w-6 animate-pulse" />
      </Button>
    );
  }

  return (
    <Card 
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300 shadow-2xl border border-border bg-card text-card-foreground rounded-2xl overflow-hidden flex flex-col",
        isMinimized 
          ? "w-auto min-w-[290px] sm:min-w-[340px] max-w-[92vw] h-auto shadow-xl" 
          : isExpanded 
            ? "w-[92vw] sm:w-[540px] h-[720px] max-h-[88vh]" 
            : "w-[92vw] sm:w-[420px] h-[580px] max-h-[82vh]",
        className
      )}
    >
      {/* Header */}
      <CardHeader 
        className={cn(
          "px-4 py-3 bg-muted/40 flex flex-row items-center justify-between space-y-0 shrink-0 select-none",
          isMinimized ? "cursor-pointer border-b-0 hover:bg-muted/70 transition-colors" : "border-b border-border/80"
        )}
        onClick={isMinimized ? () => setIsMinimized(false) : undefined}
      >
        <div className="flex items-center space-x-3 min-w-0 pr-2">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-foreground flex items-center gap-1.5 leading-tight truncate">
              <span>AI Chemistry Copilot</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold bg-primary/10 text-primary border-primary/20 shrink-0">
                Gemini AI
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5 leading-snug">
              {isMinimized ? "Click to open chat" : "SMILES · Bioactivity · Safety"}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!isMinimized && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearHistory}
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg"
                title="Clear Chat History"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg"
            title={isMinimized ? "Open Chat" : "Minimize"}
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg"
            title="Close Chat"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Main Chat Body (When Not Minimized) */}
      {!isMinimized && (
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-background">
          {/* Active Compound Badge (Context Indicator) */}
          {activeContext.smiles && (
            <div className="px-3.5 py-1.5 bg-primary/5 border-b border-border text-[11px] flex items-center justify-between text-muted-foreground">
              <span className="truncate flex items-center gap-1.5 font-medium text-foreground">
                <Atom className="w-3.5 h-3.5 text-primary shrink-0" />
                Active Context: <strong className="text-primary truncate">{activeContext.name || activeContext.smiles}</strong>
              </span>
              <button
                type="button"
                onClick={() => setLocation(`/analyze?smiles=${encodeURIComponent(activeContext.smiles || '')}`)}
                className="text-[10px] text-primary hover:underline shrink-0 font-semibold"
              >
                Inspect →
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-3.5">
            <div className="space-y-3.5">
              {messages.map((message) => {
                const isUser = message.sender === 'user';
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div className={cn("flex flex-col gap-1.5 max-w-[85%]", isUser ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm",
                          isUser
                            ? "bg-gradient-to-r from-primary to-indigo-600 text-white rounded-tr-sm font-normal"
                            : "bg-muted/80 text-foreground border border-border/70 rounded-tl-sm whitespace-pre-wrap"
                        )}
                      >
                        {message.text}
                      </div>

                      {/* Chemical Structure Suggestion Card (if returned by bot) */}
                      {message.suggestedSmiles && (
                        <div className="w-full p-2.5 rounded-xl bg-card border border-primary/30 shadow-sm space-y-2 mt-1 animate-in fade-in">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              {message.suggestedCompoundName || "Chemical Structure"}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                              SMILES
                            </Badge>
                          </div>

                          <div className="p-1.5 rounded-md bg-muted font-mono text-[11px] text-foreground break-all border border-border flex items-center justify-between gap-2">
                            <span>{message.suggestedSmiles}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(message.suggestedSmiles || '');
                                toast({ title: "SMILES Copied", description: message.suggestedSmiles });
                              }}
                              className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                              title="Copy SMILES"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>

                          {message.chemicalRationale && (
                            <p className="text-[11px] text-muted-foreground leading-normal">
                              {message.chemicalRationale}
                            </p>
                          )}

                          {/* 1-Click Action Buttons */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                window.open(
                                  `/draw?smiles=${encodeURIComponent(message.suggestedSmiles || '')}&name=${encodeURIComponent(message.suggestedCompoundName || '')}`,
                                  '_blank'
                                );
                                toast({
                                  title: "Opened in Drawing Studio Tab",
                                  description: `Structure loaded to canvas: ${message.suggestedSmiles}`,
                                });
                                setIsMinimized(true);
                              }}
                              className="text-[11px] h-7 border-primary/30 hover:bg-primary/5"
                            >
                              <Paintbrush className="w-3 h-3 mr-1 text-primary" />
                              Draw in Studio
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setLocation(`/analyze?smiles=${encodeURIComponent(message.suggestedSmiles || '')}&name=${encodeURIComponent(message.suggestedCompoundName || '')}`);
                                toast({
                                  title: "Analyzing Compound",
                                  description: `Initiating full bioactivity and safety scan...`,
                                });
                                setIsMinimized(true);
                              }}
                              className="text-[11px] h-7 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Analyze Now
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Generic Interactive Action Buttons */}
                      {message.actions && message.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {message.actions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => handleActionClick(act)}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-muted hover:bg-primary/10 hover:text-primary transition-all border border-border text-foreground flex items-center gap-1"
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="text-[9px] text-muted-foreground px-1">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-2 items-center text-xs text-muted-foreground animate-in fade-in">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-muted border border-border/70 text-xs flex items-center gap-1.5 text-foreground">
                    <span>AI Chemist is deducing molecular structure</span>
                    <span className="animate-pulse">...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Reply Pills */}
          <div className="px-3 py-2 bg-muted/30 border-t border-border overflow-x-auto">
            <div className="flex items-center gap-1.5 w-max">
              {CHEMISTRY_QUICK_REPLIES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-card hover:bg-primary hover:text-primary-foreground border border-border transition-colors text-foreground whitespace-nowrap shadow-xs"
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-border bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask to draw SMILES, modify scaffolds, or audit safety..."
                className="text-xs h-9 bg-background border-border"
                disabled={isTyping}
              />
              <Button
                type="button"
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={toggleVoiceInput}
                className="h-9 w-9 shrink-0 border-border"
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isTyping}
                className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
