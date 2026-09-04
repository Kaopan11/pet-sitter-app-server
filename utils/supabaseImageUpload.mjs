import supabase from "../repositories/supabase.mjs";

const PHOTOS_BUCKET = "photos";

/** อัปโหลดรูปไป Supabase storage — reuse pattern จาก sitter profile */
export async function uploadImageFile(file, folder, userId) {
  const filePath = `${folder}/${userId}-${Date.now()}-${file.originalname ?? "image"}`;

  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(data.path);

  return publicUrl;
}
