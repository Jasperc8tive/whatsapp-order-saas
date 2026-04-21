import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${user.id}/${timestamp}-${random}.${ext}`;

    // Ensure the bucket exists and is public (uses service-role to manage buckets)
    const admin = createAdminClient();
    const { data: existingBuckets } = await admin.storage.listBuckets();
    const bucketExists = existingBuckets?.some((b) => b.name === "product-images");
    if (!bucketExists) {
      await admin.storage.createBucket("product-images", { public: true });
    } else {
      // Make sure it is public in case it was created as private
      await admin.storage.updateBucket("product-images", { public: true });
    }

    // Upload to Supabase storage
    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { message: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data } = admin.storage
      .from("product-images")
      .getPublicUrl(filename);

    return NextResponse.json({ imageUrl: data.publicUrl });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
