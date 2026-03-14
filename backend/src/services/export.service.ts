import { createObjectCsvStringifier } from "csv-writer";
import * as XLSX from "xlsx";
import { prisma } from "../config/database";

interface ExportFilters {
  projectId?: string;
  searchId?: string;
  leadStatus?: string;
  minScore?: number;
}

export class ExportService {
  async getLeadsForExport(userId: string, filters: ExportFilters) {
    const where: Record<string, unknown> = {};

    if (filters.projectId) {
      where.projectId = filters.projectId;
      // Verify project belongs to user
      const project = await prisma.project.findFirst({
        where: { id: filters.projectId, userId },
      });
      if (!project) throw new Error("Project not found");
    }
    if (filters.searchId) where.searchId = filters.searchId;
    if (filters.leadStatus) where.leadStatus = filters.leadStatus;
    if (filters.minScore) where.leadScore = { gte: filters.minScore };

    return prisma.business.findMany({
      where,
      include: { contacts: true, socialProfiles: true },
      orderBy: { leadScore: "desc" },
    });
  }

  async exportCSV(userId: string, filters: ExportFilters): Promise<string> {
    const leads = await this.getLeadsForExport(userId, filters);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: "name", title: "Business Name" },
        { id: "businessType", title: "Business Type" },
        { id: "address", title: "Address" },
        { id: "city", title: "City" },
        { id: "state", title: "State" },
        { id: "phone", title: "Phone" },
        { id: "email", title: "Email" },
        { id: "websiteUrl", title: "Website" },
        { id: "googleMapsUrl", title: "Google Maps" },
        { id: "rating", title: "Rating" },
        { id: "reviewCount", title: "Reviews" },
        { id: "leadScore", title: "Lead Score" },
        { id: "leadStatus", title: "Status" },
        { id: "socialProfiles", title: "Social Links" },
      ],
    });

    const records = leads.map((lead) => ({
      name: lead.name,
      businessType: lead.businessType || "",
      address: lead.address || "",
      city: lead.city || "",
      state: lead.state || "",
      phone: lead.phone || "",
      email: lead.contacts.find((c) => c.email)?.email || "",
      websiteUrl: lead.websiteUrl || "",
      googleMapsUrl: lead.googleMapsUrl || "",
      rating: lead.rating ?? "",
      reviewCount: lead.reviewCount ?? "",
      leadScore: lead.leadScore,
      leadStatus: lead.leadStatus,
      socialProfiles: lead.socialProfiles
        .map((s) => `${s.platform}: ${s.profileUrl}`)
        .join("; "),
    }));

    return csvStringifier.getHeaderString()! + csvStringifier.stringifyRecords(records);
  }

  async exportExcel(userId: string, filters: ExportFilters): Promise<Buffer> {
    const leads = await this.getLeadsForExport(userId, filters);

    const data = leads.map((lead) => ({
      "Business Name": lead.name,
      "Business Type": lead.businessType || "",
      Address: lead.address || "",
      City: lead.city || "",
      State: lead.state || "",
      Phone: lead.phone || "",
      Email: lead.contacts.find((c) => c.email)?.email || "",
      Website: lead.websiteUrl || "",
      "Google Maps": lead.googleMapsUrl || "",
      Rating: lead.rating ?? "",
      Reviews: lead.reviewCount ?? "",
      "Lead Score": lead.leadScore,
      Status: lead.leadStatus,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }
}
