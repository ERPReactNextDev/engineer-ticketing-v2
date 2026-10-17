import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string || "job-documents";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: folder,
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
      overwrite: true,
    });

    return NextResponse.json({
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      resource_type: uploadResult.resource_type,
      original_filename: uploadResult.original_filename,
    });
  } catch (error: any) {
    console.error("PDF UPLOAD ERROR:", error);
    return NextResponse.json(
      { error: "Upload failed", message: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
