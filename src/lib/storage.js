const CLOUD_NAME = 'dt5evuub1';
const UPLOAD_PRESET = 'signal_uploads';

export async function uploadFile(_path, file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url;
}
