import Link from "next/link";
import VideoCard from "@/components/VideoCard";

export const metadata = { title: "Onboarding - WhatsOrder" };

const videoTutorials = [
  {
    title: "WhatsOrder Complete Walkthrough",
    description: "Start here: A 10-minute overview of every major feature and how they work together.",
    duration: "10 min",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    topics: ["Overview", "Setup", "Dashboard"],
  },
  {
    title: "Managing Orders & Status",
    description: "Learn how to create, update, and track orders through the Kanban board.",
    duration: "5 min",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    topics: ["Orders", "Status Tracking", "Workflow"],
  },
  {
    title: "Setting Up Products & Pricing",
    description: "Add products to your catalog and configure pricing for storefront orders.",
    duration: "4 min",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    topics: ["Products", "Pricing", "Catalog"],
  },
  {
    title: "Team Roles & Permissions",
    description: "Invite staff and delivery managers, and manage who can do what in your workspace.",
    duration: "5 min",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    topics: ["Team", "Permissions", "Collaboration"],
  },
  {
    title: "Delivery Operations & Assignment",
    description: "Assign orders to delivery managers and track real-time delivery status.",
    duration: "6 min",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    topics: ["Delivery", "Assignment", "Tracking"],
  },
  {
    title: "Public Storefront & Payments",
    description: "Set up your customer-facing storefront and integrate payment collection.",
    duration: "7 min",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    topics: ["Storefront", "Payments", "Customers"],
  },
];

const setupSteps = [
  {
    title: "Complete your business settings",
    description:
      "Set your business name, storefront slug, and WhatsApp number so customers can place orders correctly.",
    href: "/dashboard/settings",
    cta: "Open Settings",
  },
  {
    title: "Add products and prices",
    description:
      "Build your product catalog so AI capture and storefront orders can map to real items.",
    href: "/dashboard/products",
    cta: "Add Products",
  },
  {
    title: "Create your first customer order",
    description:
      "Use the Orders board to track order status from pending to delivered.",
    href: "/dashboard/orders",
    cta: "Go to Orders",
  },
  {
    title: "Invite your team",
    description:
      "Add staff and delivery managers so order assignment and operations can be shared.",
    href: "/dashboard/team",
    cta: "Manage Team",
  },
  {
    title: "Set up delivery workflow",
    description:
      "Assign orders to delivery managers and monitor handoff performance.",
    href: "/dashboard/delivery",
    cta: "Open Delivery Queue",
  },
];

