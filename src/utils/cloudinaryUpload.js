import * as FileSystem from 'expo-file-system';
import { CLOUDINARY_UPLOAD_URL, CLOUDINARY_CONFIG } from '../config/cloudinary';

const uploadToCloudinary = async (uri, folder = 'nadma') => {
  const fileName = `${Date.now()}_${uri.split('/').pop() || 'image.jpg'}`;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: JSON.stringify({
      file: `data:image/jpeg;base64,${base64}`,
      upload_preset: CLOUDINARY_CONFIG.uploadPreset,
      folder,
      public_id: fileName.replace(/\.[^/.]+$/, ''),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Upload failed');
  }

  return data.secure_url;
};

export const uploadCommunityImage = async (postId, uri) => {
  try {
    const url = await uploadToCloudinary(uri, 'nadma/community');
    return url;
  } catch (error) {
    console.error('uploadCommunityImage failed:', error?.message || error);
    return null;
  }
};

export const uploadImage = async (path, uri) => {
  try {
    const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : 'nadma';
    const url = await uploadToCloudinary(uri, folder);
    return url;
  } catch (error) {
    console.error('uploadImage failed:', error?.message || error);
    return null;
  }
};

export const uploadImageDetailed = async (path, uri) => {
  try {
    const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : 'nadma';
    const url = await uploadToCloudinary(uri, folder);
    return { success: true, url };
  } catch (error) {
    console.error('uploadImageDetailed failed:', error?.message || error);
    return { success: false, error: error.message || 'Upload failed' };
  }
};
