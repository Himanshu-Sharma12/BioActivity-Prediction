import { describe, it, expect } from "vitest";
import { GeminiChatbotService } from "./gemini-chatbot";

describe("GeminiChatbotService", () => {
  it("provides chemistry assistance and generates valid SMILES for aspirin query", async () => {
    const res = await GeminiChatbotService.handleChat("Please give me the SMILES notation for aspirin and explain its structure.");
    expect(res.reply).toBeDefined();
    expect(res.reply.length).toBeGreaterThan(20);
    expect(res.suggestedSmiles).toBe("CC(=O)Oc1ccccc1C(=O)O");
    expect(res.actions).toBeDefined();
    expect(res.actions?.some(a => a.type === "load_smiles")).toBe(true);
  }, 35000);

  it("handles drawing requests with actionable suggestions", async () => {
    const res = await GeminiChatbotService.handleChat(
      "How do I draw a benzene ring with an amine group (aniline)?",
      [],
      undefined,
      "draw_smiles"
    );
    expect(res.reply).toBeDefined();
    expect(res.suggestedSmiles).toBeDefined();
    expect(res.suggestedSmiles?.includes("N") || res.suggestedSmiles?.includes("n")).toBe(true);
  }, 35000);

  it("handles general medicinal chemistry questions gracefully", async () => {
    const res = await GeminiChatbotService.handleChat("What is Lipinski's Rule of 5 and why is it important in drug discovery?");
    expect(res.reply).toBeDefined();
    expect(res.reply.toLowerCase()).toContain("lipinski");
  }, 35000);
});
