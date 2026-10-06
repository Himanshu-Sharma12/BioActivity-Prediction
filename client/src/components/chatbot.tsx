import { useState } from "react";
import { X, Send, Sparkles, MessageCircle, Lightbulb, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Hello! I'm your BioPredict AI Assistant. I can help you with:\n\n• Understanding compound analysis\n• Interpreting safety predictions\n• Navigating the platform\n• Explaining molecular properties\n\nHow can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const quickQuestions = [
    { icon: HelpCircle, text: "How do I analyze a compound?" },
    { icon: Shield, text: "What is safety assessment?" },
    { icon: Lightbulb, text: "What are structural alerts?" },
    { icon: FlaskConical, text: "How to export results?" },
  ];

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const response = generateResponse(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const generateResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes("analyze") || lowerQuery.includes("compound") || lowerQuery.includes("start")) {
      return "To analyze a compound:\n\n1. Go to **Bioactivity Prediction** page\n2. Enter a SMILES string or compound name\n3. Click 'Analyze Compound'\n4. View results including:\n   • Molecular descriptors computed with RDKit\n   • Drug-likeness (Lipinski, Veber)\n   • Published structural alerts\n   • Measured ChEMBL activity, per protein target\n\nEverything is deterministic — the same input always gives the same output.";
    }
    
    if (lowerQuery.includes("safety") || lowerQuery.includes("assessment") || lowerQuery.includes("toxicity")) {
      return "Safety Assessment evaluates compound toxicity:\n\n🟧 **Hepatotoxicity** - Liver damage risk\n🔴 **Cardiotoxicity** - Heart toxicity\n🟣 **Mutagenicity** - DNA damage potential\n🔵 **hERG Inhibition** - Cardiac arrhythmia risk\n\n**Overall Score**: 0-10 scale (higher = safer)\n**Risk Levels**: Low, Medium, High\n\nClick 'Safety Assessment' in the navbar to see detailed analysis!";
    }
    
    if (lowerQuery.includes("pic50") || lowerQuery.includes("bioactivity") || lowerQuery.includes("activity")) {
      return "This app does **not** predict a pIC50 — it shows **measured** activity from ChEMBL.\n\nWhy: IC50 belongs to a *compound + protein target + assay* combination, not to a molecule on its own. The same compound can differ by several log units between targets, so a single predicted number with no target named would be meaningless.\n\nWhat you get instead:\n• Experimental values recorded in ChEMBL, listed per target\n• Assay type, pChEMBL value and the source publication for each\n• \"No measured activity on record\" when ChEMBL has nothing for that compound";
    }
    
    if (lowerQuery.includes("export") || lowerQuery.includes("download") || lowerQuery.includes("results")) {
      return "To export your analysis results:\n\n1. Navigate to **Export Results** page\n2. Choose your preferred format:\n   📊 **CSV** - For spreadsheet analysis\n   � **Excel** - Formatted workbook\n   📄 **PDF** - Professional report\n\nAll exports include:\n• Compound information\n• Measured ChEMBL activity, where any exists\n• Molecular descriptors and drug-likeness\n• Structural alert matches\n• Timestamp for reproducibility";
    }
    
    if (lowerQuery.includes("alert") || lowerQuery.includes("brenk") || lowerQuery.includes("pains")) {
      return "**Structural alerts** are published substructure patterns the analysis looks for in your molecule:\n\n• **Brenk** (Brenk et al., ChemMedChem 2008) - groups associated with reactivity or instability\n• **PAINS** (Baell & Holloway, J Med Chem 2010) - frequent hitters that interfere with assays\n\nA match means the substructure is **present**. It is a flag for a closer look, not a toxicity prediction and not a probability.";
    }

    if (lowerQuery.includes("lipinski") || lowerQuery.includes("drug-like") || lowerQuery.includes("rule")) {
      return "**Lipinski's Rule of Five** predicts oral drug-likeness:\n\n✓ Molecular weight < 500 Da\n✓ LogP < 5 (lipophilicity)\n✓ H-bond donors < 5\n✓ H-bond acceptors < 10\n\nVeber's rules (J Med Chem 2002) are also checked: rotatable bonds ≤ 10 and TPSA ≤ 140 Å².\n\nCompounds meeting these criteria typically have:\n• Good oral bioavailability\n• Better absorption\n• Favorable pharmacokinetics\n\n**Note**: Not all drugs follow these rules (e.g., antibiotics).";
    }
    
    if (lowerQuery.includes("smiles")) {
      return "**SMILES** (Simplified Molecular Input Line Entry System) examples:\n\n• Benzene: `C1=CC=CC=C1`\n• Aspirin: `CC(=O)OC1=CC=CC=C1C(=O)O`\n• Caffeine: `CN1C=NC2=C1C(=O)N(C(=O)N2C)C`\n• Ethanol: `CCO`\n\nSMILES use letters and symbols to represent molecular structure. You can input them directly in the Bioactivity Prediction page!";
    }
    
    if (lowerQuery.includes("navigate") || lowerQuery.includes("menu") || lowerQuery.includes("page")) {
      return "**Navigation Guide:**\n\n🏠 **Home** - Welcome page and overview\n🧪 **Bioactivity Prediction** - Analyze compounds\n🛡️ **Safety Assessment** - View toxicity results\n📤 **Export Results** - Download reports\n\nUse the top navbar to switch between sections. Analysis data is automatically shared across pages!";
    }
    
    return "I'm here to help! I can assist you with:\n\n• 🧪 **Compound Analysis** - How to run an analysis\n• 🛡️ **Safety Assessment** - Reading the results\n• ⚗️ **Structural Alerts** - Brenk and PAINS substructure matches\n• 📊 **Measured Activity** - ChEMBL values per target\n• 📤 **Data Export** - Downloading reports\n• 🔬 **Drug-likeness** - Lipinski's and Veber's rules\n• 🧬 **SMILES Format** - Molecular notation\n\nWhat would you like to know more about?";
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <Card className="w-full max-w-md h-[600px] flex flex-col shadow-2xl pointer-events-auto border-2 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary to-purple-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Assistant</h3>
              <p className="text-xs text-white/80">Always here to help</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Questions */}
        {messages.length === 1 && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Quick Questions:</p>
            <div className="grid grid-cols-2 gap-2">
              {quickQuestions.map((q, idx) => {
                const Icon = q.icon;
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickQuestion(q.text)}
                    className="justify-start text-xs h-auto py-2"
                  >
                    <Icon className="w-3 h-3 mr-2 flex-shrink-0" />
                    <span className="truncate">{q.text}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Import missing icons
import { Shield, FlaskConical } from "lucide-react";
