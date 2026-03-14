import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

interface OutreachInput {
  businessName: string;
  niche: string;
  location: string;
  websiteText?: string;
  contactName?: string;
  senderName?: string;
  senderCompany?: string;
}

interface GeneratedOutreach {
  email: { subject: string; body: string };
  instagramDM: string;
  linkedinMessage: string;
  contactFormMessage: string;
}

export class AIService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async generateOutreach(input: OutreachInput): Promise<GeneratedOutreach> {
    const prompt = `You are a B2B outreach copywriting expert. Generate personalized outreach messages for a business.

Business Details:
- Name: ${input.businessName}
- Niche: ${input.niche}
- Location: ${input.location}
${input.websiteText ? `- Website content summary: ${input.websiteText.slice(0, 500)}` : ""}
${input.contactName ? `- Contact name: ${input.contactName}` : ""}
${input.senderName ? `- Sender name: ${input.senderName}` : ""}
${input.senderCompany ? `- Sender company: ${input.senderCompany}` : ""}

Generate 4 personalized outreach messages in the following JSON format. Be specific, reference their business, and provide value. Keep messages concise and professional:

{
  "email": {
    "subject": "short compelling subject line",
    "body": "full email body with greeting and sign-off"
  },
  "instagramDM": "short casual Instagram DM (2-3 sentences)",
  "linkedinMessage": "professional LinkedIn connection message (2-3 sentences)",
  "contactFormMessage": "message for website contact form (3-4 sentences)"
}

Return ONLY valid JSON, no markdown or extra text.`;

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      return JSON.parse(text);
    } catch {
      // If JSON parsing fails, try extracting JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Failed to parse AI response");
    }
  }

  /**
   * Generate a follow-up message based on original outreach.
   */
  async generateFollowUp(
    originalSubject: string,
    originalBody: string,
    businessName: string,
    daysSince: number
  ): Promise<{ subject: string; body: string }> {
    const prompt = `Generate a short follow-up email. The original email was sent ${daysSince} days ago to ${businessName}.

Original subject: ${originalSubject}
Original body (first 200 chars): ${originalBody.slice(0, 200)}

Generate a brief, friendly follow-up. Return JSON: {"subject": "...", "body": "..."}
Return ONLY valid JSON.`;

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse AI follow-up response");
  }

  /**
   * Summarize website content for use in outreach.
   */
  async summarizeWebsite(html: string): Promise<string> {
    // Strip HTML tags for a rough text extraction
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Summarize this business website in 2-3 sentences. Focus on what the business does, their services, and target audience:\n\n${text}`,
        },
      ],
    });

    return response.content[0].type === "text" ? response.content[0].text : "";
  }
}
