import { prisma } from "../config/database";

interface ScrapedBusiness {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  businessType?: string;
}

interface ExtractedContact {
  emails: string[];
  phones: string[];
  contactForms: string[];
  socialLinks: {
    platform: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TWITTER";
    url: string;
    username?: string;
  }[];
}

export class ScraperService {
  /**
   * Search Google Maps for businesses by type and location.
   * Uses Playwright to scrape Google Maps results.
   */
  async searchGoogleMaps(
    businessType: string,
    location: string,
    searchId: string,
    projectId?: string
  ): Promise<ScrapedBusiness[]> {
    // Update search status
    await prisma.leadSearch.update({
      where: { id: searchId },
      data: { status: "RUNNING" },
    });

    try {
      const businesses = await this.scrapeGoogleMaps(businessType, location);

      // Store results in database
      for (const biz of businesses) {
        await prisma.business.create({
          data: {
            searchId,
            projectId,
            name: biz.name,
            address: biz.address,
            city: biz.city || location,
            state: biz.state,
            country: biz.country,
            phone: biz.phone,
            websiteUrl: biz.websiteUrl,
            googleMapsUrl: biz.googleMapsUrl,
            rating: biz.rating,
            reviewCount: biz.reviewCount,
            businessType: businessType,
            leadScore: this.calculateLeadScore(biz),
          },
        });
      }

      await prisma.leadSearch.update({
        where: { id: searchId },
        data: {
          status: "COMPLETED",
          resultsCount: businesses.length,
          completedAt: new Date(),
        },
      });

      return businesses;
    } catch (error) {
      await prisma.leadSearch.update({
        where: { id: searchId },
        data: { status: "FAILED" },
      });
      throw error;
    }
  }

  /**
   * Scrape Google Maps using Playwright.
   * In production, this would launch a browser and navigate Google Maps.
   */
  private async scrapeGoogleMaps(
    businessType: string,
    location: string
  ): Promise<ScrapedBusiness[]> {
    // Dynamic import to avoid loading Playwright when not needed
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const results: ScrapedBusiness[] = [];

    try {
      const query = encodeURIComponent(`${businessType} in ${location}`);
      await page.goto(
        `https://www.google.com/maps/search/${query}`,
        { waitUntil: "networkidle", timeout: 30000 }
      );

      // Wait for results to load
      await page.waitForTimeout(3000);

      // Scroll to load more results
      const feed = page.locator('[role="feed"]');
      for (let i = 0; i < 5; i++) {
        await feed.evaluate((el) => el.scrollBy(0, 1000));
        await page.waitForTimeout(1500);
      }

      // Extract business cards
      const cards = await page.locator('[jsaction*="mouseover:pane"]').all();

      for (const card of cards.slice(0, 50)) {
        try {
          const name = await card.locator(".fontHeadlineSmall").textContent();
          if (!name) continue;

          // Click card to get details
          await card.click();
          await page.waitForTimeout(1000);

          const address = await page
            .locator('[data-item-id="address"] .fontBodyMedium')
            .textContent()
            .catch(() => null);

          const phone = await page
            .locator('[data-item-id*="phone"] .fontBodyMedium')
            .textContent()
            .catch(() => null);

          const website = await page
            .locator('[data-item-id="authority"] a')
            .getAttribute("href")
            .catch(() => null);

          const ratingText = await page
            .locator('.fontBodyMedium span[role="img"]')
            .getAttribute("aria-label")
            .catch(() => null);

          let rating: number | undefined;
          let reviewCount: number | undefined;

          if (ratingText) {
            const ratingMatch = ratingText.match(/([\d.]+)\s+stars/);
            const reviewMatch = ratingText.match(/([\d,]+)\s+reviews/);
            rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;
            reviewCount = reviewMatch
              ? parseInt(reviewMatch[1].replace(",", ""), 10)
              : undefined;
          }

          const mapsUrl = page.url();

          results.push({
            name: name.trim(),
            address: address?.trim(),
            city: location,
            phone: phone?.trim(),
            websiteUrl: website || undefined,
            googleMapsUrl: mapsUrl,
            rating,
            reviewCount,
            businessType,
          });
        } catch {
          // Skip individual card errors
          continue;
        }
      }
    } finally {
      await browser.close();
    }

    return results;
  }

