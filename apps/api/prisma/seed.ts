import "dotenv/config";
import argon2 from "argon2";
import { Prisma, PrismaClient, Role, SocialProvider, TicketKind, VendorTransactionStatus, VipVerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const hashPassword = (password: string) =>
  argon2.hash(`${password}${process.env.PASSWORD_PEPPER ?? "dev-pepper"}`, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

async function upsertUser(email: string, fullName: string, role: Role) {
  const passwordHash = await hashPassword("VelvetRope123!");
  return prisma.user.upsert({
    where: { email },
    update: {
      role,
      emailVerifiedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      profile: {
        upsert: {
          create: { fullName, city: "Accra", country: "Ghana" },
          update: { fullName, city: "Accra", country: "Ghana" }
        }
      }
    },
    create: {
      email,
      passwordHash,
      role,
      emailVerifiedAt: new Date(),
      profile: { create: { fullName, city: "Accra", country: "Ghana" } }
    },
    include: { profile: true }
  });
}

async function category(name: string, slug: string) {
  return prisma.eventCategory.upsert({
    where: { slug },
    update: { name },
    create: { name, slug, description: `${name} events curated for premium guests.` }
  });
}

function addDays(days: number, hour = 19) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function upsertEvent(input: {
  organizerId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  bannerUrl: string;
  venueName: string;
  address: string;
  city?: string;
  startsAt: Date;
  endsAt: Date;
  isPrivate?: boolean;
  isSeries?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  popularityScore?: number;
}) {
  const event = await prisma.event.upsert({
    where: { slug: input.slug },
    update: {
      title: input.title,
      description: input.description,
      bannerUrl: input.bannerUrl,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "PUBLISHED",
      isPrivate: input.isPrivate ?? false,
      isSeries: input.isSeries ?? false,
      isFeatured: input.isFeatured ?? false,
      isPopular: input.isPopular ?? false,
      popularityScore: input.popularityScore ?? 0
    },
    create: {
      organizerId: input.organizerId,
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      bannerUrl: input.bannerUrl,
      venueName: input.venueName,
      address: input.address,
      city: input.city ?? "Accra",
      country: "Ghana",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "PUBLISHED",
      isPrivate: input.isPrivate ?? false,
      isSeries: input.isSeries ?? false,
      isFeatured: input.isFeatured ?? false,
      isPopular: input.isPopular ?? false,
      popularityScore: input.popularityScore ?? 0
    }
  });

  const existingTypes = await prisma.ticketType.count({ where: { eventId: event.id } });
  if (!existingTypes) {
    await prisma.ticketType.createMany({
      data: [
        { eventId: event.id, name: "Regular", kind: TicketKind.REGULAR, price: 120, currency: "GHS", quantity: 250, soldQuantity: input.isPopular ? 55 : 0 },
        { eventId: event.id, name: "VIP", kind: TicketKind.VIP, price: 350, currency: "GHS", quantity: 90, soldQuantity: input.isPopular ? 24 : 0 },
        { eventId: event.id, name: "VVIP Table", kind: TicketKind.TABLE, price: 2500, currency: "GHS", quantity: 16, soldQuantity: input.isPopular ? 5 : 0 }
      ],
      skipDuplicates: true
    });
  }

  return event;
}

async function main() {
  const music = await category("Music", "music");
  const conference = await category("Conference", "conference");
  const nightlife = await category("Nightlife", "nightlife");
  const food = await category("Food", "food");
  const fashion = await category("Fashion", "fashion");
  const corporate = await category("Corporate", "corporate");

  const demoUsers = {
    guest: await upsertUser("guest@velvetrope.app", "Guest Demo", Role.GUEST),
    attendee: await upsertUser("attendee@velvetrope.app", "Kwame Addo", Role.ATTENDEE),
    organizer: await upsertUser("organizer@velvetrope.app", "Amina Mensah", Role.ORGANIZER),
    staff: await upsertUser("staff@velvetrope.app", "Nana Owusu", Role.STAFF),
    vendor: await upsertUser("vendor@velvetrope.app", "Esi Catering", Role.VENDOR),
    admin: await upsertUser("admin@velvetrope.app", "Velvet Admin", Role.ADMIN),
    superAdmin: await upsertUser("superadmin@velvetrope.app", "Super Admin", Role.SUPER_ADMIN)
  };

  const organizer = demoUsers.organizer;

  await upsertUser("organizer@velvetrope.test", "Amina Mensah", Role.ORGANIZER);
  await upsertUser("attendee@velvetrope.test", "Kwame Addo", Role.ATTENDEE);
  await upsertUser("staff@velvetrope.test", "Nana Owusu", Role.STAFF);
  await upsertUser("admin@velvetrope.test", "Velvet Admin", Role.SUPER_ADMIN);

  const liveStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const liveEnd = new Date(Date.now() + 5 * 60 * 60 * 1000);

  const events = await Promise.all([
    upsertEvent({
      organizerId: organizer.id,
      categoryId: music.id,
      title: "Jess Flow Live Sessions",
      slug: "jess-flow-live-sessions",
      description: "A live music and creator showcase with tiered tickets, fast QR entry, and a polished guest list experience.",
      bannerUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80",
      venueName: "Republic Hall",
      address: "Osu Oxford Street",
      startsAt: liveStart,
      endsAt: liveEnd,
      isFeatured: true,
      isPopular: true,
      popularityScore: 240
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: nightlife.id,
      title: "Velvet Friday",
      slug: "velvet-friday",
      description: "A polished nightlife event with guest list management, vendors, and fast gate validation.",
      bannerUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1400&q=80",
      venueName: "Cantonments Social Club",
      address: "Fourth Avenue",
      startsAt: liveStart,
      endsAt: liveEnd,
      isPopular: true,
      popularityScore: 210
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: conference.id,
      title: "Founder Rooms Accra",
      slug: "founder-rooms-accra",
      description: "A private founder dinner series with controlled invites, assigned tables, and premium networking.",
      bannerUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1400&q=80",
      venueName: "Labadi Conference Centre",
      address: "Beach Road",
      startsAt: addDays(1, 17),
      endsAt: addDays(1, 23),
      isFeatured: true,
      isSeries: true,
      popularityScore: 120
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: music.id,
      title: "Accra Skyline Gala",
      slug: "accra-skyline-gala-2026",
      description: "A premium rooftop music and networking experience with curated tables, private invitations, and express QR entry.",
      bannerUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=80",
      venueName: "The Alto Rooftop",
      address: "Independence Avenue",
      startsAt: addDays(7, 19),
      endsAt: addDays(8, 2),
      isPopular: true,
      popularityScore: 190
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: food.id,
      title: "Chef's Table Noir",
      slug: "chefs-table-noir",
      description: "A culinary ticketed dinner with vendor coordination, guest preferences, and VIP table assignments.",
      bannerUrl: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1400&q=80",
      venueName: "The Gallery Kitchen",
      address: "Airport Residential",
      startsAt: addDays(2, 18),
      endsAt: addDays(2, 22),
      popularityScore: 90
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: fashion.id,
      title: "Studio 1957 Runway",
      slug: "studio-1957-runway",
      description: "A fashion show with controlled seating, influencer invitations, vendor lists, and QR admissions.",
      bannerUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1400&q=80",
      venueName: "National Theatre",
      address: "Liberia Road",
      startsAt: addDays(5, 19),
      endsAt: addDays(5, 22),
      isPopular: true,
      popularityScore: 165
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: corporate.id,
      title: "Product Leaders Summit",
      slug: "product-leaders-summit",
      description: "A professional conference for product teams with multi-day passes, check-ins, vendors, and analytics.",
      bannerUrl: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1400&q=80",
      venueName: "Kempinski Gold Coast",
      address: "Gamel Abdul Nasser Avenue",
      startsAt: addDays(10, 9),
      endsAt: addDays(11, 17),
      isSeries: true,
      popularityScore: 80
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: nightlife.id,
      title: "Moonlight Members Club",
      slug: "moonlight-members-club",
      description: "An invite-forward members night with discreet admissions, table purchases, and staff scanner controls.",
      bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
      venueName: "The Vault",
      address: "East Legon",
      startsAt: addDays(14, 21),
      endsAt: addDays(15, 3),
      popularityScore: 70
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: conference.id,
      title: "Creators Commerce Day",
      slug: "creators-commerce-day",
      description: "A creator business event with ticket bundles, partner vendors, workshops, and sales analytics.",
      bannerUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
      venueName: "Impact Hub Accra",
      address: "F 393/4 Otswe Street",
      startsAt: addDays(3, 10),
      endsAt: addDays(3, 17),
      popularityScore: 105
    }),
    upsertEvent({
      organizerId: organizer.id,
      categoryId: music.id,
      title: "Sunday Soul Garden",
      slug: "sunday-soul-garden",
      description: "An outdoor live set with relaxed premium seating, food vendors, and mobile-first ticket entry.",
      bannerUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80",
      venueName: "Legon Botanical Gardens",
      address: "Haatso",
      startsAt: addDays(6, 16),
      endsAt: addDays(6, 21),
      popularityScore: 95
    })
  ]);

  await prisma.vendor.upsert({
    where: { userId: demoUsers.vendor.id },
    update: {
      eventId: events[0]?.id,
      businessName: "Esi's Premium Catering",
      category: "Catering",
      description: "Premium food and beverage vendor for VIP tables.",
      phone: "+233 24 000 0000",
      email: demoUsers.vendor.email,
      rating: 4.8
    },
    create: {
      userId: demoUsers.vendor.id,
      eventId: events[0]?.id,
      businessName: "Esi's Premium Catering",
      category: "Catering",
      description: "Premium food and beverage vendor for VIP tables.",
      phone: "+233 24 000 0000",
      email: demoUsers.vendor.email,
      rating: 4.8
    }
  });

  for (const event of events.slice(0, 5)) {
    await prisma.staffPermission.upsert({
      where: { userId_eventId: { userId: demoUsers.staff.id, eventId: event.id } },
      update: {
        canScanTickets: true,
        canManageGuests: true,
        canViewRevenue: false,
        canManageVendors: false
      },
      create: {
        userId: demoUsers.staff.id,
        eventId: event.id,
        canScanTickets: true,
        canManageGuests: true,
        canViewRevenue: false,
        canManageVendors: false
      }
    });
  }

  const tableEvent = events[0];
  if (tableEvent) {
    const regularTicketType = await prisma.ticketType.findFirst({ where: { eventId: tableEvent.id, kind: TicketKind.VIP } });
    if (regularTicketType) {
      const order = await prisma.order.upsert({
        where: { reference: "DEMO-ORDER-ATTENDEE" },
        update: {
          userId: demoUsers.attendee.id,
          eventId: tableEvent.id,
          ticketTypeId: regularTicketType.id,
          quantity: 1,
          amount: regularTicketType.price,
          currency: regularTicketType.currency,
          status: "PAID"
        },
        create: {
          userId: demoUsers.attendee.id,
          eventId: tableEvent.id,
          ticketTypeId: regularTicketType.id,
          reference: "DEMO-ORDER-ATTENDEE",
          quantity: 1,
          amount: regularTicketType.price,
          currency: regularTicketType.currency,
          status: "PAID"
        }
      });
      await prisma.payment.upsert({
        where: { reference: order.reference },
        update: { status: "SUCCESS", amount: regularTicketType.price, currency: regularTicketType.currency, verifiedAt: new Date() },
        create: {
          orderId: order.id,
          eventId: tableEvent.id,
          provider: "PAYSTACK",
          reference: order.reference,
          amount: regularTicketType.price,
          currency: regularTicketType.currency,
          status: "SUCCESS",
          verifiedAt: new Date()
        }
      });
      const ticket = await prisma.ticket.upsert({
        where: { code: "DEMO-TICKET-ATTENDEE" },
        update: {
          userId: demoUsers.attendee.id,
          eventId: tableEvent.id,
          ticketTypeId: regularTicketType.id,
          orderId: order.id,
          status: "ACTIVE",
          usedAt: null
        },
        create: {
          userId: demoUsers.attendee.id,
          eventId: tableEvent.id,
          ticketTypeId: regularTicketType.id,
          orderId: order.id,
          code: "DEMO-TICKET-ATTENDEE",
          qrCodePayload: "velvet-rope-demo:attendee:vip:active"
        }
      });
      await prisma.nfcCredential.upsert({
        where: { ticketId: ticket.id },
        update: { eventId: tableEvent.id, userId: demoUsers.attendee.id, token: "nfc_demo_attendee_vip", active: true },
        create: { ticketId: ticket.id, eventId: tableEvent.id, userId: demoUsers.attendee.id, token: "nfc_demo_attendee_vip", label: "Demo VIP wristband" }
      });
      await prisma.ticketType.update({ where: { id: regularTicketType.id }, data: { soldQuantity: Math.max(regularTicketType.soldQuantity, 25) } });
    }

    const table = await prisma.table.upsert({
      where: { eventId_name: { eventId: tableEvent.id, name: "VIP Table A" } },
      update: { capacity: 8, zone: "Front Row" },
      create: { eventId: tableEvent.id, name: "VIP Table A", capacity: 8, zone: "Front Row" }
    });

    await Promise.all(
      Array.from({ length: 8 }, async (_, index) => {
        const label = `A${index + 1}`;
        const ticket = label === "A1" ? await prisma.ticket.findUnique({ where: { code: "DEMO-TICKET-ATTENDEE" } }) : null;
        return prisma.seat.upsert({
          where: { eventId_label: { eventId: tableEvent.id, label } },
          update: { tableId: table.id, status: ticket ? "ASSIGNED" : "AVAILABLE", ticketId: ticket?.id ?? null },
          create: { eventId: tableEvent.id, tableId: table.id, label, status: ticket ? "ASSIGNED" : "AVAILABLE", ticketId: ticket?.id }
        });
      })
    );

    await prisma.invitation.deleteMany({
      where: {
        eventId: tableEvent.id,
        email: { in: [demoUsers.attendee.email, "friend@velvetrope.app"] }
      }
    });
    await prisma.invitation.createMany({
      data: [
        {
          eventId: tableEvent.id,
          inviteeId: demoUsers.attendee.id,
          sentById: organizer.id,
          email: demoUsers.attendee.email,
          recipientName: demoUsers.attendee.profile?.fullName ?? "Kwame Addo",
          message: "You are invited to the live demo event.",
          token: "demo-invite-attendee",
          status: "PENDING",
          expiresAt: addDays(14, 23)
        },
        {
          eventId: tableEvent.id,
          sentById: organizer.id,
          email: "friend@velvetrope.app",
          recipientName: "Demo Friend",
          message: "Join us for a VIP-style entry experience.",
          token: "demo-invite-friend",
          status: "PENDING",
          expiresAt: addDays(14, 23)
        }
      ]
    });
  }

  const notificationUserIds = Object.values(demoUsers).map((user) => user.id);
  await prisma.notification.deleteMany({ where: { userId: { in: notificationUserIds } } });
  await prisma.notification.createMany({
    data: [
      { userId: demoUsers.attendee.id, title: "Welcome to Velvet Rope", body: "Browse events, buy tickets, and keep your QR passes ready." },
      { userId: demoUsers.organizer.id, title: "Organizer demo ready", body: "Your events, staff permissions, vendor, and VIP table are seeded." },
      { userId: demoUsers.staff.id, title: "Scanner access assigned", body: "You can validate QR tickets for selected demo events." },
      { userId: demoUsers.vendor.id, title: "Vendor profile active", body: "Your vendor profile is connected to the live demo event." },
      { userId: demoUsers.admin.id, title: "Admin demo access", body: "Use this account to review organizer-level routes." },
      { userId: demoUsers.superAdmin.id, title: "Super admin demo access", body: "Full platform demo account is verified and ready." }
    ]
  });

  const socialAccounts = [
    { userId: demoUsers.attendee.id, provider: SocialProvider.X, handle: "kwamevip", displayName: "Kwame Addo", followerCount: 12800, vipStatus: VipVerificationStatus.VERIFIED },
    { userId: demoUsers.attendee.id, provider: SocialProvider.LINKEDIN, handle: "kwame-addo", displayName: "Kwame Addo", followerCount: 3400, vipStatus: VipVerificationStatus.UNVERIFIED },
    { userId: demoUsers.guest.id, provider: SocialProvider.FACEBOOK, handle: "demo.guest", displayName: "Demo Guest", followerCount: 900, vipStatus: VipVerificationStatus.UNVERIFIED },
    { userId: demoUsers.organizer.id, provider: SocialProvider.X, handle: "velvetamina", displayName: "Amina Mensah", followerCount: 24500, vipStatus: VipVerificationStatus.VERIFIED }
  ];
  for (const account of socialAccounts) {
    await prisma.socialAccount.upsert({
      where: { provider_handle: { provider: account.provider, handle: account.handle } },
      update: { userId: account.userId, displayName: account.displayName, followerCount: account.followerCount, vipStatus: account.vipStatus, verifiedAt: account.vipStatus === VipVerificationStatus.VERIFIED ? new Date() : null },
      create: { ...account, verifiedAt: account.vipStatus === VipVerificationStatus.VERIFIED ? new Date() : undefined }
    });
  }

  await prisma.socialConnection.upsert({
    where: { userId_friendUserId_provider: { userId: demoUsers.attendee.id, friendUserId: demoUsers.guest.id, provider: SocialProvider.FACEBOOK } },
    update: {},
    create: { userId: demoUsers.attendee.id, friendUserId: demoUsers.guest.id, provider: SocialProvider.FACEBOOK }
  });
  await prisma.socialConnection.upsert({
    where: { userId_friendUserId_provider: { userId: demoUsers.attendee.id, friendUserId: demoUsers.organizer.id, provider: SocialProvider.LINKEDIN } },
    update: {},
    create: { userId: demoUsers.attendee.id, friendUserId: demoUsers.organizer.id, provider: SocialProvider.LINKEDIN }
  });

  if (events[0]) {
    const guestTicketType = await prisma.ticketType.findFirst({ where: { eventId: events[0].id, kind: TicketKind.REGULAR } });
    if (guestTicketType) {
      const guestOrder = await prisma.order.upsert({
        where: { reference: "DEMO-ORDER-GUEST-FRIEND" },
        update: { userId: demoUsers.guest.id, eventId: events[0].id, ticketTypeId: guestTicketType.id, quantity: 1, amount: guestTicketType.price, currency: guestTicketType.currency, status: "PAID" },
        create: { userId: demoUsers.guest.id, eventId: events[0].id, ticketTypeId: guestTicketType.id, reference: "DEMO-ORDER-GUEST-FRIEND", quantity: 1, amount: guestTicketType.price, currency: guestTicketType.currency, status: "PAID" }
      });
      await prisma.ticket.upsert({
        where: { code: "DEMO-TICKET-FRIEND" },
        update: { userId: demoUsers.guest.id, eventId: events[0].id, ticketTypeId: guestTicketType.id, orderId: guestOrder.id, status: "ACTIVE", usedAt: null },
        create: { userId: demoUsers.guest.id, eventId: events[0].id, ticketTypeId: guestTicketType.id, orderId: guestOrder.id, code: "DEMO-TICKET-FRIEND", qrCodePayload: "velvet-rope-demo:friend:regular:active" }
      });
    }
  }

  await prisma.socialMention.deleteMany({ where: { eventId: { in: events.map((event) => event.id) } } });
  await prisma.socialMention.createMany({
    data: events.slice(0, 5).flatMap((event, index) => [
      {
        eventId: event.id,
        provider: SocialProvider.X,
        hashtag: "#VelvetRope",
        authorHandle: index % 2 ? "accraevents" : "kwamevip",
        content: `${event.title} is picking up strong VIP entry buzz.`,
        reach: 12000 + index * 2300,
        engagement: 930 + index * 140,
        sentiment: "positive",
        postedAt: addDays(-index, 12)
      },
      {
        eventId: event.id,
        provider: SocialProvider.INSTAGRAM,
        hashtag: "#AccraEvents",
        authorHandle: index % 2 ? "nightlifeaccra" : "cityculture",
        content: `Guests are saving seats and tables for ${event.title}.`,
        reach: 8400 + index * 1800,
        engagement: 620 + index * 110,
        sentiment: "positive",
        postedAt: addDays(-index, 14)
      }
    ])
  });

  const vendor = await prisma.vendor.findUnique({ where: { userId: demoUsers.vendor.id } });
  if (vendor && events[0]) {
    await prisma.vendorTransaction.upsert({
      where: { reference: "VTX-DEMO-PAID" },
      update: { eventId: events[0].id, vendorId: vendor.id, attendeeId: demoUsers.attendee.id, amount: new Prisma.Decimal(180), currency: "GHS", status: VendorTransactionStatus.PAID, paidAt: new Date() },
      create: { eventId: events[0].id, vendorId: vendor.id, attendeeId: demoUsers.attendee.id, reference: "VTX-DEMO-PAID", description: "VIP table refreshments", amount: new Prisma.Decimal(180), currency: "GHS", status: VendorTransactionStatus.PAID, paidAt: new Date() }
    });
    await prisma.vendorTransaction.upsert({
      where: { reference: "VTX-DEMO-PENDING" },
      update: { eventId: events[0].id, vendorId: vendor.id, attendeeId: demoUsers.guest.id, amount: new Prisma.Decimal(75), currency: "GHS", status: VendorTransactionStatus.PENDING, paidAt: null },
      create: { eventId: events[0].id, vendorId: vendor.id, attendeeId: demoUsers.guest.id, reference: "VTX-DEMO-PENDING", description: "Food voucher", amount: new Prisma.Decimal(75), currency: "GHS", status: VendorTransactionStatus.PENDING }
    });
  }

  await prisma.eventMessage.deleteMany({ where: { eventId: { in: events.map((event) => event.id) } } });
  if (events[0]) {
    await prisma.eventMessage.createMany({
      data: [
        { eventId: events[0].id, senderId: organizer.id, audience: "STAFF", subject: "Gate briefing", body: "Use QR first, NFC fallback for VIP wristbands, and escalate duplicate scans." },
        { eventId: events[0].id, senderId: organizer.id, audience: "VENDORS", subject: "Vendor settlement window", body: "Confirm in-event transactions before 11 PM for same-night reconciliation." },
        { eventId: events[0].id, senderId: organizer.id, audience: "ALL", subject: "VIP table flow", body: "Direct table guests to Front Row after validation." }
      ]
    });
  }

  await prisma.vipVerification.deleteMany({ where: { userId: { in: [demoUsers.attendee.id, demoUsers.organizer.id] } } });
  const attendeeX = await prisma.socialAccount.findUnique({ where: { provider_handle: { provider: SocialProvider.X, handle: "kwamevip" } } });
  if (attendeeX) {
    await prisma.vipVerification.create({
      data: {
        userId: demoUsers.attendee.id,
        socialAccountId: attendeeX.id,
        provider: SocialProvider.X,
        handle: attendeeX.handle,
        status: VipVerificationStatus.VERIFIED,
        reviewerNote: "Demo X influencer account verified.",
        reviewedAt: new Date()
      }
    });
  }

  const eventsWithoutTickets = await prisma.event.findMany({
    where: { ticketTypes: { none: {} }, status: "PUBLISHED" },
    select: { id: true }
  });
  for (const event of eventsWithoutTickets) {
    await prisma.ticketType.createMany({
      data: [
        { eventId: event.id, name: "Regular", kind: TicketKind.REGULAR, price: 100, currency: "GHS", quantity: 200 },
        { eventId: event.id, name: "VIP", kind: TicketKind.VIP, price: 300, currency: "GHS", quantity: 80 },
        { eventId: event.id, name: "Table", kind: TicketKind.TABLE, price: 1800, currency: "GHS", quantity: 12 }
      ]
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
