import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const passwordHash = await bcrypt.hash("demo1234", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@leadforge.ai" },
    update: {},
    create: {
      email: "demo@leadforge.ai",
      passwordHash,
      firstName: "Demo",
      lastName: "User",
      company: "LeadForge Demo",
      plan: "PRO",
      leadsLimit: 5000,
    },
  });

  // Create demo project
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "NYC Dentists Campaign",
      description: "Outreach campaign targeting dental practices in New York City",
    },
  });

  // Create demo businesses
  const businesses = [
    { name: "Bright Smile Dental", city: "New York", rating: 4.8, reviewCount: 245, websiteUrl: "https://example.com", phone: "(212) 555-0101" },
    { name: "Manhattan Family Dentistry", city: "New York", rating: 4.5, reviewCount: 180, websiteUrl: "https://example.com", phone: "(212) 555-0102" },
    { name: "Park Avenue Dental Care", city: "New York", rating: 4.9, reviewCount: 312, websiteUrl: "https://example.com", phone: "(212) 555-0103" },
  ];

  for (const biz of businesses) {
    await prisma.business.create({
      data: {
        projectId: project.id,
        name: biz.name,
        city: biz.city,
        state: "NY",
        country: "US",
        rating: biz.rating,
        reviewCount: biz.reviewCount,
        websiteUrl: biz.websiteUrl,
        phone: biz.phone,
        businessType: "dentist",
        leadScore: 75,
        leadStatus: "NEW",
      },
    });
  }

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
