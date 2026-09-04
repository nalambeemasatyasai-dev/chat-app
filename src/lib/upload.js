const upload = async (file) => {
const CLOUD_NAME = "YOUR_CLOUDINARY_CLOUD_NAME";
const UPLOAD_PRESET = "YOUR_CLOUDINARY_UPLOAD_PRESET";

  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", UPLOAD_PRESET);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: data,
      }
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error?.message || "Upload failed");
    }

    return result.secure_url;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export default upload;