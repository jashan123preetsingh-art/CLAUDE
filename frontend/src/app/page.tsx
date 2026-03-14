"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="text-2xl font-bold text-primary-600">
              LeadForge AI
            </div>
            <div className="flex gap-4">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Find Leads. Generate Outreach.{" "}
            <span className="text-primary-600">Close Deals.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AI-powered lead generation platform that finds business contacts,
            writes personalized outreach, and automates your campaigns.
          </p>
          <Link
            href="/auth/register"
            className="inline-block px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 transition"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Generate Leads
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Business Search",
                desc: "Search Google Maps for businesses by niche and location. Get names, addresses, phones, websites, ratings, and reviews.",
              },
              {
                title: "Contact Extraction",
                desc: "Automatically crawl websites to find emails, phone numbers, contact forms, and social media profiles.",
              },
              {
                title: "AI Outreach",
                desc: "Generate personalized cold emails, Instagram DMs, LinkedIn messages, and contact form submissions using AI.",
              },
              {
                title: "Campaign Automation",
                desc: "Send bulk email campaigns with personalization, scheduling, follow-ups, and open/reply tracking.",
              },
              {
                title: "CRM Pipeline",
                desc: "Track leads through your pipeline: New, Contacted, Replied, Meeting Booked, and Closed.",
              },
              {
                title: "Lead Scoring",
                desc: "Automatic scoring from 0-100 based on website presence, reviews, social activity, and contact availability.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
              >
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Simple Pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$49",
                leads: "1,000",
                features: [
                  "1,000 leads/month",
                  "Basic outreach",
                  "CSV export",
                  "Email support",
                ],
              },
              {
                name: "Pro",
                price: "$99",
                leads: "5,000",
                popular: true,
                features: [
                  "5,000 leads/month",
                  "AI outreach generation",
                  "Campaign automation",
                  "Follow-up sequences",
                  "Priority support",
                ],
              },
              {
                name: "Agency",
                price: "$249",
                leads: "Unlimited",
                features: [
                  "Unlimited leads",
                  "Full CRM pipeline",
                  "Advanced analytics",
                  "API access",
                  "Zapier integration",
                  "Dedicated support",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-xl border-2 ${
                  plan.popular
                    ? "border-primary-600 shadow-lg"
                    : "border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="text-primary-600 text-sm font-semibold mb-2">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-gray-500 mt-1">{plan.leads} leads/month</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-gray-600">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`mt-8 block text-center py-3 rounded-lg font-semibold ${
                    plan.popular
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="text-2xl font-bold text-white mb-4">
            LeadForge AI
          </div>
          <p>AI-powered lead generation and outreach platform.</p>
          <p className="mt-4 text-sm">
            &copy; {new Date().getFullYear()} LeadForge AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
