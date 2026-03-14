export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  plan: "STARTER" | "PRO" | "AGENCY";
  leadsUsed: number;
  leadsLimit: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  _count?: {
    businesses: number;
    campaigns: number;
    searches: number;
  };
}

export interface Business {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  businessType?: string;
  leadScore: number;
  leadStatus: LeadStatus;
  notes?: string;
  contacts: Contact[];
  socialProfiles: SocialProfile[];
  createdAt: string;
}

export type LeadStatus = "NEW" | "CONTACTED" | "REPLIED" | "MEETING_BOOKED" | "CLOSED";

export interface Contact {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface SocialProfile {
  id: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TWITTER";
  profileUrl: string;
  username?: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  bodyTemplate: string;
  channel: string;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED";
  totalRecipients: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  createdAt: string;
}

export interface LeadSearch {
  id: string;
  businessType: string;
  location: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  resultsCount: number;
  createdAt: string;
}

export interface DashboardStats {
  totalLeads: number;
  totalSearches: number;
  totalCampaigns: number;
  leadsUsed: number;
  leadsLimit: number;
  plan: string;
  leadsByStatus: Record<string, number>;
  recentLeads: Business[];
  campaignStats: Campaign[];
}

export interface GeneratedOutreach {
  email: { subject: string; body: string };
  instagramDM: string;
  linkedinMessage: string;
  contactFormMessage: string;
}