const sections = [
  {
    name: "Overview",
    href: "/dashboard",
    purpose: "Snapshot of business performance.",
    features: [
      "Revenue and order KPI cards",
      "Recent orders feed",
      "Status distribution summary",
    ],
  },
  {
    name: "Orders",
    href: "/dashboard/orders",
    purpose: "Central board for order execution.",
    features: [
      "Kanban status tracking",
      "Order detail and status updates",
      "Assignment support for delivery workflow",
    ],
  },
  {
    name: "Products",
    href: "/dashboard/products",
    purpose: "Manage your sellable catalog.",
    features: [
      "Create and edit products",
      "Price management",
      "Enable or disable active listings",
    ],
  },
  {
    name: "Customers",
    href: "/dashboard/customers",
    purpose: "Keep customer records organized.",
    features: [
      "Customer list and contact details",
      "Repeat customer visibility",
      "Order relationship context",
    ],
  },
  {
    name: "Team",
    href: "/dashboard/team",
    purpose: "Collaborate with workspace roles.",
    features: [
      "Invite staff and delivery managers",
      "Role-based access management",
      "Member and invitation tracking",
    ],
  },
  {
    name: "AI Drafts",
    href: "/dashboard/drafts",
    proOnly: true,
    purpose: "Review AI-captured order drafts from inbound messages.",
    features: [
      "Pending review queue",
      "Approve to convert into real orders",
      "Reject drafts with review control",
    ],
  },
  {
    name: "AI Capture Settings",
    href: "/dashboard/settings/ai-capture",
    proOnly: true,
    purpose: "Tune AI parsing with product aliases and confidence routing.",
    features: [
      "Webhook AI capture setup",
      "Alias mapping for higher parse accuracy",
      "Review confidence threshold behavior",
    ],
  },
  {
    name: "Delivery Queue",
    href: "/dashboard/delivery",
    purpose: "Assign and monitor order dispatch workload.",
    features: [
      "Drag and drop assignment board",
      "Unassigned vs assigned queues",
      "Unassign and rebalance quickly",
    ],
  },
  {
    name: "Activity",
    href: "/dashboard/activity",
    purpose: "Operational audit timeline.",
    features: [
      "Live activity feed",
      "Filter by entity, action, and time window",
      "Visibility into assignment and workflow events",
    ],
  },
  {
    name: "Queue",
    href: "/dashboard/queue",
    purpose: "Background jobs reliability monitor.",
    features: [
      "Queued, running, failed, dead visibility",
      "Search and filter jobs",
      "Operational health checks",
    ],
  },
  {
    name: "Billing",
    href: "/dashboard/billing",
    purpose: "Subscription and usage management.",
    features: [
      "Current plan and usage meter",
      "Upgrade flow for higher limits",
      "Upgrade status and error reporting",
    ],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    purpose: "Workspace identity and storefront setup.",
    features: [
      "Business profile settings",
      "Storefront slug and public link setup",
      "WhatsApp number configuration",
    ],
  },
  {
    name: "Public Storefront",
    href: "/order/demo-store",
    purpose: "Customer-facing order entry experience.",
    features: [
      "Public ordering page",
      "Product selection and customer details capture",
      "Payment callback and status flow",
    ],
  },
];

import { getCurrentWorkspaceRole } from "@/lib/workspace";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import BillingHealthCheckClientEntry from "@/components/BillingHealthCheckClientEntry";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Real workspace owner check
  const role = await getCurrentWorkspaceRole(user.id);
  const isWorkspaceOwner = role === "owner";

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Billing health check at top of onboarding, only for owners */}
      {isWorkspaceOwner && (
        <div className="mb-4">
          <BillingHealthCheckClientEntry />
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-gray-900">WhatsOrder Onboarding</h1>
        <p className="text-sm text-gray-500 mt-2">
          Follow this guided setup to understand every section of the app and launch your operations quickly.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Video Tutorials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videoTutorials.map((video) => (
            <VideoCard
              key={video.title}
              title={video.title}
              description={video.description}
              duration={video.duration}
              videoUrl={video.videoUrl}
              topics={video.topics}
            />
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommended First-Day Setup</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {setupSteps.map((step, idx) => (
            <div key={step.title} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-xs font-semibold text-green-700 mb-1">Step {idx + 1}</p>
              <h3 className="font-semibold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{step.description}</p>
              <Link
                href={step.href}
                className="inline-block mt-3 text-sm font-medium text-green-700 hover:text-green-800"
              >
                {step.cta} -&gt;
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Section-by-Section Guide</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => (
            <article key={section.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    {section.name}
                    {(section as { proOnly?: boolean }).proOnly && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        Pro
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{section.purpose}</p>
                </div>
                <Link
                  href={section.href}
                  className="text-xs font-semibold text-green-700 whitespace-nowrap"
                >
                  Open
                </Link>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-700">
                {section.features.map((feature) => (
                  <li key={feature}>- {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-green-900">Launch Checklist</h2>
        <ul className="mt-3 space-y-1 text-sm text-green-900">
          <li>- Storefront link is configured and test order is successful</li>
          <li>- Product catalog has complete names and prices</li>
          <li>- Team roles are assigned correctly</li>
          <li>- Delivery queue is active for pending orders</li>
          <li>- Billing plan supports expected monthly volume</li>
        </ul>
      </section>
    </div>
  );
}
