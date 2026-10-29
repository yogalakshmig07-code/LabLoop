import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/db";

// Load environment variables from .env.local or .env
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("your-project-ref")) {
  console.error("================================================================================");
  console.error("❌ ERROR: Supabase environment variables missing or incomplete in .env.local");
  console.error("Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("================================================================================");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DEMO_PASSWORD = "Demo@1234";

interface DemoUserData {
  email: string;
  fullName: string;
  role: "admin" | "owner" | "manager" | "user";
  department: string;
  ownerVerified: boolean;
}

const DEMO_USERS: DemoUserData[] = [
  {
    email: "admin@labloop.demo",
    fullName: "Campus Resource Admin",
    role: "admin",
    department: "Academic Facilities & Central Administration",
    ownerVerified: true,
  },
  {
    email: "owner@labloop.demo",
    fullName: "Dr. Meera Iyer",
    role: "owner",
    department: "ECE Dept",
    ownerVerified: true,
  },
  {
    email: "manager@labloop.demo",
    fullName: "Arjun Lab Tech",
    role: "manager",
    department: "Makerspace & Prototyping Labs",
    ownerVerified: true,
  },
  {
    email: "student1@labloop.demo",
    fullName: "Priya S",
    role: "user",
    department: "Computer Science & Engineering",
    ownerVerified: false,
  },
  {
    email: "student2@labloop.demo",
    fullName: "Rahul K",
    role: "user",
    department: "Electrical Engineering",
    ownerVerified: false,
  },
  {
    email: "student3@labloop.demo",
    fullName: "Divya M",
    role: "user",
    department: "Mechanical Engineering",
    ownerVerified: false,
  },
];

async function seed() {
  console.log("🌱 Starting LabLoop seed script...");

  // 0. QUICK SCHEMA CONNECTIVITY TEST
  console.log("🔍 Checking database tables in public schema...");
  const { error: checkError } = await supabase.from("resources").select("id").limit(1);
  if (checkError && checkError.code === "PGRST205") {
    console.error("================================================================================");
    console.error("❌ ERROR: Supabase schema tables have not been created in the database yet!");
    console.error("PostgREST Error: Could not find table 'public.resources' in the schema cache.");
    console.error("");
    console.error("Please apply the database schema first:");
    console.error("  1. Open your Supabase Dashboard: https://supabase.com/dashboard");
    console.error("  2. Select your project -> SQL Editor -> New Query");
    console.error("  3. Paste the contents of supabase/migrations/20261028000000_initial_schema.sql (or supabase/schema.sql)");
    console.error("  4. Click 'Run'");
    console.error("  5. Then rerun: npm run seed");
    console.error("================================================================================");
    process.exit(1);
  }

  // 1. CLEANUP EXISTING DEMO USERS AND DATA
  console.log("🧹 Cleaning up existing demo data...");
  const { data: existingAuthUsers, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    console.error("Error listing auth users:", listError.message);
  } else if (existingAuthUsers?.users) {
    for (const u of existingAuthUsers.users) {
      if (u.email && u.email.endsWith("@labloop.demo")) {
        console.log(`Deleting existing demo user: ${u.email} (${u.id})`);
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delErr) {
          console.warn(`Warning deleting ${u.email}:`, delErr.message);
        }
      }
    }
  }

  // 2. CREATE DEMO USERS
  console.log("👥 Creating demo users with password 'Demo@1234'...");
  const userMap: Record<string, string> = {};

  for (const demoUser of DEMO_USERS) {
    let userId: string;

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: demoUser.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: demoUser.fullName,
        role: demoUser.role,
        department: demoUser.department,
        owner_verified: demoUser.ownerVerified,
      },
    });

    if (createError) {
      if (createError.message.includes("already been registered") || (createError as any).status === 422) {
        console.log(`  ℹ User ${demoUser.email} already registered in auth, reusing existing user...`);
        const { data: freshList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = freshList?.users.find((u) => u.email === demoUser.email);
        if (!existing) {
          throw createError;
        }
        userId = existing.id;
      } else {
        console.error(`Failed to create ${demoUser.email}:`, createError.message);
        throw createError;
      }
    } else {
      userId = newUser.user.id;
    }

    userMap[demoUser.email] = userId;
    console.log(`  ✓ Created/Identified ${demoUser.role.padEnd(7)}: ${demoUser.email} (${userId})`);

    // Ensure profile row matches accurately
    const { error: profErr } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: demoUser.fullName,
      email: demoUser.email,
      role: demoUser.role,
      department: demoUser.department,
      owner_verified: demoUser.ownerVerified,
      strikes: 0,
    });

    if (profErr) {
      console.error(`Failed to upsert profile for ${demoUser.email}:`, profErr.message);
      throw profErr;
    }
  }

  const ownerId = userMap["owner@labloop.demo"];
  const managerId = userMap["manager@labloop.demo"];
  const student1Id = userMap["student1@labloop.demo"];
  const student2Id = userMap["student2@labloop.demo"];
  const student3Id = userMap["student3@labloop.demo"];
  const adminId = userMap["admin@labloop.demo"];

  // Clean up any previous resources owned by this owner
  const { data: existingResources } = await supabase
    .from("resources")
    .select("id")
    .eq("owner_id", ownerId);

  if (existingResources && existingResources.length > 0) {
    const resIds = existingResources.map((r) => r.id);
    await supabase.from("resources").delete().in("id", resIds);
  }

  // 3. CREATE RESOURCES
  console.log("🏢 Seeding 8 campus resources owned by Dr. Meera Iyer...");
  const resourcesToCreate = [
    {
      key: "3d-printer",
      name: "3D Printer (Prusa MK4)",
      category: "equipment" as const,
      location: "Innovation Wing, FabLab Room 102",
      description: "High-precision FDM 3D printer equipped with 0.4mm nozzle, input shaping, and auto-bed leveling. Ideal for rapid prototyping and term projects.",
      image_path: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 6,
      buffer_minutes: 30,
      usage_rules: "Bring your own PLA filament or purchase spool at lab reception. Clean the PEI sheet after use with IPA. Do not leave unattended during the first 3 layers.",
      deposit_note: "No security deposit required for certified coursework students.",
    },
    {
      key: "oscilloscope",
      name: "Oscilloscope & RF Bench",
      category: "lab" as const,
      location: "ECE Signals & Systems Lab, Block B Room 304",
      description: "Keysight 4-channel 200MHz digital storage oscilloscope, arbitrary waveform generator, triple-output DC power supply, and high-frequency probes.",
      image_path: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 4,
      buffer_minutes: 15,
      usage_rules: "Always ground yourself with anti-static wrist strap before touching RF probes. Return all leads and clips to color-coded racks.",
      deposit_note: null,
    },
    {
      key: "camera-kit",
      name: "4K Cinema Camera Kit (Sony FX3)",
      category: "media" as const,
      location: "Media Production Center, Media Cage Desk",
      description: "Full-frame cinema kit with 24-70mm f/2.8 GM lens, dual wireless lavalier mics, 2x 160GB CFexpress cards, and heavy-duty fluid head tripod.",
      image_path: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 8,
      buffer_minutes: 30,
      usage_rules: "Check lens elements and sensors during checkout inspection. Never expose equipment to rain. Return in protective hardcase with batteries charged.",
      deposit_note: "Requires student ID card deposit and faculty sponsor signature.",
    },
    {
      key: "vr-kit",
      name: "VR Headset Kit (Meta Quest 3 Pro)",
      category: "equipment" as const,
      location: "Human-Computer Interaction Lab, CS Wing 204",
      description: "Mixed reality development headset with developer mode enabled, Link cable, facial interface sanitizing dock, and spatial mapping calibration markers.",
      image_path: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 3,
      buffer_minutes: 15,
      usage_rules: "Operate within marked 3m x 3m boundary zone only. Wipe facial foam with antibacterial wipes provided before returning.",
      deposit_note: null,
    },
    {
      key: "gpu-workstation",
      name: "GPU Compute Workstation (Dual RTX 4090)",
      category: "computing" as const,
      location: "AI & Data Science Cluster, Server Room 410",
      description: "High-performance compute node with 2x NVIDIA RTX 4090 24GB, 128GB RAM, AMD Threadripper, PyTorch/CUDA 12 pre-installed with Docker support.",
      image_path: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 12,
      buffer_minutes: 30,
      usage_rules: "No cryptocurrency mining or personal gaming. Long training jobs over 6 hours must be scheduled during overnight slots. Clear scratch disk upon completion.",
      deposit_note: null,
    },
    {
      key: "seminar-hall",
      name: "Seminar Hall B (Collaborative Lecture Space)",
      category: "room" as const,
      location: "Academic Block 1, Ground Floor",
      description: "60-seat auditorium equipped with 4K laser projector, dual wireless handheld microphones, lecture capture system, and motorized projection screen.",
      image_path: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 4,
      buffer_minutes: 30,
      usage_rules: "No food or unsealed beverages allowed inside. Switch off AV rack and air conditioning units upon departure.",
      deposit_note: null,
    },
    {
      key: "soldering-station",
      name: "Soldering & SMD Rework Station",
      category: "lab" as const,
      location: "Hardware Prototyping Workshop, Table 4",
      description: "Hakko digital soldering station with precision temperature control, hot-air rework gun, active fume extractor, illuminated magnifying lamp, and PCB holder.",
      image_path: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: false,
      max_duration_hours: 3,
      buffer_minutes: 15,
      usage_rules: "Fume extractor must be running at all times while soldering. Wear safety glasses. Never leave heated iron unattended on workbench.",
      deposit_note: null,
    },
    {
      key: "drone-system",
      name: "Autonomous Surveillance Drone (DJI Matrice 300)",
      category: "equipment" as const,
      location: "Robotics Arena & Outdoor Flight Deck",
      description: "Industrial quadcopter with RTK positioning, thermal payload, and dual-operator ground station. Used for autonomous navigation and remote sensing research.",
      image_path: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=800&q=80",
      is_active: true,
      requires_supervision: true,
      max_duration_hours: 2,
      buffer_minutes: 45,
      usage_rules: "Requires certified faculty or lab manager supervision during all flight operations. Must file flight plan with campus security 24 hours prior.",
      deposit_note: "Requires department head clearance and lab deposit authorization.",
    },
  ];

  const resourceMap: Record<string, string> = {};

  for (const item of resourcesToCreate) {
    const { data: res, error: resError } = await supabase
      .from("resources")
      .insert({
        owner_id: ownerId,
        name: item.name,
        category: item.category,
        location: item.location,
        description: item.description,
        image_path: item.image_path,
        is_active: item.is_active,
        requires_supervision: item.requires_supervision,
        max_duration_hours: item.max_duration_hours,
        buffer_minutes: item.buffer_minutes,
        usage_rules: item.usage_rules,
        deposit_note: item.deposit_note,
      })
      .select("id")
      .single();

    if (resError) {
      console.error(`Failed to create resource ${item.name}:`, resError.message);
      throw resError;
    }

    resourceMap[item.key] = res.id;
    console.log(`  ✓ Resource created: ${item.name} (${res.id})`);

    // Assign manager to every resource
    await supabase.from("resource_managers").insert({
      resource_id: res.id,
      user_id: managerId,
    });

    // Add availability windows Mon-Sat (days 1-6) 09:00 - 17:00
    for (let day = 1; day <= 6; day++) {
      await supabase.from("availability_windows").insert({
        resource_id: res.id,
        day_of_week: day,
        start_time: "09:00:00",
        end_time: "17:00:00",
      });
    }
  }

  // 4. RESOURCE REQUIREMENTS
  console.log("📜 Adding resource safety training requirements...");
  await supabase.from("resource_requirements").insert([
    {
      resource_id: resourceMap["3d-printer"],
      credential_type: "3D Printer Safety Training",
      description: "Certified completion of FabLab 3D printing slicing and hardware safety induction.",
    },
    {
      resource_id: resourceMap["drone-system"],
      credential_type: "Drone Pilot Authorisation",
      description: "Campus DGCA-aligned drone operator safety certification and outdoor flight protocol clearance.",
    },
    {
      resource_id: resourceMap["soldering-station"],
      credential_type: "Lab Safety Induction",
      description: "General electrical safety, fire prevention, and toxic fume avoidance protocol.",
    },
    {
      resource_id: resourceMap["oscilloscope"],
      credential_type: "Lab Safety Induction",
      description: "General hardware laboratory safety training.",
    },
    {
      resource_id: resourceMap["gpu-workstation"],
      credential_type: "Lab Safety Induction",
      description: "Server cluster access and workload safety training.",
    },
  ]);

  // 5. CREDENTIALS
  console.log("🎓 Seeding student credentials...");
  const pastVerifiedDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const nextYearDate = new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // student1: verified "Lab Safety Induction" and "3D Printer Safety Training"
  await supabase.from("credentials").insert([
    {
      user_id: student1Id,
      credential_type: "Lab Safety Induction",
      status: "verified",
      verified_by: managerId,
      verified_at: pastVerifiedDate,
      expires_at: nextYearDate,
      note: "Completed in-person lab walkthrough and passed safety questionnaire with 100%.",
    },
    {
      user_id: student1Id,
      credential_type: "3D Printer Safety Training",
      status: "verified",
      verified_by: ownerId,
      verified_at: pastVerifiedDate,
      expires_at: nextYearDate,
      note: "Completed Prusa slicer tuning and bed-leveling certification.",
    },
  ]);

  // student2: verified "Lab Safety Induction" and pending "3D Printer Safety Training"
  await supabase.from("credentials").insert([
    {
      user_id: student2Id,
      credential_type: "Lab Safety Induction",
      status: "verified",
      verified_by: managerId,
      verified_at: pastVerifiedDate,
      expires_at: nextYearDate,
      note: "Standard undergraduate safety orientation completed.",
    },
    {
      user_id: student2Id,
      credential_type: "3D Printer Safety Training",
      status: "pending",
      file_path: "credentials/student2_prusa_training_submission.pdf",
      note: "Awaiting practical demonstration check with lab manager.",
    },
  ]);

  // student3 has none

  // 6. SAMPLE BOOKINGS IN DIFFERENT STATES
  console.log("📅 Creating demo bookings across various lifecycle stages...");
  const now = new Date();

  // Booking 1: Approved Upcoming (3D Printer by student1, tomorrow 10:00 to 13:00)
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(13, 0, 0, 0);

  const { data: b1, error: b1Err } = await supabase
    .from("bookings")
    .insert({
      resource_id: resourceMap["3d-printer"],
      user_id: student1Id,
      start_at: tomorrowStart.toISOString(),
      end_at: tomorrowEnd.toISOString(),
      purpose: "Printing chassis mounting brackets for Mechatronics Term Project",
      priority_tier: "coursework",
      status: "approved",
      decision_reason: "Prerequisite credential verified; priority coursework assignment.",
      decided_by: ownerId,
      decided_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      system_check: {
        eligibility: "passed",
        has_required_credentials: true,
        fairness_quota_hours_remaining: 5,
        no_conflicts: true,
      },
      rules_acknowledged: true,
    })
    .select("id")
    .single();

  if (b1Err) throw b1Err;

  await supabase.from("audit_log").insert({
    actor_id: ownerId,
    actor_name: "Dr. Meera Iyer",
    action: "BOOKING_APPROVED",
    entity_type: "booking",
    entity_id: b1.id,
    booking_id: b1.id,
    resource_id: resourceMap["3d-printer"],
    reason: "Approved based on valid safety credentials and coursework priority.",
    details: { start_at: tomorrowStart.toISOString(), end_at: tomorrowEnd.toISOString() },
  });

  // Booking 2: Waitlisted (3D Printer by student2, tomorrow 11:00 to 14:00 - overlaps b1)
  const waitlistStart = new Date(tomorrowStart);
  waitlistStart.setHours(11, 0, 0, 0);
  const waitlistEnd = new Date(tomorrowStart);
  waitlistEnd.setHours(14, 0, 0, 0);

  const { data: b2, error: b2Err } = await supabase
    .from("bookings")
    .insert({
      resource_id: resourceMap["3d-printer"],
      user_id: student2Id,
      start_at: waitlistStart.toISOString(),
      end_at: waitlistEnd.toISOString(),
      purpose: "Custom drone camera gimbal prototyping",
      priority_tier: "personal",
      status: "waitlisted",
      waitlist_rank: 1,
      decision_reason: "Resource occupied by higher priority coursework booking. Placed at waitlist rank 1.",
      system_check: {
        eligibility: "credentials_pending",
        overlap_conflict: true,
        conflicting_booking_id: b1.id,
      },
      rules_acknowledged: true,
    })
    .select("id")
    .single();

  if (b2Err) throw b2Err;

  await supabase.from("audit_log").insert({
    actor_id: student2Id,
    actor_name: "Rahul K",
    action: "BOOKING_WAITLISTED",
    entity_type: "booking",
    entity_id: b2.id,
    booking_id: b2.id,
    resource_id: resourceMap["3d-printer"],
    reason: "Waitlisted due to overlapping approved reservation.",
    details: { waitlist_rank: 1 },
  });

  // Booking 3: Returned with condition reports (4K Camera Kit by student1, 3 days ago)
  const threeDaysAgoStart = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  threeDaysAgoStart.setHours(9, 0, 0, 0);
  const threeDaysAgoEnd = new Date(threeDaysAgoStart);
  threeDaysAgoEnd.setHours(16, 0, 0, 0);

  const checkoutTime = new Date(threeDaysAgoStart.getTime() + 5 * 60 * 1000).toISOString();
  const returnTime = new Date(threeDaysAgoEnd.getTime() - 10 * 60 * 1000).toISOString();

  const { data: b3, error: b3Err } = await supabase
    .from("bookings")
    .insert({
      resource_id: resourceMap["camera-kit"],
      user_id: student1Id,
      start_at: threeDaysAgoStart.toISOString(),
      end_at: threeDaysAgoEnd.toISOString(),
      purpose: "Filming documentary on university electric mobility research lab",
      priority_tier: "research",
      status: "returned",
      decision_reason: "Approved for accredited lab research documentation.",
      decided_by: ownerId,
      decided_at: new Date(threeDaysAgoStart.getTime() - 24 * 3600 * 1000).toISOString(),
      checked_out_at: checkoutTime,
      returned_at: returnTime,
      rules_acknowledged: true,
      system_check: { eligibility: "passed" },
    })
    .select("id")
    .single();

  if (b3Err) throw b3Err;

  // Condition report: Checkout
  await supabase.from("condition_reports").insert({
    booking_id: b3.id,
    kind: "checkout",
    grade: "excellent",
    notes: "Camera sensor spotless, 24-70mm lens pristine, both batteries at 100% capacity.",
    checklist: { lens_clean: true, batteries_charged: true, sd_card_cleared: true, tripod_plate_present: true },
    photo_paths: ["condition-photos/b3_checkout_front.jpg"],
    recorded_by: managerId,
  });

  // Condition report: Return
  await supabase.from("condition_reports").insert({
    booking_id: b3.id,
    kind: "return",
    grade: "good",
    notes: "Returned clean and packed properly. Minor hairline scratch noticed on plastic lens hood.",
    checklist: { lens_clean: true, batteries_returned: true, sd_card_formatted: true, tripod_plate_present: true },
    photo_paths: ["condition-photos/b3_return_lenshood.jpg"],
    recorded_by: managerId,
  });

  await supabase.from("audit_log").insert({
    actor_id: managerId,
    actor_name: "Arjun Lab Tech",
    action: "BOOKING_RETURNED",
    entity_type: "booking",
    entity_id: b3.id,
    booking_id: b3.id,
    resource_id: resourceMap["camera-kit"],
    reason: "Equipment returned and post-use condition report completed.",
    details: { condition_grade: "good" },
  });

  // Resolved damage incident linked to Booking 3
  const { data: incident1, error: incErr } = await supabase
    .from("incidents")
    .insert({
      booking_id: b3.id,
      resource_id: resourceMap["camera-kit"],
      reported_by: managerId,
      incident_type: "damage",
      severity: "low",
      description: "Hairline superficial scratch on detachable plastic lens hood discovered during gear return inspection. Optics and mounting ring unaffected.",
      ai_summary: "Cosmetic wear on removable lens hood. Core optical and electronic components unharmed. Repair/replacement unnecessary.",
      status: "resolved",
      resolution: "User counselled on safe bag packing. Lab technician buffed the surface. Strike waived due to cosmetic-only nature and upfront disclosure.",
      resolved_by: ownerId,
      strike_applied: false,
      dispute_note: "Student explained the strap brushed against a zipper in the equipment case.",
    })
    .select("id")
    .single();

  if (incErr) throw incErr;

  await supabase.from("audit_log").insert({
    actor_id: ownerId,
    actor_name: "Dr. Meera Iyer",
    action: "INCIDENT_RESOLVED",
    entity_type: "incident",
    entity_id: incident1.id,
    booking_id: b3.id,
    resource_id: resourceMap["camera-kit"],
    reason: "Incident marked resolved with no strike penalty applied.",
    details: { incident_type: "damage", severity: "low", strike_applied: false },
  });

  // Booking 4: Checked out and past its end time (OVERDUE)
  // Yesterday 10:00 to 12:00, checked out at 10:02, returned_at is null!
  const yesterdayStart = new Date(now.getTime() - 24 * 3600 * 1000);
  yesterdayStart.setHours(10, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(12, 0, 0, 0);

  const { data: b4, error: b4Err } = await supabase
    .from("bookings")
    .insert({
      resource_id: resourceMap["soldering-station"],
      user_id: student2Id,
      start_at: yesterdayStart.toISOString(),
      end_at: yesterdayEnd.toISOString(),
      purpose: "Assembling power distributor board for Formula Student EV prototype",
      priority_tier: "coursework",
      status: "checked_out",
      decision_reason: "Induction verified; critical Formula Student electronics deadline.",
      decided_by: managerId,
      decided_at: yesterdayStart.toISOString(),
      checked_out_at: new Date(yesterdayStart.getTime() + 2 * 60 * 1000).toISOString(),
      returned_at: null, // Still out past end_at!
      rules_acknowledged: true,
      system_check: { eligibility: "passed", overdue_alert_triggered: true },
    })
    .select("id")
    .single();

  if (b4Err) throw b4Err;

  // Checkout report for b4
  await supabase.from("condition_reports").insert({
    booking_id: b4.id,
    kind: "checkout",
    grade: "good",
    notes: "Soldering tip tinned, safety goggles and brass wire sponge issued.",
    checklist: { tip_tinned: true, goggles_issued: true, exhaust_operational: true },
    photo_paths: [],
    recorded_by: managerId,
  });

  await supabase.from("audit_log").insert({
    actor_id: managerId,
    actor_name: "Arjun Lab Tech",
    action: "BOOKING_CHECKED_OUT",
    entity_type: "booking",
    entity_id: b4.id,
    booking_id: b4.id,
    resource_id: resourceMap["soldering-station"],
    reason: "Student checked in at lab desk, safety goggles verified.",
    details: { checked_out_at: new Date(yesterdayStart.getTime() + 2 * 60 * 1000).toISOString() },
  });

  // Automated overdue notification for student2
  await supabase.from("notifications").insert({
    user_id: student2Id,
    title: "⚠️ Overdue Resource Return Alert",
    body: "Your booking for Soldering & SMD Rework Station was scheduled to end at 12:00 PM yesterday. Please return the station tools immediately to avoid strikes.",
    link: `/bookings/${b4.id}`,
    is_read: false,
  });

  console.log("================================================================================");
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("Demo credentials created:");
  console.log("  - Admin:    admin@labloop.demo    / Demo@1234");
  console.log("  - Owner:    owner@labloop.demo    / Demo@1234 (Dr. Meera Iyer, ECE Dept)");
  console.log("  - Manager:  manager@labloop.demo  / Demo@1234 (Arjun Lab Tech)");
  console.log("  - Student 1: student1@labloop.demo / Demo@1234 (Priya S, all credentials verified)");
  console.log("  - Student 2: student2@labloop.demo / Demo@1234 (Rahul K, pending 3D cert, overdue booking)");
  console.log("  - Student 3: student3@labloop.demo / Demo@1234 (Divya M, no credentials)");
  console.log("================================================================================");
}

seed().catch((err) => {
  console.error("❌ Fatal error in seed script:", err);
  process.exit(1);
});