  /**
   * Extract contact information from a business website.
   */
  async extractContacts(businessId: string): Promise<ExtractedContact> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business?.websiteUrl) {
      return { emails: [], phones: [], contactForms: [], socialLinks: [] };
    }

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const result: ExtractedContact = {
      emails: [],
      phones: [],
      contactForms: [],
      socialLinks: [],
    };

    try {
      await page.goto(business.websiteUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      const html = await page.content();

      // Extract emails using regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = html.match(emailRegex) || [];
      result.emails = [...new Set(emails)].filter(
        (e) => !e.includes("example") && !e.includes("wixpress") && !e.includes("sentry")
      );

      // Extract phone numbers
      const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phones = html.match(phoneRegex) || [];
      result.phones = [...new Set(phones)];

      // Find contact forms
      const forms = await page.locator("form").all();
      for (const form of forms) {
        const action = await form.getAttribute("action").catch(() => null);
        if (action) {
          result.contactForms.push(action);
        }
      }

      // Find social media links
      const links = await page.locator("a[href]").all();
      for (const link of links) {
        const href = await link.getAttribute("href");
        if (!href) continue;

        if (href.includes("instagram.com")) {
          const username = href.match(/instagram\.com\/([^/?]+)/)?.[1];
          result.socialLinks.push({
            platform: "INSTAGRAM",
            url: href,
            username,
          });
        } else if (href.includes("facebook.com")) {
          result.socialLinks.push({ platform: "FACEBOOK", url: href });
        } else if (href.includes("linkedin.com")) {
          result.socialLinks.push({ platform: "LINKEDIN", url: href });
        } else if (href.includes("twitter.com") || href.includes("x.com")) {
          const username = href.match(/(?:twitter|x)\.com\/([^/?]+)/)?.[1];
          result.socialLinks.push({
            platform: "TWITTER",
            url: href,
            username,
          });
        }
      }

      // Deduplicate social links
      const seen = new Set<string>();
      result.socialLinks = result.socialLinks.filter((link) => {
        const key = `${link.platform}:${link.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Store contacts in database
      for (const email of result.emails) {
        await prisma.contact.create({
          data: { businessId, email },
        });
      }
      for (const phone of result.phones) {
        await prisma.contact.upsert({
          where: { id: businessId },
          create: { businessId, phone },
          update: {},
        });
      }
      for (const social of result.socialLinks) {
        await prisma.socialProfile.create({
          data: {
            businessId,
            platform: social.platform,
            profileUrl: social.url,
            username: social.username,
          },
        });
      }
    } finally {
      await browser.close();
    }

    return result;
  }

  /**
   * Calculate lead score (0-100) based on business data.
   */
  calculateLeadScore(business: Partial<ScrapedBusiness>): number {
    let score = 0;

    // Website presence: 25 points
    if (business.websiteUrl) score += 25;

    // Review count: up to 25 points
    if (business.reviewCount) {
      if (business.reviewCount >= 100) score += 25;
      else if (business.reviewCount >= 50) score += 20;
      else if (business.reviewCount >= 20) score += 15;
      else if (business.reviewCount >= 5) score += 10;
      else score += 5;
    }

    // Rating: up to 20 points
    if (business.rating) {
      if (business.rating >= 4.5) score += 20;
      else if (business.rating >= 4.0) score += 15;
      else if (business.rating >= 3.5) score += 10;
      else score += 5;
    }

    // Phone: 10 points
    if (business.phone) score += 10;

    // Address completeness: 10 points
    if (business.address) score += 10;

    // Business name quality: 10 points
    if (business.name && business.name.length > 3) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Recalculate lead score including contact data.
   */
  async recalculateLeadScore(businessId: string): Promise<number> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { contacts: true, socialProfiles: true },
    });

    if (!business) return 0;

    let score = this.calculateLeadScore({
      name: business.name,
      websiteUrl: business.websiteUrl || undefined,
      rating: business.rating || undefined,
      reviewCount: business.reviewCount || undefined,
      phone: business.phone || undefined,
      address: business.address || undefined,
    });

    // Email availability: +15 points
    if (business.contacts.some((c) => c.email)) score += 15;

    // Social media presence: +5 per platform (max 20)
    const socialBonus = Math.min(business.socialProfiles.length * 5, 20);
    score += socialBonus;

    score = Math.min(score, 100);

    await prisma.business.update({
      where: { id: businessId },
      data: { leadScore: score },
    });

    return score;
  }
}
